import { Duration, StackProps, aws_logs as logs } from 'aws-cdk-lib';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Architecture, Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { AwsStack } from './aws-cdk-js-dev-guide-stack';

export class ScheduledFunction {
    constructor(stack: AwsStack, id: string, props?: StackProps, customOptions?: any) {
        const scheduledFunction = new Function(stack, 'scheduled-function', {
            runtime: Runtime.NODEJS_20_X,
            architecture: Architecture.ARM_64,
            handler: 'index.handler',
            code: Code.fromAsset('./handlers/scheduled'),
            logRetention: logs.RetentionDays.THREE_MONTHS,
            timeout: Duration.seconds(2),
        });

        // configure rule for a scheduled function
        // recommended period for keeping functions warmed up is 15 minutes
        const rule = new Rule(stack, `scheduled-function-rule`, {
            schedule: Schedule.rate(Duration.minutes(15))
        });

        rule.addTarget(new LambdaFunction(scheduledFunction));
    }
};
