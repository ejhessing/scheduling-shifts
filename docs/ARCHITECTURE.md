# Architecture Documentation

## Overview

The Time Tracking & Scheduling Application is built on AWS serverless architecture for scalability, reliability, and cost-effectiveness. The system handles from 10 to 10,000+ users without infrastructure management overhead.

## High-Level Architecture

```
┌─────────────────┐
│   CloudFront    │ ◄─── Static Assets (Web App)
└────────┬────────┘
         │
┌────────▼────────┐
│  API Gateway    │ ◄─── REST + WebSocket APIs
└────────┬────────┘
         │
    ┌────▼─────┐
    │  Lambda  │ ◄─── Business Logic
    └────┬─────┘
         │
    ┌────▼──────┐
    │ DynamoDB  │ ◄─── Primary Data Store
    └───────────┘
         │
    ┌────▼──────┐
    │    S3     │ ◄─── File Storage
    └───────────┘
         │
    ┌────▼──────┐
    │  Cognito  │ ◄─── Authentication
    └───────────┘
```

## Core Components

### 1. Frontend Layer

#### Web Application (React + Vite)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **State Management**: Zustand for global state, Tanstack Query for server state
- **Routing**: React Router v6
- **Styling**: CSS modules with mobile-first responsive design
- **Hosting**: CloudFront CDN with S3 origin

**Key Features**:
- Progressive Web App (PWA) capabilities
- Offline support for critical features
- Sub-second time tracking precision
- Real-time GPS geofencing
- Responsive design (mobile, tablet, desktop)

#### Mobile Applications (React Native) - Coming Soon
- Native iOS and Android apps
- Full feature parity with web app
- Biometric authentication support
- Background GPS tracking
- Push notifications

### 2. API Layer

#### API Gateway
- **REST API**: Standard CRUD operations
- **WebSocket API**: Real-time messaging and notifications
- **Authentication**: Cognito User Pool authorizer
- **CORS**: Configured for web and mobile origins
- **Throttling**: Rate limiting per endpoint
- **Monitoring**: CloudWatch metrics and alarms

**Endpoints**:
```
POST   /auth/signup         - Create new user account
POST   /auth/login          - Authenticate user
POST   /auth/refresh        - Refresh access token

GET    /users               - List organization users
GET    /users/{userId}      - Get user profile
PUT    /users/{userId}      - Update user profile

POST   /time-tracking/clock-in    - Clock in
POST   /time-tracking/clock-out   - Clock out
GET    /time-tracking/timesheet   - Get timesheet
PUT    /time-tracking/entries/{id} - Update time entry
POST   /time-tracking/approve     - Approve time entries

GET    /schedule            - Get schedule
POST   /schedule/shifts     - Create shift
PUT    /schedule/shifts/{id} - Update shift
DELETE /schedule/shifts/{id} - Delete shift
POST   /schedule/shifts/swap - Request shift swap
```

### 3. Compute Layer (Lambda Functions)

#### Authentication Functions
- **signup.ts**: User registration with Cognito and DynamoDB
- **login.ts**: User authentication and token generation
- **refreshToken.ts**: Token refresh logic

#### Time Tracking Functions
- **clockIn.ts**: Handle clock-in with GPS validation
- **clockOut.ts**: Handle clock-out with hours/pay calculation
- **getTimesheet.ts**: Retrieve time entries
- **updateEntry.ts**: Modify time entries
- **approveEntries.ts**: Manager approval workflow

#### Scheduling Functions
- **createShift.ts**: Create new shifts with conflict detection
- **updateShift.ts**: Modify existing shifts
- **deleteShift.ts**: Soft-delete shifts
- **getSchedule.ts**: Retrieve schedules
- **swapShift.ts**: Handle shift swap requests

#### User Management Functions
- **getProfile.ts**: Retrieve user profile
- **updateProfile.ts**: Update user details
- **listUsers.ts**: List organization users

**Lambda Configuration**:
- Runtime: Node.js 18.x
- Memory: 512 MB (adjustable per function)
- Timeout: 30 seconds
- Concurrent executions: Unreserved (auto-scales)
- Environment variables: Encrypted with KMS

### 4. Data Layer

#### DynamoDB (Single-Table Design)

**Table**: TimeTrackingApp

**Primary Key**:
- PK (Partition Key): String
- SK (Sort Key): String

**Global Secondary Indexes**:
- GSI1 (GSI1PK, GSI1SK): For location and user queries
- GSI2 (GSI2PK, GSI2SK): For organization-wide queries

**Access Patterns**:
1. Get user by ID: `PK=USER#{userId}, SK=PROFILE#{userId}`
2. Get organization users: `GSI1PK=ORG#{orgId}#USERS`
3. Get user time entries: `PK=USER#{userId}#DATE#{date}`
4. Get location shifts: `PK=LOC#{locationId}#DATE#{date}`
5. Get user shifts: `GSI1PK=USER#{userId}#SHIFTS`
6. Get org shifts: `GSI2PK=ORG#{orgId}#SHIFTS`

**Capacity**:
- Billing Mode: On-Demand (pay per request)
- Point-in-Time Recovery: Enabled
- Encryption: AWS managed keys
- Streams: Enabled for change data capture

#### S3 Bucket

**Buckets**:
- `time-tracking-app-{account}-{region}`: Primary storage

**Structure**:
```
photos/
  {userId}/
    {entryId}-clock-in.jpg
    {entryId}-clock-out.jpg
documents/
  {userId}/
    {docId}.pdf
```

**Lifecycle Rules**:
- Photos: Delete after 90 days
- Documents: Move to Intelligent Tiering after 30 days

#### ElastiCache Redis (Optional)

**Use Cases**:
- Session management
- API rate limiting
- Frequently accessed data caching

**TTL Configuration**:
- User sessions: 1 hour
- Organization settings: 24 hours
- Schedule data: 15 minutes
- Geofence boundaries: 24 hours

### 5. Authentication & Authorization

#### Cognito User Pool

**Configuration**:
- Sign-in: Email only
- MFA: Optional (SMS and TOTP)
- Password Policy: Min 8 chars, uppercase, lowercase, numbers
- Account Recovery: Email only
- Custom Attributes: orgId, role

**User Roles**:
- SUPER_ADMIN: Platform administrators
- ORG_ADMIN: Organization administrators
- MANAGER: Location/team managers
- EMPLOYEE: Regular employees

**Token Configuration**:
- Access Token: 1 hour
- ID Token: 1 hour
- Refresh Token: 30 days

### 6. Background Processing

#### EventBridge Rules
- **Hourly**: Notify upcoming shifts
- **Daily**: Calculate overtime warnings
- **Daily**: Check certification expiry
- **Weekly/Bi-weekly**: Process payroll period
- **Daily**: Cleanup old data

#### Step Functions (Future)
- Complex payroll workflows
- Multi-step approval processes
- Scheduled report generation

### 7. Monitoring & Observability

#### CloudWatch

**Metrics**:
- API latency (p50, p95, p99)
- Lambda duration and errors
- DynamoDB read/write capacity
- API Gateway request count
- Cache hit/miss ratio

**Alarms**:
- High error rate (>1%)
- High latency (>1s p95)
- DynamoDB throttling
- Lambda timeout rate
- Failed clock-ins

**Logs**:
- Retention: 7 days (adjustable)
- Log Groups per Lambda function
- Structured JSON logging
- Log Insights queries enabled

#### X-Ray

**Tracing**:
- End-to-end request tracing
- Service map visualization
- Performance bottleneck identification
- Sampling: 5% of requests

## Data Flow Examples

### Clock In Flow

```
1. User clicks "Clock In" on web/mobile app
   ↓
2. App requests GPS location from browser/device
   ↓
3. POST /time-tracking/clock-in with location data
   ↓
4. API Gateway validates JWT token via Cognito authorizer
   ↓
5. Lambda function clockIn.ts executes:
   - Validates GPS coordinates
   - Checks if already clocked in
   - Validates geofence (if enabled)
   - Creates time entry in DynamoDB
   - Uploads photo to S3 (if provided)
   ↓
6. Returns success response with entryId
   ↓
7. App updates UI to show "Clocked In" status
```

### Schedule Query Flow

```
1. User navigates to Schedule page
   ↓
2. GET /schedule?startDate=2024-01-01&endDate=2024-01-07
   ↓
3. API Gateway validates JWT token
   ↓
4. Lambda function getSchedule.ts executes:
   - Queries DynamoDB for shifts in date range
   - Filters by user or location (based on role)
   - Sorts by date and time
   ↓
5. Returns array of shifts
   ↓
6. App renders weekly calendar view
```

## Security Architecture

### Data Security
- **Encryption at Rest**: All DynamoDB tables and S3 buckets
- **Encryption in Transit**: TLS 1.3 for all API calls
- **Secrets Management**: AWS Secrets Manager for API keys
- **IAM Roles**: Least privilege principle for all services

### Network Security
- **VPC**: Lambda functions in private subnets (future)
- **Security Groups**: Restrict access between services
- **WAF**: Web Application Firewall on API Gateway (planned)

### Application Security
- **Input Validation**: All user inputs sanitized
- **XSS Prevention**: Content Security Policy headers
- **SQL Injection**: N/A (NoSQL database)
- **CSRF Protection**: Token-based authentication
- **Rate Limiting**: API Gateway throttling

## Scalability

### Horizontal Scaling
- **Lambda**: Auto-scales to thousands of concurrent executions
- **DynamoDB**: On-demand mode scales automatically
- **API Gateway**: Handles any request volume

### Performance Optimization
- **Caching**: CloudFront edge caching (static assets)
- **Connection Pooling**: Reuse DynamoDB connections
- **Batch Operations**: Bulk DynamoDB writes where applicable
- **Compression**: Gzip all API responses

### Cost Optimization
- **Lambda**: Reserved concurrency for predictable workloads
- **DynamoDB**: On-demand for variable traffic
- **S3**: Intelligent Tiering for document storage
- **CloudFront**: Cache static assets to reduce API calls

## Disaster Recovery

### Backup Strategy
- **DynamoDB**: Point-in-time recovery (35 days)
- **S3**: Versioning enabled
- **RTO**: 1 hour
- **RPO**: 15 minutes

### High Availability
- **Multi-AZ**: All AWS services deployed across AZs
- **Regional Failover**: Planned for critical customers
- **Health Checks**: CloudWatch alarms for service health

## Future Enhancements

1. **GraphQL API**: For more efficient data fetching
2. **AppSync**: Real-time subscriptions
3. **Aurora Serverless**: For complex analytics queries
4. **Kinesis**: Real-time data streaming
5. **SageMaker**: AI-powered auto-scheduling
6. **ECS Fargate**: For long-running background jobs
7. **Route 53**: Multi-region failover

## Technology Decisions

### Why Serverless?
- **No server management**: Focus on business logic
- **Auto-scaling**: Handle traffic spikes automatically
- **Pay-per-use**: Cost-effective for variable workloads
- **High availability**: Built-in redundancy

### Why DynamoDB?
- **Performance**: Single-digit millisecond latency
- **Scalability**: Handles any workload size
- **Cost-effective**: On-demand pricing
- **Flexibility**: NoSQL fits varied data patterns

### Why React?
- **Component-based**: Reusable UI components
- **Large ecosystem**: Rich library support
- **Performance**: Virtual DOM for efficient updates
- **Developer experience**: Hot module replacement

### Why TypeScript?
- **Type safety**: Catch errors at compile time
- **Better IDE support**: Autocomplete and refactoring
- **Documentation**: Types serve as inline docs
- **Maintainability**: Easier to refactor large codebases
