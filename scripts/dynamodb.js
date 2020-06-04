const aws = require(`aws-sdk`);
aws.config.update({
    region: 'eu-west-2', // default for localhost
    endpoint: "http://localhost:8000",
    accessKeyId: 'xxxx',
    secretAccessKey: 'xxxx'
});
const cp = require("child_process");
const dynamodb = new aws.DynamoDB();
const fs = require("fs");
const yaml = require('js-yaml')

const ddbDockerName = 'aws-local-dev_ddb';
let ddbDocker = null;
let tables = {};

function stripUnusedChars(str) {
    str = str.replace("-", "");
    str = str.replace("_", "");
    return str;
}

function startDockerProcess(next) {
    next = next || (() => {});
    if (ddbDocker) {
        console.error('dynamodb already running');
        return next();
    }
    // Spin up a docker instance of the DynamoDB in a separate process
    ddbDocker = cp.spawn('docker', ['run', '--name', ddbDockerName, '--rm', '-p', '8000:8000', 'amazon/dynamodb-local']);
    ddbDocker.stdout.on('data', (data) => {
        console.log(`ddb stdout: ${data}`);
        next();
    });

    ddbDocker.stderr.on('data', (data) => {
        console.error(`ddb stderr: ${data}`);
        // try to remove the docker container before quitting
        cp.execSync(`docker rm -f ${ddbDockerName}`);
        process.exit(0);
    });

    ddbDocker.on('close', (code) => {
        console.log(`ddb docker child process exited with code ${code}`);
    });
}

function stopDockerProcess(next) {
    next = next || (() => {});
    if (ddbDocker) {
        cp.execSync(`docker rm -f ${ddbDockerName}`);
        ddbDocker = null;
    } else {
        console.error('dynamodb not running');
    }
    next();
}

function createTables(next) {
    next = next || (() => {});
    for (let key in tables) {
        let table = tables[key];

        dynamodb.createTable(table.Properties, function(err, data) {
            if (err) {
                console.error(`Unable to create table ${key}. Error JSON:`, JSON.stringify(err, null, 2));
            } else {
                console.log(`Created table ${key}. Table description JSON:`, JSON.stringify(data, null, 2));
            }
            next();
        });
    }
}

function deleteTables(next) {
    next = next || (() => {});
    for (let key in tables) {
        let table = tables[key];

        dynamodb.deleteTable({ TableName: table.Properties.TableName }, function(err, data) {
            if (err) {
                console.error(`Unable to delete table ${key}. Error JSON:`, JSON.stringify(err, null, 2));
            } else {
                console.log(`Deleted table ${key}. Table description JSON:`, JSON.stringify(data, null, 2));
            }
            next();
        });
    }
}

const exportable = {
    commandList: [
        'start: start dynamodb docker instance',
        'stop: stop dynamodb docker instance',
        'create tables: create database tables defined by cdk output',
        'delete tables: delete database tables'
    ],
    command: (command, next) => {
        next = next || (() => {});
        switch(command) {
            case 'start':
                startDockerProcess(next);
                break;
            case 'stop':
                stopDockerProcess(next);
                break;
            case 'create tables':
                createTables(next);
                break;
            case 'delete tables':
                deleteTables(next);
                break;
            default:
                console.error('invalid command');
                next();
        }
    },
    shutdown: () => {
        stopDockerProcess(() => {});
    },
    init: (stack) => {
        console.log("retrieving table names...");
        for (let i in stack.node.children) {
            let child = stack.node.children[i];
            if (child.table) {
                tables[child.node._actualNode.id] = {};
            }
        }

        console.log("retrieving table definitions...")
        let template = yaml.safeLoadAll(fs.readFileSync('template.yaml'));
        for (let key in template[0].Resources) {
            for (let tableName in tables) {
                let strippedName = stripUnusedChars(tableName);
                let strippedKey = key.substr(0, key.length - 8);
                if (strippedKey == strippedName) {
                    tables[tableName] = template[0].Resources[key];
                    tables[tableName].Properties.TableName = key;
                    delete tables[tableName].Properties.TimeToLiveSpecification;
                }
            }
        }
    }
};

module.exports = exportable;