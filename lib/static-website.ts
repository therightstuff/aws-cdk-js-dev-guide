import { RemovalPolicy, StackProps, CfnOutput } from 'aws-cdk-lib';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { CloudFrontWebDistribution, OriginProtocolPolicy, SecurityPolicyProtocol, SSLMethod } from 'aws-cdk-lib/aws-cloudfront';
import { ARecord, CnameRecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { WrappedError } from './common';
import { AwsStack } from './aws-cdk-js-dev-guide-stack';

export class StaticWebsite {
    constructor(stack: AwsStack, id: string, props?: StackProps, customOptions?: any) {
        // NOTE: See README.md for instructions on how to configure a Hosted Zone.
        // CAUTION: Hosted Zones are not free, nor is their usage. Each domain you
        //          configure will cost you a minimum of $0.50 per month (assuming
        //          reasonable use)
        //          See https://aws.amazon.com/route53/pricing/ for more details.

        const domainName = null; // eg. "example.com";

        if (domainName) {
            // Many thanks to https://blog.dennisokeeffe.com/blog/2020-11-04-deploying-websites-to-aws-s3-with-the-cdk
            // and GitHub Copilot for this example!
            let zone;
            try {
                zone = HostedZone.fromLookup(stack, domainName, {
                    domainName,
                });
            } catch (err) {
                // throw a wrapped error to make it easier to find in the logs
                throw new WrappedError(`Hosted zone not found / region not specified for stack ${id} with region options ${props}.`, err);
            }
            new CfnOutput(stack, "Site", { value: "https://" + domainName });

            // create the site bucket
            const siteBucket = new Bucket(stack, "static-website", {
                bucketName: domainName,
                websiteIndexDocument: "index.html",
                publicReadAccess: true, // your bucket will be browsable directly via unsecured HTTP
                removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
                autoDeleteObjects: true, // NOT recommended for production code
            });
            new CfnOutput(stack, "Bucket", { value: siteBucket.bucketName });

            const subdomainName = `www.${domainName}`;

            // TLS certificate, see https://serverfault.com/a/1047117 for domain/subdomain configuration
            const dnsValidatedCertificate = new DnsValidatedCertificate(
                stack,
                "SiteCertificate",
                {
                    domainName: domainName,
                    subjectAlternativeNames: [subdomainName],
                    hostedZone: zone,
                    region: "us-east-1", // Cloudfront only checks us-east-1 (N. Virginia) for certificates.
                }
                );
                new CfnOutput(stack, "Certificate", {
                    value: dnsValidatedCertificate.certificateArn
                });

                // CloudFront distribution that provides HTTPS
                const distribution = new CloudFrontWebDistribution(
                    stack,
                    "SiteDistribution",
                    {
                        viewerCertificate: {
                            aliases: [domainName, subdomainName],
                            props: {
                                acmCertificateArn: dnsValidatedCertificate.certificateArn,
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
                        ],
                        }
                    );
                    new CfnOutput(stack, "DistributionId", {
                        value: distribution.distributionId,
                    });

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
            };
