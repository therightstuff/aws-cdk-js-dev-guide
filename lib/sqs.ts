import { StackProps } from 'aws-cdk-lib';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { AwsStack } from './aws-cdk-js-dev-guide-stack';
import { aws_logs as logs } from 'aws-cdk-lib';

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
