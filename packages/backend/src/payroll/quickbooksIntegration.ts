import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import axios from 'axios';
import { successResponse, validationErrorResponse, errorResponse } from '../utils/response';
import { queryItems, getItem, updateItem } from '../utils/dynamodb';

const QUICKBOOKS_API_URL = 'https://quickbooks.api.intuit.com/v3';

interface QuickBooksConfig {
  realmId: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Export payroll data to QuickBooks
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const claims = event.requestContext.authorizer?.claims;
    const orgId = claims?.['custom:orgId'];
    const userRole = claims?.['custom:role'];

    if (userRole !== 'ORG_ADMIN') {
      return validationErrorResponse('Only organization administrators can export payroll');
    }

    const body = JSON.parse(event.body || '{}');
    const { startDate, endDate, payPeriod } = body;

    if (!startDate || !endDate) {
      return validationErrorResponse('Start date and end date are required');
    }

    // Get organization QuickBooks configuration
    const org = await getItem(`ORG#${orgId}`, `ORG#${orgId}`);
    if (!org?.integrations?.quickbooks) {
      return validationErrorResponse('QuickBooks integration not configured');
    }

    const qbConfig: QuickBooksConfig = org.integrations.quickbooks;

    // Get all time entries for the pay period
    const weeks: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
      const year = d.getFullYear();
      const week = getWeekNumber(d);
      weeks.push(`${year}-${week.toString().padStart(2, '0')}`);
    }

    const allEntries: any[] = [];
    for (const week of weeks) {
      const entries = await queryItems(
        'GSI2PK = :pk',
        {
          ':pk': `ORG#${orgId}#PAYPERIOD#${week}`,
        },
        'GSI2'
      );
      allEntries.push(...entries);
    }

    // Filter only approved entries
    const approvedEntries = allEntries.filter(e => e.status === 'APPROVED');

    // Group by employee
    const byEmployee: { [key: string]: any } = {};
    for (const entry of approvedEntries) {
      if (!byEmployee[entry.userId]) {
        const userProfile = await getItem(`USER#${entry.userId}`, `PROFILE#${entry.userId}`);
        byEmployee[entry.userId] = {
          userId: entry.userId,
          employeeName: userProfile?.name || 'Unknown',
          email: userProfile?.email,
          regularHours: 0,
          overtimeHours: 0,
          regularPay: 0,
          overtimePay: 0,
          totalPay: 0,
        };
      }

      byEmployee[entry.userId].regularHours += entry.regularHours || 0;
      byEmployee[entry.userId].overtimeHours += entry.overtimeHours || 0;
      byEmployee[entry.userId].regularPay += (entry.regularHours || 0) * entry.payRate;
      byEmployee[entry.userId].overtimePay += (entry.overtimeHours || 0) * entry.payRate * 1.5;
      byEmployee[entry.userId].totalPay += entry.totalPay || 0;
    }

    // Create payroll batch in QuickBooks
    const payrollItems = Object.values(byEmployee).map((emp: any) => ({
      EmployeeRef: {
        name: emp.employeeName,
        value: emp.userId, // Map to QuickBooks employee ID
      },
      PayPeriodStart: startDate,
      PayPeriodEnd: endDate,
      TotalPay: emp.totalPay,
      EarningLines: [
        {
          EarningType: 'Regular',
          Hours: emp.regularHours,
          Amount: emp.regularPay,
        },
        {
          EarningType: 'Overtime',
          Hours: emp.overtimeHours,
          Amount: emp.overtimePay,
        },
      ],
    }));

    try {
      // Send to QuickBooks API
      const response = await axios.post(
        `${QUICKBOOKS_API_URL}/company/${qbConfig.realmId}/payroll/batch`,
        {
          PayrollBatch: {
            PayPeriodStart: startDate,
            PayPeriodEnd: endDate,
            PayrollItems: payrollItems,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${qbConfig.accessToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      // Mark entries as exported
      for (const entry of approvedEntries) {
        await updateItem(
          `USER#${entry.userId}#DATE#${entry.date}`,
          `ENTRY#${entry.entryId}`,
          {
            status: 'PAID',
            exportedToQuickBooks: true,
            exportedAt: new Date().toISOString(),
            quickBooksBatchId: response.data.PayrollBatch.Id,
          }
        );
      }

      return successResponse({
        message: 'Payroll exported to QuickBooks successfully',
        batchId: response.data.PayrollBatch.Id,
        employeeCount: Object.keys(byEmployee).length,
        totalEntries: approvedEntries.length,
        totalAmount: Object.values(byEmployee).reduce((sum: number, emp: any) => sum + emp.totalPay, 0),
      });
    } catch (qbError: any) {
      console.error('QuickBooks API error:', qbError.response?.data || qbError.message);

      // Check if token expired
      if (qbError.response?.status === 401) {
        // TODO: Refresh token
        return errorResponse(new Error('QuickBooks authentication expired. Please reconnect.'));
      }

      return errorResponse(qbError);
    }
  } catch (error: any) {
    console.error('QuickBooks export error:', error);
    return errorResponse(error);
  }
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
