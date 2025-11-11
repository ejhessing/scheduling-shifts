# Ultimate Time Tracking & Scheduling App

A next-generation time tracking and scheduling platform built on AWS serverless architecture. This application combines the best features from industry-leading workforce management tools while addressing their common pain points.

## Features

### ✅ Implemented (MVP)

- **User Authentication**
  - Email/password signup and login
  - JWT token-based authentication
  - Token refresh mechanism
  - Secure password hashing with bcrypt

- **Time Tracking**
  - Clock in/out with GPS location tracking
  - Real-time geofencing validation
  - Manual time entry notes
  - Automatic overtime calculation
  - Sub-second precision tracking
  - Time entry approval workflow

- **Scheduling**
  - Create, update, and delete shifts
  - View weekly/monthly schedules
  - Shift conflict detection
  - Shift swapping requests
  - Status tracking (scheduled, confirmed, completed, cancelled)

- **User Management**
  - User profiles with role-based access (owner, admin, manager, employee)
  - Organization management
  - Multi-user support within organizations

- **Reporting**
  - Weekly timesheet summaries
  - Hours breakdown (regular vs overtime)
  - Pay calculations
  - Approval status tracking

### 🚧 Planned Features (Phase 2+)

- AI-powered auto-scheduling
- Real-time messaging via WebSocket
- Mobile apps (React Native)
- Advanced reporting and analytics
- Payroll integrations
- Document management
- Compliance rules engine
- Break management
- Task/project tracking

## Technology Stack

### Backend
- **Infrastructure**: AWS CDK (TypeScript)
- **Compute**: AWS Lambda (Node.js 20.x)
- **API**: Amazon API Gateway (REST)
- **Database**: Amazon DynamoDB (single-table design)
- **Storage**: Amazon S3
- **Authentication**: Amazon Cognito + JWT
- **Monitoring**: CloudWatch, X-Ray

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **Date Utilities**: date-fns

## Architecture

### DynamoDB Single-Table Design

```
PK                              SK                      Entity Type
-----------------------------------------------------------------
USER#<userId>                   PROFILE#<userId>        User Profile
USER#EMAIL#<email>              USER#EMAIL#<email>      Email Lookup
ORG#<orgId>                     ORG#<orgId>             Organization
LOC#<locationId>#DATE#<date>    SHIFT#<shiftId>         Shift
USER#<userId>#DATE#<date>       ENTRY#<entryId>         Time Entry
SWAP#<swapId>                   SWAP#<swapId>           Shift Swap Request

GSI1: For organization-based queries
GSI2: For payroll period queries
```

### Lambda Functions

```
services/
├── auth/
│   ├── signup.ts           - User registration
│   ├── login.ts            - User authentication
│   └── refreshToken.ts     - JWT token refresh
├── users/
│   ├── getProfile.ts       - Get user profile
│   ├── updateProfile.ts    - Update user profile
│   └── listUsers.ts        - List organization users
├── timeTracking/
│   ├── clockIn.ts          - Clock in with GPS
│   ├── clockOut.ts         - Clock out with calculations
│   ├── getTimesheet.ts     - Retrieve timesheet data
│   ├── updateEntry.ts      - Edit time entries
│   └── approveEntries.ts   - Approve/reject entries
└── scheduling/
    ├── createShift.ts      - Create new shift
    ├── updateShift.ts      - Update shift details
    ├── deleteShift.ts      - Delete shift
    ├── getSchedule.ts      - Get schedule data
    └── swapShift.ts        - Request shift swap
```

## Project Structure

```
time-tracking-app/
├── backend/
│   ├── infrastructure/
│   │   ├── app.ts                    # CDK app entry point
│   │   └── stacks/
│   │       └── time-tracking-stack.ts # Main infrastructure stack
│   ├── services/                      # Lambda functions
│   │   ├── auth/
│   │   ├── users/
│   │   ├── timeTracking/
│   │   └── scheduling/
│   ├── shared/                        # Shared utilities
│   │   ├── db.ts                      # DynamoDB helpers
│   │   ├── response.ts                # API response helpers
│   │   ├── auth.ts                    # JWT & password helpers
│   │   ├── validators.ts              # Zod schemas
│   │   ├── geofence.ts                # GPS validation
│   │   └── utils.ts                   # Common utilities
│   ├── package.json
│   ├── tsconfig.json
│   └── cdk.json
├── frontend/
│   └── web/
│       ├── src/
│       │   ├── components/
│       │   │   └── Layout.tsx         # App layout
│       │   ├── pages/
│       │   │   ├── LoginPage.tsx
│       │   │   ├── SignupPage.tsx
│       │   │   ├── DashboardPage.tsx
│       │   │   ├── TimeTrackingPage.tsx
│       │   │   ├── SchedulePage.tsx
│       │   │   ├── TimesheetPage.tsx
│       │   │   └── ProfilePage.tsx
│       │   ├── stores/
│       │   │   └── authStore.ts       # Auth state management
│       │   ├── lib/
│       │   │   └── api.ts             # API client
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   └── index.css
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── tailwind.config.js
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- AWS Account with CLI configured
- AWS CDK CLI: `npm install -g aws-cdk`

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd scheduling-shifts
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install

   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend/web
   npm install
   cd ../..
   ```

### Backend Setup & Deployment

1. **Configure AWS credentials**
   ```bash
   aws configure
   ```

2. **Bootstrap CDK (first time only)**
   ```bash
   cd backend
   cdk bootstrap
   ```

3. **Set environment variables**
   ```bash
   export JWT_SECRET="your-secure-jwt-secret-here"
   ```

4. **Deploy to AWS**
   ```bash
   npm run deploy
   ```

   This will:
   - Create DynamoDB table
   - Deploy Lambda functions
   - Set up API Gateway
   - Create Cognito User Pool
   - Create S3 bucket
   - Output the API URL

5. **Note the outputs**
   After deployment, save the following outputs:
   - API Gateway URL
   - Cognito User Pool ID
   - Cognito Client ID

### Frontend Setup

1. **Configure environment variables**
   Create `.env` file in `frontend/web`:
   ```env
   VITE_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/prod
   ```

2. **Run development server**
   ```bash
   cd frontend/web
   npm run dev
   ```

   The app will open at `http://localhost:3000`

3. **Build for production**
   ```bash
   npm run build
   ```

   The built files will be in `frontend/web/dist`

## Usage

### First-Time Setup

1. **Create an account**
   - Navigate to the signup page
   - Enter your name, email, password, and organization name
   - The first user becomes the organization owner

2. **Sign in**
   - Use your email and password to log in
   - You'll be redirected to the dashboard

### Time Tracking

1. **Clock In**
   - Go to Time Tracking page
   - Allow browser to access your location
   - Click "Clock In"
   - Add optional notes

2. **Clock Out**
   - Go to Time Tracking page
   - Click "Clock Out" when finished
   - Hours and pay are automatically calculated

### Scheduling

1. **View Schedule**
   - Navigate to Schedule page
   - See your upcoming shifts
   - Navigate between weeks

### Timesheet

1. **View Timesheet**
   - Navigate to Timesheet page
   - View hours and pay summary
   - See all time entries for the week

## API Endpoints

### Authentication
- `POST /auth/signup` - Register new user
- `POST /auth/login` - Authenticate user
- `POST /auth/refresh` - Refresh JWT token

### Users
- `GET /users` - List organization users
- `GET /users/:userId` - Get user profile
- `PUT /users/:userId` - Update user profile

### Time Tracking
- `POST /time/clock-in` - Clock in
- `POST /time/clock-out` - Clock out
- `GET /time/timesheet` - Get timesheet
- `PUT /time/entry/:entryId` - Update time entry
- `POST /time/approve` - Approve/reject entries

### Scheduling
- `GET /schedule` - Get schedule
- `POST /schedule/shifts` - Create shift
- `PUT /schedule/shifts/:shiftId` - Update shift
- `DELETE /schedule/shifts/:shiftId` - Delete shift
- `POST /schedule/shifts/swap` - Request shift swap

## Testing

### Backend Testing
```bash
cd backend
npm test
```

### Frontend Testing
```bash
cd frontend/web
npm test
```

## Deployment

### Backend Deployment
```bash
cd backend
npm run deploy
```

### Frontend Deployment

Option 1: Amazon S3 + CloudFront
```bash
cd frontend/web
npm run build
aws s3 sync dist/ s3://your-bucket-name
```

Option 2: Vercel
```bash
cd frontend/web
vercel deploy --prod
```

Option 3: Netlify
```bash
cd frontend/web
netlify deploy --prod --dir=dist
```

## Cost Optimization

### DynamoDB
- Using on-demand billing (pay per request)
- No minimum charges
- Estimated: $1-5/month for small teams

### Lambda
- 1M free requests/month
- Pay per invocation after that
- Estimated: $0-10/month for small teams

### API Gateway
- Pay per request
- Estimated: $1-5/month for small teams

### S3
- Pay for storage used
- Estimated: $0.50-2/month

**Total Estimated Cost for Small Team (< 50 users): $5-25/month**

## Security

- ✅ Password hashing with bcrypt
- ✅ JWT token-based authentication
- ✅ Token refresh mechanism
- ✅ Role-based access control
- ✅ Input validation with Zod
- ✅ CORS configuration
- ✅ HTTPS only in production
- ✅ DynamoDB encryption at rest
- ✅ S3 private buckets

## Monitoring

- CloudWatch Logs for Lambda functions
- X-Ray tracing enabled
- API Gateway metrics
- DynamoDB metrics

Access CloudWatch dashboard:
```bash
aws cloudwatch get-dashboard --dashboard-name TimeTrackingApp
```

## Troubleshooting

### Common Issues

1. **GPS not working**
   - Ensure HTTPS is enabled
   - Grant location permissions in browser
   - Check if geolocation API is supported

2. **API errors**
   - Check API Gateway URL in frontend `.env`
   - Verify AWS credentials
   - Check CloudWatch logs

3. **Authentication issues**
   - Clear browser storage
   - Check JWT_SECRET environment variable
   - Verify Cognito configuration

### Logs

View Lambda logs:
```bash
aws logs tail /aws/lambda/TimeTrackingStack-ClockInFunction --follow
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Create an issue in the repository
- Email: support@timetrackingapp.com

## Roadmap

### Q2 2024
- [ ] WebSocket support for real-time updates
- [ ] Mobile apps (React Native)
- [ ] Advanced reporting dashboard

### Q3 2024
- [ ] AI-powered auto-scheduling
- [ ] Payroll integrations (QuickBooks, Gusto)
- [ ] Break compliance engine

### Q4 2024
- [ ] Document management
- [ ] Performance reviews
- [ ] White-labeling options

---

**Built with ❤️ using AWS Serverless and React**
