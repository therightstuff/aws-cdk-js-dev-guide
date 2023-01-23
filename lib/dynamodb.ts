import { StackProps } from 'aws-cdk-lib';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, BillingMode, ProjectionType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { AwsStack } from './aws-cdk-js-dev-guide-stack';

export class DynamoDbComponents {
    constructor(stack: AwsStack, id: string, props?: StackProps, customOptions?: any) {
        // If you're not already familiar with DynamoDB's reserved keywords, it's
        // worth checking your attribute names against
        // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html.
        // NOTE: remove timeToLiveAttribute if you don't want to set a TTL for the data
        const dynamodbTable = new Table(stack, 'dynamodb-table', {
            partitionKey: { name: 'dataOwner', type: AttributeType.STRING },
            sortKey: { name: 'objectId', type: AttributeType.STRING },
            billingMode: BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'expiration'
        });
        stack.dynamodbTable = dynamodbTable;

        // Querying a DynamoDB table without knowing the partition key is not
        // possible without a Secondary Index, see
        // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/SecondaryIndexes.html
        // for more details.
        // NOTE: by default the projection type is set to ALL when it should
        // be set to the minimum number of fields required by the queries.
        const DDB_GSI_NAME = 'dynamodb-table-flip-index';
        dynamodbTable.addGlobalSecondaryIndex({
            indexName: DDB_GSI_NAME,
            projectionType: ProjectionType.KEYS_ONLY,
            partitionKey: { name: 'objectId', type: AttributeType.STRING },
        });

        const dynamodbGetFunction = new Function(stack, 'dynamodb-function-get', {
            runtime: Runtime.NODEJS_16_X,
            handler: 'get.handler',
            code: Code.fromAsset('./handlers/dynamodb'),
            environment: {
                ...stack.cors.corsEnvironment,
                TABLE_NAME: dynamodbTable.tableName,
                DDB_GSI_NAME
            },
            layers: [stack.layer]
        });

        dynamodbTable.grantReadData(dynamodbGetFunction);

        const dynamodbScanFunction = new Function(stack, 'dynamodb-function-scan', {
            runtime: Runtime.NODEJS_16_X,
            handler: 'scan.handler',
            code: Code.fromAsset('./handlers/dynamodb'),
            environment: {
                ...stack.cors.corsEnvironment,
                TABLE_NAME: dynamodbTable.tableName
            },
            layers: [stack.layer]
        });

        dynamodbTable.grantReadData(dynamodbScanFunction);
        // create reusable lambda integration
        const dynamodbScanFunctionIntegration = new LambdaIntegration(dynamodbScanFunction);
        stack.dynamodbScanFunctionIntegration = dynamodbScanFunctionIntegration;

        const dynamodbCreateFunction = new Function(stack, 'dynamodb-function-create', {
            runtime: Runtime.NODEJS_16_X,
            handler: 'create.handler',
            code: Code.fromAsset('./handlers/dynamodb'),
            environment: {
                ...stack.cors.corsEnvironment,
                TABLE_NAME: dynamodbTable.tableName
            },
            layers: [stack.layer]
        });

        dynamodbTable.grantWriteData(dynamodbCreateFunction);

        const dynamodbUpdateFunction = new Function(stack, 'dynamodb-function-update', {
            runtime: Runtime.NODEJS_16_X,
            handler: 'update.handler',
            code: Code.fromAsset('./handlers/dynamodb'),
            environment: {
                ...stack.cors.corsEnvironment,
                TABLE_NAME: dynamodbTable.tableName,
                DDB_GSI_NAME
            },
            layers: [stack.layer]
        });

        // the update itself doesn't require read permissions, but we may need to query
        // the object using the global secondary index. see handlers/dynamodb/update.js
        dynamodbTable.grantReadData(dynamodbUpdateFunction);
        dynamodbTable.grantWriteData(dynamodbUpdateFunction);

        // dynamodb api
        const dynamodbApi = new RestApi(stack, 'dynamodb-api', {
            defaultCorsPreflightOptions: stack.cors.corsOptions,
        });

        // /objects
        // https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/objects
        let apiObjects = dynamodbApi.root.addResource('objects');

        // GET /objects : list all objects
        apiObjects.addMethod('GET', dynamodbScanFunctionIntegration);
        // POST /objects : add a new object
        apiObjects.addMethod('POST', new LambdaIntegration(dynamodbCreateFunction));

        // objects/{id}
        let apiObjectsObject = apiObjects.addResource("{objectId}")

        // GET /objects/{id} : get object with specified id
        apiObjectsObject.addMethod('GET', new LambdaIntegration(dynamodbGetFunction));
        // PUT /objects/{id} : update object with specified id
        apiObjectsObject.addMethod('PUT', new LambdaIntegration(dynamodbUpdateFunction));
    }
};
