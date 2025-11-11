#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TimeTrackingStack } from './stacks/time-tracking-stack';

const app = new cdk.App();

// Get environment from context or use defaults
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Create the main stack
new TimeTrackingStack(app, 'TimeTrackingStack', {
  env,
  description: 'Time Tracking and Scheduling App Infrastructure',
  tags: {
    Application: 'TimeTracking',
    Environment: process.env.STAGE || 'dev',
  },
});

app.synth();
