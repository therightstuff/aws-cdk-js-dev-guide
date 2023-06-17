import { StackProps } from 'aws-cdk-lib';
import { IpAddresses, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { AwsStack } from './aws-cdk-js-dev-guide-stack';

export class VpcResources {
    constructor(stack: AwsStack, id: string, props?: StackProps, customOptions?: any) {
        stack.vpc = new Vpc(stack, `vpc-${id}`, {
            vpcName: `vpc-${id}`,
            ipAddresses: IpAddresses.cidr('10.0.0.0/16'),
            maxAzs: 3, // Default is all AZs in region
            natGateways: 1,
            subnetConfiguration: [
                {
                    // This subnet is for traffic between the function
                    // and the database
                    name: 'private-subnet',
                    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                    cidrMask: 24,
                },
                {
                    // This subnet is for external traffic
                    name: 'public-subnet',
                    subnetType: SubnetType.PUBLIC,
                    cidrMask: 24,
                },
            ],
        });

        stack.securityGroup = new SecurityGroup(stack, `security-group-${id}`, {
            vpc: stack.vpc,
            securityGroupName: `security-group-${id}`,
        });
    }
};
