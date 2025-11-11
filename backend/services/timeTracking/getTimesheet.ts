import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';
import { parseQueryParams } from '../../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Parse query parameters
    const queryParams = parseQueryParams(event.queryStringParameters);
    const userId = queryParams.userId || currentUser.userId;
    const startDate = queryParams.startDate; // YYYY-MM-DD
    const endDate = queryParams.endDate; // YYYY-MM-DD

    // Check authorization
    if (userId !== currentUser.userId && !['manager', 'admin', 'owner'].includes(currentUser.role)) {
      return error('You do not have permission to view this timesheet', 403);
    }

    // If specific date range requested
    if (startDate && endDate) {
      const entries = await getEntriesForDateRange(userId, startDate, endDate);
      const summary = calculateSummary(entries);

      return success({
        userId,
        startDate,
        endDate,
        entries,
        summary,
      });
    }

    // Default to current week
    const { start, end } = getCurrentWeek();
    const entries = await getEntriesForDateRange(userId, start, end);
    const summary = calculateSummary(entries);

    return success({
      userId,
      startDate: start,
      endDate: end,
      entries,
      summary,
    });
  } catch (err: any) {
    console.error('Get timesheet error:', err);
    return error(err.message || 'Failed to get timesheet', 500);
  }
};

// Helper to get entries for a date range
async function getEntriesForDateRange(userId: string, startDate: string, endDate: string): Promise<any[]> {
  const allEntries: any[] = [];
  const dates = getDatesBetween(startDate, endDate);

  for (const date of dates) {
    const entries = await db.query(`USER#${userId}#DATE#${date}`);
    allEntries.push(...entries);
  }

  return allEntries.sort((a, b) => {
    return new Date(a.clockInTime).getTime() - new Date(b.clockInTime).getTime();
  });
}

// Helper to get dates between start and end
function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  return dates;
}

// Helper to get current week (Sunday to Saturday)
function getCurrentWeek(): { start: string; end: string } {
  const today = new Date();
  const dayOfWeek = today.getDay();

  const start = new Date(today);
  start.setDate(today.getDate() - dayOfWeek);

  const end = new Date(today);
  end.setDate(today.getDate() + (6 - dayOfWeek));

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

// Helper to calculate summary
function calculateSummary(entries: any[]): any {
  let totalHours = 0;
  let regularHours = 0;
  let overtimeHours = 0;
  let totalPay = 0;
  let entriesCount = entries.length;
  let pendingApproval = 0;
  let approved = 0;

  for (const entry of entries) {
    totalHours += entry.totalHours || 0;
    regularHours += entry.regularHours || 0;
    overtimeHours += entry.overtimeHours || 0;
    totalPay += entry.totalPay || 0;

    if (entry.status === 'pending_approval') {
      pendingApproval++;
    } else if (entry.status === 'approved') {
      approved++;
    }
  }

  return {
    entriesCount,
    totalHours: Math.round(totalHours * 100) / 100,
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    totalPay: Math.round(totalPay * 100) / 100,
    pendingApproval,
    approved,
  };
}
