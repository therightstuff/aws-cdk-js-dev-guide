# AWS CDK Javascript Dev Guide

This project is a template that's intended to serve as a guide for working with
CDK in TypeScript / Javascript.

## History

This was initially an attempt to create a simple way to define, build, test and
deploy AWS projects using CDK and SAM. In spite of my discovering that SAM is
extremely limited and doesn't integrate well with CDK
[by design](https://github.com/awslabs/aws-sam-cli/issues/1911), it was only
after I started trying to integrate lambda layers that it became clear that
testing "locally" with SAM means only one thing: deploying everything to the
cloud and then invoking lambdas locally against the cloud infrastructure. Once
everything's in the cloud already, I can't see much utility in testing locally -
it's simpler and safer to deploy a separate stack for testing.

The only real way to test locally would be to recreate the invoked lambda's
context manually, which has proved too costly for too little benefit. If you're
interested in seeing my efforts in that direction, I've left the
`feature/adding-lambdas` branch up for reference (although that's only partial,
the functional code for actually running the lambdas in a separate project and
I'm not sure it's worth bringing in here - shoot me a message if you're really
interested).

## Tooling setup for AWS development

### Preamble

It is valuable and necessary to go through the following steps to familiarize
yourself with the tools.

- create programmatic user in IAM with admin permissions
- if you're using visual studio code (recommended), [configure aws toolkit](https://docs.aws.amazon.com/toolkit-for-vscode/latest/userguide/setup-toolkit.html)
- set up credentials with the profile id "default"
- get 12 digit account id from My Account in console
- follow [the CDK hello world tutorial](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#hello_world_tutorial)

### Tool Versions

CDK, like SAM, tends to be updated frequently with breaking changes. Prior to
committing changes, please ensure that you are using the latest versions and
that everything is building and running correctly.

### CDK Initialization

The first step to creating a CDK project is initializing it with `cdk init app`
(eg. `cdk init app --language typescript`), and a CDK project cannot be
initialized if the project directory isn't empty. If you would like to use an
existing project (like this one) as a template, bear in mind that you will have
to rename the stack in multiple locations and it would probably be safer and
easier to create a new project and copy and paste in the bits you need
(estimated time: 20-30 minutes if you're not familiar with the project
structure).

To be able to run the build scripts, execute the following command:

```bash
npm install --save eslint fs-extra
```

Copy the following as-is to your new project:

```text
- /aws-cdk-js-dev-guide
|- `.eslintc`
|- `.gitignore`
|- `.npmignore`
|- `build-layers.js`
|- `tsconfig.json`
|- `/lib`
    |- `regions.json`
    |- `stages.json`
```

Additionally, you will need to copy the npm script definitions from
`package.json` and the `bin/aws-cdk-js-dev-guide.ts` (with the stack name
modified to match your new project).

### Useful commands

- `npm run build`   build layers and compile typescript to js
- `npm run synth`   perform build steps then synthesize the CloudFormation
                    template(s)
- `cdk deploy`      deploy this stack to your default AWS account/region
- `cdk diff`        compare deployed stack with current state

### Stack definition

The stack definition is located in the `/lib` folder, this is where the stack
is configured for deployment.

See [AWS CDK API documentation](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-construct-library.html) for reference.

#### Tagging apps and stacks for cost reporting

Tagging can be used for multiple purposes, but it's particularly useful in
isolating costs per app / stack.

The example `bin/aws-cdk-js-dev-guide.ts` demonstrates tag configuration for an
entire app as well as its individual stacks. Please note that in order to
enable tag filtering in the cost explorer,
[tags must be individually activated](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/activating-tags.html).

#### Cloudwatch Logging and Metric Filters

API Gateway access logging can be configured, but it appears that lambda
logging cannot be redirected to a custom log group so the name of a lambda's
log group will be automatically generated.

Otherwise, Cloudwatch log event filtering and querying is quite robust, see
[the documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/FilterAndPatternSyntax.html).

Custom Cloudwatch metrics can be quite expensive (each dimension on a metric is
counted as its own metric for billing purposes), but it is possible to simulate
metrics using [Metric Filters](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/MonitoringPolicyExamples.html).


#### API Gateway Stages

I have deliberately ignored API Gateway's stage functionality in favour of
manually configuring an entire stack as a stage. Without staging specifications
the API's default to `prod`, if you want to specify something else then follow
this example:

```javascript
const dynamodbApi = new RestApi(this, 'dynamodb-api', {
    deployOptions: {
        stageName: 'prod'
    }
});
```

#### Lambda Functions

Lambda functions are defined in the `handlers` directory, and include the
following samples:

- `simple`: a stateless function
- `layer`: a function that uses packages in a lambda layer
- `dynamodb`: a function with handlers for storing and retrieving data
  - NOTE: `timeToLiveAttribute` has been used in the example to set a TTL on
    test data. Remove this attribute for persistent data.

Lambda functions MUST return responses in the following format:

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

To create a layer, simply add a `<layer name>` folder in the `layers/src`
directory that includes a `package.json` file. When the `npm run build` command
is run, the packages are installed and the layer archive is produced and copied
into the `layers/build` directory.

WARNING: A lambda function can use a maximum of 5 layers and be a maximum of
250MB unzipped.

##### Custom Lambda Layer Modules

To include a custom module in a layer, simply add it to a subfolder under the
appropriate layer's `src` folder and it will be copied into the layer's build
directory. Once the layer has been linked to a lambda function, it can then be
accessed by including it from `/opt/nodejs/<module>`.

While there's no problem with storing your layer's custom modules in its root,
eg. `layers/src/sample-layer/utils.js`, if the layer is used in conjunction
with other layers the modules may be unexpectedly overwritten:

> Your function can access the content of the layer during execution in the
> /opt directory. Layers are applied in the order that's specified, merging any
> folders with the same name. If the same file appears in multiple layers, the
> version in the last applied layer is used.

To prevent this from happening, it's recommended to put custom modules in a
subfolder with the same name as the layer eg.
`layers/src/sample-layer/sample-layer/utils.js`. Not only does this prevent
overwriting, but referencing the modules from your lambda functions becomes
clearer as `require('/opt/nodejs/utils')` becomes
`require('/opt/nodejs/sample-layer/utils')`.

#### API Gateway Integrations

When you create a `RestApi` object, the `.root` resource defaults to `/prod/`.
You can add HTTP method handlers to the root, or add resource objects and add
method handlers to those. To add a resource parameter, simply add a resource
enclosed in curly braces (`{}`) and this will be accessible in the `event`
object as `event.pathParameters`.

Querystring parameters will be available in the `event` object as
`event.queryStringParameters`.

NOTE: it is not possible to rename a path parameter, as cdk will attempt to
deploy the new resource before removing the old one and it cannot deploy two
resources with the same path structure. The workaround suggested on
[the serverless issue thread](https://github.com/serverless/serverless/issues/3785)
is to comment out the resource definition, deploy, then uncomment it and deploy
again.

##### CORS

CORS support can be configured on a single resource, or on a resource and all
of its children.

In order for CORS to be allowed it must be enabled on a RestApi resource AND
the appropriate headers must be returned by the lambda function it calls.

`lib/aws-cdk-js-dev-guide-stack.ts`:

```javascript
// Enable CORS for all resources of an api
const api = new RestApi(this, 'api-name', {
    defaultCorsPreflightOptions: {
        // array containing an origin, or Cors.ALL_ORIGINS
        allowOrigins: [ corsOrigin ],
        // array of methods eg. [ 'OPTIONS', 'GET', 'POST', 'PUT', 'DELETE' ]
        allowMethods: Cors.ALL_METHODS,
    }
});

// OR

// Enable CORS for a specific api resource
const api2 = new RestApi(this, 'api2-name');
api2Objects = api2.root.addResource('objects');
api2Objects.addCorsPreflight({
    // array containing an origin, or Cors.ALL_ORIGINS
    allowOrigins: [ corsOrigin ],
    // array of methods eg. [ 'OPTIONS', 'GET', 'POST', 'PUT', 'DELETE' ]
    allowMethods: Cors.ALL_METHODS,
});
```

`handlers/myhandler/index.js`:

```javascript
resolve({
    "isBase64Encoded": false,
    "statusCode": 200,
    "headers": {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
        'Access-Control-Allow-Credentials': true,
    },
    "body": JSON.stringify({ "success": true })
});
```

NOTE: This project defines an origin per stack in the `lib/stages.json` file,
which requires a modification to the `AwsStack` signature. This is not a CDK
requirement, you should configure it in any way that suits your purposes.

For more details see [https://docs.aws.amazon.com/cdk/api/latest/docs/aws-apigateway-readme.html](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-apigateway-readme.html)
and [https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-apigateway.CorsOptions.html](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-apigateway.CorsOptions.html).

### Deployment

By default, CDK deploys stacks that are
[environment-agnostic](https://docs.aws.amazon.com/cdk/latest/guide/environments.html).
To enable environment-agnostic deployments, run `cdk bootstrap` before
`cdk deploy`, but configuring specific regions is probably the safer practice.

To deploy to specific regions, update the `bin/regions.json` file with the
desired region and account numbers.

An example for stack configuration has been provided in `lib/stages.json`.

To deploy a stack, `cdk deploy <stack name>` (wildcards are supported).

If you don't want to review each set of changes, use the
`--require-approval=never` option (not recommended).

The `Outputs` displayed at the end of the process include the API Gateway
endpoints. These can be used as-is for the example lambda functions.

### Redeploying a Stack

One of the great advantages of using CDK is that updating a stack is as simple
as running the `cdk deploy <stack name>` again.

### Debugging

Testing a lambda function via the API Gateway interface is unlikely to report
useful error details. If a function is not behaving correctly or is failing, go
to your CloudWatch dashboard and find the log group for the function.

### Deleting a Stack

If for whatever reason you decide you want to delete a stack in its entirety,
install the
[AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
and run
`aws cloudformation delete-stack --stack-name <stack name> --region <region name>`.
