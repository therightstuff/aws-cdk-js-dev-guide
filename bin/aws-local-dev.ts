#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsLocalDevStack } from '../lib/aws-local-dev-stack';
import regionsJson from './regions.json';

const app = new cdk.App();

// source region / account details from regions.json
type regionsType = {
    [key: string]: any
}

let regions: regionsType = regionsJson;

// when no regions are specified or when synthesizing for local development,
// do not specify regions or CDK output will not be available in template.yaml
if (process.env.AWS_LOCAL_DEV || Object.keys(regions).length == 0) {
    new AwsLocalDevStack(app, `AwsLocalDevStack-local`);
} else {
    for (let region in regions) {
        new AwsLocalDevStack(app, `AwsLocalDevStack-${region}`, { env: regions[region] });
    }
}
