import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, validationErrorResponse, errorResponse } from '../utils/response';
import { queryItems } from '../utils/dynamodb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const claims = event.requestContext.authorizer?.claims;
    const orgId = claims?.['custom:orgId'];
    const userRole = claims?.['custom:role'];

    // Only managers and admins can access labor cost reports
    if (userRole !== 'MANAGER' && userRole !== 'ORG_ADMIN') {
      return validationErrorResponse('Insufficient permissions');
    }

    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;
    const locationId = event.queryStringParameters?.locationId;

    if (!startDate || !endDate) {
      return validationErrorResponse('Start date and end date are required');
    }

    // Calculate week/pay period keys
    const start = new Date(startDate);
    const end = new Date(endDate);
    const weeks: string[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
      const year = d.getFullYear();
      const week = getWeekNumber(d);
      weeks.push(`${year}-${week.toString().padStart(2, '0')}`);
    }

    // Query all time entries for the pay periods
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

    // Filter by location if specified
    const filteredEntries = locationId
      ? allEntries.filter(e => e.locationId === locationId)
      : allEntries;

    // Calculate metrics
    const totalHours = filteredEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0);
    const regularHours = filteredEntries.reduce((sum, e) => sum + (e.regularHours || 0), 0);
    const overtimeHours = filteredEntries.reduce((sum, e) => sum + (e.overtimeHours || 0), 0);
    const totalCost = filteredEntries.reduce((sum, e) => sum + (e.totalPay || 0), 0);

    // Group by user
    const byUser: { [key: string]: any } = {};
    filteredEntries.forEach(entry => {
      if (!byUser[entry.userId]) {
        byUser[entry.userId] = {
          userId: entry.userId,
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          totalPay: 0,
          shifts: 0,
        };
      }
      byUser[entry.userId].totalHours += entry.totalHours || 0;
      byUser[entry.userId].regularHours += entry.regularHours || 0;
      byUser[entry.userId].overtimeHours += entry.overtimeHours || 0;
      byUser[entry.userId].totalPay += entry.totalPay || 0;
      byUser[entry.userId].shifts += 1;
    });

    // Group by location
    const byLocation: { [key: string]: any } = {};
    filteredEntries.forEach(entry => {
      if (!byLocation[entry.locationId]) {
        byLocation[entry.locationId] = {
          locationId: entry.locationId,
          totalHours: 0,
          totalCost: 0,
          employees: new Set(),
        };
      }
      byLocation[entry.locationId].totalHours += entry.totalHours || 0;
      byLocation[entry.locationId].totalCost += entry.totalPay || 0;
      byLocation[entry.locationId].employees.add(entry.userId);
    });

    // Convert sets to counts
    Object.values(byLocation).forEach((loc: any) => {
      loc.employeeCount = loc.employees.size;
      delete loc.employees;
    });

    // Calculate daily breakdown
    const byDate: { [key: string]: any } = {};
    filteredEntries.forEach(entry => {
      if (!byDate[entry.date]) {
        byDate[entry.date] = {
          date: entry.date,
          totalHours: 0,
          totalCost: 0,
          entries: 0,
        };
      }
      byDate[entry.date].totalHours += entry.totalHours || 0;
      byDate[entry.date].totalCost += entry.totalPay || 0;
      byDate[entry.date].entries += 1;
    });

    return successResponse({
      summary: {
        totalHours: Math.round(totalHours * 100) / 100,
        regularHours: Math.round(regularHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        averageHourlyRate: totalHours > 0 ? Math.round((totalCost / totalHours) * 100) / 100 : 0,
        totalEntries: filteredEntries.length,
      },
      byUser: Object.values(byUser),
      byLocation: Object.values(byLocation),
      byDate: Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date)),
      period: {
        startDate,
        endDate,
      },
    });
  } catch (error: any) {
    console.error('Labor cost analysis error:', error);
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
