import { Duration, RemovalPolicy, StackProps, aws_logs as logs } from 'aws-cdk-lib';
import { AccessLogFormat, LambdaIntegration, LogGroupLogDestination, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Architecture, Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { AwsStack } from './aws-cdk-js-dev-guide-stack';

export class SimpleFunction {
    constructor(stack: AwsStack, id: string, props?: StackProps, customOptions?: any) {
        const simpleFunction = new Function(stack, 'simple-function', {
            runtime: Runtime.NODEJS_LATEST,
            architecture: Architecture.ARM_64,
            handler: 'index.handler',
            code: Code.fromAsset('./handlers/simple'),
            environment: {
                ...stack.cors.corsEnvironment,
                HELLO: "Hello",
                WORLD: "World"
            },
            logGroup: new logs.LogGroup(stack, `simple-function-logs`, {
                logGroupName: `${id}-simple-function`,
                removalPolicy: RemovalPolicy.DESTROY,
                retention: logs.RetentionDays.THREE_MONTHS,
            }),
            timeout: Duration.seconds(2),
        });

        // simple REST api interface

        // configure log group for RestApi access logs
        const simpleFunctionAccessLogGroup = new LogGroup(stack, 'simple-function-access-log-group', {
            logGroupName: `apigateway/${id}-simple-function`,
            retention: 1 // retention in days
            // see https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-logs.LogGroup.html
        });

        // to enable CORS on all resources of the api, uncomment the line
        // beginning with defaultCorsPreflightOptions:
        const simpleApi = new RestApi(stack, 'simple-api', {
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
    }
};
