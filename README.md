# aws-local-dev

Based on [this excellent tutorial](https://sanderknape.com/2019/05/building-serverless-applications-aws-cdk/), this is a work in progress - please contribute if you can!

TODO Add build script should add versions eg `cdk --version` and `sam --version` somewhere for tracking (this README?)

## Tooling setup for local AWS development

### Preamble

It is worth going through the following guides to familiarize yourself with the tools:

- create programmatic user in IAM with admin permissions
- https://docs.aws.amazon.com/toolkit-for-vscode/latest/userguide/setup-toolkit.html
  - set up credentials with the profile id "default"
- follow cdk guide
  - get 12 digit account id from My Account in console
  - https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#hello_world_tutorial

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

TODO use `envs.json` to limit deployment regions?

## Local testing

### DynamoDB

To emulate DynamoDB locally using the CDK, run the vanilla node.js script `scripts/run-dynamodb.js`.

This will:

- Compile the TypeScript to Javascript
- Use CDK to synthesize the `template.yaml` file.
- Retrieve table definitions from `template.yaml`
- Prompt the user for instructions

The user can start or stop the local DynamoDB instance (running in a Docker container),
and create or delete the tables extracted from `template.yaml`. The DynamoDB container
will be closed automatically on exit.

### Lambda

sam: lambda env includes dynamodb url which is localhost
cdk:
