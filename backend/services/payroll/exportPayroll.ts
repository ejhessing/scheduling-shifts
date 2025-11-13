/**
 * Export Payroll
 * Exports payroll data in various formats (CSV, QuickBooks, ADP, JSON)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, query } from '../../shared/db';
import { verifyToken, checkPermission } from '../../shared/auth';
import { error } from '../../shared/response';
import {
  exportPayrollToCSV,
  exportPayrollToQuickBooks,
  exportPayrollToADP,
  exportPayrollToJSON,
  PayrollEntry,
  PayrollPeriod,
} from '../../shared/payroll';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Verify authentication
    const user = await verifyToken(event);
    if (!user) {
      return error('Unauthorized', 401);
    }

    // Only managers can export payroll
    if (!checkPermission(user.role, 'manager')) {
      return error('Forbidden: Manager access required', 403);
    }

    const db = getDb();
    const orgId = user.organizationId;
    const periodId = event.pathParameters?.periodId;
    const format = event.queryStringParameters?.format || 'csv';

    if (!periodId) {
      return error('periodId is required', 400);
    }

    // Validate format
    if (!['csv', 'quickbooks', 'adp', 'json'].includes(format)) {
      return error('Invalid format. Must be csv, quickbooks, adp, or json', 400);
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

    const period: PayrollPeriod = periodResult.Items[0];

    if (period.status === 'draft') {
      return error('Cannot export payroll in draft status. Process payroll first.', 400);
    }

    // Fetch payroll entries
    const entriesResult = await query(db, {
      TableName: process.env.TABLE_NAME!,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `ORG#${orgId}#PAYROLL#${periodId}`,
        ':prefix': 'ENTRY#',
      },
    });

    if (!entriesResult.Items || entriesResult.Items.length === 0) {
      return error('No payroll entries found for this period', 404);
    }

    const payrollEntries: PayrollEntry[] = entriesResult.Items.map((item: any) => ({
      entryId: item.entryId,
      periodId: item.periodId,
      userId: item.userId,
      userName: item.userName,
      employeeNumber: item.employeeNumber,
      regularHours: item.regularHours,
      overtimeHours: item.overtimeHours,
      doubleTimeHours: item.doubleTimeHours,
      regularRate: item.regularRate,
      overtimeRate: item.overtimeRate,
      doubleTimeRate: item.doubleTimeRate,
      grossPay: item.grossPay,
      federalTax: item.federalTax,
      stateTax: item.stateTax,
      socialSecurity: item.socialSecurity,
      medicare: item.medicare,
      deductions: item.deductions,
      netPay: item.netPay,
      timeEntries: item.timeEntries,
    }));

    // Generate export based on format
    let exportData: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'csv':
        exportData = exportPayrollToCSV(payrollEntries);
        contentType = 'text/csv';
        filename = `payroll_${period.startDate}_${period.endDate}.csv`;
        break;

      case 'quickbooks':
        const companyName = user.organizationId; // In production, fetch actual org name
        exportData = exportPayrollToQuickBooks(payrollEntries, period, companyName);
        contentType = 'text/plain';
        filename = `payroll_${period.startDate}_${period.endDate}.iif`;
        break;

      case 'adp':
        exportData = exportPayrollToADP(payrollEntries, period);
        contentType = 'text/csv';
        filename = `payroll_${period.startDate}_${period.endDate}_adp.csv`;
        break;

      case 'json':
        exportData = exportPayrollToJSON(payrollEntries, period);
        contentType = 'application/json';
        filename = `payroll_${period.startDate}_${period.endDate}.json`;
        break;

      default:
        return error('Invalid format', 400);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*',
      },
      body: exportData,
    };
  } catch (err: any) {
    console.error('Error exporting payroll:', err);
    return error(err.message || 'Internal server error', 500);
  }
};
