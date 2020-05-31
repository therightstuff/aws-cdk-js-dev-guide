const aws = require(`aws-sdk`);
aws.config.update({
    region: 'eu-west-2', // default for localhost
    endpoint: "http://localhost:8000",
    accessKeyId: 'xxxx',
    secretAccessKey: 'xxxx'
});
const dynamodb = new aws.DynamoDB();

const cdk = require('@aws-cdk/core');
const app = new cdk.App();

const fs = require("fs");
const cp = require("child_process");
const yaml = require('js-yaml')

var readline = require('readline');
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function stripUnusedChars(str) {
    str = str.replace("-", "");
    str = str.replace("_", "");
    return str;
}

console.log('compiling typescript...');
cp.execSync('npm run build', {
    stdio: 'inherit'
});

// this include must be performed after the typescript has been compiled
const AwsLocalDevStack = require('../lib/aws-local-dev-stack').AwsLocalDevStack;

console.log('using CDK to synthesize `template.yaml`...');
cp.execSync('cdk synth --no-staging > template.yaml', {
    stdio: 'inherit'
});

// Retrieve table names
console.log("retrieving table names");
let stack = new AwsLocalDevStack(app, 'AwsLocalDevStack');
let tables = {};
for (let i in stack.node.children) {
    let child = stack.node.children[i];
    if (child.table) {
        tables[child.node._actualNode.id] = {};
    }
}

// Retrieve table definitions
console.log("retrieving table definitions...")
let template = yaml.safeLoadAll(fs.readFileSync('template.yaml'));
for (let key in template[0].Resources) {
    for (let tableName in tables) {
        let strippedName = stripUnusedChars(tableName);
        let strippedKey = key.substr(0, strippedName.length);
        if (strippedKey == strippedName) {
            tables[tableName] = template[0].Resources[key];
            tables[tableName].Properties.TableName = key;
            delete tables[tableName].Properties.TimeToLiveSpecification;
        }
    }
}

// Create tables using retrieved table definitions
function createTables(tables) {
    for (let key in tables) {
        let table = tables[key];

        dynamodb.createTable(table.Properties, function(err, data) {
            if (err) {
                console.error(`Unable to create table ${key}. Error JSON:`, JSON.stringify(err, null, 2));
            } else {
                console.log(`Created table ${key}. Table description JSON:`, JSON.stringify(data, null, 2));
            }
            prompt();
        });
    }
}

function deleteTables(tables) {
    for (let key in tables) {
        let table = tables[key];

        dynamodb.deleteTable({ TableName: table.Properties.TableName }, function(err, data) {
            if (err) {
                console.error(`Unable to delete table ${key}. Error JSON:`, JSON.stringify(err, null, 2));
            } else {
                console.log(`Deleted table ${key}. Table description JSON:`, JSON.stringify(data, null, 2));
            }
            prompt();
        });
    }
}

let ddbDocker = null;
function startDockerProcess() {
    // Spin up a docker instance of the DynamoDB in a separate process
    ddbDocker = cp.spawn('docker', ['run', '-p', '8000:8000', 'amazon/dynamodb-local']);
    ddbDocker.stdout.on('data', (data) => {
        console.log(`ddb stdout: ${data}`);
        prompt();
    });

    ddbDocker.stderr.on('data', (data) => {
        console.error(`ddb stderr: ${data}`);
    });

    ddbDocker.on('close', (code) => {
        console.log(`ddb docker child process exited with code ${code}`);
    });
}

// Allow user to enter commands, specifically to enable invoking lambda with sam
function prompt() {
    let commandList = [
        '',
        'dynamodb start: start docker instance',
        'dynamodb stop: stop docker instance',
        'create tables: create database tables defined by cdk output',
        'delete tables: delete database tables',
        'exit / quit: end this program',
        '> '
    ];
    rl.question(commandList.join('\n'), promptHandler);
}
prompt();

function promptHandler(answer) {
    switch (answer){
        case 'dynamodb start':
            startDockerProcess();
            break;
        case 'dynamodb stop':
            if (ddbDocker) {
                ddbDocker.kill();
                ddbDocker = null;
            } else {
                console.error('dynamodb not running');
            }
            prompt();
            break;
        case 'create tables':
            createTables(tables);
            break;
        case 'delete tables':
            deleteTables(tables);
            break;
        case 'exit':
        case 'quit':
            if (ddbDocker) {
                ddbDocker.kill();
            }
            rl.close();
            process.exit(0);
            break;
        default:
            console.error('invalid command');
            prompt();
    }
}