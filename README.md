# AWS CDK Javascript Dev Guide

This project is a template that's intended to serve as a guide for working with CDK in TypeScript / Javascript.

## History

This was initially an attempt to create a simple way to define, build, test and deploy AWS projects using CDK and SAM. In spite of my discovering that SAM is extremely limited and doesn't integrate well with CDK
[by design](https://github.com/awslabs/aws-sam-cli/issues/1911), it was only after I started trying to integrate lambda layers that it became clear that testing "locally" with SAM means only one thing: deploying everything to the cloud and then invoking lambdas locally against the cloud infrastructure. Once everything's in the cloud already, I can't see much utility in testing locally - it's simpler and safer to deploy a separate stack for testing.

The only real way to test locally would be to recreate the invoked lambda's context manually, which has proved too costly for too little benefit.

## Tooling setup for AWS development

### Preamble

It is valuable and necessary to go through the following steps to familiarize yourself with the tools.

- create a programmatic user in IAM with admin permissions
- if you're using [Visual Studio Code](https://code.visualstudio.com/) (recommended), [configure the AWS toolkit](https://docs.aws.amazon.com/toolkit-for-vscode/latest/userguide/setup-toolkit.html)
- set up credentials with the profile id "default"
- get the 12 digit account id from My Account in console
- follow [the CDK hello world tutorial](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#hello_world_tutorial)

### Tool Versions

CDK, like SAM, tends to be updated frequently - sometimes with breaking changes. Prior to committing changes, it's a good idea to ensure that you are using the latest versions and that everything is building and running correctly.

#### Upgrading from CDK v1

To upgrade from CDK v1, switch to the [feature/v1-v2-migration branch](https://github.com/therightstuff/aws-cdk-js-dev-guide/tree/feature/v1-v2-migration) which I will leave in place for you to be able to review the changes.

### CDK Initialization

The first step to creating a CDK project is to create a project folder and initialize it with `cdk init app` (eg. `cdk init app --language typescript`) - please note that a CDK project cannot be initialized if the project directory isn't empty. If you would like to use an existing project (like this one) as a template, bear in mind that you will have to rename the stack in multiple locations and it would probably be safer and easier to create a new project and copy and paste in the bits you need (estimated time: 20-30 minutes if you're not familiar with the project structure).

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
|- `/bin`
    |- `/load-sensitive-json.ts`
|- `build-layers.js`
|- `package-upgrade.js`
|- `tsconfig.json`
|- `/lib`
    |- `regions.json`
    |- `stages.json`
```

Additionally, you will need to copy the npm script definitions from `package.json`, the `bin/aws-cdk-js-dev-guide.ts` file (with the stack name modified to match your new project), and modify the signature of `lib/aws-cdk-js-dev-guide-stack.ts` to accept custom options.

### Useful commands

- `npm run build`   build layers and compile typescript to js
- `npm run synth`   perform build steps then synthesize the CloudFormation template(s)
- `cdk deploy`      deploy this stack to your default AWS account/region
- `cdk diff`        compare deployed stack with current state

### CDK Runtime Context

[CDK Runtime context](https://docs.aws.amazon.com/cdk/v2/guide/context.html) is cached to prevent unexpected changes. It is recommended to check in `cdk.context.json` to your repository, but you will find it *.gitignore*d in this one because it can include sensitive information.

**ENSURE THIS FILE IS CHECKED IN TO YOUR PRODUCTION REPOSITORIES!**

### Stack definition

The stack definition is located in the `lib` folder, this is where the stack is configured for deployment. This is just an example, stack configurations can be handled in a wide variety of ways; for TypeScript CDK projects they're used by the entry point in the `bin` folder.

See [AWS CDK API documentation](https://docs.aws.amazon.com/cdk/api/latest/guide/) (in particular, [the constructs library](https://docs.aws.amazon.com/cdk/api/v2/docs/constructs-readme.html)) for reference.

#### Sensitive data (using .env files)

While it's useful to set up stack customizations in the `/lib` folder, it's not a good idea to keep your sensitive secrets in those files as they're at risk of being accidentally checked in. As an alternative, it's recommended to use `dotenv`. `/bin/aws-cdk-js-dev-guide.ts` uses `/bin/load-sensitive-json.ts` to ingest the `/lib/regions.json` and replace anything surrounded by double braces with the value of the environment variable of the same name.

To get started, you can copy the `.env.template` file in the project root folder to `.env` and insert your AWS account number where specified.

#### Tagging apps and stacks for cost reporting

Tagging can be used for multiple purposes, but it's particularly useful in isolating costs per app / stack.

The example `bin/aws-cdk-js-dev-guide.ts` demonstrates tag configuration for an entire app as well as its individual stacks. Please note that in order to enable tag filtering in the cost explorer,
[tags must be individually activated](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/activating-tags.html).

#### Cloudwatch Logging and Metric Filters

API Gateway access logging can be configured, but it appears that lambda logging cannot be redirected to a custom log group so the name of a lambda's log group will be automatically generated.

Otherwise, Cloudwatch log event filtering and querying is quite robust, see [the documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/FilterAndPatternSyntax.html).

Custom Cloudwatch metrics can be quite expensive (each dimension on a metric is counted as its own metric for billing purposes), but it is possible to simulate metrics using [Metric Filters](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/MonitoringPolicyExamples.html).

#### API Gateway Log Permissions

For logging, API Gateway has a [single IAM role configured for all API Gateway APIs in a region](https://www.alexdebrie.com/posts/api-gateway-access-logs/#logging-iam-role), which means that removing any of your services in a region would silently disable logging for all the other services.

To circumvent this, it's recommended to always set `DeletionPolicy: Retain` to your API Gateway IAM roles.

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

Lambda functions are defined in the `handlers` directory, and include the following samples:

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

To create a layer, simply add a `<layer name>` folder in the `layers/src` directory that includes a `package.json` file. When the `npm run build` command is run, the packages are installed and the layer archive is produced and copied into the `layers/build` directory.

WARNING: A lambda function can use a maximum of 5 layers and be a maximum of 250MB unzipped.

##### Custom Lambda Layer Modules

To include a custom module in a layer, simply add it to a subfolder under the appropriate layer's `src` folder and it will be copied into the layer's build directory. Once the layer has been linked to a lambda function, it can then be accessed by including it from `/opt/nodejs/<module>`.

While there's no problem with storing your layer's custom modules in its root, eg. `layers/src/sample-layer/utils.js`, if the layer is used in conjunction with other layers the modules may be unexpectedly overwritten:

> Your function can access the content of the layer during execution in the
> /opt directory. Layers are applied in the order that's specified, merging any
> folders with the same name. If the same file appears in multiple layers, the
> version in the last applied layer is used.

To prevent this from happening, it's recommended to put custom modules in a subfolder with the same name as the layer eg. `layers/src/sample-layer/sample-layer/utils.js`. Not only does this prevent overwriting, but referencing the modules from your lambda functions becomes clearer as `require('/opt/nodejs/utils')` becomes `require('/opt/nodejs/sample-layer/utils')`.

#### API Gateway Integrations

When you create a `RestApi` object, the `.root` resource defaults to `/prod/`. You can add HTTP method handlers to the root, or add resource objects and add method handlers to those. To add a resource parameter, simply add a resource enclosed in curly braces (`{}`) and this will be accessible in the `event`
object as `event.pathParameters`.

Querystring parameters will be available in the `event` object as `event.queryStringParameters`.

NOTE: it is not possible to rename a path parameter, as CDK will attempt to deploy the new resource before removing the old one and it cannot deploy two resources with the same path structure. The workaround suggested on [the serverless issue thread](https://github.com/serverless/serverless/issues/3785) is to comment out the resource definition, deploy, then uncomment it and deploy again.

##### CORS

CORS support can be configured on a single resource, or on a resource and all of its children.

In order for CORS to be allowed it must be enabled on a RestApi resource AND the appropriate headers must be returned by the lambda function it calls.

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

NOTE: This project defines an origin per stack in the `lib/stages.json` file, which requires a modification to the `AwsStack` signature. This is not a CDK requirement, you should configure it in any way that suits your purposes.

For more details see [the API Gateway library documentation](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_apigateway-readme.html), and [the CORS documentation](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_apigateway.Cors.html) in particular.

#### Domains and Static Websites

##### Hosted Zone Management

While I'm sure it's possible to create the required hosted zone using CDK, I'm not sure one would want to considering the need to point one's domain name to the AWS nameservers. Configuring the hosted zone is relatively straightforward using the AWS console:

1. Open the AWS Console on the Route 53 service.
2. Select Hosted Zones and then Create Hosted Zone.
3. Enter your domain name (the naked domain eg. example.com) and select Public Hosted Zone.
4. Once created, select the hosted zone's NS record and copy the nameserver values to your domain configuration with your domain name registrar.

WARNING: If the domain is not configured correctly using the hosted zone's nameservers prior to deployment, the certificate will not be validated and there's a good chance the stack will require manual intervention to rollback the changes or delete it.

See [https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/CreatingHostedZone.html](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/CreatingHostedZone.html) for more details.

##### Certificate Stack Configuration

Certificates can only be hosted in the `us-east-1` region (N. Virginia), and the `DnsValidatedCertificate` construct I originally used has been deprecated in favor of the `Certificate` construct, which does not support specifying the certificate's region.

To set up a certificate for a stack that's hosted in a different region, you need to create a separate certificate stack and inject its hosted zone and certificate objects into your primary stacks.

##### Deploying a Certificate Stack

There is no need to explicitly deploy certificate stacks, as they will be direct dependencies of their respective primary stacks and will be deployed automatically along with them.

##### Multiple Projects Per Domain

Separate CDK projects in separate repositories are able to use a shared domain / hosted zone as long as there are no DNS record conflicts. For example, one project can create an A record for the naked domain (eg. [https://example.com](https://example.com)) and the second project can create a CNAME record for a subdomain (eg. [https://abc.example.com](https://abc.example.com)).

Each project must create its own certificates, and secondary projects (ie. projects that do not manage the A records) must always use the fully qualified domain name (FQDN) instead of the domain name.

### Deployment

By default, CDK deploys stacks that are [environment-agnostic](https://docs.aws.amazon.com/cdk/latest/guide/environments.html).
To enable environment-agnostic deployments, run `cdk bootstrap` before `cdk deploy`, but configuring specific regions is the safer practice.

**NOTE**: While environment-agnostic deployments are usually possible, there are certain constructs that are simply incompatible. See the `WrappedError` from the Hosted Zone lookup for an example of this.

To deploy to specific regions, update the `bin/regions.json` file with the desired region and account numbers.

An example for stack configuration has been provided in `lib/stages.json`.

To deploy a stack, `cdk deploy <stack name>` (wildcards are supported).

If you don't want to review each set of changes, use the `--require-approval=never` option (not recommended).

The `Outputs` displayed at the end of the process include the API Gateway endpoints. These can be used as-is for the example lambda functions.

### Redeploying a Stack

One of the great advantages of using CDK is that updating a stack is as simple as running the `cdk deploy <stack name>` again.

### Debugging

Testing a lambda function via the API Gateway interface is unlikely to report useful error details. If a function is not behaving correctly or is failing, go to your CloudWatch dashboard and find the log group for the function.

### Deleting a Stack

If for whatever reason you decide you want to delete a stack in its entirety, install the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) and run `aws cloudformation delete-stack --stack-name <stack name> --region <region name>`.
