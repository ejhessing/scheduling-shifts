# Deployment Guide

This guide covers deploying the Time Tracking & Scheduling Application to AWS production environments.

## Deployment Overview

The application uses AWS CDK for infrastructure as code, enabling consistent and repeatable deployments across environments.

## Prerequisites

- AWS account with appropriate permissions
- AWS CLI configured with credentials
- CDK CLI installed (`npm install -g aws-cdk`)
- Project dependencies installed (`npm install`)
- Shared package built (`npm run build -w @time-tracking/shared`)

## Environments

We support multiple deployment environments:

- **Development** (`dev`): For active development and testing
- **Staging** (`staging`): Pre-production environment
- **Production** (`prod`): Live customer-facing environment

## Initial Deployment

### 1. Bootstrap CDK (One-time per Account/Region)

```bash
# Bootstrap for your account and region
cd packages/infrastructure
cdk bootstrap aws://ACCOUNT-ID/REGION

# Example
cdk bootstrap aws://123456789012/us-east-1
```

### 2. Configure Environment Variables

Create environment-specific context in `cdk.json` or use CLI parameters:

```json
{
  "context": {
    "dev": {
      "environment": "dev",
      "autoConfirmUsers": true,
      "logRetentionDays": 7
    },
    "staging": {
      "environment": "staging",
      "autoConfirmUsers": false,
      "logRetentionDays": 14
    },
    "prod": {
      "environment": "prod",
      "autoConfirmUsers": false,
      "logRetentionDays": 30
    }
  }
}
```

### 3. Review Changes

```bash
# Synthesize CloudFormation template
cdk synth

# Review what will be deployed
cdk diff

# Review estimated costs
cdk deploy --no-execute
```

### 4. Deploy Stack

```bash
# Deploy to development
cdk deploy TimeTrackingStack

# Deploy to staging
cdk deploy TimeTrackingStack-Staging --context environment=staging

# Deploy to production (requires approval)
cdk deploy TimeTrackingStack-Prod --context environment=prod --require-approval broadening
```

### 5. Save Stack Outputs

After deployment, save the CloudFormation outputs:

```bash
# Get outputs
aws cloudformation describe-stacks \
  --stack-name TimeTrackingStack \
  --query 'Stacks[0].Outputs' \
  --output table

# Outputs you'll need:
# - ApiUrl
# - UserPoolId
# - UserPoolClientId
# - BucketName
# - TableName
```

## Deploy Web Application

### 1. Build for Production

```bash
cd packages/web

# Set environment variables
export VITE_API_URL=https://xxxxx.execute-api.us-east-1.amazonaws.com/prod
export VITE_USER_POOL_ID=us-east-1_xxxxx
export VITE_USER_POOL_CLIENT_ID=xxxxx

# Build
npm run build

# Output will be in packages/web/dist/
```

### 2. Deploy to S3 + CloudFront

Option A: Manual deployment

```bash
# Create S3 bucket for web hosting
aws s3 mb s3://time-tracking-app-web-prod

# Enable static website hosting
aws s3 website s3://time-tracking-app-web-prod \
  --index-document index.html \
  --error-document index.html

# Upload build
aws s3 sync dist/ s3://time-tracking-app-web-prod \
  --delete \
  --cache-control max-age=31536000

# Upload index.html with no-cache
aws s3 cp dist/index.html s3://time-tracking-app-web-prod/index.html \
  --cache-control no-cache

# Create CloudFront distribution (one-time)
# See: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-creating-console.html

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id EXXXXXXXXXXXXX \
  --paths "/*"
```

Option B: Using CDK (Recommended)

Add to infrastructure stack:

```typescript
// In packages/infrastructure/lib/time-tracking-stack.ts

const webBucket = new s3.Bucket(this, 'WebBucket', {
  websiteIndexDocument: 'index.html',
  websiteErrorDocument: 'index.html',
  publicReadAccess: true,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

const distribution = new cloudfront.Distribution(this, 'WebDistribution', {
  defaultBehavior: {
    origin: new origins.S3Origin(webBucket),
  },
  defaultRootObject: 'index.html',
});

new s3deploy.BucketDeployment(this, 'DeployWebsite', {
  sources: [s3deploy.Source.asset('../web/dist')],
  destinationBucket: webBucket,
  distribution,
  distributionPaths: ['/*'],
});
```

## CI/CD Pipeline

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - run: npm test

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build -w @time-tracking/shared
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - name: Deploy to staging
        run: |
          cd packages/infrastructure
          npx cdk deploy TimeTrackingStack-Staging --require-approval never

  deploy-production:
    needs: deploy-staging
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build -w @time-tracking/shared
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID_PROD }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY_PROD }}
          aws-region: us-east-1
      - name: Deploy to production
        run: |
          cd packages/infrastructure
          npx cdk deploy TimeTrackingStack-Prod --require-approval never
```

### Required GitHub Secrets

Add these in GitHub Settings > Secrets:

- `AWS_ACCESS_KEY_ID`: AWS credentials for staging
- `AWS_SECRET_ACCESS_KEY`: AWS credentials for staging
- `AWS_ACCESS_KEY_ID_PROD`: AWS credentials for production
- `AWS_SECRET_ACCESS_KEY_PROD`: AWS credentials for production

## Rollback Strategy

### Lambda Functions

Lambda maintains previous versions automatically.

```bash
# List function versions
aws lambda list-versions-by-function \
  --function-name TimeTracking-ClockIn

# Update alias to previous version
aws lambda update-alias \
  --function-name TimeTracking-ClockIn \
  --name live \
  --function-version 23
```

### CloudFormation Stack

```bash
# Rollback entire stack
cdk deploy --rollback

# Or use AWS Console:
# CloudFormation > Stacks > Select Stack > Actions > Roll back
```

### Database

```bash
# DynamoDB Point-in-Time Recovery
aws dynamodb restore-table-to-point-in-time \
  --source-table-name TimeTrackingApp \
  --target-table-name TimeTrackingApp-Restored \
  --restore-date-time 2024-01-15T10:00:00Z
```

## Monitoring Post-Deployment

### 1. Check CloudWatch Alarms

```bash
# List alarms
aws cloudwatch describe-alarms \
  --alarm-name-prefix TimeTracking

# Check alarm state
aws cloudwatch describe-alarm-history \
  --alarm-name TimeTracking-HighErrorRate \
  --max-records 10
```

### 2. View Lambda Logs

```bash
# Tail logs for specific function
aws logs tail /aws/lambda/TimeTracking-ClockIn --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/TimeTracking-ClockIn \
  --filter-pattern "ERROR"
```

### 3. API Gateway Metrics

Check CloudWatch Metrics:
- `Count`: Number of API requests
- `4XXError`: Client errors
- `5XXError`: Server errors
- `Latency`: Response times
- `IntegrationLatency`: Backend processing time

### 4. DynamoDB Metrics

- `ConsumedReadCapacityUnits`
- `ConsumedWriteCapacityUnits`
- `UserErrors`
- `SystemErrors`
- `ThrottledRequests`

## Performance Testing

Before production deployment, run performance tests:

```bash
# Install k6
brew install k6

# Run load test
k6 run tests/load-test.js --vus 100 --duration 5m

# Monitor during test
# - CloudWatch Metrics
# - X-Ray Traces
# - Lambda Concurrent Executions
```

## Cost Optimization

### Lambda
- Set appropriate memory sizes (512MB default)
- Use reserved concurrency for predictable workloads
- Monitor invocation counts and durations

### DynamoDB
- Use on-demand for variable traffic
- Monitor for hot partitions
- Archive old data to S3

### API Gateway
- Enable caching for read-heavy endpoints
- Set appropriate cache TTL (5-15 minutes)

### S3
- Enable Intelligent Tiering
- Set lifecycle policies
- Use CloudFront CDN

## Security Checklist

Before production deployment:

- [ ] Enable CloudTrail logging
- [ ] Configure AWS Config rules
- [ ] Set up AWS WAF on API Gateway
- [ ] Enable GuardDuty
- [ ] Rotate IAM access keys
- [ ] Review security group rules
- [ ] Enable MFA for critical operations
- [ ] Set up budget alerts
- [ ] Configure AWS Backup
- [ ] Review IAM policies (least privilege)
- [ ] Enable encryption at rest
- [ ] Configure VPC endpoints (if using VPC)
- [ ] Set up AWS Secrets Manager for sensitive data

## Disaster Recovery

### Backup Strategy

1. **DynamoDB**: Point-in-time recovery enabled (35 days)
2. **S3**: Versioning enabled on all buckets
3. **Lambda**: Code stored in S3 by CDK
4. **Cognito**: Export users via AWS Console

### Recovery Procedures

1. **Database Corruption**
   ```bash
   aws dynamodb restore-table-to-point-in-time \
     --source-table-name TimeTrackingApp \
     --target-table-name TimeTrackingApp-Restored \
     --restore-date-time <TIMESTAMP>
   ```

2. **Lambda Function Issues**
   ```bash
   # Rollback to previous version
   cdk deploy --rollback
   ```

3. **Complete Stack Failure**
   ```bash
   # Redeploy from source
   cd packages/infrastructure
   cdk deploy --force
   ```

## Post-Deployment Verification

### Smoke Tests

```bash
# Test authentication
curl -X POST https://api.example.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}'

# Test time tracking
curl -X POST https://api.example.com/time-tracking/clock-in \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### Health Checks

Create a health check endpoint:

```typescript
// packages/backend/src/health/check.ts
export async function handler() {
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.VERSION,
    }),
  };
}
```

Monitor with:
```bash
curl https://api.example.com/health
```

## Troubleshooting Deployments

### CDK Deploy Fails

```bash
# Issue: Stack in UPDATE_ROLLBACK_COMPLETE state
# Solution: Delete and redeploy
cdk destroy
cdk deploy

# Issue: Resource already exists
# Solution: Import existing resource or rename
```

### Lambda Cold Starts

```bash
# Issue: High latency on first request
# Solutions:
# 1. Enable Provisioned Concurrency
# 2. Use AWS Lambda SnapStart (for Java)
# 3. Implement keep-warm function
```

### API Gateway 502 Errors

```bash
# Check Lambda function logs
aws logs tail /aws/lambda/FunctionName --follow

# Check Lambda execution role permissions
aws iam get-role-policy --role-name LambdaExecutionRole

# Check API Gateway integration timeout (max 29s)
```

## Updating Dependencies

```bash
# Update npm packages
npm update

# Check for outdated packages
npm outdated

# Update CDK
npm install -g aws-cdk@latest
npm update aws-cdk-lib

# Test after updates
npm test
cdk synth
```

## Compliance & Auditing

### Enable CloudTrail

```bash
aws cloudtrail create-trail \
  --name TimeTrackingAppTrail \
  --s3-bucket-name time-tracking-logs
```

### Enable AWS Config

```bash
aws configservice put-configuration-recorder \
  --configuration-recorder name=TimeTrackingRecorder,roleARN=arn:aws:iam::123456789012:role/config-role
```

## Support & Escalation

### Deployment Issues
- Check CloudFormation events
- Review CloudWatch logs
- Contact DevOps team

### Production Incidents
1. Check monitoring dashboards
2. Review recent deployments
3. Rollback if necessary
4. Post incident review

## Additional Resources

- [AWS CDK Best Practices](https://docs.aws.amazon.com/cdk/latest/guide/best-practices.html)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Serverless Application Lens](https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/welcome.html)
