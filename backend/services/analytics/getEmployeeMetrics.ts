/**
 * Get Employee Metrics
 * Provides detailed performance metrics for individual employees
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, query } from '../../shared/db';
import { verifyToken, checkPermission } from '../../shared/auth';
import { success, error } from '../../shared/response';
import { calculateEmployeeMetrics, EmployeeMetrics } from '../../shared/analytics';
import { TimeEntry, Shift, User } from '../../shared/types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Verify authentication
    const user = await verifyToken(event);
    if (!user) {
      return error('Unauthorized', 401);
    }

    const db = getDb();
    const orgId = user.organizationId;

    // Parse query parameters
    const userId = event.queryStringParameters?.userId;
    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;

    if (!startDate || !endDate) {
      return error('startDate and endDate are required', 400);
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return error('Invalid date format. Use YYYY-MM-DD', 400);
    }

    // Permission check: employees can only view their own metrics
    if (userId && userId !== user.userId && !checkPermission(user.role, 'manager')) {
      return error('Forbidden: Cannot view other employees metrics', 403);
    }

    // If no userId provided, use current user's ID
    const targetUserId = userId || user.userId;

    // Fetch time entries
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
    }));

    // Filter by date range
    timeEntries = timeEntries.filter((entry) => {
      const entryDate = entry.clockInTime.split('T')[0];
      return entryDate >= startDate && entryDate <= endDate;
    });

    // Fetch shifts
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
    }));

    // Filter shifts by date range
    shifts = shifts.filter((shift) => shift.date >= startDate && shift.date <= endDate);

    // If requesting specific user metrics
    if (targetUserId) {
      // Fetch user to get pay rate and name
      const userResult = await query(db, {
        TableName: process.env.TABLE_NAME!,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `ORG#${orgId}`,
          ':sk': `USER#${targetUserId}`,
        },
      });

      if (!userResult.Items || userResult.Items.length === 0) {
        return error('User not found', 404);
      }

      const userData = userResult.Items[0];
      const payRate = userData.hourlyRate || 15;
      const userName = `${userData.firstName} ${userData.lastName}`;

      const metrics = calculateEmployeeMetrics(
        targetUserId,
        timeEntries,
        shifts,
        payRate,
        new Date(startDate),
        new Date(endDate)
      );

      metrics.userName = userName;

      return success(metrics);
    }

    // If no specific user, return metrics for all employees (manager only)
    if (!checkPermission(user.role, 'manager')) {
      return error('Forbidden: Manager access required for all employee metrics', 403);
    }

    // Fetch all users
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

    const allMetrics: EmployeeMetrics[] = users.map((u) => {
      const metrics = calculateEmployeeMetrics(
        u.userId,
        timeEntries,
        shifts,
        u.hourlyRate || 15,
        new Date(startDate),
        new Date(endDate)
      );
      metrics.userName = `${u.firstName} ${u.lastName}`;
      return metrics;
    });

    // Sort by total hours descending
    allMetrics.sort((a, b) => b.totalHours - a.totalHours);

    return success({
      employees: allMetrics,
      period: {
        startDate,
        endDate,
      },
    });
  } catch (err: any) {
    console.error('Error getting employee metrics:', err);
    return error(err.message || 'Internal server error', 500);
  }
};
