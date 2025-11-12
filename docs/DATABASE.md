# Database Schema Documentation

## Overview

The Time Tracking & Scheduling Application uses Amazon DynamoDB with a single-table design pattern. This approach optimizes for performance, cost, and flexibility.

## Why Single-Table Design?

**Benefits**:
- Lower latency (fewer round trips)
- Lower cost (fewer tables to manage)
- Atomic transactions across entity types
- Better performance at scale

**Trade-offs**:
- More complex query patterns
- Requires upfront access pattern design
- Less intuitive than relational databases

## Table Configuration

**Table Name**: `TimeTrackingApp`

**Primary Key**:
- **PK** (Partition Key): String
- **SK** (Sort Key): String

**Global Secondary Indexes**:
1. **GSI1**
   - GSI1PK (Partition Key): String
   - GSI1SK (Sort Key): String
   - Projection: ALL

2. **GSI2**
   - GSI2PK (Partition Key): String
   - GSI2SK (Sort Key): String
   - Projection: ALL

**Capacity Settings**:
- Billing Mode: On-Demand (pay per request)
- Point-in-Time Recovery: Enabled
- Encryption: AWS managed keys (SSE)
- Stream: Enabled (NEW_AND_OLD_IMAGES)

## Entity Types

### 1. User Profile

**Purpose**: Store user account information and preferences

**Primary Key**:
- PK: `USER#{userId}`
- SK: `PROFILE#{userId}`

**GSI1**:
- GSI1PK: `ORG#{orgId}#USERS`
- GSI1SK: `USER#{userId}`

**Attributes**:
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+1234567890",
  "role": "EMPLOYEE | MANAGER | ORG_ADMIN | SUPER_ADMIN",
  "orgId": "uuid",
  "locationIds": ["loc-uuid-1", "loc-uuid-2"],
  "preferences": {
    "theme": "light | dark",
    "notifications": {
      "email": true,
      "push": true,
      "sms": false,
      "shiftReminders": true,
      "scheduleChanges": true
    },
    "timezone": "America/New_York",
    "language": "en"
  },
  "certifications": [
    {
      "id": "cert-uuid",
      "name": "CPR Certification",
      "issuer": "Red Cross",
      "issueDate": "2024-01-01",
      "expiryDate": "2026-01-01",
      "documentUrl": "s3://..."
    }
  ],
  "skills": ["bartender", "server", "host"],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

**Access Patterns**:
1. Get user by ID: `GetItem(PK=USER#{userId}, SK=PROFILE#{userId})`
2. List all users in org: `Query(GSI1, GSI1PK=ORG#{orgId}#USERS)`

### 2. Organization

**Purpose**: Store organization settings and configuration

**Primary Key**:
- PK: `ORG#{orgId}`
- SK: `ORG#{orgId}`

**Attributes**:
```json
{
  "orgId": "uuid",
  "name": "Acme Corp",
  "plan": "FREE | STARTER | PROFESSIONAL | ENTERPRISE",
  "settings": {
    "workWeekStart": 0,
    "overtimeThreshold": 40,
    "requireClockInPhoto": false,
    "requireGeofence": true,
    "autoApproveTimeEntries": false,
    "payPeriodType": "WEEKLY | BI_WEEKLY | SEMI_MONTHLY | MONTHLY"
  },
  "complianceRules": {
    "maxHoursPerDay": 12,
    "maxHoursPerWeek": 60,
    "minRestBetweenShifts": 8,
    "breakRules": [
      {
        "minShiftDuration": 6,
        "breakDuration": 30,
        "paid": false
      }
    ],
    "overtimeRules": [
      {
        "threshold": 40,
        "multiplier": 1.5,
        "period": "WEEKLY | DAILY"
      }
    ]
  },
  "timezone": "America/New_York",
  "billingInfo": {
    "customerId": "stripe-customer-id",
    "subscriptionId": "stripe-subscription-id",
    "paymentMethodId": "pm_xxx",
    "billingEmail": "billing@example.com"
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

**Access Patterns**:
1. Get org by ID: `GetItem(PK=ORG#{orgId}, SK=ORG#{orgId})`

### 3. Location

**Purpose**: Store work location details and geofence boundaries

**Primary Key**:
- PK: `ORG#{orgId}`
- SK: `LOC#{locationId}`

**GSI1**:
- GSI1PK: `LOC#{locationId}`
- GSI1SK: `LOC#{locationId}`

**Attributes**:
```json
{
  "locationId": "uuid",
  "orgId": "uuid",
  "name": "Downtown Office",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  },
  "geofence": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "radiusMeters": 100
  },
  "timezone": "America/New_York",
  "settings": {
    "allowedClockInMethods": ["MOBILE", "WEB", "KIOSK"],
    "requirePhoto": false,
    "requireBiometric": false
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

**Access Patterns**:
1. Get location by ID: `Query(GSI1, GSI1PK=LOC#{locationId})`
2. List org locations: `Query(PK=ORG#{orgId}, SK begins_with LOC#)`

### 4. Shift/Schedule

**Purpose**: Store scheduled work shifts

**Primary Key**:
- PK: `LOC#{locationId}#DATE#{YYYY-MM-DD}`
- SK: `SHIFT#{shiftId}`

**GSI1** (User's shifts):
- GSI1PK: `USER#{userId}#SHIFTS`
- GSI1SK: `DATE#{YYYY-MM-DD}#{ISO-timestamp}`

**GSI2** (Org-wide shifts):
- GSI2PK: `ORG#{orgId}#SHIFTS`
- GSI2SK: `DATE#{YYYY-MM-DD}#{ISO-timestamp}`

**Attributes**:
```json
{
  "shiftId": "uuid",
  "userId": "uuid",
  "locationId": "uuid",
  "orgId": "uuid",
  "date": "2024-01-15",
  "startTime": "2024-01-15T09:00:00Z",
  "endTime": "2024-01-15T17:00:00Z",
  "position": "Server",
  "status": "SCHEDULED | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED | NO_SHOW",
  "breakRules": [
    {
      "minShiftDuration": 6,
      "breakDuration": 30,
      "paid": false
    }
  ],
  "payRate": 15.00,
  "notes": "Bring uniform",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "createdBy": "manager-user-id"
}
```

**Access Patterns**:
1. Get shifts for location and date: `Query(PK=LOC#{locationId}#DATE#{date})`
2. Get user's shifts in date range: `Query(GSI1, GSI1PK=USER#{userId}#SHIFTS, GSI1SK between DATE#start and DATE#end)`
3. Get all org shifts: `Query(GSI2, GSI2PK=ORG#{orgId}#SHIFTS)`

### 5. Time Entry

**Purpose**: Store clock in/out records and hours worked

**Primary Key**:
- PK: `USER#{userId}#DATE#{YYYY-MM-DD}`
- SK: `ENTRY#{entryId}`

**GSI1** (Location time entries):
- GSI1PK: `LOC#{locationId}#DATE#{YYYY-MM-DD}`
- GSI1SK: `ENTRY#{ISO-timestamp}`

**GSI2** (Payroll period):
- GSI2PK: `ORG#{orgId}#PAYPERIOD#{YYYY-WW}`
- GSI2SK: `USER#{userId}#{ISO-timestamp}`

**Attributes**:
```json
{
  "entryId": "uuid",
  "userId": "uuid",
  "shiftId": "uuid",
  "locationId": "uuid",
  "orgId": "uuid",
  "date": "2024-01-15",
  "clockInTime": "2024-01-15T09:00:00.123Z",
  "clockOutTime": "2024-01-15T17:30:00.456Z",
  "clockInLocation": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 10.5,
    "timestamp": "2024-01-15T09:00:00.123Z"
  },
  "clockOutLocation": {
    "latitude": 40.7130,
    "longitude": -74.0062,
    "accuracy": 12.3,
    "timestamp": "2024-01-15T17:30:00.456Z"
  },
  "breaks": [
    {
      "startTime": "2024-01-15T12:00:00Z",
      "endTime": "2024-01-15T12:30:00Z",
      "paid": false,
      "duration": 30
    }
  ],
  "totalHours": 8.0,
  "regularHours": 8.0,
  "overtimeHours": 0.0,
  "photos": {
    "clockIn": "s3://bucket/photos/user-id/entry-id-clock-in.jpg",
    "clockOut": "s3://bucket/photos/user-id/entry-id-clock-out.jpg"
  },
  "status": "DRAFT | PENDING | APPROVED | REJECTED | PAID",
  "approvedBy": "manager-user-id",
  "approvedAt": "2024-01-16T10:00:00Z",
  "payRate": 15.00,
  "totalPay": 120.00,
  "notes": "Worked overtime",
  "createdAt": "2024-01-15T09:00:00Z",
  "updatedAt": "2024-01-15T17:30:00Z"
}
```

**Access Patterns**:
1. Get user's entries for date: `Query(PK=USER#{userId}#DATE#{date})`
2. Get user's entries for date range: Multiple queries (one per date)
3. Get location entries: `Query(GSI1, GSI1PK=LOC#{locationId}#DATE#{date})`
4. Get payroll period entries: `Query(GSI2, GSI2PK=ORG#{orgId}#PAYPERIOD#{period})`

### 6. Message

**Purpose**: Store in-app messages and communications

**Primary Key**:
- PK: `ORG#{orgId}#CHANNEL#{channelId}`
- SK: `MSG#{ISO-timestamp}#{messageId}`

**GSI1** (User's messages):
- GSI1PK: `USER#{userId}#MESSAGES`
- GSI1SK: `CHANNEL#{channelId}#{ISO-timestamp}`

**Attributes**:
```json
{
  "messageId": "uuid",
  "senderId": "uuid",
  "channelId": "uuid",
  "orgId": "uuid",
  "content": "Message text",
  "attachments": [
    {
      "id": "uuid",
      "name": "document.pdf",
      "type": "application/pdf",
      "size": 1024,
      "url": "s3://..."
    }
  ],
  "readBy": ["user-id-1", "user-id-2"],
  "timestamp": "2024-01-15T10:00:00Z",
  "editedAt": "2024-01-15T10:05:00Z"
}
```

### 7. Document

**Purpose**: Store user and org documents (certifications, contracts, etc.)

**Primary Key**:
- PK: `USER#{userId}#DOCS`
- SK: `DOC#{docId}`

**GSI1** (Org documents by type):
- GSI1PK: `ORG#{orgId}#DOCTYPE#{type}`
- GSI1SK: `DOC#{docId}`

**Attributes**:
```json
{
  "docId": "uuid",
  "userId": "uuid",
  "orgId": "uuid",
  "name": "CPR Certification",
  "type": "CERTIFICATION | LICENSE | ID | CONTRACT | HANDBOOK | OTHER",
  "s3Key": "documents/user-id/doc-id.pdf",
  "uploadedBy": "uuid",
  "uploadedAt": "2024-01-01T00:00:00Z",
  "expiresAt": "2026-01-01T00:00:00Z",
  "status": "PENDING | APPROVED | REJECTED | EXPIRED"
}
```

### 8. Notification

**Purpose**: Store user notifications

**Primary Key**:
- PK: `USER#{userId}#NOTIFICATIONS`
- SK: `NOTIF#{ISO-timestamp}#{notifId}`

**Attributes**:
```json
{
  "notifId": "uuid",
  "userId": "uuid",
  "type": "SHIFT_ASSIGNED | SHIFT_REMINDER | SHIFT_CHANGED | TIME_ENTRY_APPROVED | ...",
  "title": "Shift Reminder",
  "content": "You have a shift starting in 1 hour",
  "read": false,
  "actionUrl": "/schedule",
  "createdAt": "2024-01-15T08:00:00Z"
}
```

## Common Query Patterns

### 1. User Authentication Flow

```typescript
// Get user profile after Cognito authentication
const user = await dynamoDB.get({
  TableName: 'TimeTrackingApp',
  Key: {
    PK: `USER#${userId}`,
    SK: `PROFILE#${userId}`
  }
});
```

### 2. Clock In

```typescript
// Create time entry
await dynamoDB.put({
  TableName: 'TimeTrackingApp',
  Item: {
    PK: `USER#${userId}#DATE#${date}`,
    SK: `ENTRY#${entryId}`,
    GSI1PK: `LOC#${locationId}#DATE#${date}`,
    GSI1SK: `ENTRY#${clockInTime}`,
    GSI2PK: `ORG#${orgId}#PAYPERIOD#${payPeriod}`,
    GSI2SK: `USER#${userId}#${clockInTime}`,
    // ... other attributes
  }
});
```

### 3. Get Weekly Schedule

```typescript
// Query user's shifts for a week
const shifts = await dynamoDB.query({
  TableName: 'TimeTrackingApp',
  IndexName: 'GSI1',
  KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK BETWEEN :start AND :end',
  ExpressionAttributeValues: {
    ':pk': `USER#${userId}#SHIFTS`,
    ':start': `DATE#${startDate}`,
    ':end': `DATE#${endDate}#9999`
  }
});
```

### 4. Get Location Schedule for Day

```typescript
// Query all shifts at a location for a specific date
const shifts = await dynamoDB.query({
  TableName: 'TimeTrackingApp',
  KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
  ExpressionAttributeValues: {
    ':pk': `LOC#${locationId}#DATE#${date}`,
    ':sk': 'SHIFT#'
  }
});
```

### 5. Get Timesheet for Pay Period

```typescript
// Query all time entries for a pay period
const entries = await dynamoDB.query({
  TableName: 'TimeTrackingApp',
  IndexName: 'GSI2',
  KeyConditionExpression: 'GSI2PK = :pk',
  ExpressionAttributeValues: {
    ':pk': `ORG#${orgId}#PAYPERIOD#${period}`
  }
});
```

## Best Practices

### 1. Partition Key Design

✅ **Good**: High cardinality, evenly distributed access
- `USER#{userId}` - Each user gets their own partition
- `LOC#{locationId}#DATE#{date}` - Distributes by location and date

❌ **Bad**: Low cardinality, hot partitions
- `STATUS` - Only a few values
- `ORG#{orgId}` - Large orgs cause hot partitions

### 2. Sort Key Design

✅ **Good**: Enables range queries and sorting
- `DATE#{date}#{timestamp}` - Query by date range
- `ENTRY#{entryId}` - Direct access by ID

### 3. Attribute Naming

- Use consistent naming: camelCase
- Include units in names: `radiusMeters`, `durationMinutes`
- Use ISO 8601 for timestamps

### 4. Data Types

- Use appropriate types (String, Number, Boolean)
- Store timestamps as ISO 8601 strings for sortability
- Use Number for currency (cents, not dollars)

### 5. Indexing

- Only create indexes for actual access patterns
- Keep projection type as ALL for flexibility
- Monitor index size and cost

## Data Migration

### Adding New Attributes

```typescript
// Add new attribute to existing items
await dynamoDB.update({
  TableName: 'TimeTrackingApp',
  Key: { PK: 'USER#123', SK: 'PROFILE#123' },
  UpdateExpression: 'SET #newAttr = :value',
  ExpressionAttributeNames: { '#newAttr': 'newAttribute' },
  ExpressionAttributeValues: { ':value': 'default-value' }
});
```

### Backfilling Data

```typescript
// Scan and update all items (use pagination)
const scanAll = async () => {
  let lastKey = null;

  do {
    const result = await dynamoDB.scan({
      TableName: 'TimeTrackingApp',
      FilterExpression: 'attribute_not_exists(#attr)',
      ExpressionAttributeNames: { '#attr': 'newAttribute' },
      ExclusiveStartKey: lastKey
    });

    // Process items in batches
    await Promise.all(result.Items.map(item => updateItem(item)));

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
};
```

## Performance Optimization

### 1. Use Consistent Reads Sparingly

```typescript
// Eventually consistent (default) - faster, cheaper
await dynamoDB.get({ TableName, Key });

// Strongly consistent - slower, more expensive
await dynamoDB.get({ TableName, Key, ConsistentRead: true });
```

### 2. Batch Operations

```typescript
// Get multiple items in one request
await dynamoDB.batchGet({
  RequestItems: {
    'TimeTrackingApp': {
      Keys: [
        { PK: 'USER#1', SK: 'PROFILE#1' },
        { PK: 'USER#2', SK: 'PROFILE#2' }
      ]
    }
  }
});
```

### 3. Limit Query Results

```typescript
// Limit number of items returned
await dynamoDB.query({
  TableName,
  KeyConditionExpression,
  Limit: 20 // Pagination
});
```

## Monitoring

### CloudWatch Metrics

Monitor these key metrics:
- `ConsumedReadCapacityUnits`
- `ConsumedWriteCapacityUnits`
- `UserErrors` (client errors)
- `SystemErrors` (server errors)
- `ThrottledRequests`

### DynamoDB Insights

Enable Contributor Insights to identify:
- Most accessed items
- Throttled requests
- Hot partitions

## Troubleshooting

### Hot Partition

**Symptom**: Throttling on specific partition key

**Solution**:
- Add random suffix to partition key
- Use write sharding
- Redesign partition key for better distribution

### Large Item Size

**Symptom**: Items approaching 400KB limit

**Solution**:
- Move large attributes to S3
- Split into multiple items
- Compress data

### Scan Operations

**Symptom**: Slow queries, high costs

**Solution**:
- Use Query instead of Scan
- Add appropriate indexes
- Use FilterExpression sparingly

## Resources

- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Single-Table Design](https://www.alexdebrie.com/posts/dynamodb-single-table/)
- [NoSQL Workbench](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/workbench.html)
