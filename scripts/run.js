/*
    compile typescript, synthesize cdk, and provide an interface for easily
    setting up and tearing down local components and invoking lambda functions
    against them
*/

const cdk = require('@aws-cdk/core');
const app = new cdk.App();
const cp = require("child_process");

var readline = require('readline');
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

console.log('compiling typescript...');
cp.execSync('npm run build', {
    stdio: 'inherit'
});

console.log('using CDK to synthesize `template.yaml`...');
cp.execSync('AWS_LOCAL_DEV=true npm run synth-local', {
    stdio: 'inherit'
});

// this include must only be performed after the typescript has been compiled
const AwsLocalDevStack = require('../lib/aws-local-dev-stack').AwsLocalDevStack;
let stack = new AwsLocalDevStack(app, 'AwsLocalDevStack');

let commandList = [ '' ];

dynamodb = require('./dynamodb');
dynamodb.init(stack);
commandList.push.apply(commandList, dynamodb.commandList);

commandList.push.apply(commandList, [ 'exit / quit: end this program', '> ']);

// Allow user to enter commands, specifically to enable invoking lambda with sam
function prompt() {
    rl.question(commandList.join('\n'), promptHandler);
}
prompt();

function promptHandler(answer) {
    switch (answer){
        case 'ddb start':
            dynamodb.startDockerProcess(prompt);
            break;
        case 'ddb stop':
            dynamodb.stopDockerProcess(prompt);
            break;
        case 'ddb create tables':
            dynamodb.createTables(prompt);
            break;
        case 'ddb delete tables':
            dynamodb.deleteTables(prompt);
            break;
        case 'exit':
        case 'quit':
            dynamodb.stopDockerProcess(() => {});
            rl.close();
            process.exit(0);
        default:
            console.error('invalid command');
            prompt();
    }
}