# Development Guide

## Prerequisites

- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **AWS CLI**: v2.x configured with credentials
- **AWS CDK**: v2.x (`npm install -g aws-cdk`)
- **Git**: Latest version

## Initial Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd scheduling-shifts
```

### 2. Backend Setup

#### Install Dependencies
```bash
cd backend/infrastructure
npm install
```

#### Configure AWS Credentials
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter your default region (e.g., us-east-1)
# Enter output format (json)
```

#### Bootstrap CDK (First Time Only)
```bash
cdk bootstrap
```

#### Deploy Infrastructure
```bash
cdk deploy
```

This will:
- Create DynamoDB table
- Create S3 bucket
- Create Cognito user pool
- Deploy 47 Lambda functions
- Create API Gateway
- Set up SNS, SES, EventBridge

**Note**: Save the outputs (API URL, User Pool ID, etc.)

### 3. Frontend Setup

#### Install Dependencies
```bash
cd ../../frontend/web
npm install
```

#### Configure Environment
Create `.env` file:
```env
VITE_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/prod
VITE_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### Start Development Server
```bash
npm run dev
```

Navigate to `http://localhost:5173`

## Development Workflow

### Backend Development

#### Project Structure
```
backend/
├── infrastructure/        # CDK infrastructure code
│   ├── bin/              # CDK app entry
│   └── stacks/           # Stack definitions
├── services/             # Lambda function handlers
│   ├── auth/
│   ├── users/
│   ├── time/
│   ├── schedule/
│   ├── timeOff/
│   ├── analytics/
│   ├── payroll/
│   └── documents/
└── shared/               # Shared utilities
    ├── db.ts
    ├── auth.ts
    ├── response.ts
    └── ...
```

#### Adding a New Lambda Function

1. **Create Handler**:
```typescript
// backend/services/example/myFunction.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb } from '../../shared/db';
import { verifyToken } from '../../shared/auth';
import { success, error } from '../../shared/response';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Verify authentication
    const user = await verifyToken(event);
    if (!user) {
      return error('Unauthorized', 401);
    }

    // Your logic here
    const db = getDb();

    return success(data, 'Success message');
  } catch (err: any) {
    console.error('Error:', err);
    return error(err.message || 'Internal server error', 500);
  }
};
```

2. **Add to CDK Stack**:
```typescript
// backend/infrastructure/stacks/time-tracking-stack.ts

const myFunction = new NodejsFunction(this, 'MyFunction', {
  ...lambdaDefaults,
  entry: path.join(__dirname, '../../services/example/myFunction.ts'),
  handler: 'handler',
  description: 'Description of function',
});

// Add to allFunctions array
const allFunctions = [
  // ... existing functions
  myFunction,
];

// Add API route
const exampleResource = api.root.addResource('example');
exampleResource.addMethod('GET', new apigateway.LambdaIntegration(myFunction), {
  authorizer,
  authorizationType: apigateway.AuthorizationType.COGNITO,
});
```

3. **Deploy**:
```bash
cd backend/infrastructure
cdk deploy
```

#### Testing Lambda Locally

Use AWS SAM for local testing:
```bash
# Install SAM CLI
brew install aws-sam-cli  # macOS
# or follow: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

# Build and test
sam build
sam local invoke MyFunction --event events/test-event.json
```

#### Viewing Logs
```bash
# Get log group name from CloudWatch
aws logs tail /aws/lambda/TimeTrackingStack-MyFunction --follow
```

### Frontend Development

#### Project Structure
```
frontend/web/src/
├── components/          # Reusable components
│   ├── Layout.tsx      # App shell with sidebar
│   ├── ui.tsx          # UI component library
│   └── ErrorBoundary.tsx
├── pages/              # Page components (one per route)
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   └── ...
├── stores/             # Zustand state stores
│   └── authStore.ts
├── hooks/              # Custom React hooks
│   └── index.ts
├── lib/                # Utilities
│   ├── api.ts         # API client
│   ├── utils.ts       # Utility functions
│   └── validations.ts # Zod schemas
├── types/              # TypeScript types
│   └── index.ts
├── App.tsx             # Root component with routing
└── main.tsx            # Entry point
```

#### Adding a New Page

1. **Create Page Component**:
```typescript
// frontend/web/src/pages/MyPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { myApi } from '../lib/api';
import { PageHeader, LoadingSpinner } from '../components/ui';

export default function MyPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['myData'],
    queryFn: async () => {
      const response = await myApi.getData();
      return response.data.data;
    },
  });

  if (isLoading) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="My Page"
        description="Description"
        icon={MyIcon}
      />
      {/* Your content */}
    </div>
  );
}
```

2. **Add Route**:
```typescript
// frontend/web/src/App.tsx
import MyPage from './pages/MyPage';

// In Routes:
<Route
  path="/my-page"
  element={
    <ProtectedRoute>
      <MyPage />
    </ProtectedRoute>
  }
/>
```

3. **Add Navigation**:
```typescript
// frontend/web/src/components/Layout.tsx
import { MyIcon } from 'lucide-react';

const baseNavigation = [
  // ... existing
  { name: 'My Page', href: '/my-page', icon: MyIcon },
];
```

#### Adding API Endpoint

```typescript
// frontend/web/src/lib/api.ts

export const myApi = {
  getData: () => api.get('/my-endpoint'),
  createData: (data: any) => api.post('/my-endpoint', data),
  updateData: (id: string, data: any) => api.put(`/my-endpoint/${id}`, data),
  deleteData: (id: string) => api.delete(`/my-endpoint/${id}`),
};
```

#### Styling Guidelines

Use Tailwind CSS utility classes:
```tsx
// Good
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
  <h2 className="text-lg font-semibold text-gray-900">Title</h2>
  <button className="px-4 py-2 text-white bg-primary-600 rounded-lg hover:bg-primary-700">
    Button
  </button>
</div>

// Avoid inline styles
<div style={{ display: 'flex' }}>  // Don't do this
```

Common patterns:
- `bg-gray-50` - Page background
- `bg-white rounded-lg shadow-sm` - Cards
- `text-gray-900` - Primary text
- `text-gray-600` - Secondary text
- `text-sm font-medium` - Labels
- `px-4 py-2` - Button padding
- `hover:bg-gray-100` - Hover states

### Shared Utilities

#### DynamoDB Operations
```typescript
import { getDb, putItem, getItem, query, updateItem, deleteItem } from '../shared/db';

const db = getDb();

// Put item
await putItem(db, {
  TableName: process.env.TABLE_NAME!,
  Item: { PK: 'ORG#123', SK: 'USER#456', ...data },
});

// Query
const result = await query(db, {
  TableName: process.env.TABLE_NAME!,
  KeyConditionExpression: 'PK = :pk',
  ExpressionAttributeValues: { ':pk': 'ORG#123' },
});
```

#### Authentication
```typescript
import { verifyToken, checkPermission } from '../shared/auth';

// Verify JWT token
const user = await verifyToken(event);
if (!user) {
  return error('Unauthorized', 401);
}

// Check role
if (!checkPermission(user.role, 'manager')) {
  return error('Forbidden', 403);
}
```

#### Response Formatting
```typescript
import { success, error } from '../shared/response';

// Success response
return success(data, 'Success message');
// Returns: { statusCode: 200, body: { success: true, message: '...', data: ... } }

// Error response
return error('Error message', 400);
// Returns: { statusCode: 400, body: { success: false, message: '...' } }
```

## Code Style Guide

### TypeScript

#### Interfaces vs Types
```typescript
// Use interfaces for objects
interface User {
  userId: string;
  email: string;
  name: string;
}

// Use types for unions, primitives
type Status = 'pending' | 'approved' | 'rejected';
type ID = string;
```

#### Naming Conventions
- **PascalCase**: Components, interfaces, types, classes
- **camelCase**: Variables, functions, methods
- **UPPER_SNAKE_CASE**: Constants
- **kebab-case**: File names (except components)

```typescript
// Good
const MyComponent = () => { };
interface UserProfile { }
type UserRole = 'admin' | 'user';
const getUserData = () => { };
const MAX_RETRIES = 3;

// File names
my-component.tsx
user-profile.ts
```

#### Async/Await
Always use async/await, not promises:
```typescript
// Good
try {
  const result = await fetchData();
  return success(result);
} catch (err) {
  return error(err.message);
}

// Avoid
fetchData()
  .then(result => success(result))
  .catch(err => error(err.message));
```

### React

#### Function Components
```typescript
// Good
export default function MyComponent({ prop1, prop2 }: Props) {
  return <div>...</div>;
}

// Also good
const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => {
  return <div>...</div>;
};
```

#### Hooks Order
```typescript
export default function MyComponent() {
  // 1. State
  const [state, setState] = useState('');

  // 2. Refs
  const ref = useRef(null);

  // 3. React Query
  const { data } = useQuery({ ... });

  // 4. Mutations
  const mutation = useMutation({ ... });

  // 5. Effects
  useEffect(() => { ... }, []);

  // 6. Handlers
  const handleClick = () => { ... };

  // 7. Render
  return <div>...</div>;
}
```

#### Conditional Rendering
```typescript
// Good - Early return
if (isLoading) {
  return <LoadingSpinner />;
}

if (!data) {
  return <EmptyState />;
}

return <Content data={data} />;

// Good - Ternary for simple cases
{isLoading ? <Spinner /> : <Content />}

// Avoid - Nested ternaries
{isLoading ? <Spinner /> : data ? <Content /> : <Empty />}  // Hard to read
```

## Testing

### Unit Tests (Future Enhancement)

```typescript
// Example test structure
describe('myFunction', () => {
  it('should return success for valid input', async () => {
    const event = mockAPIGatewayEvent({ ... });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
  });

  it('should return error for invalid input', async () => {
    const event = mockAPIGatewayEvent({ ... });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });
});
```

### Manual Testing

1. **Backend**: Use Postman or curl
```bash
curl -X POST https://api-url/prod/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

2. **Frontend**: Use browser dev tools and React Query Devtools

## Git Workflow

### Branch Strategy
- `main` - Production-ready code
- `develop` - Integration branch
- `feature/feature-name` - Feature branches
- `bugfix/bug-name` - Bug fixes

### Commit Messages
```
feat: Add new feature
fix: Fix bug in component
docs: Update documentation
refactor: Refactor code
style: Format code
test: Add tests
chore: Update dependencies
```

### Pull Request Process
1. Create feature branch from `develop`
2. Make changes and commit
3. Push to remote
4. Create PR to `develop`
5. Code review
6. Merge after approval

## Debugging

### Backend
```typescript
// Add console.logs (visible in CloudWatch)
console.log('User:', JSON.stringify(user, null, 2));
console.error('Error:', err);

// Use CloudWatch Logs Insights
// Query: fields @timestamp, @message | filter @message like /ERROR/
```

### Frontend
```typescript
// React Query Devtools (already enabled)
// Shows query state, cache, and errors

// Console logging
console.log('Data:', data);
console.error('Error:', error);

// React DevTools browser extension
```

## Performance Optimization

### Backend
- Use DynamoDB batch operations for multiple items
- Enable Lambda function caching (container reuse)
- Use appropriate Lambda memory (512MB default, 1024MB for heavy operations)
- Implement pagination for large result sets

### Frontend
- Use React Query for automatic caching
- Implement virtualization for long lists (react-window)
- Lazy load components with React.lazy()
- Optimize images (WebP format, compression)
- Use useMemo and useCallback appropriately

## Security Checklist

- [ ] Never commit AWS credentials
- [ ] Use environment variables for sensitive data
- [ ] Validate all user inputs (Zod schemas)
- [ ] Sanitize data before database operations
- [ ] Use HTTPS for all API calls
- [ ] Implement rate limiting (API Gateway)
- [ ] Enable CloudWatch logging
- [ ] Use IAM roles with least privilege
- [ ] Enable DynamoDB and S3 encryption
- [ ] Validate file types and sizes for uploads

## Deployment

### Backend
```bash
cd backend/infrastructure
cdk synth  # Generate CloudFormation template
cdk diff   # Show changes
cdk deploy # Deploy to AWS
```

### Frontend
```bash
cd frontend/web
npm run build  # Build for production
# Deploy dist/ folder to S3 + CloudFront or hosting service
```

## Monitoring

### CloudWatch Dashboards
Monitor:
- Lambda invocation count and errors
- DynamoDB read/write capacity
- API Gateway request count and latency
- S3 storage and requests

### Alarms
Set up CloudWatch alarms for:
- Lambda errors > threshold
- DynamoDB throttled requests
- API Gateway 5xx errors
- High costs (billing alarm)

## Common Issues

### "Cannot find module"
```bash
# Backend
cd backend/infrastructure
npm install

# Frontend
cd frontend/web
npm install
```

### "Access Denied" AWS
```bash
# Check AWS credentials
aws sts get-caller-identity

# Reconfigure if needed
aws configure
```

### "CORS Error"
- Check API Gateway CORS configuration in CDK stack
- Verify `Access-Control-Allow-Origin` header

### Lambda Timeout
- Increase timeout in CDK stack (default 15s, max 900s)
- Optimize database queries
- Use DynamoDB indexes

### React Query Not Refetching
```typescript
// Invalidate query cache
queryClient.invalidateQueries({ queryKey: ['myData'] });

// Force refetch
refetch();
```

## Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)

## Getting Help

1. Check documentation files in root directory
2. Review CloudWatch logs for errors
3. Search existing GitHub issues
4. Create new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Error messages and logs
