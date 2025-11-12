import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import axios from 'axios';
import { successResponse, validationErrorResponse, errorResponse } from '../utils/response';
import { queryItems, getItem, updateItem } from '../utils/dynamodb';

const GUSTO_API_URL = 'https://api.gusto.com/v1';

interface GustoConfig {
  companyId: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Export payroll data to Gusto
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
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return validationErrorResponse('Start date and end date are required');
    }

    // Get organization Gusto configuration
    const org = await getItem(`ORG#${orgId}`, `ORG#${orgId}`);
    if (!org?.integrations?.gusto) {
      return validationErrorResponse('Gusto integration not configured');
    }

    const gustoConfig: GustoConfig = org.integrations.gusto;

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
          gustoEmployeeId: userProfile?.integrations?.gusto?.employeeId,
          regularHours: 0,
          overtimeHours: 0,
        };
      }

      byEmployee[entry.userId].regularHours += entry.regularHours || 0;
      byEmployee[entry.userId].overtimeHours += entry.overtimeHours || 0;
    }

    // Create time sheets in Gusto
    const timeSheetPromises = Object.values(byEmployee).map(async (emp: any) => {
      if (!emp.gustoEmployeeId) {
        console.warn(`No Gusto employee ID for user ${emp.userId}`);
        return null;
      }

      try {
        const response = await axios.post(
          `${GUSTO_API_URL}/companies/${gustoConfig.companyId}/employees/${emp.gustoEmployeeId}/time_activities`,
          {
            start_date: startDate,
            end_date: endDate,
            regular_hours: emp.regularHours,
            overtime_hours: emp.overtimeHours,
          },
          {
            headers: {
              'Authorization': `Bearer ${gustoConfig.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        return { userId: emp.userId, success: true, data: response.data };
      } catch (error: any) {
        console.error(`Failed to export for user ${emp.userId}:`, error.response?.data);
        return { userId: emp.userId, success: false, error: error.message };
      }
    });

    const results = await Promise.all(timeSheetPromises);
    const successful = results.filter(r => r?.success).length;
    const failed = results.filter(r => r && !r.success).length;

    // Mark successfully exported entries as PAID
    for (const result of results) {
      if (result?.success) {
        const userEntries = approvedEntries.filter(e => e.userId === result.userId);
        for (const entry of userEntries) {
          await updateItem(
            `USER#${entry.userId}#DATE#${entry.date}`,
            `ENTRY#${entry.entryId}`,
            {
              status: 'PAID',
              exportedToGusto: true,
              exportedAt: new Date().toISOString(),
            }
          );
        }
      }
    }

    return successResponse({
      message: `Payroll exported to Gusto. ${successful} successful, ${failed} failed.`,
      employeeCount: Object.keys(byEmployee).length,
      successful,
      failed,
      results: results.filter(r => r !== null),
    });
  } catch (error: any) {
    console.error('Gusto export error:', error);
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
