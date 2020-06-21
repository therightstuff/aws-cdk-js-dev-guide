# AWS CDK Javascript Dev Guide

This project is a template that's intended to serve as a guide for working with CDK in TypeScript / Javascript.

## History

This was initially an attempt to create a simple way to define, build, test and deploy AWS projects using CDK and SAM. In spite of my discovering that SAM is extremely limited and doesn't integrate well with CDK [by design](https://github.com/awslabs/aws-sam-cli/issues/1911), it was only after I started trying to integrate lambda layers that it became clear that testing "locally" with SAM means only one thing: deploying everything to the cloud and then invoking lambdas locally against the cloud infrastructure. Once everything's in the cloud already, I can't see much utility in testing locally - it's simpler and safer to deploy a separate stack for testing.

The only real way to test locally would be to recreate the invoked lambda's context manually, which has proved too costly for too little benefit. If you're interested in seeing my efforts in that direction, I've left the `feature/adding-lambdas` branch up for reference (although that's only partial, the functional code for actually running the lambdas in a separate project and I'm not sure it's worth bringing in here - ask me if you're really interested).

## Tooling setup for local AWS development

### Preamble

It is worth going through the following guides to familiarize yourself with the tools.

- create programmatic user in IAM with admin permissions
- if you're using visual studio code (recommended), [configure aws toolkit](https://docs.aws.amazon.com/toolkit-for-vscode/latest/userguide/setup-toolkit.html)
- set up credentials with the profile id "default"
- get 12 digit account id from My Account in console
- follow [the CDK hello world tutorial](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#hello_world_tutorial)

### Tool Versions

CDK, like SAM, tends to be updated frequently with breaking changes. Prior to committing changes, please ensure that you are using the latest versions and that everything is building and running correctly.

### CDK Initialization

The first step to creating a CDK project is initializing it with `cdk init`, and a CDK project cannot be initialized if the project directory isn't empty. If you would like to use an existing project (like this one) as a template, bear in mind that you will have to rename the stack in multiple locations and it would probably be safer and easier to create a new project and copy/paste the bits you need from here.

### Useful commands

- `npm run build`   build layers and compile typescript to js
- `npm run watch`   watch for changes and compile
- `npm run test`    perform the jest unit tests
- `cdk deploy`      deploy this stack to your default AWS account/region
- `cdk diff`        compare deployed stack with current state
- `cdk synth`       emits the synthesized CloudFormation template(s)
- `npm run synth`   perform build steps then synthesize the CloudFormat template(s)

### Stack definition

The stack definition is located in the `/lib` folder, this is where the stack is configured for deployment.

#### API Gateway Stages

I have deliberately ignored API Gateway's stage functionality in favour of manually configuring an entire stack as a stage. Without staging specifications the API's default to `prod`, if you want to specify something else then follow this example:

```javascript
const dynamodbApi = new RestApi(this, 'dynamodb-api', {
    deployOptions: {
        stageName: 'prod'
    }
});
```

#### Lambda Functions

Lambda functions are defined in the `handlers`, and include the following samples:

- simple: a stateless function
- layer: a function that uses packages in a lambda layer
- documentdb: a function with handlers for storing and retrieving data
  - NOTE: `timeToLiveAttribute` has been used in the example to set a TTL on
    test data. Remove this attribute for persistent data.

If the lambda functions must return responses in the following format:

```javascript
{
    "isBase64Encoded": false,
    "statusCode": 200,
    "headers": {},
    "body": JSON.stringify({...})
}
```

#### Lambda Layers

Layers are composite packages that multiple lambda functions can reference.

To create a layer, simply add a `<layer name>` folder in the `layers/src` directory that includes a `package.json` file. When the `npm run build` command is run, the packages are installed and the layer archive is produced and copied into the `layers/build` directory.

### Deployment

By default, CDK deploys stacks that are [environment-agnostic](https://docs.aws.amazon.com/cdk/latest/guide/environments.html). To enable environment-agnostic deployments, run `cdk bootstrap` before `cdk deploy`, but configuring specific regions is probably the safer practice.

To deploy to specific regions, update the `bin/regions.json` file with the desired region and account numbers.

An example for stack configuration has been provided in `bin/aws-cdk-js-dev-guide.ts`.

To deploy a stack, `cdk deploy <stack name>` (wildcards are supported).

If you don't want to review each set of changes, use the `--require-approval=never` option.

The `Outputs` displayed at the end of the process include the API Gateway endpoints, but these are not complete. For example, if the endpoint for `AwsStack-dev.simpleapiEndpoint<hash>` is listed as `https://<hash>.execute-api.us-east-1.amazonaws.com/dev/`, you will need to make a GET request to `https://<hash>.execute-api.us-east-1.amazonaws.com/dev/simple-api`.

### Redeploying a Stack

One of the great advantages of using CDK is that updating a stack is as simple as running the `cdk deploy <stack name>` again.

### Deleting a Stack

If for whatever reason you decide you want to delete a stack in its entirety, install the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) and run `aws cloudformation delete-stack --stack-name <stack name>`.
