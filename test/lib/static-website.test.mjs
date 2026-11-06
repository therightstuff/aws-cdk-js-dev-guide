import { describe, expect, test } from '@jest/globals';
import { execFileSync } from 'node:child_process';

function synthesize(options) {
    return JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '-e', `
        const { App, Stack } = require('aws-cdk-lib');
        const { Template } = require('aws-cdk-lib/assertions');
        const { Certificate } = require('aws-cdk-lib/aws-certificatemanager');
        const { HostedZone } = require('aws-cdk-lib/aws-route53');
        const { AwsStack } = require('./lib/aws-cdk-js-dev-guide-stack.ts');
        const app = new App();
        const imports = new Stack(app, 'Imports');
        const options = JSON.parse(process.argv[1]);
        const stack = new AwsStack(app, options.stackName ?? 'WebsiteTest', {
            env: { account: '123456789012', region: 'us-east-1' },
        }, {
            ...options,
            domainName: 'example.com',
            zone: HostedZone.fromHostedZoneAttributes(imports, 'Zone', {
                hostedZoneId: 'Z123456', zoneName: 'example.com',
            }),
            certificate: Certificate.fromCertificateArn(imports, 'Certificate',
                'arn:aws:acm:us-east-1:123456789012:certificate/test'),
        });
        console.log(JSON.stringify(Template.fromStack(stack).toJSON()));
    `, JSON.stringify(options)], { encoding: 'utf8', timeout: 30000 }));
}

describe('static website deployment outputs', () => {
    test.each(['WebsiteOne', 'WebsiteTwo'])('lets CloudFormation name the site bucket in %s', stackName => {
        const template = synthesize({
            stackName, resources: ['static-website'],
            isNakedDomainTarget: false, subdomainNames: ['dev'],
        });
        const bucket = template.Resources.staticwebsiteF89859A2;
        expect(bucket.Type).toBe('AWS::S3::Bucket');
        expect(bucket.Properties).not.toHaveProperty('BucketName');
        expect(bucket.DeletionPolicy).toBe('Delete');
        expect(bucket.UpdateReplacePolicy).toBe('Delete');
        const distribution = Object.values(template.Resources).find(
            resource => resource.Type === 'AWS::CloudFront::Distribution');
        expect(distribution.Properties.DistributionConfig.Origins).toEqual(expect.arrayContaining([
            expect.objectContaining({
                DomainName: { 'Fn::GetAtt': ['staticwebsiteF89859A2', 'RegionalDomainName'] },
            }),
        ]));
        const deployment = Object.values(template.Resources).find(
            resource => resource.Type === 'Custom::CDKBucketDeployment');
        expect(deployment.Properties.DestinationBucketName).toEqual({ Ref: 'staticwebsiteF89859A2' });
    });

    test.each([
        [true, [], ['example.com']],
        [true, ['www'], ['example.com', 'www.example.com']],
        [false, ['app'], ['app.example.com']],
        [false, [], []],
    ])('outputs website and proxy URLs with naked domain %s and subdomains %j',
        (isNakedDomainTarget, subdomainNames, expectedDomains) => {
            const template = synthesize({
                resources: ['simple-function', 'static-website'], isNakedDomainTarget, subdomainNames,
            });
            const outputs = template.Outputs;
            const distributionId = Object.keys(template.Resources).find(
                key => template.Resources[key].Type === 'AWS::CloudFront::Distribution');
            const apiId = Object.keys(template.Resources).find(
                key => template.Resources[key].Type === 'AWS::ApiGateway::RestApi'
                    && template.Resources[key].Properties.Name === 'site-api');
            const stageId = Object.keys(template.Resources).find(
                key => template.Resources[key].Type === 'AWS::ApiGateway::Stage'
                    && template.Resources[key].Properties.RestApiId.Ref === apiId);

            expect(outputs.WebsiteUrl0.Value).toEqual({ 'Fn::Join': ['', [
                'https://', { 'Fn::GetAtt': [distributionId, 'DomainName'] }, '/',
            ]] });
            expect(outputs.WebsiteApiUrl0.Value).toEqual({ 'Fn::Join': ['', [
                'https://', { 'Fn::GetAtt': [distributionId, 'DomainName'] }, '/api/',
            ]] });
            for (const [index, domain] of expectedDomains.entries()) {
                expect(outputs[`WebsiteUrl${index + 1}`].Value).toBe(`https://${domain}/`);
                expect(outputs[`WebsiteApiUrl${index + 1}`].Value).toBe(`https://${domain}/api/`);
            }
            expect(Object.keys(outputs).filter(key => key.startsWith('Website')))
                .toHaveLength(2 * (expectedDomains.length + 1));
            expect(outputs.SiteApiUrl.Value).toEqual({ 'Fn::Join': ['', [
                'https://', { Ref: apiId }, '.execute-api.us-east-1.',
                { Ref: 'AWS::URLSuffix' }, '/', { Ref: stageId }, '/api',
            ]] });
            expect(Object.values(outputs).map(output => output.Value)).toContainEqual({
                'Fn::Join': ['', [
                    'https://', { Ref: apiId }, '.execute-api.us-east-1.',
                    { Ref: 'AWS::URLSuffix' }, '/', { Ref: stageId }, '/',
                ]],
            });
        });

    test('does not output website links when the website is disabled', () => {
        const template = synthesize({ resources: [] });
        expect(template.Outputs).toBeUndefined();
    });
});
