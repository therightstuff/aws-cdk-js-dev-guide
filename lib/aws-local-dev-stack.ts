import * as cdk from '@aws-cdk/core';
import { RestApi, LambdaIntegration } from '@aws-cdk/aws-apigateway';
import { Table, AttributeType, BillingMode } from '@aws-cdk/aws-dynamodb';
import { Function, Runtime, Code } from '@aws-cdk/aws-lambda';

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
        WORLD: "World"
      },
    });

    const simpleApi = new RestApi(this, 'simple-api', {
      deployOptions: {
        stageName: 'dev'
      }
    });

    simpleApi.root.addMethod('GET', new LambdaIntegration(simpleFunction));

    // layer test function
    const layerFunction = new Function(this, 'layer-function', {
      runtime: Runtime.NODEJS_12_X,
      handler: 'index.handler',
      code: Code.asset('./handlers/layer'),
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
        AWS_LOCAL_DEV: "FALSE",
        TABLE_NAME: dynamodbTable.tableName
      },
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
