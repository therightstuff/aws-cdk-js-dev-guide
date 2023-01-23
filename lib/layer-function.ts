import { StackProps } from 'aws-cdk-lib';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Code, Function, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { AwsStack } from './aws-cdk-js-dev-guide-stack';

export class LayerFunction {
    constructor(stack: AwsStack, id: string, props?: StackProps, customOptions?: any) {
        const layer = new LayerVersion(stack, 'sample-layer', {
            // Code.fromAsset must reference the build folder
            code: Code.fromAsset('./layers/build/sample-layer'),
            compatibleRuntimes: [Runtime.NODEJS_16_X],
            license: 'MIT',
            description: 'A sample layer for the layer and dynamodb test functions',
        });
        stack.layer = layer;

        // layer test function
        const layerFunction = new Function(stack, 'layer-function', {
            runtime: Runtime.NODEJS_16_X,
            handler: 'index.handler',
            code: Code.fromAsset('./handlers/layer'),
            layers: [layer]
        });

        // layer api
        const layerApi = new RestApi(stack, 'layer-api', {
            defaultCorsPreflightOptions: stack.cors.corsOptions
        });

        layerApi.root.addMethod('GET', new LambdaIntegration(layerFunction));
    }
};
