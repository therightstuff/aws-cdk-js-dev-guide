import { Duration, StackProps } from 'aws-cdk-lib';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { AwsStack } from './aws-cdk-js-dev-guide-stack';
import { aws_logs as logs } from 'aws-cdk-lib';

export class ScheduledFunction {
    constructor(stack: AwsStack, id: string, props?: StackProps, customOptions?: any) {
        const scheduledFunction = new Function(stack, 'scheduled-function', {
            runtime: Runtime.NODEJS_16_X,
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

        // CAUTION: enabling scheduling will cause the lambda function to be
        //          invoked at the specified interval. If not actually
        //          required it's bad form to leave it running: aside from
        //          potential cost to you, it's also a waste of resources
        //          others might need.
        const isScheduleEnabled = false;
        if (isScheduleEnabled) {
            rule.addTarget(new LambdaFunction(scheduledFunction));
        }
    }
};
