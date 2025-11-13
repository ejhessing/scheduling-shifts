/**
 * Get Analytics
 * Provides comprehensive analytics including metrics, trends, and department breakdown
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, query, scan } from '../../shared/db';
import { verifyToken, checkPermission } from '../../shared/auth';
import { success, error } from '../../shared/response';
import {
  calculateMetricsFromEntries,
  calculateAttendanceRate,
  generateTrendData,
  calculateDepartmentMetrics,
  detectAnomalies,
  AnalyticsMetrics,
  TrendDataPoint,
  DepartmentMetrics,
} from '../../shared/analytics';
import { TimeEntry, Shift, User, Location } from '../../shared/types';

interface AnalyticsResponse {
  metrics: AnalyticsMetrics;
  trends: {
    hours: TrendDataPoint[];
    cost: TrendDataPoint[];
  };
  departmentMetrics: DepartmentMetrics[];
  anomalies: Array<{
    type: string;
    description: string;
    entryId: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Verify authentication
    const user = await verifyToken(event);
    if (!user) {
      return error('Unauthorized', 401);
    }

    // Only managers can access analytics
    if (!checkPermission(user.role, 'manager')) {
      return error('Forbidden: Manager access required', 403);
    }

    const db = getDb();

    // Parse query parameters
    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;
    const locationId = event.queryStringParameters?.locationId;
    const groupBy = (event.queryStringParameters?.groupBy as 'day' | 'week' | 'month') || 'day';

    if (!startDate || !endDate) {
      return error('startDate and endDate are required', 400);
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return error('Invalid date format. Use YYYY-MM-DD', 400);
    }

    if (new Date(startDate) > new Date(endDate)) {
      return error('startDate must be before endDate', 400);
    }

    const orgId = user.organizationId;

    // Fetch time entries for the period
    const entriesResult = await query(db, {
      TableName: process.env.TABLE_NAME!,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: {
        ':gsi1pk': `ORG#${orgId}#ENTRIES`,
        ':prefix': 'DATE#',
      },
    });

    let timeEntries: TimeEntry[] = (entriesResult.Items || []).map((item: any) => ({
      entryId: item.SK.replace('ENTRY#', ''),
      userId: item.userId,
      organizationId: item.organizationId,
      locationId: item.locationId,
      clockInTime: item.clockInTime,
      clockOutTime: item.clockOutTime,
      totalHours: item.totalHours,
      notes: item.notes,
      clockInLocation: item.clockInLocation,
      clockOutLocation: item.clockOutLocation,
      status: item.status,
    }));

    // Filter by date range
    timeEntries = timeEntries.filter((entry) => {
      const entryDate = entry.clockInTime.split('T')[0];
      return entryDate >= startDate && entryDate <= endDate;
    });

    // Filter by location if specified
    if (locationId) {
      timeEntries = timeEntries.filter((entry) => entry.locationId === locationId);
    }

    // Fetch shifts for the period
    const shiftsResult = await query(db, {
      TableName: process.env.TABLE_NAME!,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gsi1pk',
      ExpressionAttributeValues: {
        ':gsi1pk': `ORG#${orgId}#SHIFTS`,
      },
    });

    let shifts: Shift[] = (shiftsResult.Items || []).map((item: any) => ({
      shiftId: item.SK.replace('SHIFT#', ''),
      organizationId: item.organizationId,
      userId: item.userId,
      locationId: item.locationId,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      position: item.position,
      status: item.status,
      notes: item.notes,
    }));

    // Filter shifts by date range
    shifts = shifts.filter((shift) => shift.date >= startDate && shift.date <= endDate);

    if (locationId) {
      shifts = shifts.filter((shift) => shift.locationId === locationId);
    }

    // Fetch users to get pay rates
    const usersResult = await query(db, {
      TableName: process.env.TABLE_NAME!,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `ORG#${orgId}`,
        ':prefix': 'USER#',
      },
    });

    const users: User[] = (usersResult.Items || []).map((item: any) => ({
      userId: item.SK.replace('USER#', ''),
      email: item.email,
      firstName: item.firstName,
      lastName: item.lastName,
      role: item.role,
      organizationId: item.organizationId,
      hourlyRate: item.hourlyRate,
    }));

    const payRates = new Map<string, number>();
    users.forEach((u) => {
      payRates.set(u.userId, u.hourlyRate || 15);
    });

    // Fetch locations
    const locationsResult = await query(db, {
      TableName: process.env.TABLE_NAME!,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `ORG#${orgId}`,
        ':prefix': 'LOCATION#',
      },
    });

    const locations = new Map<string, { name: string }>();
    (locationsResult.Items || []).forEach((item: any) => {
      locations.set(item.SK.replace('LOCATION#', ''), {
        name: item.name,
      });
    });

    // Calculate metrics
    const metrics = calculateMetricsFromEntries(timeEntries, payRates);
    metrics.shiftsScheduled = shifts.length;
    metrics.attendanceRate = calculateAttendanceRate(shifts, timeEntries);

    // Generate trends
    const hoursTrend = generateTrendData(timeEntries, payRates, groupBy, 'hours');
    const costTrend = generateTrendData(timeEntries, payRates, groupBy, 'cost');

    // Calculate department metrics
    const departmentMetrics = calculateDepartmentMetrics(
      timeEntries,
      shifts,
      payRates,
      locations
    );

    // Detect anomalies
    const anomalies = detectAnomalies(timeEntries, {
      hours: 16, // Flag shifts over 16 hours
    });

    const response: AnalyticsResponse = {
      metrics,
      trends: {
        hours: hoursTrend,
        cost: costTrend,
      },
      departmentMetrics,
      anomalies,
      period: {
        startDate,
        endDate,
      },
    };

    return success(response);
  } catch (err: any) {
    console.error('Error getting analytics:', err);
    return error(err.message || 'Internal server error', 500);
  }
};
