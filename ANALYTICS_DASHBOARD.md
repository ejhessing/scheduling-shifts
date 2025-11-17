# Analytics Dashboard

## Overview

The Analytics Dashboard provides comprehensive insights into labor costs, employee performance, and budget tracking for managers and administrators.

## Features

### 1. Key Metrics
- **Total Hours**: Breakdown of regular vs overtime hours
- **Labor Cost**: Total labor costs with regular and overtime breakdown
- **Attendance Rate**: Percentage of completed shifts vs scheduled
- **Active Employees**: Number of employees who logged hours in the period

### 2. Budget Tracking
- Real-time budget usage monitoring
- Projected spend calculations based on current burn rate
- Alert system when budget thresholds are exceeded (default: 80%)
- Visual progress bar showing budget consumption
- Days remaining in budget period
- On-track vs over-budget status indicator

### 3. Department Breakdown
- Hours and costs per location/department
- Employee count by department
- Attendance rates by location
- Sorted by cost (highest first)

### 4. Employee Performance Metrics
- Total hours worked per employee
- Overtime hours tracking
- Attendance rates
- Late clock-ins tracking
- Missed shifts
- Top 10 performers by hours worked

### 5. Anomaly Detection
- Excessive hours (>16 hours in single shift)
- Missing clock-outs (>24 hours)
- Very short shifts (<1 hour)
- Severity levels: low, medium, high

### 6. Trends (Data Available)
- Hours worked over time
- Labor costs over time
- Grouping by day, week, or month
- Note: Chart visualization requires recharts library installation

## API Endpoints

### GET /analytics
Retrieve comprehensive analytics data.

**Query Parameters:**
- `startDate` (required): YYYY-MM-DD format
- `endDate` (required): YYYY-MM-DD format
- `locationId` (optional): Filter by specific location
- `groupBy` (optional): 'day' | 'week' | 'month' (default: 'day')

**Response:**
```json
{
  "metrics": {
    "totalHours": 1200.5,
    "regularHours": 1000,
    "overtimeHours": 200.5,
    "totalCost": 18500.75,
    "regularCost": 15000,
    "overtimeCost": 3500.75,
    "shiftsScheduled": 150,
    "shiftsCompleted": 145,
    "attendanceRate": 97,
    "employeeCount": 25
  },
  "trends": {
    "hours": [
      { "date": "2025-01-01", "value": 120.5 },
      { "date": "2025-01-02", "value": 135.0 }
    ],
    "cost": [
      { "date": "2025-01-01", "value": 1850.25 },
      { "date": "2025-01-02", "value": 2025.50 }
    ]
  },
  "departmentMetrics": [
    {
      "locationId": "loc-123",
      "locationName": "Downtown Store",
      "hours": 500,
      "cost": 7500,
      "employeeCount": 10,
      "attendanceRate": 98
    }
  ],
  "anomalies": [
    {
      "type": "excessive_hours",
      "description": "Entry has 18 hours, exceeds threshold of 16",
      "entryId": "entry-456",
      "severity": "high"
    }
  ],
  "period": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-31"
  }
}
```

### GET /analytics/budget
Get budget status and projections.

**Query Parameters:**
- `periodStart` (required): YYYY-MM-DD format
- `periodEnd` (required): YYYY-MM-DD format
- `budgetAmount` (optional): Budget amount in dollars (default: 10000)
- `locationId` (optional): Filter by specific location
- `alertThreshold` (optional): Alert threshold percentage (default: 80)

**Response:**
```json
{
  "periodStart": "2025-01-01",
  "periodEnd": "2025-01-31",
  "budgetAmount": 10000,
  "actualSpent": 8500,
  "projectedSpend": 10200,
  "remainingBudget": 1500,
  "percentageUsed": 85,
  "onTrack": false,
  "daysRemaining": 10,
  "alert": true,
  "alertMessage": "Budget usage at 85% - exceeds 80% threshold"
}
```

### GET /analytics/employees
Get employee performance metrics.

**Query Parameters:**
- `startDate` (required): YYYY-MM-DD format
- `endDate` (required): YYYY-MM-DD format
- `userId` (optional): Get metrics for specific employee

**Response:**
```json
{
  "employees": [
    {
      "userId": "user-123",
      "userName": "John Doe",
      "totalHours": 160,
      "regularHours": 140,
      "overtimeHours": 20,
      "scheduledShifts": 20,
      "completedShifts": 19,
      "missedShifts": 1,
      "lateClockIns": 2,
      "attendanceRate": 95,
      "averageHoursPerWeek": 40
    }
  ],
  "period": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-31"
  }
}
```

## Access Control

All analytics endpoints require:
- Authentication via JWT token
- Manager, Admin, or Owner role
- Employees receive 403 Forbidden error

## Frontend Usage

Navigate to `/analytics` in the web application. The page includes:

1. **Date Range Filter**: Select custom date ranges
2. **Grouping Options**: View trends by day, week, or month
3. **Budget Configuration**: Set budget amount and alert threshold
4. **Interactive Tables**: Sort and filter employee and department data
5. **Visual Indicators**: Color-coded badges for attendance and budget status

## Backend Implementation

### Lambda Functions

1. **getAnalytics.ts**: Main analytics aggregation
   - Fetches time entries, shifts, users, locations
   - Calculates metrics using analytics utilities
   - Generates trends and department breakdowns
   - Detects anomalies

2. **getBudgetStatus.ts**: Budget tracking
   - Calculates actual spend from time entries
   - Projects future spend based on burn rate
   - Determines if spending is on track

3. **getEmployeeMetrics.ts**: Employee performance
   - Calculates individual metrics for all employees
   - Supports single employee lookup
   - Tracks attendance, overtime, and punctuality

### Shared Utilities (`/backend/shared/analytics.ts`)

- `calculateMetricsFromEntries()`: Aggregate hours and costs
- `calculateAttendanceRate()`: Compare scheduled vs actual
- `generateTrendData()`: Group by time period
- `calculateDepartmentMetrics()`: Break down by location
- `calculateEmployeeMetrics()`: Individual performance
- `calculateBudgetStatus()`: Budget projections
- `detectAnomalies()`: Find suspicious patterns

## Installation Notes

### Optional: Install Charting Library

For visual charts (line charts, bar charts, pie charts):

```bash
cd frontend/web
npm install recharts
```

Then update `AnalyticsPage.tsx` to import and use recharts components:

```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
```

## Cost Considerations

Analytics Lambda functions:
- **Memory**: 1024 MB (getAnalytics), 512 MB (budget, employee)
- **Timeout**: 30s (getAnalytics), 15s (others)
- **Estimated Cost**: ~$0.10-0.50/month for typical usage (< 1000 requests/month)

Data retrieval may scan large DynamoDB tables - consider:
- Setting date range limits
- Implementing caching for frequently accessed periods
- Using DynamoDB query optimization

## Future Enhancements

1. **Forecasting**: Predict future labor costs based on historical trends
2. **Shift Coverage**: Analyze understaffed vs overstaffed periods
3. **Cost Center Analysis**: Track profitability by department
4. **Export**: Download analytics data as PDF or Excel
5. **Scheduled Reports**: Email weekly/monthly analytics reports
6. **Custom Dashboards**: Allow users to create personalized views
7. **Real-time Updates**: WebSocket integration for live metrics
