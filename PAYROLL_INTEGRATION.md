# Payroll Integration & Export

## Overview

The Payroll Integration system provides comprehensive payroll management, calculation, and export capabilities. It supports multiple payroll periods, automated wage calculations with overtime, and seamless integration with popular payroll systems.

## Features

### 1. Payroll Period Management
- **Create Payroll Periods**: Define periods with start/end dates and pay dates
- **Period Types**: Weekly, biweekly, semi-monthly, monthly
- **Status Tracking**: Draft → Processing → Approved → Paid
- **Period Generation**: Automatic calculation of periods for a year

### 2. Payroll Processing
- **Automated Calculations**:
  - Regular hours vs overtime hours
  - Double-time hours (California compliance)
  - Gross pay with overtime multipliers
  - Per-employee wage calculations
- **Time Entry Integration**: Automatically pulls approved time entries
- **Multi-rate Support**: Respects individual employee hourly rates

### 3. Export Formats

#### CSV (Universal)
Standard comma-separated format compatible with Excel, Google Sheets, and most payroll systems.

**Fields**:
- Employee Name, Employee Number
- Regular Hours, Overtime Hours, Double Time Hours
- Regular Rate, Overtime Rate, Double Time Rate
- Gross Pay, Taxes, Deductions, Net Pay

#### QuickBooks IIF
Direct import format for QuickBooks Desktop (Time Activities).

**Features**:
- Time activity format
- Separate entries for regular and overtime
- Includes job costing fields
- Compatible with QuickBooks Desktop 2020+

#### ADP Format
Custom CSV format designed for ADP Workforce Now import.

**Fields**:
- Company Code, Batch ID, File Number
- Regular Hours, Overtime Hours
- Regular Earnings, Overtime Earnings, Gross Pay

#### JSON (API Integration)
Structured JSON for custom payroll system integrations.

**Structure**:
```json
{
  "period": {
    "id": "...",
    "startDate": "2025-01-01",
    "endDate": "2025-01-14",
    "payDate": "2025-01-17",
    "status": "approved"
  },
  "summary": {
    "totalGrossPay": 15000.00,
    "totalRegularHours": 800.0,
    "totalOvertimeHours": 50.0,
    "employeeCount": 25
  },
  "entries": [...]
}
```

### 4. Workflow States

**Draft**:
- Newly created period
- No payroll calculations yet
- Can be deleted or modified

**Processing**:
- Payroll has been calculated
- Time entries have been aggregated
- Ready for manager review

**Approved**:
- Manager has approved the payroll
- Ready to export to payroll system
- Can be marked as paid

**Paid**:
- Payment has been processed
- Final status (read-only)
- Archived for record-keeping

## API Endpoints

### POST /payroll/periods
Create a new payroll period.

**Request Body**:
```json
{
  "startDate": "2025-01-01",
  "endDate": "2025-01-14",
  "payDate": "2025-01-17",
  "periodType": "biweekly"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Payroll period created successfully",
  "data": {
    "periodId": "uuid",
    "status": "draft",
    ...
  }
}
```

### GET /payroll/periods
List all payroll periods with optional filtering.

**Query Parameters**:
- `status`: Filter by status (draft, processing, approved, paid, cancelled)
- `year`: Filter by year (e.g., "2025")

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "periodId": "uuid",
      "startDate": "2025-01-01",
      "endDate": "2025-01-14",
      "payDate": "2025-01-17",
      "status": "processing",
      "periodType": "biweekly",
      "totalGrossPay": 15000.00,
      "employeeCount": 25,
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### POST /payroll/{periodId}/process
Process payroll for a period (calculate wages from time entries).

**Prerequisites**:
- Period must be in "draft" status
- Time entries must be approved

**Process**:
1. Fetches all approved time entries for the period
2. Groups entries by employee
3. Calculates regular, overtime, and double-time hours
4. Applies hourly rates and overtime multipliers
5. Stores payroll entries
6. Updates period status to "processing"

**Response**:
```json
{
  "success": true,
  "message": "Payroll processed successfully",
  "data": {
    "periodId": "uuid",
    "status": "processing",
    "totalGrossPay": 15000.00,
    "employeeCount": 25,
    "entries": [...]
  }
}
```

### GET /payroll/{periodId}/export
Export payroll data in specified format.

**Query Parameters**:
- `format`: "csv", "quickbooks", "adp", or "json"

**Prerequisites**:
- Period must be "processing", "approved", or "paid"

**Response**:
- File download with appropriate Content-Type and filename
- CSV/QuickBooks/ADP: `text/csv` or `text/plain`
- JSON: `application/json`

### POST /payroll/{periodId}/approve
Approve a payroll period or mark as paid.

**Request Body**:
```json
{
  "action": "approve"  // or "mark_paid"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Payroll approved successfully",
  "data": {
    "periodId": "uuid",
    "status": "approved"
  }
}
```

## Frontend Usage

Navigate to `/payroll` in the web application.

### Create New Period
1. Click "Create Period" button
2. Select period type (weekly, biweekly, semi-monthly, monthly)
3. Enter start date, end date, and pay date
4. Submit form

### Process Payroll
1. Click "Process" button on a draft period
2. System calculates payroll from approved time entries
3. Review totals (gross pay, employee count)
4. Period moves to "processing" status

### Approve Payroll
1. Review processed payroll entries
2. Click "Approve" button
3. Period moves to "approved" status
4. Ready for export

### Export Payroll
1. Click "Export" button on processed/approved period
2. Select export format:
   - CSV (Excel, Spreadsheets)
   - QuickBooks IIF
   - ADP Format
   - JSON (API Integration)
3. Click "Export" to download file
4. Import file into your payroll system

### Mark as Paid
1. After processing payment in external system
2. Click "Mark Paid" button
3. Period moves to "paid" status (final)

## Overtime Calculations

### Standard Overtime (FLSA)
- **Threshold**: 40 hours per week
- **Multiplier**: 1.5x regular rate
- **Example**: $15/hr regular → $22.50/hr overtime

### Double Time (California)
- **Threshold**: 12 hours per day
- **Multiplier**: 2.0x regular rate
- **Example**: $15/hr regular → $30/hr double time

### Calculation Logic
```typescript
if (totalHours <= 40) {
  regularHours = totalHours
  overtimeHours = 0
} else if (totalHours <= 60) {
  regularHours = 40
  overtimeHours = totalHours - 40
} else {
  regularHours = 40
  overtimeHours = 20
  doubleTimeHours = totalHours - 60
}

grossPay =
  (regularHours × regularRate) +
  (overtimeHours × overtimeRate) +
  (doubleTimeHours × doubleTimeRate)
```

## Integration Examples

### QuickBooks Desktop
1. Export payroll in QuickBooks IIF format
2. Open QuickBooks Desktop
3. Go to File → Utilities → Import → IIF Files
4. Select downloaded `.iif` file
5. Review imported time activities
6. Process payroll in QuickBooks

### ADP Workforce Now
1. Export payroll in ADP format
2. Log into ADP Workforce Now
3. Navigate to Payroll → Import Time
4. Upload CSV file
5. Map fields (if first time)
6. Process payroll run

### Excel/Google Sheets
1. Export payroll in CSV format
2. Open in Excel or Google Sheets
3. Review and analyze data
4. Create pivot tables or charts
5. Calculate additional deductions/benefits

### Custom API Integration
1. Export payroll in JSON format
2. Parse JSON in your application
3. Map fields to your payroll system
4. Make API calls to external payroll provider
5. Handle responses and confirmations

## Access Control

All payroll endpoints require:
- Authentication via JWT token
- Manager, Admin, or Owner role
- Employees receive 403 Forbidden error

## Backend Implementation

### Lambda Functions

1. **createPayrollPeriod.ts**: Create new payroll periods
   - Validates dates and period type
   - Stores in DynamoDB
   - Returns period details

2. **getPayrollPeriods.ts**: List payroll periods
   - Fetches from DynamoDB
   - Supports filtering by status and year
   - Sorts by date descending

3. **processPayroll.ts**: Calculate payroll
   - Fetches approved time entries
   - Groups by employee
   - Calculates wages with overtime
   - Stores payroll entries
   - Updates period totals

4. **exportPayroll.ts**: Export in various formats
   - Fetches payroll entries
   - Generates format-specific output
   - Returns file download

5. **approvePayroll.ts**: Approve or mark as paid
   - Updates period status
   - Records approver and timestamp
   - Prevents changes to final periods

### Shared Utilities (`/backend/shared/payroll.ts`)

- `generatePayrollPeriods()`: Generate periods for a year
- `calculatePayrollEntries()`: Calculate wages from time entries
- `exportPayrollToCSV()`: CSV format generator
- `exportPayrollToQuickBooks()`: QuickBooks IIF generator
- `exportPayrollToADP()`: ADP format generator
- `exportPayrollToJSON()`: JSON format generator

## Database Schema

### Payroll Period
```
PK: ORG#{organizationId}
SK: PAYROLL#{periodId}
GSI1PK: ORG#{organizationId}#PAYROLL
GSI1SK: DATE#{startDate}
```

### Payroll Entry
```
PK: ORG#{organizationId}#PAYROLL#{periodId}
SK: ENTRY#{userId}
```

## Cost Considerations

Payroll Lambda functions:
- **Memory**: 1024 MB (process), 512 MB (others)
- **Timeout**: 60s (process), 30s (export), 15s (others)
- **Estimated Cost**: ~$0.05-0.25/month for typical usage

## Security & Compliance

- **Data Encryption**: All payroll data encrypted at rest (DynamoDB)
- **Access Logging**: All payroll operations logged to CloudWatch
- **Role-Based Access**: Strictly manager+ only
- **Audit Trail**: Created/updated timestamps, approver tracking
- **PII Protection**: Employee numbers support anonymization

## Future Enhancements

1. **Tax Withholding**: Calculate federal, state, FICA taxes
2. **Deductions**: Health insurance, 401k, garnishments
3. **Direct Deposit**: ACH file generation
4. **Pay Stubs**: PDF generation with itemized breakdown
5. **Year-End Reports**: W-2 generation, annual summaries
6. **Multi-Currency**: Support for international payroll
7. **Benefits Integration**: Track benefits enrollment and costs
8. **Payroll Calendar**: Visual calendar with pay dates
9. **Automated Reminders**: Email notifications for payroll deadlines
10. **Payroll Analytics**: Labor cost trends, department comparisons

## Troubleshooting

### "Cannot export payroll in draft status"
- Solution: Click "Process" button first to calculate payroll

### "No payroll entries found for this period"
- Check that time entries exist for the date range
- Ensure time entries are approved (not pending/rejected)
- Verify employees clocked in during the period

### "No time entries approved"
- Navigate to Admin Dashboard
- Approve pending time entries
- Re-process payroll

### QuickBooks import fails
- Ensure QuickBooks version supports IIF format
- Verify employee names match QuickBooks exactly
- Check that time activity items ("Regular", "Overtime") exist

### ADP file format issues
- Verify company code is configured correctly
- Check employee numbers match ADP system
- Ensure CSV encoding is UTF-8

## Support

For additional help:
- Review AWS CloudWatch logs for detailed error messages
- Check DynamoDB for data integrity
- Verify API Gateway request/response formats
- Test with small periods before large payroll runs
