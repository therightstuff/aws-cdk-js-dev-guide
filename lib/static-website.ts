import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { RestApi } from "aws-cdk-lib/aws-apigateway";
import {
    AccessLevel,
    AllowedMethods,
    CachePolicy,
    Distribution,
    Function,
    FunctionCode,
    FunctionEventType,
    IOrigin,
    OriginProtocolPolicy,
    OriginRequestPolicy,
    ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin, S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { ARecord, CnameRecord, RecordTarget } from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import { Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { AwsStack } from "./aws-cdk-js-dev-guide-stack";

// see https://medium.com/aws-tip/pssst-wanna-set-up-a-reverse-proxy-api-on-an-aws-hosted-single-page-application-938937e50a11
// for a detailed explanation of how a static website with a reverse proxy API works
export class StaticWebsite {
    constructor(
        stack: AwsStack,
        id: string,
        props?: StackProps,
        customOptions?: any
    ) {
        const domainName = customOptions.domainName;
        const isNakedDomainTarget = customOptions.isNakedDomainTarget;
        const subdomainNames = customOptions.subdomainNames.map(
            (subdomain: string) => `${subdomain}.${domainName}`
        );
        const zone = customOptions.zone;

        // the site bucket for the static website
        const siteBucket = new Bucket(stack, "static-website", {
            bucketName: domainName,
            encryption: BucketEncryption.S3_MANAGED,
            publicReadAccess: false,
            removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
            autoDeleteObjects: true, // NOT recommended for production code
        });

        const s3Origin = S3BucketOrigin.withOriginAccessControl(siteBucket, {
            originAccessLevels: [AccessLevel.READ],
        });

        // the API Gateway API for the static website
        const siteApi = new RestApi(stack, "site-api");

        // the site API must have an /api resource which is where the site's API calls will be mapped to
        // WARNING: actual functionality of the site's API is an exercise left to the reader
        const siteApiRoot = siteApi.root.addResource("api");
        // a dummy method, as CDK will not synthesize without any methods
        const siteApiGet = siteApiRoot.addMethod("GET");

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

        const redirectFunction = generateRedirectFunction(
            stack,
            "subdirectory",
            "subdirectory"
        );

        const distribution = new Distribution(stack, "SiteDistribution", {
            domainNames: isNakedDomainTarget
                ? [domainName, ...subdomainNames]
                : [...subdomainNames],
            certificate: customOptions.certificate,
            // the default behavior is how we set up the static website
            defaultBehavior: {
                origin: s3Origin,
                allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                cachePolicy: CachePolicy.CACHING_OPTIMIZED,
                viewerProtocolPolicy: ViewerProtocolPolicy.ALLOW_ALL,
            },
            // additional behaviors is how we set up a reverse proxy to the API,
            // as well as any redirects required for subdirectories. this won't be
            // necessary for an SPA, as an SPA should handle its own routing.
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
                    originRequestPolicy:
                        OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                },
                // unfortunately, the supported wildcards are non-standard
                // and quite limited, see Path pattern under
                // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html
                subdirectory: generateRedirectBehavior(
                    s3Origin,
                    redirectFunction
                ),
                "subdirectory/": generateRedirectBehavior(
                    s3Origin,
                    redirectFunction
                ),
            },
            defaultRootObject: "index.html",
            errorResponses: regularErrorResponses,
        });

        // Route53 alias record for the naked domain's CloudFront distribution
        // Leave this out if you're only deploying to a subdomain / subdomains
        if (isNakedDomainTarget) {
            new ARecord(stack, "SiteAliasRecord", {
                recordName: domainName,
                target: RecordTarget.fromAlias(
                    new targets.CloudFrontTarget(distribution)
                ),
                zone,
            });
        }

        // Route53 alias record for a subdomain's CloudFront distribution
        for (const subdomainName of subdomainNames) {
            new CnameRecord(stack, "SiteCnameRecord", {
                recordName: subdomainName,
                domainName: distribution.distributionDomainName,
                zone,
            });
        }

        // Deploy the static website to the site bucket
        // The distribution must be specified in order to perform cache
        // invalidation, up to 1000 invalidations free per month
        new BucketDeployment(stack, "static-website-deployment", {
            sources: [Source.asset("./static-website")],
            destinationBucket: siteBucket,
            distribution: distribution,
        });
    }
}

function generateRedirectBehavior(
    s3Origin: IOrigin,
    redirectFunction: Function
) {
    return {
        origin: s3Origin,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: ViewerProtocolPolicy.ALLOW_ALL,
        functionAssociations: [
            {
                function: redirectFunction,
                eventType: FunctionEventType.VIEWER_REQUEST,
            },
        ],
    };
}

function generateRedirectFunction(
    stack: Stack,
    name: string,
    subdirectory: string
) {
    // configure a redirect function that will redirect to a subdirectory
    // or rewrite the subdirectory as its index.html page
    return new Function(stack, `${name}-redirect-function`, {
        code: FunctionCode.fromInline(`
            function handler(event) {
                var request = event.request;
                var uri = request.uri;

                // if the request is for the subdirectory, redirect to the subdirectory/
                // this is to ensure that any relative links in the application will work
                // correctly
                if (uri === '/${subdirectory}') {
                    var relocation = '/${subdirectory}/';
                    // if there's a querystring, we need to preserve it
                    if (request.querystring) {
                        relocation += '?' + getURLSearchParamsString(request.querystring);
                    }
                    return {
                        statusCode: 302,
                        statusDescription: 'Found',
                        headers: {
                            "location": { value: relocation }
                        }
                    };
                }

                request.uri = uri + 'index.html';

                return request;
            }

            // Helper function to format query string parameters, see
            // https://github.com/aws-samples/amazon-cloudfront-functions/issues/11
            function getURLSearchParamsString(querystring) {
                var str = [];

                for (var param in querystring) {
                    var query = querystring[param];
                    var multiValue = query.multiValue;

                    if (multiValue) {
                        str.push(multiValue.map((item) => param + '=' + item.value).join('&'));
                    } else if (query.value === '') {
                        str.push(param);
                    } else {
                        str.push(param + '=' + query.value);
                    }
                }

                return str.join('&');
            }
        `),
    });
}
