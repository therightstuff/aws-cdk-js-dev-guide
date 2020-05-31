#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsLocalDevStack } from '../lib/aws-local-dev-stack';

const app = new cdk.App();
new AwsLocalDevStack(app, 'AwsLocalDevStack');
