#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsStack } from '../lib/aws-cdk-js-dev-guide-stack';
import regionsJson from '../lib/regions.json';
import stagesJson from '../lib/stages.json';

const app = new cdk.App();

// source region / account details from regions.json
type regionsType = {
    [key: string]: any
}

let regions: regionsType = regionsJson;

// determine which stacks will be deployed to which regions
// for region-agnostic deployments, set the region to the empty string
type stageType = {
    "origin": string,
    "regions": string[]
}
type stagesType = {
    [key: string]: stageType
}

// the sample configuration results in the creation of AwsStack-dev,
// AwsStack-prod-za, AwsStack-test-eu and AwsStack-test-za
let stages:stagesType = stagesJson;

for (let name in stages) {
    let stage:stageType = stages[name];
    for (let i in stage.regions) {
        let region = stage.regions[i];
        if (region.length == 0) {
            // deploy region-agnostic when no region is specified
            new AwsStack(app, `AwsStack-${name}`, undefined, stage.origin);
        } else {
            new AwsStack(app, `AwsStack-${name}-${region}`, { env: regions[region] }, stage.origin);
        }
    }
}
