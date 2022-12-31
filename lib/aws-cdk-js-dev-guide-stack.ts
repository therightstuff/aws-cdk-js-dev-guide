import { Duration, RemovalPolicy, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { AccessLogFormat, Cors, LambdaIntegration, LogGroupLogDestination, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { BackupPlan, BackupPlanRule, BackupResource } from 'aws-cdk-lib/aws-backup';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { CloudFrontWebDistribution, OriginProtocolPolicy, SecurityPolicyProtocol, SSLMethod } from 'aws-cdk-lib/aws-cloudfront';
import { AttributeType, BillingMode, ProjectionType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { Code, Function, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';

class WrappedError extends Error {
  cause: any;
  constructor(message: string, cause: any) {
    super(message);
    this.cause = cause;
    this.name = 'WrappedError';
  }
}

export class AwsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps, customOptions?: any) {
    super(scope, id, props);

    customOptions = customOptions || {};

    // configure backup plan, alternatively use defaults like BackupPlan.dailyWeeklyMonthly5YearRetention
    const createBackupPlan = false;
    if (createBackupPlan) {
      const backupPlan = new BackupPlan(this, `${id}-daily-weekly-monthly`);
      backupPlan.addRule(BackupPlanRule.daily());
      backupPlan.addRule(BackupPlanRule.weekly());
      backupPlan.addRule(BackupPlanRule.monthly1Year());
      backupPlan.addSelection('Selection', {
        resources: [
          //BackupResource.fromDynamoDbTable(myTable), // A specific DynamoDB table
          BackupResource.fromTag('stack-name', id), // All resources that are tagged stack-name=<id> in the region/account
        ]
      });
    }

    // set default CORS origin to ALL_ORIGINS
    const corsOrigin = customOptions.origin || "*";
    // make the stack's CORS origin available to lambdas as an environment variable
    let corsEnvironment = {
      CORS_ORIGIN: corsOrigin
    };

    // reusable RESTful API CORS options object
    let corsOptions = {
      allowOrigins: [ corsOrigin ], // array containing an origin, or Cors.ALL_ORIGINS
      allowMethods: Cors.ALL_METHODS, // array of methods eg. [ 'OPTIONS', 'GET', 'POST', 'PUT', 'DELETE' ]
    };

    // ************************************************************************
    // ************************ simple lambda function ************************
    // ************************************************************************

    const simpleFunction = new Function(this, 'simple-function', {
      runtime: Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: Code.fromAsset('./handlers/simple'),
      environment: {
        ...corsEnvironment,
        HELLO: "Hello",
        WORLD: "World"
      },
      timeout: Duration.seconds(2)
    });

    // simple REST api interface

    // configure log group for RestApi access logs
    const simpleFunctionAccessLogGroup = new LogGroup(this, 'simple-function-access-log-group', {
      logGroupName: `apigateway/${customOptions.stackName}-simple-function`,
      retention: 1 // retention in days
      // see https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-logs.LogGroup.html
    });

    // to enable CORS on all resources of the api, uncomment the line
    // beginning with defaultCorsPreflightOptions:
    const simpleApi = new RestApi(this, 'simple-api', {
      restApiName: 'Simple API sample',
      description: "Simple API sample with no dependencies",
      // defaultCorsPreflightOptions: corsOptions,
      deployOptions: {
        accessLogDestination: new LogGroupLogDestination(simpleFunctionAccessLogGroup),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields()
      }
    });

    // to enable CORS on just the root or any other specific resource,
    // uncomment the following line:
    // simpleApi.root.addCorsPreflight(corsOptions);

    simpleApi.root.addMethod('GET', new LambdaIntegration(
      simpleFunction,
      {
        requestTemplates: { "application/json": '{ "statusCode": "200" }' }
      }
    ));

    // ************************************************************************
    // ********************* layer definition and usage ***********************
    // ************************************************************************

    const layer = new LayerVersion(this, 'sample-layer', {
      // Code.fromAsset must reference the build folder
      code: Code.fromAsset('./layers/build/sample-layer'),
      compatibleRuntimes: [Runtime.NODEJS_16_X],
      license: 'MIT',
      description: 'A sample layer for the layer and dynamodb test functions',
    });

    // layer test function
    const layerFunction = new Function(this, 'layer-function', {
      runtime: Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: Code.fromAsset('./handlers/layer'),
      layers: [layer]
    });

    // layer api
    const layerApi = new RestApi(this, 'layer-api', {
      defaultCorsPreflightOptions: corsOptions
    });

    layerApi.root.addMethod('GET', new LambdaIntegration(layerFunction));

    // ************************************************************************
    // ****************** dynamodb table and functions ************************
    // ************************************************************************

    // If you're not already familiar with DynamoDB's reserved keywords, it's
    // worth checking your attribute names against
    // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html.
    // NOTE: remove timeToLiveAttribute if you don't want to set a TTL for the data
    const dynamodbTable = new Table(this, 'dynamodb-table', {
      partitionKey: { name: 'dataOwner', type: AttributeType.STRING },
      sortKey: { name: 'objectId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiration'
    });

    // Querying a DynamoDB table without knowing the partition key is not
    // possible without a Secondary Index, see
    // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/SecondaryIndexes.html
    // for more details.
    // NOTE: by default the projection type is set to ALL when it should
    // be set to the minimum number of fields required by the queries.
    const DDB_GSI_NAME = 'dynamodb-table-flip-index';
    dynamodbTable.addGlobalSecondaryIndex({
      indexName: DDB_GSI_NAME,
      projectionType: ProjectionType.KEYS_ONLY,
      partitionKey: { name: 'objectId', type: AttributeType.STRING },
    });

    const dynamodbGetFunction = new Function(this, 'dynamodb-function-get', {
      runtime: Runtime.NODEJS_16_X,
      handler: 'get.handler',
      code: Code.fromAsset('./handlers/dynamodb'),
      environment: {
        ...corsEnvironment,
        TABLE_NAME: dynamodbTable.tableName,
        DDB_GSI_NAME
      },
      layers: [layer]
    });

    dynamodbTable.grantReadData(dynamodbGetFunction);

    const dynamodbScanFunction = new Function(this, 'dynamodb-function-scan', {
      runtime: Runtime.NODEJS_16_X,
      handler: 'scan.handler',
      code: Code.fromAsset('./handlers/dynamodb'),
      environment: {
        ...corsEnvironment,
        TABLE_NAME: dynamodbTable.tableName
      },
      layers: [layer]
    });

    dynamodbTable.grantReadData(dynamodbScanFunction);
    // create reusable lambda integration
    let dynamodbScanFunctionIntegration = new LambdaIntegration(dynamodbScanFunction);

    const dynamodbCreateFunction = new Function(this, 'dynamodb-function-create', {
      runtime: Runtime.NODEJS_16_X,
      handler: 'create.handler',
      code: Code.fromAsset('./handlers/dynamodb'),
      environment: {
        ...corsEnvironment,
        TABLE_NAME: dynamodbTable.tableName
      },
      layers: [layer]
    });

    dynamodbTable.grantWriteData(dynamodbCreateFunction);

    const dynamodbUpdateFunction = new Function(this, 'dynamodb-function-update', {
      runtime: Runtime.NODEJS_16_X,
      handler: 'update.handler',
      code: Code.fromAsset('./handlers/dynamodb'),
      environment: {
        ...corsEnvironment,
        TABLE_NAME: dynamodbTable.tableName,
        DDB_GSI_NAME
      },
      layers: [layer]
    });

    // the update itself doesn't require read permissions, but we may need to query
    // the object using the global secondary index. see handlers/dynamodb/update.js
    dynamodbTable.grantReadData(dynamodbUpdateFunction);
    dynamodbTable.grantWriteData(dynamodbUpdateFunction);

    // dynamodb api
    const dynamodbApi = new RestApi(this, 'dynamodb-api', {
      defaultCorsPreflightOptions: corsOptions,
    });

    // /objects
    // https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/objects
    let apiObjects = dynamodbApi.root.addResource('objects');

    // GET /objects : list all objects
    apiObjects.addMethod('GET', dynamodbScanFunctionIntegration);
    // POST /objects : add a new object
    apiObjects.addMethod('POST', new LambdaIntegration(dynamodbCreateFunction));

    // objects/{id}
    let apiObjectsObject = apiObjects.addResource("{objectId}")

    // GET /objects/{id} : get object with specified id
    apiObjectsObject.addMethod('GET', new LambdaIntegration(dynamodbGetFunction));
    // PUT /objects/{id} : update object with specified id
    apiObjectsObject.addMethod('PUT', new LambdaIntegration(dynamodbUpdateFunction));

    // ************************************************************************
    // ******************** sqs queue and functions ***************************
    // ************************************************************************

    const sqsQueue = new Queue(this, 'sqs-queue');

    const queuePublishFunction = new Function(this, 'queue-function-publish', {
      runtime: Runtime.NODEJS_16_X,
      handler: 'index.publish',
      code: Code.fromAsset('./handlers/sqs'),
      environment: {
        ...corsEnvironment,
        QUEUE_URL: sqsQueue.queueUrl,
        TABLE_NAME: dynamodbTable.tableName
      },
      layers: [layer]
    });

    sqsQueue.grantSendMessages(queuePublishFunction);

    const queueSubscribeFunction = new Function(this, 'queue-function-subscribe', {
      runtime: Runtime.NODEJS_16_X,
      handler: 'index.subscribe',
      code: Code.fromAsset('./handlers/sqs'),
      environment: {
        QUEUE_URL: sqsQueue.queueUrl,
        TABLE_NAME: dynamodbTable.tableName
      },
      layers: [layer]
    });

    // WARNING: unlike the rest of the serverless resources, setting up an
    //          SQS queue event listener incurs costs even when there's no
    //          activity (something in the order of 50 cents/month). From
    //          https://aws.amazon.com/blogs/aws/aws-lambda-adds-amazon-simple-queue-service-to-supported-event-sources/
    //    "There are no additional charges for this feature, but because the
    //     Lambda service is continuously long-polling the SQS queue the
    //     account will be charged for those API calls at the standard SQS
    //     pricing rates."
    /* set up a queue event listener
    let queueEventSource = new SqsEventSource(sqsQueue, {
      batchSize: 10 // default
    });

    queueSubscribeFunction.addEventSource(queueEventSource);
    */

    dynamodbTable.grantWriteData(queueSubscribeFunction);

    // sqs api
    const sqsApi = new RestApi(this, 'sqs-api', {
      defaultCorsPreflightOptions: corsOptions
    });

    sqsApi.root.addMethod('POST', new LambdaIntegration(queuePublishFunction));

    // reuse dynamodb scan function
    sqsApi.root.addMethod('GET', dynamodbScanFunctionIntegration);

    // ************************************************************************
    // ************************ scheduled function ****************************
    // ************************************************************************

    const scheduledFunction = new Function(this, 'scheduled-function', {
      runtime: Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: Code.fromAsset('./handlers/scheduled'),
      timeout: Duration.seconds(2)
    });

    // configure rule for a scheduled function
    // recommended period for warming up functions is 15 minutes
    const rule = new Rule(this, `scheduled-function-rule`, {
      schedule: Schedule.rate(Duration.minutes(15))
    });

    // CAUTION: enabling scheduling will cause the lambda function to be
    //          invoked at the specified interval. If not actually
    //          required it's bad form to leave it running: aside from
    //          potential cost to you, it's also a waste of resources
    //          others might need.
    const isScheduleEnabled = false;
    if (isScheduleEnabled) {
      rule.addTarget(new LambdaFunction(scheduledFunction));
    }

    // ************************************************************************
    // ************************ s3 bucket static website **********************
    // ************************************************************************
    // NOTE: See README.md for instructions on how to configure a Hosted Zone.
    // CAUTION: Hosted Zones are not free, nor is their usage. Each domain you
    //          configure will cost you a minimum of $0.50 per month (assuming
    //          reasonable use)
    //          See https://aws.amazon.com/route53/pricing/ for more details.

    const domainName = null; // eg. "example.com";

    if (domainName) {
      // Many thanks to https://blog.dennisokeeffe.com/blog/2020-11-04-deploying-websites-to-aws-s3-with-the-cdk
      // and GitHub Copilot for this example!
      let zone;
      try {
        zone = HostedZone.fromLookup(this, domainName, {
          domainName,
        });
      } catch (err) {
        // throw a wrapped error to make it easier to find in the logs
        throw new WrappedError(`Hosted zone not found / region not specified for stack ${id} with region options ${props}.`, err);
      }
      new CfnOutput(this, "Site", { value: "https://" + domainName });

      // create the site bucket for the naked domain
      const siteBucket = new Bucket(this, "static-website", {
        bucketName: domainName,
        websiteIndexDocument: "index.html",
        publicReadAccess: false, // this will prevent the bucket from being browsable directly
        removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
        autoDeleteObjects: true, // NOT recommended for production code
      });
      new CfnOutput(this, "Bucket", { value: siteBucket.bucketName });

      // TLS certificate
      const certificateArn = new DnsValidatedCertificate(
        this,
        "SiteCertificate",
        {
          domainName,
          hostedZone: zone,
          region: "us-east-1", // Cloudfront only checks us-east-1 (N. Virginia) for certificates.
        }
      ).certificateArn;
      new CfnOutput(this, "Certificate", { value: certificateArn });

      // CloudFront distribution that provides HTTPS
      const distribution = new CloudFrontWebDistribution(
        this,
        "SiteDistribution",
        {
            viewerCertificate: {
                aliases: [domainName],
                props: {
                    acmCertificateArn: certificateArn,
                    sslSupportMethod: SSLMethod.SNI,
                    minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_1_2016,
                },
            },
            originConfigs: [
                {
                    customOriginSource: {
                        domainName: siteBucket.bucketWebsiteDomainName,
                        originProtocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
                    },
                    behaviors: [{ isDefaultBehavior: true }],
                },
            ],
        }
      );
      new CfnOutput(this, "DistributionId", {
        value: distribution.distributionId,
      });

      // Route53 alias record for the CloudFront distribution
      new ARecord(this, "SiteAliasRecord", {
        recordName: domainName,
        target: RecordTarget.fromAlias(
            new targets.CloudFrontTarget(distribution)
        ),
        zone,
      });

      // Deploy the static website to the site bucket
      new BucketDeployment(this, "static-website-deployment", {
        sources: [Source.asset("./static-website")],
        destinationBucket: siteBucket,
      });
    }
  }
}