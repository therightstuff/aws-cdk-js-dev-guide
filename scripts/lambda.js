const aws = require(`aws-sdk`);
const cp = require("child_process");
const fs = require("fs");
const yaml = require('js-yaml')

let functions = {};

function stripUnusedChars(str) {
    str = str.replace("-", "");
    str = str.replace("_", "");
    return str;
}

const exportable = {
    commandList: [
        'lambda:'
    ],
    init: (stack) => {
        console.log("retrieving function names");
        for (let i in stack.node.children) {
            let child = stack.node.children[i];
            if (child.functionName) {
                functions[child.node._actualNode.id] = {};
            }
        }

        console.log(functions);

        console.log("retrieving function definitions...")
        let template = yaml.safeLoadAll(fs.readFileSync('template.yaml'));
        for (let key in template[0].Resources) {
            for (let functionName in functions) {
                let strippedName = stripUnusedChars(functionName);
                let strippedKey = key.substr(0, key.length - 8);
                if (strippedKey == strippedName) {
                    functions[functionName] = template[0].Resources[key];
                    functions[functionName].Properties.FunctionName = key;

                }
            }
        }
    }, // init
    startDockerProcess: (prompt) => {
        if (ddbDocker) {
            console.error('dynamodb already running');
            return prompt();
        }
        // Spin up a docker instance of the DynamoDB in a separate process
        ddbDocker = cp.spawn('docker', ['run', '--name', ddbDockerName, '--rm', '-p', '8000:8000', 'amazon/dynamodb-local']);
        ddbDocker.stdout.on('data', (data) => {
            console.log(`ddb stdout: ${data}`);
            prompt();
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
    },
    stopDockerProcess: (prompt) => {
        if (ddbDocker) {
            cp.execSync(`docker rm -f ${ddbDockerName}`);
            ddbDocker = null;
        } else {
            console.error('dynamodb not running');
        }
        prompt();
    },
    createTables: (prompt) => {
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
    },
    deleteTables: (prompt) => {
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
};

module.exports = exportable;