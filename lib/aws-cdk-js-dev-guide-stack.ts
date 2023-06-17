import { Stack, StackProps } from 'aws-cdk-lib';
import { Cors, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { BackupPlan, BackupPlanRule, BackupResource } from 'aws-cdk-lib/aws-backup';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { DynamoDbComponents } from './dynamodb';
import { LayerFunction } from './layer-function';
import { RdsDatabase } from './rds-database';
import { ScheduledFunction } from './scheduled-function';
import { SimpleFunction } from './simple-function';
import { SQSComponents } from './sqs';
import { StaticWebsite } from './static-website';
import { VpcResources } from './vpc-resources';

export class AwsStack extends Stack {
    // properties shared between the different sample components
    cors: any;
    dynamodbScanFunctionIntegration: LambdaIntegration;
    dynamodbTable: Table;
    layer: LayerVersion;
    securityGroup: SecurityGroup;
    vpc: Vpc;

    constructor(scope: Construct, id: string, props?: StackProps, customOptions?: any) {
        super(scope, id, props);

        customOptions = customOptions || {};
        const resources = customOptions.resources || [];

        // configure backup plan, alternatively use defaults like BackupPlan.dailyWeeklyMonthly5YearRetention
        if (resources.includes('backup-plan')) {
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

        if (resources.includes("vpc")
            || resources.includes("rds")) {
            new VpcResources(this, id, props, customOptions);
        }

        if (resources.includes("simple-function")) {
            new SimpleFunction(this, id, props, customOptions);
        }

        const isLayerRequired = resources.includes("lambda-layer")
            || resources.includes("dynamodb-components")
            || resources.includes("sqs-components");

        if (isLayerRequired) {
            new LayerFunction(this, id, props, customOptions);
        }

        const isDynamoDbRequired = resources.includes("dynamodb-components")
            || resources.includes("sqs-components");

        if (isDynamoDbRequired) {
            new DynamoDbComponents(this, id, props, customOptions);
        }

        // WARNING: setting up an SQS queue event listener incurs costs even
        //          when there's no activity (something in the order of
        //          $0.50 per month). From
        //          https://aws.amazon.com/blogs/aws/aws-lambda-adds-amazon-simple-queue-service-to-supported-event-sources/
        //    "There are no additional charges for this feature, but because the
        //     Lambda service is continuously long-polling the SQS queue the
        //     account will be charged for those API calls at the standard SQS
        //     pricing rates."
        if (resources.includes("sqs-components")) {
            new SQSComponents(this, id, props, customOptions);
        }

        // CAUTION: enabling scheduling will cause the lambda function to be
        //          invoked at the specified interval. If not actually
        //          required it's bad form to leave it running: aside from
        //          potential cost to you, it's also a waste of resources
        //          others might need.
        if (resources.includes("scheduled-function")) {
            new ScheduledFunction(this, id, props, customOptions);
        }


        // CAUTION: Hosted Zones are not free, nor is their usage. Each domain you
        //          configure will cost you a minimum of $0.50 per month (assuming
        //          reasonable use)
        //          See https://aws.amazon.com/route53/pricing/ for more details.
        if (resources.includes("static-website")) {
            new StaticWebsite(this, id, props, customOptions);
        }

        // CAUTION: RDS instances are not free, nor is their usage (although costs
        //          might be covered by your free tier). Review the pricing before
        //          enabling this resource.
        //          See https://aws.amazon.com/rds/pricing/ for more details.
        if (resources.includes("rds")) {
            new RdsDatabase(this, id, props, customOptions);
        }
    }
}
