# Project Structure

## Overview

This is a comprehensive Time Tracking & Scheduling application built with AWS serverless architecture. The app competes with TSheets, When I Work, and Deputy, offering time tracking, scheduling, payroll, analytics, and document management.

## Technology Stack

### Backend
- **AWS CDK** - Infrastructure as Code (TypeScript)
- **AWS Lambda** - Serverless compute (Node.js/TypeScript)
- **DynamoDB** - NoSQL database with single-table design
- **S3** - Document and file storage
- **API Gateway** - REST API with Cognito authentication
- **Cognito** - User authentication and authorization
- **SES** - Email notifications
- **SNS** - Pub/sub messaging
- **EventBridge** - Scheduled tasks
- **CloudWatch** - Logging and monitoring
- **X-Ray** - Distributed tracing

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TailwindCSS** - Styling
- **TanStack Query (React Query)** - Data fetching and caching
- **Zustand** - State management
- **React Router** - Client-side routing
- **Lucide React** - Icons
- **date-fns** - Date utilities
- **Zod** - Runtime validation
- **react-big-calendar** - Calendar component
- **@dnd-kit** - Drag and drop

## Project Structure

```
scheduling-shifts/
├── backend/
│   ├── infrastructure/
│   │   ├── bin/
│   │   │   └── time-tracking.ts          # CDK app entry point
│   │   └── stacks/
│   │       └── time-tracking-stack.ts    # Main infrastructure stack (47 Lambdas)
│   ├── services/                          # Lambda function handlers (47 total)
│   │   ├── auth/                          # Authentication (3)
│   │   │   ├── signup.ts
│   │   │   ├── login.ts
│   │   │   └── refreshToken.ts
│   │   ├── users/                         # User management (3)
│   │   │   ├── getUserProfile.ts
│   │   │   ├── updateUserProfile.ts
│   │   │   └── listUsers.ts
│   │   ├── locations/                     # Location management (4)
│   │   │   ├── createLocation.ts
│   │   │   ├── getLocations.ts
│   │   │   ├── updateLocation.ts
│   │   │   └── deleteLocation.ts
│   │   ├── time/                          # Time tracking (5)
│   │   │   ├── clockIn.ts
│   │   │   ├── clockOut.ts
│   │   │   ├── getTimesheet.ts
│   │   │   ├── updateTimeEntry.ts
│   │   │   └── approveEntries.ts
│   │   ├── schedule/                      # Scheduling (5)
│   │   │   ├── createShift.ts
│   │   │   ├── updateShift.ts
│   │   │   ├── deleteShift.ts
│   │   │   ├── getSchedule.ts
│   │   │   └── swapShift.ts
│   │   ├── scheduling/                    # Advanced scheduling (5)
│   │   │   ├── createShiftTemplate.ts
│   │   │   ├── getShiftTemplates.ts
│   │   │   ├── setAvailability.ts
│   │   │   ├── getAvailability.ts
│   │   │   └── checkScheduleConflicts.ts
│   │   ├── reports/                       # Reporting (1)
│   │   │   └── generateReport.ts
│   │   ├── compliance/                    # Labor law compliance (1)
│   │   │   └── checkCompliance.ts
│   │   ├── notifications/                 # Email notifications (2)
│   │   │   ├── sendNotification.ts
│   │   │   └── scheduledNotifications.ts
│   │   ├── timeOff/                       # PTO management (4)
│   │   │   ├── requestTimeOff.ts
│   │   │   ├── reviewTimeOff.ts
│   │   │   ├── getTimeOffRequests.ts
│   │   │   └── getTimeOffBalance.ts
│   │   ├── analytics/                     # Analytics & budget (3)
│   │   │   ├── getAnalytics.ts
│   │   │   ├── getBudgetStatus.ts
│   │   │   └── getEmployeeMetrics.ts
│   │   ├── payroll/                       # Payroll integration (5)
│   │   │   ├── createPayrollPeriod.ts
│   │   │   ├── getPayrollPeriods.ts
│   │   │   ├── processPayroll.ts
│   │   │   ├── exportPayroll.ts
│   │   │   └── approvePayroll.ts
│   │   └── documents/                     # Document management (5)
│   │       ├── uploadDocument.ts
│   │       ├── getDocuments.ts
│   │       ├── getDocument.ts
│   │       ├── deleteDocument.ts
│   │       └── approveDocument.ts
│   └── shared/                            # Shared utilities and types
│       ├── db.ts                          # DynamoDB helpers
│       ├── auth.ts                        # Authentication utilities
│       ├── response.ts                    # API response helpers
│       ├── validators.ts                  # Input validation
│       ├── geofence.ts                    # GPS geofencing with Turf.js
│       ├── utils.ts                       # General utilities
│       ├── notifications.ts               # Email templates and SES
│       ├── compliance.ts                  # FLSA compliance engine
│       ├── timeOff.ts                     # PTO calculations
│       ├── scheduling.ts                  # Scheduling utilities
│       ├── analytics.ts                   # Analytics calculations
│       ├── payroll.ts                     # Payroll calculations & exports
│       ├── documents.ts                   # Document management utilities
│       └── types.ts                       # Shared TypeScript types
│
├── frontend/
│   └── web/
│       ├── src/
│       │   ├── components/                # Reusable UI components
│       │   │   ├── Layout.tsx             # App layout with sidebar
│       │   │   ├── ui.tsx                 # UI component library (7 components)
│       │   │   └── ErrorBoundary.tsx      # Error boundary component
│       │   ├── pages/                     # Page components (13)
│       │   │   ├── LoginPage.tsx
│       │   │   ├── SignupPage.tsx
│       │   │   ├── DashboardPage.tsx
│       │   │   ├── TimeTrackingPage.tsx
│       │   │   ├── SchedulePage.tsx
│       │   │   ├── TimesheetPage.tsx
│       │   │   ├── LocationsPage.tsx
│       │   │   ├── AdminDashboardPage.tsx
│       │   │   ├── ProfilePage.tsx
│       │   │   ├── TimeOffPage.tsx
│       │   │   ├── ScheduleCalendarPage.tsx
│       │   │   ├── AnalyticsPage.tsx
│       │   │   ├── PayrollPage.tsx
│       │   │   └── DocumentsPage.tsx
│       │   ├── stores/                    # Zustand state stores
│       │   │   └── authStore.ts           # Authentication state
│       │   ├── hooks/                     # Custom React hooks (13)
│       │   │   └── index.ts
│       │   ├── lib/                       # Utilities and config
│       │   │   ├── api.ts                 # API client with all endpoints
│       │   │   ├── utils.ts               # Utility functions (20+)
│       │   │   └── validations.ts         # Zod validation schemas (12+)
│       │   ├── types/                     # TypeScript type definitions
│       │   │   └── index.ts               # Shared types (15+)
│       │   ├── App.tsx                    # Root component with routing
│       │   ├── main.tsx                   # Entry point
│       │   └── index.css                  # Global styles
│       ├── public/                        # Static assets
│       ├── index.html                     # HTML template
│       ├── package.json                   # Dependencies
│       ├── tsconfig.json                  # TypeScript config
│       ├── vite.config.ts                 # Vite config
│       ├── tailwind.config.js             # Tailwind config
│       └── postcss.config.js              # PostCSS config
│
└── Documentation/
    ├── README.md                          # Project overview
    ├── AWS_COST_ESTIMATION.md             # Infrastructure costs
    ├── COMPLIANCE_AND_NOTIFICATIONS.md    # Email and compliance docs
    ├── ANALYTICS_DASHBOARD.md             # Analytics features
    ├── PAYROLL_INTEGRATION.md             # Payroll export formats
    └── DOCUMENT_MANAGEMENT.md             # Document storage docs
```

## Database Schema (DynamoDB Single-Table Design)

### Access Patterns

**Primary Key (PK, SK)**:
- Users: `ORG#{orgId}`, `USER#{userId}`
- Locations: `ORG#{orgId}`, `LOCATION#{locationId}`
- Time Entries: `ORG#{orgId}#USER#{userId}`, `ENTRY#{entryId}`
- Shifts: `ORG#{orgId}`, `SHIFT#{shiftId}`
- Time Off: `ORG#{orgId}#USER#{userId}`, `TIMEOFF#{requestId}`
- Payroll: `ORG#{orgId}`, `PAYROLL#{periodId}`
- Documents: `ORG#{orgId}#USER#{userId}`, `DOCUMENT#{documentId}`

**GSI1 (GSI1PK, GSI1SK)**:
- Time Entries by Date: `ORG#{orgId}#ENTRIES`, `DATE#{date}`
- Shifts by Org: `ORG#{orgId}#SHIFTS`, `DATE#{date}`
- Documents by Org: `ORG#{orgId}#DOCUMENTS`, `CATEGORY#{category}#{date}`
- Payroll by Org: `ORG#{orgId}#PAYROLL`, `DATE#{startDate}`

**GSI2 (GSI2PK, GSI2SK)**:
- User lookups: `EMAIL#{email}`, `USER#{userId}`

## API Endpoints (47 Lambda Functions)

### Authentication (3)
- `POST /auth/signup` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh JWT token

### Users (3)
- `GET /users` - List all users (managers)
- `GET /users/{userId}` - Get user profile
- `PUT /users/{userId}` - Update user profile

### Locations (4)
- `GET /locations` - List locations
- `POST /locations` - Create location
- `PUT /locations/{locationId}` - Update location
- `DELETE /locations/{locationId}` - Delete location

### Time Tracking (5)
- `POST /time/clock-in` - Clock in with GPS
- `POST /time/clock-out` - Clock out
- `GET /time/timesheet` - Get timesheet
- `PUT /time/entry/{entryId}` - Update entry
- `POST /time/approve` - Approve entries (managers)

### Scheduling (10)
- `GET /schedule` - Get schedule
- `POST /schedule/shifts` - Create shift
- `PUT /schedule/shifts/{shiftId}` - Update shift
- `DELETE /schedule/shifts/{shiftId}` - Delete shift
- `POST /schedule/shifts/swap` - Swap shifts
- `GET /schedule/templates` - Get shift templates
- `POST /schedule/templates` - Create template
- `GET /schedule/availability` - Get availability
- `POST /schedule/availability` - Set availability
- `GET /schedule/conflicts` - Check conflicts

### Reports (1)
- `GET /reports/generate` - Generate reports (CSV export)

### Compliance (1)
- `GET /compliance/check` - Check FLSA violations

### Time Off (4)
- `POST /time-off/request` - Request PTO
- `GET /time-off/requests` - List requests
- `GET /time-off/balance` - Get PTO balance
- `POST /time-off/{requestId}/review` - Approve/reject

### Analytics (3)
- `GET /analytics` - Get comprehensive analytics
- `GET /analytics/budget` - Budget tracking
- `GET /analytics/employees` - Employee metrics

### Payroll (5)
- `GET /payroll/periods` - List payroll periods
- `POST /payroll/periods` - Create period
- `POST /payroll/{periodId}/process` - Process payroll
- `GET /payroll/{periodId}/export` - Export (CSV, QuickBooks, ADP, JSON)
- `POST /payroll/{periodId}/approve` - Approve payroll

### Documents (5)
- `GET /documents` - List documents
- `POST /documents` - Upload document (presigned URL)
- `GET /documents/{documentId}` - Get document (download URL)
- `DELETE /documents/{documentId}` - Delete document
- `POST /documents/{documentId}/approve` - Approve/reject

## Key Features by Phase

### Phase 1: MVP Foundation
- AWS CDK infrastructure setup
- User authentication (Cognito)
- Basic time tracking (clock in/out)
- Location management with geofencing
- Schedule creation and management

### Phase 2: Admin & Reporting
- Admin dashboard with approvals
- CSV report generation
- Time entry approval workflow

### Phase 3: Notifications & Compliance
- SES email notifications (6 templates)
- FLSA compliance engine
- SNS pub/sub architecture
- EventBridge scheduled notifications

### Phase 4: PTO & Advanced Scheduling
- Time-off management with accrual
- Shift templates and recurring patterns
- Employee availability windows
- Conflict detection (double-booking, rest periods)
- Drag-and-drop calendar (react-big-calendar)

### Phase 5: Code Refactoring
- UI component library (7 reusable components)
- Shared types and utilities (20+ functions)
- Custom React hooks (13 hooks)
- Zod validation schemas
- Error boundaries

### Phase 6: Cost Analysis
- AWS cost estimation documentation
- Service breakdown and optimization tips

### Phase 7: Analytics Dashboard
- Labor cost tracking and trends
- Budget monitoring with projections
- Department performance breakdown
- Employee leaderboards
- Anomaly detection

### Phase 8: Payroll Integration
- Payroll period management (weekly/biweekly/monthly)
- Wage calculations with overtime (1.5x) and double-time (2.0x)
- Export to CSV, QuickBooks IIF, ADP, JSON
- Approval workflow

### Phase 9: Document Management
- Secure S3 document storage
- 10 document categories (tax forms, certifications, etc.)
- Presigned upload/download URLs
- Expiration tracking for certifications
- Approval workflow
- Role-based access control

## Development Workflow

### Backend Deployment
```bash
cd backend/infrastructure
npm install
cdk deploy
```

### Frontend Development
```bash
cd frontend/web
npm install
npm run dev  # Starts Vite dev server on http://localhost:5173
```

### Frontend Build
```bash
npm run build  # Outputs to dist/
```

## Environment Variables

### Backend (Lambda)
- `TABLE_NAME` - DynamoDB table name
- `BUCKET_NAME` - S3 bucket name
- `USER_POOL_ID` - Cognito user pool
- `USER_POOL_CLIENT_ID` - Cognito client
- `NOTIFICATION_TOPIC_ARN` - SNS topic
- `FROM_EMAIL` - SES sender email
- `FRONTEND_URL` - Frontend URL for links

### Frontend (.env)
- `VITE_API_URL` - API Gateway URL
- `VITE_USER_POOL_ID` - Cognito user pool
- `VITE_USER_POOL_CLIENT_ID` - Cognito client

## User Roles & Permissions

### Employee
- Clock in/out with GPS
- View own timesheet and schedule
- Request time off
- Upload own documents
- View own analytics

### Manager
- All employee permissions
- Approve time entries and PTO
- Create/manage schedules
- View team analytics
- Manage locations
- Approve documents

### Admin
- All manager permissions
- User management
- System configuration

### Owner
- All admin permissions
- Organization-level settings

## Cost Estimates

**Small Team (5-10 employees)**:
- ~$5-7/month
- Free tier covers most usage first year

**Medium Team (25-50 employees)**:
- ~$20-30/month
- Primarily Lambda and DynamoDB costs

**Large Team (100+ employees)**:
- ~$100-150/month
- May benefit from reserved capacity

**Savings vs SaaS**:
- TSheets: $8/user/month = $800/month for 100 users
- This app: ~$100/month (87% savings)

## Key Design Decisions

1. **Single-Table DynamoDB**: Reduces costs and improves query performance
2. **Serverless Architecture**: Auto-scaling, pay-per-use, minimal ops
3. **Presigned URLs**: Direct S3 access without proxying through Lambda
4. **SNS Pub/Sub**: Decoupled notification architecture
5. **React Query**: Automatic caching and background updates
6. **Zustand**: Lightweight state management
7. **Component Library**: Reusable UI patterns
8. **Validation Schemas**: Shared validation between frontend and backend

## Technical Debt Notes

Currently, the codebase has minimal technical debt:
- ✅ Consistent error handling patterns
- ✅ Shared utilities and types
- ✅ Comprehensive documentation
- ✅ Type safety throughout
- ✅ Reusable components
- ⚠️ Limited unit test coverage (future enhancement)
- ⚠️ Some hardcoded values in frontend (should use env vars)

## Next Steps for New Developers

1. Read this PROJECT_STRUCTURE.md
2. Review AWS_COST_ESTIMATION.md for infrastructure understanding
3. Set up AWS credentials and deploy backend
4. Configure frontend environment variables
5. Run frontend dev server
6. Review feature documentation in respective MD files
7. Check GitHub issues for current work items

## Support & Resources

- **AWS CDK Docs**: https://docs.aws.amazon.com/cdk/
- **React Query Docs**: https://tanstack.com/query/
- **DynamoDB Single-Table**: https://www.alexdebrie.com/posts/dynamodb-single-table/
- **Tailwind CSS**: https://tailwindcss.com/docs
