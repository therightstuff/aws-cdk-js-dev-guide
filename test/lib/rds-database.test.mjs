import { describe, expect, test } from '@jest/globals';
import { execFileSync } from 'node:child_process';

function synthesize() {
    return JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '-e', `
        const { App } = require('aws-cdk-lib');
        const { Template } = require('aws-cdk-lib/assertions');
        const { AwsStack } = require('./lib/aws-cdk-js-dev-guide-stack.ts');
        const app = new App({ context: {
            '@aws-cdk/aws-ec2:restrictDefaultSecurityGroup': true,
        } });
        const stack = new AwsStack(app, 'RdsTest', {
            env: { account: '123456789012', region: 'us-east-1' },
        }, { resources: ['rds'] });
        console.log(JSON.stringify(Template.fromStack(stack).toJSON()));
    `], { encoding: 'utf8', timeout: 30000 }));
}

describe('RDS security', () => {
    const template = synthesize();
    const resources = Object.values(template.Resources);
    const database = template.Resources.postgresinstanceF7987B74;

    test('encrypts database storage and preserves snapshot retention', () => {
        expect(database.Type).toBe('AWS::RDS::DBInstance');
        expect(database.Properties.StorageEncrypted).toBe(true);
        expect(database.DeletionPolicy).toBe('Snapshot');
        expect(database.UpdateReplacePolicy).toBe('Snapshot');
    });

    test('allows PostgreSQL only from the Lambda security group', () => {
        const lambda = resources.find(resource => resource.Type === 'AWS::Lambda::Function'
            && resource.Properties.Environment?.Variables?.POSTGRES_HOST);
        const databaseGroup = database.Properties.VPCSecurityGroups[0];
        expect(String(database.Properties.Port)).toBe('5432');
        const databasePort = { 'Fn::GetAtt': ['postgresinstanceF7987B74', 'Endpoint.Port'] };
        expect(database.Properties.VPCSecurityGroups).toHaveLength(1);
        expect(databaseGroup).toEqual({ 'Fn::GetAtt': ['postgresinstanceSecurityGroupCCBAAEF5', 'GroupId'] });
        const ingress = resources.flatMap(resource => {
            if (resource.Type === 'AWS::EC2::SecurityGroupIngress') return [resource.Properties];
            if (resource.Type === 'AWS::EC2::SecurityGroup') return resource.Properties.SecurityGroupIngress ?? [];
            return [];
        });
        expect(ingress).toEqual([
            expect.objectContaining({
                GroupId: databaseGroup,
                SourceSecurityGroupId: lambda.Properties.VpcConfig.SecurityGroupIds[0],
                IpProtocol: 'tcp', FromPort: databasePort, ToPort: databasePort,
            }),
        ]);
        expect(ingress[0]).not.toHaveProperty('CidrIp');
        expect(ingress[0]).not.toHaveProperty('CidrIpv6');
    });
});
