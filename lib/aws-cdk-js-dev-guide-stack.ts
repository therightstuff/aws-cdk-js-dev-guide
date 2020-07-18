import * as cdk from '@aws-cdk/core';
import { RestApi, LambdaIntegration } from '@aws-cdk/aws-apigateway';
import { Table, AttributeType, BillingMode } from '@aws-cdk/aws-dynamodb';
import { Function, Runtime, Code, LayerVersion } from '@aws-cdk/aws-lambda';
import { Duration } from '@aws-cdk/core';

export class AwsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // simple test function
    const simpleFunction = new Function(this, 'simple-function', {
      runtime: Runtime.NODEJS_12_X,
      handler: 'index.handler',
      code: Code.asset('./handlers/simple'),
      environment: {
        HELLO: "Hello",
        WORLD: "World"
      },
      timeout: Duration.seconds(2)
    });

    const simpleApi = new RestApi(this, 'simple-api', {
      restApiName: 'Simple API sample',
      description: "Simple API sample with no dependencies"
    });

    simpleApi.root.addMethod('GET', new LambdaIntegration(
      simpleFunction,
      {
        requestTemplates: { "application/json": '{ "statusCode": "200" }' }
      }
    ));

    // layer
    const layer = new LayerVersion(this, 'sample-layer', {
      // Code.fromAsset must reference the build folder
      code: Code.fromAsset('./layers/build/sample-layer'),
      compatibleRuntimes: [Runtime.NODEJS_12_X],
      license: 'MIT',
      description: 'A sample layer for the layer and dynamodb test functions',
    });

    // layer test function
    const layerFunction = new Function(this, 'layer-function', {
      runtime: Runtime.NODEJS_12_X,
      handler: 'index.handler',
      code: Code.asset('./handlers/layer'),
      layers: [layer],
    });

    const layerApi = new RestApi(this, 'layer-api');

    layerApi.root.addMethod('GET', new LambdaIntegration(layerFunction));

    // dynamodb test function
    // NOTE: remove timeToLiveAttribute if you don't want to set a TTL for the data
    const dynamodbTable = new Table(this, 'dynamodb-table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiration'
    });

    const dynamodbGetFunction = new Function(this, 'dynamodb-function-get', {
      runtime: Runtime.NODEJS_12_X,
      handler: 'get.handler',
      code: Code.asset('./handlers/dynamodb'),
      environment: {
        TABLE_NAME: dynamodbTable.tableName
      },
      layers: [layer],
    });

    dynamodbTable.grantReadData(dynamodbGetFunction);

    const dynamodbScanFunction = new Function(this, 'dynamodb-function-scan', {
      runtime: Runtime.NODEJS_12_X,
      handler: 'scan.handler',
      code: Code.asset('./handlers/dynamodb'),
      environment: {
        TABLE_NAME: dynamodbTable.tableName
      },
      layers: [layer],
    });

    dynamodbTable.grantReadData(dynamodbScanFunction);

    const dynamodbCreateFunction = new Function(this, 'dynamodb-function-create', {
      runtime: Runtime.NODEJS_12_X,
      handler: 'create.handler',
      code: Code.asset('./handlers/dynamodb'),
      environment: {
        TABLE_NAME: dynamodbTable.tableName
      },
      layers: [layer],
    });

    dynamodbTable.grantWriteData(dynamodbCreateFunction);

    const dynamodbUpdateFunction = new Function(this, 'dynamodb-function-update', {
      runtime: Runtime.NODEJS_12_X,
      handler: 'update.handler',
      code: Code.asset('./handlers/dynamodb'),
      environment: {
        TABLE_NAME: dynamodbTable.tableName
      },
      layers: [layer],
    });

    dynamodbTable.grantWriteData(dynamodbUpdateFunction);

    // Configure RESTful API
    const dynamodbApi = new RestApi(this, 'dynamodb-api');

    // /objects
    // https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/objects
    let apiObjects = dynamodbApi.root.addResource('objects');
    // GET /objects : list all objects
    apiObjects.addMethod('GET', new LambdaIntegration(dynamodbScanFunction));
    // POST /objects : add a new object
    apiObjects.addMethod('POST', new LambdaIntegration(dynamodbCreateFunction));

    // objects/{id}
    let apiObjectsObject = apiObjects.addResource("{objectId}")
    // GET /objects/{id} : get object with specified id
    apiObjectsObject.addMethod('GET', new LambdaIntegration(dynamodbGetFunction));
    // PUT /objects/{id} : update object with specified id
    apiObjectsObject.addMethod('PUT', new LambdaIntegration(dynamodbUpdateFunction));
  }
}