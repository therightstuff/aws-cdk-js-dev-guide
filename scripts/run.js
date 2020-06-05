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

console.log('compiling typescript and using CDK to synthesize `template.yaml`...');
cp.execSync('AWS_LOCAL_DEV=true npm run synth-local', {
    stdio: 'inherit'
});

// this include must only be performed after the typescript has been compiled
const AwsLocalDevStack = require('../lib/aws-local-dev-stack').AwsLocalDevStack;
let stack = new AwsLocalDevStack(app, 'AwsLocalDevStack');

let modules = {};
let commandList = [ '' ];
let commandFunctions = {};

function includeModule(path, key, label) {
    label = label || key;
    modules[key] = require(path);
    modules[key].init(stack);
    commandList.push(`${label}:`);
    commandList.push.apply(
        commandList,
        modules[key].commandList.map((c) => { return `${key} ` + c; })
    );
    commandFunctions[key] = modules[key].command;
}

includeModule('./dynamodb', 'ddb', 'dynamodb');
includeModule('./lambda', 'lambda');

commandList.push.apply(commandList, [ 'exit / quit: end this program', '> ']);

// allow user to enter commands, specifically to enable invoking lambda with sam
function prompt() {
    rl.question(commandList.join('\n'), promptHandler);
}
prompt();

function promptHandler(command) {
    // handle exit case first
    if (['exit', 'x', 'quit', 'q'].indexOf(command) > -1) {
        modules['ddb'].shutdown();
        rl.close();
        process.exit(0);
    }
    // first token is the module, the rest of the command is to be handled by that module
    let arr = command.split(" ");
    let commandKey = arr.splice(0, 1);
    command = arr.join(" ");
    if (commandFunctions[commandKey]) {
        commandFunctions[commandKey](command, prompt);
    } else {
        console.error('invalid command');
        prompt();
    }
}