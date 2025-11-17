# Compliance & Notification System

This document explains the compliance rules engine and email notification system for the Time Tracking & Scheduling App.

## Table of Contents
1. [Email Notification System](#email-notification-system)
2. [Compliance Rules Engine](#compliance-rules-engine)
3. [Configuration](#configuration)
4. [API Endpoints](#api-endpoints)

---

## Email Notification System

### Architecture

The notification system uses an SNS pub/sub pattern for asynchronous email delivery:

1. **Event Publishers**: Lambda functions publish notification events to an SNS topic
2. **SNS Topic**: `TimeTrackingNotifications` topic receives all notification events
3. **Notification Handler**: Lambda function subscribes to SNS and sends emails via SES
4. **Scheduled Notifications**: EventBridge rule triggers hourly checks for reminders

### Email Templates

The system includes 6 pre-built email templates (HTML + text versions):

#### 1. Shift Created
Sent to employees when a new shift is assigned.
```typescript
{
  type: 'shift_created',
  userId: 'user-123',
  userName: 'John Doe',
  startTime: '2025-01-15T09:00:00Z',
  endTime: '2025-01-15T17:00:00Z',
  location: 'Main Office',
  position: 'Cashier'
}
```

#### 2. Time Entry Approved
Sent when a manager approves a time entry.
```typescript
{
  type: 'time_entry_approved',
  userId: 'user-123',
  userName: 'John Doe',
  date: '2025-01-14',
  hours: 8.5,
  pay: 127.50
}
```

#### 3. Time Entry Rejected
Sent when a manager rejects a time entry.
```typescript
{
  type: 'time_entry_rejected',
  userId: 'user-123',
  userName: 'John Doe',
  date: '2025-01-14',
  reason: 'Clock-in time does not match schedule'
}
```

#### 4. Pending Approvals Reminder
Sent to managers at 9 AM daily if there are pending approvals.
```typescript
{
  type: 'pending_approvals_reminder',
  userId: 'manager-456',
  managerName: 'Jane Manager',
  pendingCount: 12
}
```

#### 5. Compliance Violation
Sent when a compliance violation is detected.
```typescript
{
  type: 'compliance_violation',
  userId: 'user-123',
  userName: 'John Doe',
  violationType: 'overtime_violation',
  description: 'Weekly hours exceed 40 hours without overtime approval',
  severity: 'warning' | 'critical'
}
```

#### 6. Shift Reminder
Sent 2 hours before a scheduled shift starts.
```typescript
{
  type: 'shift_reminder',
  userId: 'user-123',
  userName: 'John Doe',
  startTime: '2025-01-15T09:00:00Z',
  location: 'Main Office',
  hoursUntil: 2
}
```

### Scheduled Notifications

The `scheduledNotifications` Lambda runs every hour via EventBridge and:
- **Shift Reminders**: Checks for shifts starting in the next 2 hours
- **Pending Approvals**: At 9 AM daily, reminds managers with pending approvals

### Publishing Notifications

To send a notification from any Lambda function:

```typescript
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const sns = new SNSClient({});

await sns.send(new PublishCommand({
  TopicArn: process.env.NOTIFICATION_TOPIC_ARN,
  Message: JSON.stringify({
    type: 'shift_created',
    userId: 'user-123',
    userName: 'John Doe',
    startTime: '2025-01-15T09:00:00Z',
    endTime: '2025-01-15T17:00:00Z',
    location: 'Main Office',
    position: 'Cashier'
  })
}));
```

---

## Compliance Rules Engine

### Overview

The `ComplianceEngine` class validates time entries against labor law regulations. It supports:
- Federal FLSA (Fair Labor Standards Act) standards
- Regional variations (California, New York, Texas)
- Customizable rules per organization

### Default FLSA Standards

```typescript
{
  dailyOvertimeThreshold: 8,        // Hours before overtime starts
  weeklyOvertimeThreshold: 40,      // Weekly hours before overtime
  overtimeMultiplier: 1.5,          // 1.5x pay for overtime
  requireBreaks: true,              // Enforce break requirements
  breakRules: [
    { minHours: 5, breakDuration: 30, paid: false },  // 30 min break after 5 hours
    { minHours: 8, breakDuration: 30, paid: false },  // Additional break after 8 hours
  ],
  minimumRestBetweenShifts: 8,      // Hours between shifts
  minimumWeeklyRest: 24,            // Continuous hours off per week
  maximumShiftLength: 12,           // Maximum consecutive work hours
  maximumConsecutiveDays: 6,        // Max days without a day off
  minorMaxDailyHours: 8,            // Max hours for employees under 18
  minorMaxWeeklyHours: 40,          // Max weekly hours for minors
  minorProhibitedHours: [
    { start: '19:00', end: '07:00' },  // Minors can't work 7 PM - 7 AM
  ],
  region: 'US-FEDERAL',
  timezone: 'America/New_York',
}
```

### Regional Variations

#### California (US-CA)
- **Daily Overtime**: 8 hours (more strict)
- **Double Overtime**: 12+ hours per day = 2x pay
- **7th Day**: 2x pay for working 7+ consecutive days
- **Meal Breaks**: 30 min unpaid after 5 hours, 2nd break after 10 hours

#### New York (US-NY)
- **Split Shift**: Additional hour of pay for split shifts
- **Spread of Hours**: 10-hour spread limit
- **Day of Rest**: 24 consecutive hours per week required

#### Texas (US-TX)
- **No State Overtime**: Follows federal FLSA rules
- **At-Will Employment**: More flexible scheduling

### Violation Types

The engine detects these violation types:

1. **Missing Breaks** (`missing_break`)
   - Worked 5+ hours without a 30-minute break
   - Severity: `warning`

2. **Excessive Shift Length** (`excessive_shift_length`)
   - Shift exceeds 12 hours
   - Severity: `critical`

3. **Insufficient Rest Period** (`insufficient_rest_period`)
   - Less than 8 hours between shifts
   - Severity: `critical`

4. **Daily Overtime** (`daily_overtime`)
   - Exceeds 8 hours in a day (CA) or 12 hours (federal)
   - Severity: `warning`

5. **Weekly Overtime** (`weekly_overtime`)
   - Exceeds 40 hours in a week
   - Severity: `warning`

6. **Excessive Consecutive Days** (`excessive_consecutive_days`)
   - More than 6 consecutive days without a day off
   - Severity: `critical`

7. **Minor Work Hours** (`minor_work_hours`)
   - Minor exceeds 8 hours/day or 40 hours/week
   - Severity: `critical`

8. **Minor Prohibited Hours** (`minor_prohibited_hours`)
   - Minor working between 7 PM - 7 AM
   - Severity: `critical`

### Using the Compliance Engine

```typescript
import { ComplianceEngine, getRegionalComplianceSettings } from '../shared/compliance';

// Create engine with regional settings
const settings = getRegionalComplianceSettings('US-CA');
const engine = new ComplianceEngine(settings);

// Check a time entry
const violations = engine.checkTimeEntry({
  userId: 'user-123',
  entryId: 'entry-456',
  clockInTime: '2025-01-15T08:00:00Z',
  clockOutTime: '2025-01-15T20:00:00Z',  // 12-hour shift
  breaks: [
    { startTime: '2025-01-15T12:00:00Z', endTime: '2025-01-15T12:30:00Z', duration: 30 }
  ],
  totalHours: 11.5,
  isMinor: false,
  previousShift: {
    clockOutTime: '2025-01-14T23:00:00Z'  // Only 9 hours ago
  }
});

// violations = [
//   {
//     type: 'excessive_shift_length',
//     severity: 'critical',
//     description: 'Shift length (11.5 hours) exceeds maximum allowed (12 hours)',
//     userId: 'user-123',
//     entryId: 'entry-456',
//     date: '2025-01-15'
//   }
// ]
```

### API Endpoint

**GET /compliance/check**

Query parameters:
- `userId` (optional): Check specific user
- `startDate` (required): Start of date range (YYYY-MM-DD)
- `endDate` (required): End of date range (YYYY-MM-DD)

Response:
```json
{
  "success": true,
  "data": {
    "violations": [
      {
        "type": "weekly_overtime",
        "severity": "warning",
        "description": "Weekly hours (45.5) exceed threshold (40)",
        "userId": "user-123",
        "entryId": "entry-456",
        "date": "2025-01-15"
      }
    ],
    "summary": {
      "total": 1,
      "critical": 0,
      "warnings": 1
    }
  }
}
```

---

## Configuration

### Environment Variables

**Required for Notifications:**
- `FROM_EMAIL`: Email address to send notifications from (must be verified in SES)
- `FRONTEND_URL`: Base URL for frontend links in emails
- `NOTIFICATION_TOPIC_ARN`: SNS topic ARN (auto-configured by CDK)

**Required for Compliance:**
- `TABLE_NAME`: DynamoDB table name
- `JWT_SECRET`: JWT secret for authentication

### SES Setup

1. **Verify Email Address**:
   ```bash
   aws ses verify-email-identity --email-address noreply@yourdomain.com
   ```

2. **Production**: Request production access to send to any email
   ```bash
   # By default, SES is in sandbox mode (can only send to verified emails)
   # Request production access via AWS Console: SES > Account Dashboard > Request Production Access
   ```

3. **Set FROM_EMAIL Environment Variable**:
   ```bash
   export FROM_EMAIL=noreply@yourdomain.com
   ```

### Organization Compliance Settings

Each organization can customize compliance settings in DynamoDB:

```typescript
// Store in DynamoDB as ORG#{orgId}#SETTINGS
{
  PK: 'ORG#org-123',
  SK: 'SETTINGS',
  compliance: {
    dailyOvertimeThreshold: 8,
    weeklyOvertimeThreshold: 40,
    requireBreaks: true,
    region: 'US-CA',  // Use California rules
    timezone: 'America/Los_Angeles'
  }
}
```

---

## API Endpoints

### Compliance

- **GET /compliance/check**: Check compliance violations
  - Auth: Required (Cognito)
  - Role: Manager, Admin, Owner

### Future Endpoints (To Be Implemented)

- **POST /notifications/send**: Manually send notification
- **GET /notifications/history**: Get notification history
- **PUT /settings/compliance**: Update organization compliance settings
- **GET /settings/compliance**: Get current compliance settings

---

## Testing

### Test Notification System

1. Create a shift and verify the employee receives an email
2. Approve/reject a time entry and verify the employee receives an email
3. Wait for scheduled notifications (or manually invoke Lambda)

### Test Compliance Engine

1. Create time entries that violate rules:
   - 12+ hour shifts
   - Less than 8 hours between shifts
   - Missing breaks after 5+ hours
   - 7+ consecutive days
2. Call `/compliance/check` to verify violations are detected
3. Verify compliance violation emails are sent

### Manual Testing via AWS Console

**Send Test Notification:**
```bash
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT:TimeTrackingNotifications \
  --message '{
    "type": "shift_reminder",
    "userId": "user-123",
    "userName": "Test User",
    "startTime": "2025-01-15T09:00:00Z",
    "location": "Main Office",
    "hoursUntil": 2
  }'
```

**Invoke Scheduled Notifications:**
```bash
aws lambda invoke \
  --function-name TimeTrackingStack-ScheduledNotificationsFunction \
  --payload '{}' \
  response.json
```

---

## Future Enhancements

1. **SMS Notifications**: Add SNS SMS support for urgent notifications
2. **Push Notifications**: Add mobile push notification support
3. **Notification Preferences**: Let users configure notification preferences
4. **Advanced Compliance**: Add more regional regulations (EU, UK, etc.)
5. **Compliance Reports**: Generate compliance reports for auditing
6. **Automated Compliance Actions**: Auto-reject entries that violate critical rules
7. **Notification Templates**: Allow admins to customize email templates
8. **Multi-language Support**: Translate emails based on user preferences

---

## Support

For issues or questions:
- Check AWS CloudWatch logs for Lambda function errors
- Verify SES email verification status
- Ensure SNS topic subscription is active
- Check compliance settings in DynamoDB
