# Development Setup Guide

This guide will help you set up your local development environment for the Time Tracking & Scheduling Application.

## Prerequisites

### Required Software

1. **Node.js and npm**
   ```bash
   # Install Node.js 18 or higher
   # Visit https://nodejs.org/ or use nvm
   nvm install 18
   nvm use 18

   # Verify installation
   node --version  # Should be >= 18.0.0
   npm --version   # Should be >= 9.0.0
   ```

2. **AWS CLI**
   ```bash
   # Install AWS CLI v2
   # Visit https://aws.amazon.com/cli/

   # Verify installation
   aws --version

   # Configure AWS credentials
   aws configure
   # Enter your AWS Access Key ID
   # Enter your AWS Secret Access Key
   # Enter your default region (e.g., us-east-1)
   # Enter default output format (json)
   ```

3. **AWS CDK CLI**
   ```bash
   # Install globally
   npm install -g aws-cdk

   # Verify installation
   cdk --version
   ```

4. **Git**
   ```bash
   # Verify installation
   git --version
   ```

### Optional Tools

- **Docker** (for local DynamoDB testing)
- **Postman** or **Insomnia** (for API testing)
- **AWS SAM CLI** (for local Lambda testing)

## Project Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd time-tracking-app
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
npm install

# This will install dependencies for:
# - Root workspace
# - packages/shared
# - packages/backend
# - packages/web
# - packages/infrastructure
```

### 3. Build Shared Package

The shared package contains types and utilities used by all other packages.

```bash
# Build the shared package
npm run build -w @time-tracking/shared

# Or in watch mode for development
npm run dev -w @time-tracking/shared
```

### 4. Configure Environment Variables

#### Backend (Lambda Functions)

The backend uses AWS environment variables set via CDK. No local `.env` file is needed for deployed functions.

For local testing:
```bash
# packages/backend/.env.local
TABLE_NAME=TimeTrackingApp
S3_BUCKET_NAME=time-tracking-app-dev
USER_POOL_ID=us-east-1_xxxxx
USER_POOL_CLIENT_ID=xxxxx
REGION=us-east-1
AUTO_CONFIRM_USERS=true
```

#### Web Application

```bash
# packages/web/.env.local
VITE_API_URL=https://xxxxx.execute-api.us-east-1.amazonaws.com/prod
VITE_USER_POOL_ID=us-east-1_xxxxx
VITE_USER_POOL_CLIENT_ID=xxxxx
```

### 5. Deploy Infrastructure (First Time)

#### Bootstrap CDK (One-time per AWS account/region)

```bash
cd packages/infrastructure
cdk bootstrap aws://<ACCOUNT-ID>/<REGION>
```

#### Deploy Stack

```bash
# Synthesize CloudFormation template
cdk synth

# Review changes
cdk diff

# Deploy
cdk deploy

# Save the output values (API URL, User Pool ID, etc.)
```

After deployment, you'll see outputs like:
```
Outputs:
TimeTrackingStack.ApiUrl = https://xxxxx.execute-api.us-east-1.amazonaws.com/prod
TimeTrackingStack.UserPoolId = us-east-1_xxxxx
TimeTrackingStack.UserPoolClientId = xxxxx
TimeTrackingStack.BucketName = time-tracking-app-xxxxx-us-east-1
TimeTrackingStack.TableName = TimeTrackingApp
```

Update your `.env.local` files with these values.

### 6. Start Development Servers

#### Terminal 1: Web Application
```bash
npm run dev:web

# Or
cd packages/web
npm run dev

# App will open at http://localhost:3000
```

#### Terminal 2: Backend (Watch Mode)
```bash
npm run dev:backend

# Or
cd packages/backend
npm run dev
```

#### Terminal 3: Shared Package (Watch Mode)
```bash
cd packages/shared
npm run dev
```

## Development Workflow

### Making Changes

1. **Shared Package Changes**
   - Edit files in `packages/shared/src/`
   - TypeScript will automatically recompile
   - Changes are immediately available to backend and web

2. **Backend Changes**
   - Edit Lambda functions in `packages/backend/src/`
   - Deploy specific function: `cdk deploy --hotswap` (faster)
   - Or deploy all: `cdk deploy`

3. **Web Changes**
   - Edit React components in `packages/web/src/`
   - Vite hot module replacement updates instantly
   - No need to refresh browser

4. **Infrastructure Changes**
   - Edit CDK stacks in `packages/infrastructure/lib/`
   - Review: `cdk diff`
   - Deploy: `cdk deploy`

### Testing

#### Unit Tests (Coming Soon)

```bash
# Run all tests
npm test

# Run tests for specific package
npm test -w @time-tracking/backend

# Watch mode
npm test -- --watch
```

#### API Testing

Use the provided Postman/Insomnia collection:

```bash
# Import collection from
docs/api-collection.json
```

Or use curl:

```bash
# Signup
curl -X POST https://your-api-url/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234",
    "firstName": "John",
    "lastName": "Doe",
    "orgName": "Test Org"
  }'

# Login
curl -X POST https://your-api-url/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234"
  }'
```

### Local DynamoDB (Optional)

For offline development:

```bash
# Install DynamoDB Local
npm install -g dynamodb-admin

# Start DynamoDB Local
docker run -p 8000:8000 amazon/dynamodb-local

# In another terminal, start admin UI
dynamodb-admin

# Update Lambda environment to use local endpoint
# endpoint: http://localhost:8000
```

## IDE Setup

### VS Code (Recommended)

#### Required Extensions
- ESLint
- Prettier
- TypeScript + JavaScript
- AWS Toolkit

#### Optional Extensions
- DynamoDB Workbench
- GitLens
- Thunder Client (API testing)

#### Workspace Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

#### Launch Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Web App",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/packages/web/src"
    }
  ]
}
```

### WebStorm/IntelliJ

1. Open project root
2. Mark `packages/*/src` as source roots
3. Enable TypeScript service
4. Configure ESLint and Prettier

## Troubleshooting

### Common Issues

#### 1. CDK Deploy Fails

```bash
# Issue: Bootstrap required
# Solution:
cdk bootstrap

# Issue: Insufficient permissions
# Solution: Check IAM permissions for your AWS credentials
aws sts get-caller-identity
```

#### 2. npm install Fails

```bash
# Issue: Node version mismatch
# Solution: Use correct Node version
nvm use 18

# Issue: Lock file conflicts
# Solution: Remove and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 3. Web App Can't Connect to API

```bash
# Issue: CORS errors
# Solution: Check API Gateway CORS configuration

# Issue: Wrong API URL
# Solution: Verify .env.local has correct API URL
cat packages/web/.env.local
```

#### 4. Lambda Function Errors

```bash
# View logs
aws logs tail /aws/lambda/TimeTracking-ClockIn --follow

# Or use CloudWatch Insights
# Navigate to CloudWatch > Logs > Insights in AWS Console
```

#### 5. DynamoDB Access Denied

```bash
# Issue: Lambda IAM role missing permissions
# Solution: Check CDK stack grants table access
# packages/infrastructure/lib/time-tracking-stack.ts
# Look for: table.grantReadWriteData(lambdaRole)
```

## Database Seeding (Development)

Create test data for development:

```bash
# Run seeder script (coming soon)
npm run seed

# Or manually create via API
# See docs/api-examples.sh
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add your feature"

# Push to remote
git push origin feature/your-feature-name

# Create pull request on GitHub
```

## Code Style

We use ESLint and Prettier for code formatting.

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint -- --fix

# Format code
npm run format
```

## Performance Testing

```bash
# Install k6 for load testing
brew install k6

# Run load test
k6 run tests/load-test.js

# Monitor with CloudWatch during test
```

## Next Steps

1. ✅ Complete setup steps above
2. ✅ Deploy infrastructure
3. ✅ Start development servers
4. 📖 Read [ARCHITECTURE.md](./ARCHITECTURE.md)
5. 📖 Read [DATABASE.md](./DATABASE.md)
6. 🔨 Start building features!

## Getting Help

- **Documentation**: Check `docs/` folder
- **Issues**: Create GitHub issue
- **Slack**: Join #time-tracking-dev channel
- **Email**: dev-team@example.com

## Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
