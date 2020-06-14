import * as cdk from '@aws-cdk/core';
import { RestApi, LambdaIntegration } from '@aws-cdk/aws-apigateway';
import { Table, AttributeType, BillingMode } from '@aws-cdk/aws-dynamodb';
import { Function, Runtime, Code, LayerVersion } from '@aws-cdk/aws-lambda';

export class AwsLocalDevStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // simple test function
    const simpleFunction = new Function(this, 'simple-function', {
      runtime: Runtime.NODEJS_12_X,
      handler: 'index.handler',
      code: Code.asset('./handlers/simple'),
      environment: {
        HELLO: "Hello",
        WORLD: "World",
        AWS_LOCAL_DEV: "false"
      },
    });

    const simpleApi = new RestApi(this, 'simple-api', {
      deployOptions: {
        stageName: 'dev'
      }
    });

    simpleApi.root.addMethod('GET', new LambdaIntegration(simpleFunction));

    // layer
    // https://www.youtube.com/watch?v=xCgcJjqsLGw
    // https://www.codeproject.com/Articles/5269904/Deploy-a-Typescript-Lambda-function-with-AWS-CDK-a
    const layer = new LayerVersion(this, 'test-layer', {
      code: Code.fromAsset(path.join(__dirname, 'layer-code')),
      compatibleRuntimes: [Runtime.NODEJS_12_X],
      license: 'MIT',
      description: 'A layer for the layer and dynamodb test functions',
    });

    // layer test function
    const layerFunction = new Function(this, 'layer-function', {
      runtime: Runtime.NODEJS_12_X,
      handler: 'index.handler',
      code: Code.asset('./handlers/layer'),
      environment: {
        AWS_LOCAL_DEV: "false"
      },
      layers: [layer],
    });

    const layerApi = new RestApi(this, 'layer-api', {
      deployOptions: {
        stageName: 'dev'
      }
    });

    layerApi.root.addMethod('GET', new LambdaIntegration(layerFunction));

    // dynamodb test function
    const dynamodbTable = new Table(this, 'dynamodb-table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiration'
    });

    const dynamodbFunction = new Function(this, 'dynamodb-function', {
      runtime: Runtime.NODEJS_12_X,
      handler: 'index.handler',
      code: Code.asset('./handlers/dynamodb'),
      environment: {
        AWS_LOCAL_DEV: "false",
        TABLE_NAME: dynamodbTable.tableName,
        LOCAL_DDB_URL: "http://localhost:8000",
        LOCAL_DDB_ACCESS_KEY_ID: "xxxx",
        LOCAL_DDB_SECRET_ACCESS_KEY: "xxxx"
      },
      layers: [layer],
    });

    dynamodbTable.grant(dynamodbFunction,
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:BatchGetItem",
      "dynamodb:Query",
      "dynamodb:UpdateItem"
    );

    const dynamodbApi = new RestApi(this, 'dynamodb-api', {
      deployOptions: {
        stageName: 'dev'
      }
    });

    dynamodbApi.root.addMethod('GET', new LambdaIntegration(dynamodbFunction));
    dynamodbApi.root.addMethod('POST', new LambdaIntegration(dynamodbFunction));
    dynamodbApi.root.addMethod('PUT', new LambdaIntegration(dynamodbFunction));
  }
}
