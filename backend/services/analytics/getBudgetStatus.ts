/**
 * Get Budget Status
 * Tracks budget usage and provides projections
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, query, getItem } from '../../shared/db';
import { verifyToken, checkPermission } from '../../shared/auth';
import { success, error } from '../../shared/response';
import { calculateBudgetStatus, BudgetStatus } from '../../shared/analytics';
import { TimeEntry } from '../../shared/types';

interface BudgetSettings {
  budgetId: string;
  organizationId: string;
  locationId?: string;
  periodType: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  budgetAmount: number;
  periodStart: string;
  periodEnd: string;
  alertThreshold: number; // Percentage (e.g., 80 for 80%)
  createdAt: string;
  updatedAt: string;
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

    // Only managers can access budget status
    if (!checkPermission(user.role, 'manager')) {
      return error('Forbidden: Manager access required', 403);
    }

    const db = getDb();
    const orgId = user.organizationId;
    const locationId = event.queryStringParameters?.locationId;

    // Fetch budget settings
    // In a real system, this would be stored in DynamoDB
    // For now, we'll use default settings or allow passing via query params
    const periodStart = event.queryStringParameters?.periodStart;
    const periodEnd = event.queryStringParameters?.periodEnd;
    const budgetAmount = event.queryStringParameters?.budgetAmount
      ? parseFloat(event.queryStringParameters.budgetAmount)
      : 10000; // Default $10,000

    if (!periodStart || !periodEnd) {
      return error('periodStart and periodEnd are required', 400);
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(periodStart) || !dateRegex.test(periodEnd)) {
      return error('Invalid date format. Use YYYY-MM-DD', 400);
    }

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
    }));

    // Filter by date range
    timeEntries = timeEntries.filter((entry) => {
      const entryDate = entry.clockInTime.split('T')[0];
      return entryDate >= periodStart && entryDate <= periodEnd;
    });

    // Filter by location if specified
    if (locationId) {
      timeEntries = timeEntries.filter((entry) => entry.locationId === locationId);
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

    const payRates = new Map<string, number>();
    (usersResult.Items || []).forEach((item: any) => {
      const userId = item.SK.replace('USER#', '');
      payRates.set(userId, item.hourlyRate || 15);
    });

    // Calculate actual spent
    let actualSpent = 0;
    timeEntries.forEach((entry) => {
      const hours = entry.totalHours || 0;
      const payRate = payRates.get(entry.userId) || 15;

      // Simple calculation (in real app, would account for overtime multiplier)
      actualSpent += hours * payRate;
    });

    // Calculate budget status
    const budgetStatus = calculateBudgetStatus(
      budgetAmount,
      actualSpent,
      new Date(periodStart),
      new Date(periodEnd)
    );

    // Add alert information
    const alertThreshold = event.queryStringParameters?.alertThreshold
      ? parseFloat(event.queryStringParameters.alertThreshold)
      : 80; // Default 80%

    const response = {
      ...budgetStatus,
      alert: budgetStatus.percentageUsed >= alertThreshold,
      alertMessage:
        budgetStatus.percentageUsed >= alertThreshold
          ? `Budget usage at ${budgetStatus.percentageUsed}% - exceeds ${alertThreshold}% threshold`
          : null,
      locationId: locationId || null,
    };

    return success(response);
  } catch (err: any) {
    console.error('Error getting budget status:', err);
    return error(err.message || 'Internal server error', 500);
  }
};
