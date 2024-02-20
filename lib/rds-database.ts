import { Duration, RemovalPolicy, StackProps, aws_logs as logs } from 'aws-cdk-lib';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { InstanceClass, InstanceSize, InstanceType, Peer, Port, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Architecture, Code, Function, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Credentials, DatabaseInstance, DatabaseInstanceEngine, PostgresEngineVersion } from 'aws-cdk-lib/aws-rds';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { AwsStack } from './aws-cdk-js-dev-guide-stack';
const POSTGRES_PORT = 5432;
const POSTGRES_DATABASE = 'sample_postgres_db'; // valid Postgres identifier
const POSTGRES_USERNAME = 'postgres';


export class RdsDatabase {
    constructor(stack: AwsStack, id: string, props?: StackProps, customOptions?: any) {
        stack.securityGroup.addIngressRule(
            Peer.ipv4(stack.vpc.vpcCidrBlock),
            Port.tcp(POSTGRES_PORT),
            'allow postgres access from vpc'
        );

        // RDS Postgres instance
        const postgresConfig:any = {
            vpc: stack.vpc,
            vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS, },
            securityGroup: stack.securityGroup,
            port: POSTGRES_PORT,
            databaseName: POSTGRES_DATABASE,
            backupRetention: Duration.days(0), // no backups, not for production use!
            deletionProtection: false, // no deletion protection, not for production use!
            RemovalPolicy: RemovalPolicy.DESTROY, // easy removal for cost-saving, not for production use!
            deleteAutomatedBackups: true, // also not for production use!
        };

        postgresConfig.engine = DatabaseInstanceEngine.postgres({
            version: PostgresEngineVersion.VER_15_3
        });

        // CAUTION: make sure you're familiar with the pricing of the instance type you choose!
        postgresConfig.instanceType = InstanceType.of(InstanceClass.T3, InstanceSize.MICRO);

        // Generate a random password for the root database user. This is fine for
        // a simple test setup like this, but you really should use a secret manager
        // for anything less temporary.
        const masterUserSecret = new Secret(stack, `postgres-credentials`, {
            secretName: `postgres-credentials`,
            generateSecretString: {
                secretStringTemplate: JSON.stringify({
                    username: POSTGRES_USERNAME,
                }),
                generateStringKey: "password",
                excludePunctuation: true,
                includeSpace: false,
                requireEachIncludedType: false,
                excludeCharacters: '"@/\\',
            },
            removalPolicy: RemovalPolicy.DESTROY,
        });

        postgresConfig.credentials = Credentials.fromSecret(masterUserSecret);

        // Create the database instance
        const dbInstance = new DatabaseInstance(stack, `postgres-instance`, postgresConfig);
        // Allow access from anywhere with the given port. This is fine for a simple test setup,
        // but you should restrict access for more long-lived resources.
        dbInstance.connections.allowFromAnyIpv4(Port.tcp(POSTGRES_PORT));

        // Create a Lambda layer that contains the sequelize and pg libraries.
        // You'll need pg pg-hstore @sequelize/core and sequelize
        const postgresLayer = new LayerVersion(stack, `postgres-layer`, {
            // Code.fromAsset must reference a valid build folder
            code: Code.fromAsset(`./layers/build/postgres-layer`),
            compatibleRuntimes: [Runtime.NODEJS_20_X],
            license: 'MIT',
            description: 'A layer for postgres functions',
        });

        // Lambda function
        const postgresFunction = new Function(stack, `postgres-function`, {
            runtime: Runtime.NODEJS_20_X,
            architecture: Architecture.ARM_64,
            handler: 'index.handler',
            vpc: stack.vpc,
            vpcSubnets: {
                // This subnet allows for traffic between the function and the database
                // as well as external traffic
                subnetType: SubnetType.PRIVATE_WITH_EGRESS,
            },
            securityGroups: [stack.securityGroup],
            code: Code.fromAsset(`./handlers/postgres`),
            environment: {
                CORS_ORIGIN: stack.cors.corsOrigin,
                POSTGRES_HOST: dbInstance.dbInstanceEndpointAddress,
                POSTGRES_PORT: `${POSTGRES_PORT}`,
                POSTGRES_DATABASE: POSTGRES_DATABASE,
                POSTGRES_USERNAME: POSTGRES_USERNAME,
                // The password should be stored in a secure location like,
                // AWS Secrets Manager or AWS Parameter Store, this is just
                // for demo purposes.
                POSTGRES_PASSWORD: masterUserSecret.secretValueFromJson('password').unsafeUnwrap(),
            },
            layers: [postgresLayer],
            logGroup: new logs.LogGroup(stack, `postgres-function-logs`, {
                logGroupName: `${id}-postgres-function`,
                retention: logs.RetentionDays.THREE_MONTHS,
            }),
            timeout: Duration.seconds(10),
        });

        // API Gateway integration to trigger the function
        const rdsApi = new RestApi(stack, `rds-api`, {
            defaultCorsPreflightOptions: stack.cors.corsOptions
        });

        rdsApi.root.addMethod('GET', new LambdaIntegration(postgresFunction));
    }
};
