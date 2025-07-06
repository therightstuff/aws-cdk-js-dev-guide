import { RemovalPolicy, StackProps, aws_logs as logs } from 'aws-cdk-lib';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Architecture, Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { AwsStack } from './aws-cdk-js-dev-guide-stack';

export class SQSComponents {
    constructor(stack: AwsStack, id: string, props?: StackProps, customOptions?: any) {
        const sqsQueue = new Queue(stack, 'sqs-queue');

        const queuePublishFunction = new Function(stack, 'sqs-function-publish', {
            runtime: Runtime.NODEJS_LATEST,
            architecture: Architecture.ARM_64,
            handler: 'index.publish',
            code: Code.fromAsset('./handlers/sqs'),
            environment: {
                ...stack.cors.corsEnvironment,
                QUEUE_URL: sqsQueue.queueUrl,
                TABLE_NAME: stack.dynamodbTable.tableName
            },
            layers: [stack.layer],
            logGroup: new logs.LogGroup(stack, `sqs-function-publish-logs`, {
                logGroupName: `${id}-sqs-function-publish`,
                removalPolicy: RemovalPolicy.DESTROY,
                retention: logs.RetentionDays.THREE_MONTHS,
            }),
        });

        sqsQueue.grantSendMessages(queuePublishFunction);

        const queueSubscribeFunction = new Function(stack, 'sqs-function-subscribe', {
            runtime: Runtime.NODEJS_LATEST,
            architecture: Architecture.ARM_64,
            handler: 'index.subscribe',
            code: Code.fromAsset('./handlers/sqs'),
            environment: {
                QUEUE_URL: sqsQueue.queueUrl,
                TABLE_NAME: stack.dynamodbTable.tableName
            },
            layers: [stack.layer],
            logGroup: new logs.LogGroup(stack, `sqs-function-subscribe-logs`, {
                logGroupName: `${id}-sqs-function-subscribe`,
                removalPolicy: RemovalPolicy.DESTROY,
                retention: logs.RetentionDays.THREE_MONTHS,
            }),
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
