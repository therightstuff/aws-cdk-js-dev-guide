import * as cdk from '@aws-cdk/core';
import { RestApi, LambdaIntegration } from '@aws-cdk/aws-apigateway';
import { Table, AttributeType, BillingMode } from '@aws-cdk/aws-dynamodb';
import { Function, Runtime, Code } from '@aws-cdk/aws-lambda';

export class AwsLocalDevStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // define a dynamodb table
    const table = new Table(this, 'experiment-table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiration'
    });

    const experimentFunction = new Function(this, 'experiment-function', {
      runtime: Runtime.NODEJS_12_X,
      handler: 'index.handler',
      code: Code.asset('./handlers/experiment'),
      environment: {
        TABLE_NAME: table.tableName
      },
    });

    table.grant(experimentFunction,
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:BatchGetItem",
      "dynamodb:Query",
      "dynamodb:UpdateItem"
    );

    const api = new RestApi(this, 'experiment-api', {
      deployOptions: {
        stageName: 'dev'
      }
    });

    api.root.addMethod('GET', new LambdaIntegration(experimentFunction));
    api.root.addMethod('POST', new LambdaIntegration(experimentFunction));
    api.root.addMethod('PUT', new LambdaIntegration(experimentFunction));
  }
}
