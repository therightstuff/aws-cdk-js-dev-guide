import { Stack, StackProps } from 'aws-cdk-lib';
import { Cors, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { BackupPlan, BackupPlanRule, BackupResource } from 'aws-cdk-lib/aws-backup';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { SimpleFunction } from './simple-function';
import { LayerFunction } from './layer-function';
import { DynamoDbComponents } from './dynamodb';
import { SQSComponents } from './sqs';
import { ScheduledFunction } from './scheduled-function';
import { StaticWebsite } from './static-website';

export class AwsStack extends Stack {
    // properties shared between the different sample components
    cors: any;
    dynamodbScanFunctionIntegration: LambdaIntegration;
    dynamodbTable: Table;
    layer: LayerVersion;

    constructor(scope: Construct, id: string, props?: StackProps, customOptions?: any) {
        super(scope, id, props);

        customOptions = customOptions || {};

        // configure backup plan, alternatively use defaults like BackupPlan.dailyWeeklyMonthly5YearRetention
        const createBackupPlan = false;
        if (createBackupPlan) {
            const backupPlan = new BackupPlan(this, `${id}-daily-weekly-monthly`);
            backupPlan.addRule(BackupPlanRule.daily());
            backupPlan.addRule(BackupPlanRule.weekly());
            backupPlan.addRule(BackupPlanRule.monthly1Year());
            backupPlan.addSelection('Selection', {
                resources: [
                    //BackupResource.fromDynamoDbTable(myTable), // A specific DynamoDB table
                    BackupResource.fromTag('stack-name', id), // All resources that are tagged stack-name=<id> in the region/account
                ]
            });
        }

        // set default CORS origin to ALL_ORIGINS
        const corsOrigin = customOptions.corsOrigin || "*";

        this.cors = {
            corsOrigin,
            // this will be used to make the stack's CORS origin available to lambdas
            // as an environment variable
            corsEnvironment: {
                CORS_ORIGIN: corsOrigin
            },
            // reusable RESTful API CORS options object
            corsOptions: {
                allowOrigins: [ corsOrigin ], // array containing an origin, or Cors.ALL_ORIGINS
                allowMethods: Cors.ALL_METHODS, // array of methods eg. [ 'OPTIONS', 'GET', 'POST', 'PUT', 'DELETE' ]
            }
        };

        new SimpleFunction(this, id, props, customOptions);

        new LayerFunction(this, id, props, customOptions);

        new DynamoDbComponents(this, id, props, customOptions);

        new SQSComponents(this, id, props, customOptions);

        new ScheduledFunction(this, id, props, customOptions);

        new StaticWebsite(this, id, props, customOptions);
    }
}
