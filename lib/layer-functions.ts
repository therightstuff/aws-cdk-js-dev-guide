import { StackProps, aws_logs as logs } from 'aws-cdk-lib';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Architecture, Code, Function, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { AwsStack } from './aws-cdk-js-dev-guide-stack';

export class LayerFunctions {
    constructor(stack: AwsStack, id: string, props?: StackProps, customOptions?: any) {
        const layer = new LayerVersion(stack, 'sample-layer', {
            // Code.fromAsset must reference the build folder
            code: Code.fromAsset('./layers/build/sample-layer'),
            compatibleArchitectures: [Architecture.ARM_64],
            compatibleRuntimes: [Runtime.NODEJS_20_X, Runtime.PYTHON_3_10],
            license: 'MIT',
            description: 'A sample layer for the node, python and dynamodb test functions',
        });
        stack.layer = layer;

        // layer test function: node
        const layerFunctionNode = new Function(stack, 'layer-function-node', {
            runtime: Runtime.NODEJS_20_X,
            architecture: Architecture.ARM_64,
            handler: 'index.handler',
            code: Code.fromAsset('./handlers/layer'),
            layers: [layer],
            logGroup: new logs.LogGroup(stack, `layer-function-node-logs`, {
                logGroupName: `${id}-layer-function-node`,
                retention: logs.RetentionDays.THREE_MONTHS,
            }),
        });

        // layer test function: python
        const layerFunctionPython = new Function(stack, 'layer-function-python', {
            runtime: Runtime.PYTHON_3_10,
            architecture: Architecture.ARM_64,
            handler: 'main.handler',
            code: Code.fromAsset('./handlers/python'),
            layers: [layer],
            logGroup: new logs.LogGroup(stack, `layer-function-python-logs`, {
                logGroupName: `${id}-layer-function-python`,
                retention: logs.RetentionDays.THREE_MONTHS,
            }),
        });

        // layer api
        const layerApi = new RestApi(stack, 'layer-api', {
            defaultCorsPreflightOptions: stack.cors.corsOptions
        });

        layerApi
            .root
            .addResource('node')
            .addMethod('GET', new LambdaIntegration(layerFunctionNode));

        layerApi
            .root
            .addResource('python')
            .addMethod('GET', new LambdaIntegration(layerFunctionPython));
    }
};
