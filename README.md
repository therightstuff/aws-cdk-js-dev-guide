# AWS CDK Javascript Dev Guide

This project is a template that's intended to serve as a guide for working with CDK in TypeScript / Javascript.

## History

This was initially an attempt to create a simple way to define, build, test and deploy AWS projects using CDK and SAM. In spite of my discovering that SAM is extremely limited and doesn't integrate well with CDK [by design](https://github.com/awslabs/aws-sam-cli/issues/1911), it was only after I started trying to integrate lambda layers that it became clear that testing "locally" with SAM means only one thing: deploying everything to the cloud and then invoking lambdas locally against the cloud infrastructure. Once everything's in the cloud already, I can't see much utility in testing locally - it's simpler and safer to deploy a separate stack for testing.

The only real way to test locally would be to recreate the invoked lambda's context manually, which has proved too costly for too little benefit. If you're interested in seeing my efforts in that direction, I've left the `feature/adding-lambdas` branch up for reference.

## Tooling setup for local AWS development

### Preamble

It is worth going through the following guides to familiarize yourself with the tools:

- create programmatic user in IAM with admin permissions
- if you're using visual studio code (recommended), [configure aws toolkit](https://docs.aws.amazon.com/toolkit-for-vscode/latest/userguide/setup-toolkit.html)
- set up credentials with the profile id "default"
- get 12 digit account id from My Account in console
- follow [the CDK hello world tutorial](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#hello_world_tutorial)

### Tool Versions

CDK, like SAM, tends to be updated frequently with breaking changes. Prior to committing changes, please ensure that you are using the latest versions and that everything is building and running correctly.

### CDK Initialization

The first step to creating a CDK project is initializing it with `cdk init`, and a CDK project cannot be initialized if the project directory isn't empty. If you would like to use an existing project (like this one) as a template, bear in mind that you will have to rename the stack in multiple locations and it would probably be safer and easier to create a new project and copy/paste the bits you need from here.

The following is from the auto-generated CDK README:

```markdown
The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
```

### Stack definition

The stack definition is located in the `/lib` folder, this is where the stack is configured for deployment.

By default, CDK deploys stacks that are [environment-agnostic](https://docs.aws.amazon.com/cdk/latest/guide/environments.html). To deploy to specific regions, update the `bin/regions.json` file with the desired region and account numbers.

If this file does not contain any region specifications, the stack will be deployed as environment-agnostic.
