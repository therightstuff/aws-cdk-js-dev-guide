import { RemovalPolicy, StackProps } from 'aws-cdk-lib';
import { CloudFrontWebDistribution, OriginProtocolPolicy, SSLMethod, SecurityPolicyProtocol } from 'aws-cdk-lib/aws-cloudfront';
import { ARecord, CnameRecord, RecordTarget } from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { AwsStack } from './aws-cdk-js-dev-guide-stack';

export class StaticWebsite {
    constructor(stack: AwsStack, id: string, props?: StackProps, customOptions?: any) {
        const domainName = customOptions.domainName;
        const subdomainName = `www.${domainName}`;
        const zone = customOptions.zone;

        const siteBucket = new Bucket(stack, "static-website", {
            bucketName: domainName,
            websiteIndexDocument: "index.html",
            publicReadAccess: true, // your bucket will be browsable directly via unsecured HTTP
            removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
            autoDeleteObjects: true, // NOT recommended for production code
        });

        // CloudFront distribution that provides HTTPS
        const distribution = new CloudFrontWebDistribution(
            stack,
            "SiteDistribution",
            {
                viewerCertificate: {
                    aliases: [domainName, subdomainName],
                    props: {
                        acmCertificateArn: customOptions.certificate.certificateArn,
                        sslSupportMethod: SSLMethod.SNI,
                        minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_1_2016,
                    },
                },
                originConfigs: [
                    {
                        customOriginSource: {
                            domainName: siteBucket.bucketWebsiteDomainName,
                            originProtocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
                        },
                        behaviors: [{ isDefaultBehavior: true }],
                    },
                ],
                errorConfigurations: [
                    {
                        errorCode: 404,
                        errorCachingMinTtl: 1,
                        responseCode: 404,
                        responsePagePath: "/error.html",
                    }
                ]
            }
        );

        // Route53 alias record for the naked domain's CloudFront distribution
        new ARecord(stack, "SiteAliasRecord", {
            recordName: domainName,
            target: RecordTarget.fromAlias(
                new targets.CloudFrontTarget(distribution)
            ),
            zone,
        });

        // Route53 alias record for a subdomain's CloudFront distribution
        new CnameRecord(stack, "SiteCnameRecord", {
            recordName: subdomainName,
            domainName: distribution.distributionDomainName,
            zone,
        });

        // Deploy the static website to the site bucket
        // The distribution must be specified in order to perform cache
        // invalidation, up to 1000 invalidations free per month
        new BucketDeployment(stack, "static-website-deployment", {
            sources: [Source.asset("./static-website")],
            destinationBucket: siteBucket,
            distribution: distribution
        });
    }
}
