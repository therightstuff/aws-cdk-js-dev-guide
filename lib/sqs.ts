import { StackProps, aws_logs as logs } from 'aws-cdk-lib';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { AwsStack } from './aws-cdk-js-dev-guide-stack';

export class SQSComponents {
    constructor(stack: AwsStack, id: string, props?: StackProps, customOptions?: any) {
        const sqsQueue = new Queue(stack, 'sqs-queue');

        const queuePublishFunction = new Function(stack, 'queue-function-publish', {
            runtime: Runtime.NODEJS_16_X,
            handler: 'index.publish',
            code: Code.fromAsset('./handlers/sqs'),
            environment: {
                ...stack.cors.corsEnvironment,
                QUEUE_URL: sqsQueue.queueUrl,
                TABLE_NAME: stack.dynamodbTable.tableName
            },
            layers: [stack.layer],
            logRetention: logs.RetentionDays.THREE_MONTHS,
        });

        sqsQueue.grantSendMessages(queuePublishFunction);

        const queueSubscribeFunction = new Function(stack, 'queue-function-subscribe', {
            runtime: Runtime.NODEJS_16_X,
            handler: 'index.subscribe',
            code: Code.fromAsset('./handlers/sqs'),
            environment: {
                QUEUE_URL: sqsQueue.queueUrl,
                TABLE_NAME: stack.dynamodbTable.tableName
            },
            layers: [stack.layer],
            logRetention: logs.RetentionDays.THREE_MONTHS,
        });

        // set up a queue event listener
        let queueEventSource = new SqsEventSource(sqsQueue, {
            batchSize: 10 // default
        });

        queueSubscribeFunction.addEventSource(queueEventSource);

        stack.dynamodbTable.grantWriteData(queueSubscribeFunction);

        // sqs api
        const sqsApi = new RestApi(stack, 'sqs-api', {
            defaultCorsPreflightOptions: stack.cors.corsOptions
        });

        sqsApi.root.addMethod('POST', new LambdaIntegration(queuePublishFunction));

        // reuse dynamodb scan function
        sqsApi.root.addMethod('GET', stack.dynamodbScanFunctionIntegration);
    }
};
