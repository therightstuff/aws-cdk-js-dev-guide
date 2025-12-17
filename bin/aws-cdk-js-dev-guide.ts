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
    let crossRegionReferences = false;

    // CERTIFICATE-STACK-START
    // if the stack requires a certificate, create a certificate stack first
    if (stack.domainName && stack.resources.includes("static-website")) {
        let certificateStackName = `AwsStack-Cert-${name}`;
        let certificateStackInstance = new CertificateStack(
            app, certificateStackName, {
                env: {
                    "region": "us-east-1",
                    "account": stack.account,
                }
            }, stack
        );
        cdk.Tags.of(certificateStackInstance).add('stack-name', certificateStackName);

        // inject the certificate and zone into the primary stack's custom options
        stack.zone = certificateStackInstance.zone;
        stack.certificate = certificateStackInstance.certificate;

        crossRegionReferences = true;
    }
    // CERTIFICATE-STACK-END

    let stackName = `AwsStack-${name}`;
    let stackProps: cdk.StackProps = {
        env: stack.region ? {
            "region": stack.region,
            "account": stack.account,
        } : undefined,
        // this is to enable access to the certificate stack resources
        crossRegionReferences: crossRegionReferences
    };

    let stackInstance = new AwsStack(
        app, stackName,
        stackProps,
        stack
    );
    cdk.Tags.of(stackInstance).add('stack-name', stackName);
}
