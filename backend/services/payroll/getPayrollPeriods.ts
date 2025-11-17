/**
 * Get Payroll Periods
 * Retrieves payroll periods with optional filtering
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, query } from '../../shared/db';
import { verifyToken, checkPermission } from '../../shared/auth';
import { success, error } from '../../shared/response';
import { PayrollPeriod } from '../../shared/payroll';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Verify authentication
    const user = await verifyToken(event);
    if (!user) {
      return error('Unauthorized', 401);
    }

    // Only managers can view payroll periods
    if (!checkPermission(user.role, 'manager')) {
      return error('Forbidden: Manager access required', 403);
    }

    const db = getDb();
    const orgId = user.organizationId;

    // Parse query parameters
    const status = event.queryStringParameters?.status;
    const year = event.queryStringParameters?.year;

    // Query payroll periods
    const result = await query(db, {
      TableName: process.env.TABLE_NAME!,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gsi1pk',
      ExpressionAttributeValues: {
        ':gsi1pk': `ORG#${orgId}#PAYROLL`,
      },
    });

    let periods: PayrollPeriod[] = (result.Items || []).map((item: any) => ({
      periodId: item.periodId,
      organizationId: item.organizationId,
      startDate: item.startDate,
      endDate: item.endDate,
      payDate: item.payDate,
      status: item.status,
      periodType: item.periodType,
      totalGrossPay: item.totalGrossPay,
      totalNetPay: item.totalNetPay,
      totalTaxes: item.totalTaxes,
      totalDeductions: item.totalDeductions,
      employeeCount: item.employeeCount,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      approvedBy: item.approvedBy,
      approvedAt: item.approvedAt,
    }));

    // Filter by status if provided
    if (status) {
      periods = periods.filter((p) => p.status === status);
    }

    // Filter by year if provided
    if (year) {
      periods = periods.filter((p) => p.startDate.startsWith(year));
    }

    // Sort by start date descending (most recent first)
    periods.sort((a, b) => b.startDate.localeCompare(a.startDate));

    return success(periods);
  } catch (err: any) {
    console.error('Error getting payroll periods:', err);
    return error(err.message || 'Internal server error', 500);
  }
};
