#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsStack } from '../lib/aws-cdk-js-dev-guide-stack';
import regionsJson from '../lib/regions.json';
import stagesJson from '../lib/stages.json';

const app = new cdk.App();
// this will add an app tag to all components
cdk.Tags.of(app).add("app", "my-app-tag");

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
        let regionKey = stage.regions[i];
        let stackName;
        let regionOptions;
        if (regionKey.length == 0) {
            // deploy region-agnostic when no region is specified
            regionOptions = undefined;
            stackName = `AwsStack-${name}`;
        } else {
            let region = regions[regionKey];
            regionOptions = { env: region };
            stackName = `AwsStack-${name}-${regionKey}`;
        }
        let stackInstance = new AwsStack(app, stackName, regionOptions, stage.origin);
        // this will add a stack tag to all stack components
        cdk.Tags.of(stackInstance).add('stack-name', stackName);
    }
}
