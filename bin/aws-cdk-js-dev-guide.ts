#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import path from 'path';
import 'source-map-support/register';

import { AwsStack } from '../lib/aws-cdk-js-dev-guide-stack';
import { CertificateStack } from '../lib/certificate-stack';
import loadSensitiveJson from './load-sensitive-json';

// begin CDK stack synthesis
const app = new cdk.App();
// this will add an app tag to all components
cdk.Tags.of(app).add("app", "my-app-tag");

// determine which stacks will be deployed to which regions
// for region-agnostic deployments, set the region to null
let stacks:any = loadSensitiveJson(path.resolve(__dirname, '../lib/stacks.json'));

for (let name in stacks) {
    let stack:any = stacks[name];

    if (stack.domainName) {
        let certificateStackName = `AwsStack-Cert-${name}`;
        let certificateStackInstance = new CertificateStack(
            app, certificateStackName, {
                env: {
                    "region": "us-east-1",
                    "account": stack.account,
                },
            }, stack
        );
        cdk.Tags.of(certificateStackInstance).add('stack-name', certificateStackName);

        // inject the certificate and zone into the primary stack's custom options
        stack.zone = certificateStackInstance.zone;
        stack.certificate = certificateStackInstance.certificate;
    }

    let regionOptions;
    let stackName = `AwsStack-${name}`;
    if (!stack.region) {
        // deploy region-agnostic when no region is specified
        regionOptions = undefined;
    } else {
        regionOptions = {
            env: {
                "region": stack.region,
                "account": stack.account,
            }
        };
    }
    let stackInstance = new AwsStack(
        app, stackName,
        regionOptions,
        stack
    );
    cdk.Tags.of(stackInstance).add('stack-name', stackName);
}
