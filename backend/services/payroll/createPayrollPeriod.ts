/**
 * Create Payroll Period
 * Creates a new payroll period for processing
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, putItem } from '../../shared/db';
import { verifyToken, checkPermission } from '../../shared/auth';
import { success, error } from '../../shared/response';
import { PayrollPeriod } from '../../shared/payroll';
import { v4 as uuidv4 } from 'uuid';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Verify authentication
    const user = await verifyToken(event);
    if (!user) {
      return error('Unauthorized', 401);
    }

    // Only managers can create payroll periods
    if (!checkPermission(user.role, 'manager')) {
      return error('Forbidden: Manager access required', 403);
    }

    const db = getDb();
    const body = JSON.parse(event.body || '{}');

    // Validate input
    const { startDate, endDate, payDate, periodType } = body;

    if (!startDate || !endDate || !payDate || !periodType) {
      return error('startDate, endDate, payDate, and periodType are required', 400);
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate) || !dateRegex.test(payDate)) {
      return error('Invalid date format. Use YYYY-MM-DD', 400);
    }

    // Validate periodType
    if (!['weekly', 'biweekly', 'semimonthly', 'monthly'].includes(periodType)) {
      return error('Invalid periodType. Must be weekly, biweekly, semimonthly, or monthly', 400);
    }

    // Validate dates
    if (new Date(startDate) > new Date(endDate)) {
      return error('startDate must be before endDate', 400);
    }

    if (new Date(endDate) > new Date(payDate)) {
      return error('payDate must be after endDate', 400);
    }

    const orgId = user.organizationId;
    const periodId = uuidv4();

    const period: PayrollPeriod = {
      periodId,
      organizationId: orgId,
      startDate,
      endDate,
      payDate,
      status: 'draft',
      periodType,
      totalGrossPay: 0,
      employeeCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store in DynamoDB
    await putItem(db, {
      TableName: process.env.TABLE_NAME!,
      Item: {
        PK: `ORG#${orgId}`,
        SK: `PAYROLL#${periodId}`,
        GSI1PK: `ORG#${orgId}#PAYROLL`,
        GSI1SK: `DATE#${startDate}`,
        ...period,
      },
    });

    return success(period, 'Payroll period created successfully');
  } catch (err: any) {
    console.error('Error creating payroll period:', err);
    return error(err.message || 'Internal server error', 500);
  }
};
