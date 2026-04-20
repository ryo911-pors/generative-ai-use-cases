#!/usr/bin/env node
import 'source-map-support/register';
// Load secrets from .env at the project root before reading CDK context.
// parameter.ts falls back to process.env for secret fields when the
// context is empty, so cdk.json can stay free of API keys.
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import * as cdk from 'aws-cdk-lib';
import { getParams } from '../parameter';
import { createStacks } from '../lib/create-stacks';
import { TAG_KEY } from '../consts';

const app = new cdk.App();
const params = getParams(app);
if (params.tagValue) {
  const tagKey = params.tagKey || TAG_KEY;
  cdk.Tags.of(app).add(tagKey, params.tagValue, {
    // Exclude OpenSearchServerless Collection from tagging
    excludeResourceTypes: ['AWS::OpenSearchServerless::Collection'],
  });
}
createStacks(app, params);
