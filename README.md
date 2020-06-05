# aws-local-dev

The AWS tools for local development are good, but extremely limited and don't integrate well [by design](https://github.com/awslabs/aws-sam-cli/issues/1911) (*WHY NOT?!?!*). This is an attempt to create a simple way to define, build, test and deploy AWS projects using both CDK and SAM.

Inspired by [this excellent tutorial](https://sanderknape.com/2019/05/building-serverless-applications-aws-cdk/), this is a work in progress - please contribute if you can!

## Tooling setup for local AWS development

### Preamble

It is worth going through the following guides to familiarize yourself with the tools:

- create programmatic user in IAM with admin permissions
- if you're using visual studio code (recommended), [configure aws toolkit](https://docs.aws.amazon.com/toolkit-for-vscode/latest/userguide/setup-toolkit.html)
- set up credentials with the profile id "default"
- get 12 digit account id from My Account in console
- follow [the CDK hello world tutorial](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#hello_world_tutorial)

### Tool Versions

The two main AWS packages in use, CDK and SAM, tend to be updated frequently with breaking changes. Prior to committing changes, please ensure that you are using the latest versions and that everything is building and running correctly.

### CDK Initialization

The first step to creating a CDK project is initializing it with `cdk init`, and a CDK project cannot be initialized if the project directory isn't empty. If you use an existing project (like this one) as a template, bear in mind that you will have to rename the stack in multiple locations. The following is from the auto-generated CDK README:

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

Region specifications will be ignored for local testing.

## Local testing

To compile typescript, synthesize cdk, and provide an interface for easily setting up and tearing down local components and invoking lambda functions against them, run `npm run test-local`.

### DynamoDB

The user can start or stop the local DynamoDB instance (running in a Docker container),
and create or delete the tables extracted from `template.yaml`. The DynamoDB container
will be closed automatically on exit.

### Lambda

Lambda functions can be invoked as follows:

- lambda function-name
- lambda function-name [sam options]

#### Environment variable overrides

SAM options include `--env-vars [path to JSON file]`, but in order for the JSON file to function it needs to reference the CDK-transformed function name. To facilitate this, there is a `test/env.template.json` file in which you can configure the environment variables using the function name (eg. `simple-function`), which will then be transformed into `test/env.json` as part of the setup when running `npm run test-local`.

**It is important to note that any variable not already defined in the CDK stack definition will not be visible to the locally-invoked function.**

If any environment variables are *not* included in `test/env.json` then the original CDK-defined values will be used.
