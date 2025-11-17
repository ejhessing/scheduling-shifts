import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error, unauthorized } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';
import { parseQueryParams } from '../../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Check authorization
    if (!['manager', 'admin', 'owner'].includes(currentUser.role)) {
      return unauthorized('Only managers and administrators can generate reports');
    }

    // Parse query parameters
    const queryParams = parseQueryParams(event.queryStringParameters);
    const reportType = queryParams.type || 'timesheet'; // timesheet, labor_cost, attendance, overtime
    const startDate = queryParams.startDate;
    const endDate = queryParams.endDate;
    const format = queryParams.format || 'json'; // json, csv
    const userId = queryParams.userId; // Optional: specific user

    if (!startDate || !endDate) {
      return error('Start date and end date are required', 400);
    }

    let reportData: any;

    switch (reportType) {
      case 'timesheet':
        reportData = await generateTimesheetReport(currentUser.orgId, startDate, endDate, userId);
        break;
      case 'labor_cost':
        reportData = await generateLaborCostReport(currentUser.orgId, startDate, endDate);
        break;
      case 'attendance':
        reportData = await generateAttendanceReport(currentUser.orgId, startDate, endDate);
        break;
      case 'overtime':
        reportData = await generateOvertimeReport(currentUser.orgId, startDate, endDate);
        break;
      default:
        return error('Invalid report type', 400);
    }

    // Format response
    if (format === 'csv') {
      const csv = convertToCSV(reportData.data, reportData.columns);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${reportType}_${startDate}_${endDate}.csv"`,
          'Access-Control-Allow-Origin': '*',
        },
        body: csv,
      };
    }

    return success({
      reportType,
      startDate,
      endDate,
      ...reportData,
    });
  } catch (err: any) {
    console.error('Generate report error:', err);
    return error(err.message || 'Failed to generate report', 500);
  }
};

// Generate timesheet report
async function generateTimesheetReport(
  orgId: string,
  startDate: string,
  endDate: string,
  userId?: string
): Promise<any> {
  const dates = getDatesBetween(startDate, endDate);
  const allEntries: any[] = [];

  // Get all time entries for the period
  for (const date of dates) {
    const payPeriod = getPayPeriodFromDate(date);
    const entries = await db.queryGSI2(`ORG#${orgId}#PAYPERIOD#${payPeriod}`);

    // Filter by userId if provided
    const filteredEntries = userId
      ? entries.filter((e) => e.userId === userId && e.clockInTime?.startsWith(date))
      : entries.filter((e) => e.clockInTime?.startsWith(date));

    allEntries.push(...filteredEntries);
  }

  // Sort by date
  allEntries.sort((a, b) => {
    return new Date(a.clockInTime).getTime() - new Date(b.clockInTime).getTime();
  });

  // Calculate summary
  const summary = {
    totalEntries: allEntries.length,
    totalHours: allEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0),
    regularHours: allEntries.reduce((sum, e) => sum + (e.regularHours || 0), 0),
    overtimeHours: allEntries.reduce((sum, e) => sum + (e.overtimeHours || 0), 0),
    totalPay: allEntries.reduce((sum, e) => sum + (e.totalPay || 0), 0),
  };

  return {
    data: allEntries,
    summary,
    columns: [
      'userId',
      'entryId',
      'clockInTime',
      'clockOutTime',
      'totalHours',
      'regularHours',
      'overtimeHours',
      'totalPay',
      'status',
    ],
  };
}

// Generate labor cost report
async function generateLaborCostReport(
  orgId: string,
  startDate: string,
  endDate: string
): Promise<any> {
  const timesheetData = await generateTimesheetReport(orgId, startDate, endDate);

  // Group by user
  const userCosts: Record<
    string,
    {
      userId: string;
      totalHours: number;
      regularHours: number;
      overtimeHours: number;
      totalPay: number;
      entries: number;
    }
  > = {};

  for (const entry of timesheetData.data) {
    if (!userCosts[entry.userId]) {
      userCosts[entry.userId] = {
        userId: entry.userId,
        totalHours: 0,
        regularHours: 0,
        overtimeHours: 0,
        totalPay: 0,
        entries: 0,
      };
    }

    userCosts[entry.userId].totalHours += entry.totalHours || 0;
    userCosts[entry.userId].regularHours += entry.regularHours || 0;
    userCosts[entry.userId].overtimeHours += entry.overtimeHours || 0;
    userCosts[entry.userId].totalPay += entry.totalPay || 0;
    userCosts[entry.userId].entries += 1;
  }

  const data = Object.values(userCosts);

  const summary = {
    totalEmployees: data.length,
    totalLaborCost: data.reduce((sum, u) => sum + u.totalPay, 0),
    totalHours: data.reduce((sum, u) => sum + u.totalHours, 0),
    averageCostPerEmployee: data.length > 0 ? data.reduce((sum, u) => sum + u.totalPay, 0) / data.length : 0,
  };

  return {
    data,
    summary,
    columns: ['userId', 'totalHours', 'regularHours', 'overtimeHours', 'totalPay', 'entries'],
  };
}

// Generate attendance report
async function generateAttendanceReport(
  orgId: string,
  startDate: string,
  endDate: string
): Promise<any> {
  const timesheetData = await generateTimesheetReport(orgId, startDate, endDate);

  // Get all users
  const users = await db.query(`ORG#${orgId}#USERS`, undefined, 'GSI1');

  // Count work days
  const workDays = getWorkDaysBetween(startDate, endDate);

  // Calculate attendance by user
  const attendanceData = users.map((user) => {
    const userEntries = timesheetData.data.filter((e: any) => e.userId === user.userId);

    // Count unique days worked
    const daysWorked = new Set(
      userEntries
        .map((e: any) => e.clockInTime?.split('T')[0])
        .filter(Boolean)
    ).size;

    const attendanceRate = workDays > 0 ? (daysWorked / workDays) * 100 : 0;

    return {
      userId: user.userId,
      userName: user.name,
      daysWorked,
      totalWorkDays: workDays,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
      totalHours: userEntries.reduce((sum: number, e: any) => sum + (e.totalHours || 0), 0),
    };
  });

  const summary = {
    totalEmployees: attendanceData.length,
    averageAttendanceRate:
      attendanceData.length > 0
        ? attendanceData.reduce((sum, u) => sum + u.attendanceRate, 0) / attendanceData.length
        : 0,
    totalWorkDays: workDays,
  };

  return {
    data: attendanceData,
    summary,
    columns: ['userId', 'userName', 'daysWorked', 'totalWorkDays', 'attendanceRate', 'totalHours'],
  };
}

// Generate overtime report
async function generateOvertimeReport(
  orgId: string,
  startDate: string,
  endDate: string
): Promise<any> {
  const timesheetData = await generateTimesheetReport(orgId, startDate, endDate);

  // Filter entries with overtime
  const overtimeEntries = timesheetData.data.filter((e: any) => e.overtimeHours > 0);

  // Group by user
  const userOvertime: Record<
    string,
    {
      userId: string;
      overtimeHours: number;
      overtimePay: number;
      overtimeEntries: number;
    }
  > = {};

  for (const entry of overtimeEntries) {
    if (!userOvertime[entry.userId]) {
      userOvertime[entry.userId] = {
        userId: entry.userId,
        overtimeHours: 0,
        overtimePay: 0,
        overtimeEntries: 0,
      };
    }

    userOvertime[entry.userId].overtimeHours += entry.overtimeHours || 0;
    // Estimate overtime pay (would need pay rate details for accuracy)
    userOvertime[entry.userId].overtimePay +=
      (entry.overtimeHours || 0) * (entry.payRate || 0) * 1.5;
    userOvertime[entry.userId].overtimeEntries += 1;
  }

  const data = Object.values(userOvertime);

  const summary = {
    totalOvertimeHours: data.reduce((sum, u) => sum + u.overtimeHours, 0),
    totalOvertimePay: data.reduce((sum, u) => sum + u.overtimePay, 0),
    employeesWithOvertime: data.length,
  };

  return {
    data,
    summary,
    columns: ['userId', 'overtimeHours', 'overtimePay', 'overtimeEntries'],
  };
}

// Helper: Convert data to CSV
function convertToCSV(data: any[], columns: string[]): string {
  if (!data || data.length === 0) {
    return columns.join(',') + '\n';
  }

  // Header row
  const header = columns.join(',');

  // Data rows
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        const value = row[col];
        // Handle values with commas, quotes, or newlines
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(',');
  });

  return [header, ...rows].join('\n');
}

// Helper functions
function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  return dates;
}

function getWorkDaysBetween(startDate: string, endDate: string): number {
  const dates = getDatesBetween(startDate, endDate);
  // Filter out weekends (Saturday = 6, Sunday = 0)
  return dates.filter((date) => {
    const day = new Date(date).getDay();
    return day !== 0 && day !== 6;
  }).length;
}

function getPayPeriodFromDate(date: string): string {
  const d = new Date(date);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    (((d.getTime() - yearStart.getTime()) / 86400000) + yearStart.getDay() + 1) / 7
  );
  return `${d.getFullYear()}-${String(weekNo).padStart(2, '0')}`;
}
