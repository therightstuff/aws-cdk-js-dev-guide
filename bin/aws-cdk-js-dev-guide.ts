#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsStack } from '../lib/aws-cdk-js-dev-guide-stack';
import regionsJson from './regions.json';

const app = new cdk.App();

// source region / account details from regions.json
type regionsType = {
    [key: string]: any
}

let regions: regionsType = regionsJson;

if (Object.keys(regions).length == 0) {
    // deploy region-agnostic when no regions are specified
    new AwsStack(app, `AwsStack`);
} else {
    for (let region in regions) {
        new AwsStack(app, `AwsStack-${region}`, { env: regions[region] });
    }
}
