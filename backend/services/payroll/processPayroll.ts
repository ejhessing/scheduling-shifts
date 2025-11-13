/**
 * Process Payroll
 * Calculates payroll entries for a period based on time entries
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, query, putItem, updateItem } from '../../shared/db';
import { verifyToken, checkPermission } from '../../shared/auth';
import { success, error } from '../../shared/response';
import { calculatePayrollEntries, PayrollSettings, PayrollEntry } from '../../shared/payroll';
import { TimeEntry, User } from '../../shared/types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Verify authentication
    const user = await verifyToken(event);
    if (!user) {
      return error('Unauthorized', 401);
    }

    // Only managers can process payroll
    if (!checkPermission(user.role, 'manager')) {
      return error('Forbidden: Manager access required', 403);
    }

    const db = getDb();
    const orgId = user.organizationId;
    const periodId = event.pathParameters?.periodId;

    if (!periodId) {
      return error('periodId is required', 400);
    }

    // Fetch payroll period
    const periodResult = await query(db, {
      TableName: process.env.TABLE_NAME!,
      KeyConditionExpression: 'PK = :pk AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `ORG#${orgId}`,
        ':sk': `PAYROLL#${periodId}`,
      },
    });

    if (!periodResult.Items || periodResult.Items.length === 0) {
      return error('Payroll period not found', 404);
    }

    const period = periodResult.Items[0];

    if (period.status === 'approved' || period.status === 'paid') {
      return error('Cannot process payroll for approved or paid periods', 400);
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
      status: item.status,
    }));

    // Filter time entries by date range and approved status
    timeEntries = timeEntries.filter((entry) => {
      const entryDate = entry.clockInTime.split('T')[0];
      return (
        entryDate >= period.startDate &&
        entryDate <= period.endDate &&
        entry.status === 'approved'
      );
    });

    // Fetch users
    const usersResult = await query(db, {
      TableName: process.env.TABLE_NAME!,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `ORG#${orgId}`,
        ':prefix': 'USER#',
      },
    });

    const users = new Map<string, User>();
    (usersResult.Items || []).forEach((item: any) => {
      const userId = item.SK.replace('USER#', '');
      users.set(userId, {
        userId,
        email: item.email,
        firstName: item.firstName,
        lastName: item.lastName,
        role: item.role,
        organizationId: item.organizationId,
        hourlyRate: item.hourlyRate,
        employeeNumber: item.employeeNumber,
      });
    });

    // Get payroll settings (use defaults for now)
    const settings: PayrollSettings = {
      organizationId: orgId,
      periodType: period.periodType,
      weekStartDay: 0,
      overtimeThreshold: 40,
      overtimeMultiplier: 1.5,
      doubleTimeThreshold: undefined,
      doubleTimeMultiplier: undefined,
    };

    // Calculate payroll entries
    const payrollEntries = calculatePayrollEntries(timeEntries, users, settings);

    // Add periodId to entries
    payrollEntries.forEach((entry) => {
      entry.periodId = periodId;
    });

    // Store payroll entries in DynamoDB
    const storePromises = payrollEntries.map((entry) =>
      putItem(db, {
        TableName: process.env.TABLE_NAME!,
        Item: {
          PK: `ORG#${orgId}#PAYROLL#${periodId}`,
          SK: `ENTRY#${entry.userId}`,
          ...entry,
        },
      })
    );

    await Promise.all(storePromises);

    // Update period with totals
    const totalGrossPay = payrollEntries.reduce((sum, e) => sum + e.grossPay, 0);
    const employeeCount = payrollEntries.length;

    await updateItem(db, {
      TableName: process.env.TABLE_NAME!,
      Key: {
        PK: `ORG#${orgId}`,
        SK: `PAYROLL#${periodId}`,
      },
      UpdateExpression:
        'SET #status = :status, totalGrossPay = :totalGrossPay, employeeCount = :employeeCount, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'processing',
        ':totalGrossPay': totalGrossPay,
        ':employeeCount': employeeCount,
        ':updatedAt': new Date().toISOString(),
      },
    });

    return success({
      periodId,
      status: 'processing',
      totalGrossPay,
      employeeCount,
      entries: payrollEntries,
    }, 'Payroll processed successfully');
  } catch (err: any) {
    console.error('Error processing payroll:', err);
    return error(err.message || 'Internal server error', 500);
  }
};
