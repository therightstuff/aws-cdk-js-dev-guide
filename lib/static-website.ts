import { RemovalPolicy, StackProps } from 'aws-cdk-lib';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { AllowedMethods, CachePolicy, Distribution, OriginAccessIdentity, OriginProtocolPolicy, OriginRequestPolicy, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin, S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { ARecord, CnameRecord, RecordTarget } from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { AwsStack } from './aws-cdk-js-dev-guide-stack';

// see https://medium.com/aws-tip/pssst-wanna-set-up-a-reverse-proxy-api-on-an-aws-hosted-single-page-application-938937e50a11
// for a detailed explanation of how a static website with a reverse proxy API works
export class StaticWebsite {
    constructor(stack: AwsStack, id: string, props?: StackProps, customOptions?: any) {
        const domainName = customOptions.domainName;
        const subdomainName = `www.${domainName}`;
        const zone = customOptions.zone;

        // the site bucket for the static website
        const siteBucket = new Bucket(stack, "static-website", {
            bucketName: domainName,
            encryption: BucketEncryption.S3_MANAGED,
            publicReadAccess: false,
            removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
            autoDeleteObjects: true, // NOT recommended for production code
        });

        const originAccessIdentity = new OriginAccessIdentity(stack, 'site-OAI', {
            comment: 'website OAI'
        });
        const s3Origin = new S3Origin(siteBucket, {originAccessIdentity: originAccessIdentity})

        // the API Gateway API for the static website
        const siteApi = new RestApi(stack, 'site-api');

        // the site API must have an /api resource which is where the site's API calls will be mapped to
        // WARNING: actual functionality of the site's API is an exercise left to the reader
        const siteApiRoot = siteApi.root.addResource('api');
        // a dummy method, as CDK will not synthesize without any methods
        const siteApiGet = siteApiRoot.addMethod('GET');

        // NOTE: it amazes me that manually reconstructing this url is required.
        const apiOriginName = `${siteApi.restApiId}.execute-api.${stack.region}.amazonaws.com`;

        // origin path must be set to the stage name, and this assumes that after
        // the path there is a /api resource that will be mapped to. in other words,
        // if the cloudfront path matches example.com/api/abc, it will redirect to the
        // /{stage}/api/abc resource of the API
        const apiOriginPath = `/${siteApi.deploymentStage.stageName}`;

        // if the static website is a single page application (SPA), redirect the
        // error responses to the index.html page with a 200 response.
        const spaErrorResponses = [
            {
                httpStatus: 403,
                responseHttpStatus: 200,
                responsePagePath: "/index.html",
            },
            {
                httpStatus: 404,
                responseHttpStatus: 200,
                responsePagePath: "/index.html",
            },
        ];
        // if it's a regular website, however, redirect to the appropriate error pages.
        const regularErrorResponses = [
            {
                httpStatus: 403,
                responseHttpStatus: 403,
                responsePagePath: "/error-403.html",
            },
            {
                httpStatus: 404,
                responseHttpStatus: 404,
                responsePagePath: "/error-404.html",
            },
        ];


        const distribution = new Distribution(
            stack,
            "SiteDistribution",
            {
                domainNames: [domainName, subdomainName],
                certificate: customOptions.certificate,
                // the default behavior is how we set up the static website
                defaultBehavior: {
                    origin: s3Origin,
                    allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                    cachePolicy: CachePolicy.CACHING_OPTIMIZED,
                    viewerProtocolPolicy: ViewerProtocolPolicy.ALLOW_ALL,
                },
                // the addition behaviors is how we set up a reverse proxy to the API
                additionalBehaviors: {
                    "api/*": {
                        origin: new HttpOrigin(apiOriginName, {
                            originId: apiOriginName,
                            protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
                            httpPort: 80,
                            httpsPort: 443,
                            originPath: apiOriginPath,
                        }),
                        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
                        cachePolicy: CachePolicy.CACHING_DISABLED,
                        allowedMethods: AllowedMethods.ALLOW_ALL,
                        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                    },
                },
                defaultRootObject: "index.html",
                errorResponses: regularErrorResponses,
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
