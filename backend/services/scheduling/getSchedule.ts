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
    const startDate = queryParams.startDate; // YYYY-MM-DD
    const endDate = queryParams.endDate; // YYYY-MM-DD
    const userId = queryParams.userId; // Optional: filter by user
    const locationId = queryParams.locationId; // Optional: filter by location

    // Determine date range
    let start: string;
    let end: string;

    if (startDate && endDate) {
      start = startDate;
      end = endDate;
    } else {
      // Default to current week
      const week = getCurrentWeek();
      start = week.start;
      end = week.end;
    }

    // Get shifts
    let shifts: any[] = [];

    if (userId) {
      // Get shifts for specific user
      shifts = await getShiftsForUser(userId, start, end);
    } else if (locationId) {
      // Get shifts for specific location
      shifts = await getShiftsForLocation(locationId, start, end);
    } else {
      // Get all shifts for the organization
      shifts = await getShiftsForOrg(currentUser.orgId, start, end);
    }

    // Filter based on authorization
    const isManager = ['manager', 'admin', 'owner'].includes(currentUser.role);
    if (!isManager) {
      // Regular employees can only see their own shifts
      shifts = shifts.filter((shift) => shift.userId === currentUser.userId);
    }

    // Sort shifts by start time
    shifts.sort((a, b) => {
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    // Group shifts by date for easier frontend consumption
    const shiftsByDate: Record<string, any[]> = {};
    for (const shift of shifts) {
      const date = new Date(shift.startTime).toISOString().split('T')[0];
      if (!shiftsByDate[date]) {
        shiftsByDate[date] = [];
      }
      shiftsByDate[date].push(shift);
    }

    return success({
      startDate: start,
      endDate: end,
      shifts,
      shiftsByDate,
      totalShifts: shifts.length,
    });
  } catch (err: any) {
    console.error('Get schedule error:', err);
    return error(err.message || 'Failed to get schedule', 500);
  }
};

// Helper to get shifts for a user
async function getShiftsForUser(userId: string, startDate: string, endDate: string): Promise<any[]> {
  const dates = getDatesBetween(startDate, endDate);
  const allShifts: any[] = [];

  for (const date of dates) {
    const shifts = await db.query(`USER#${userId}#SHIFTS`, {
      begins: `DATE#${date}`,
    }, 'GSI1');
    allShifts.push(...shifts);
  }

  return allShifts;
}

// Helper to get shifts for a location
async function getShiftsForLocation(locationId: string, startDate: string, endDate: string): Promise<any[]> {
  const dates = getDatesBetween(startDate, endDate);
  const allShifts: any[] = [];

  for (const date of dates) {
    const shifts = await db.query(`LOC#${locationId}#DATE#${date}`);
    allShifts.push(...shifts);
  }

  return allShifts;
}

// Helper to get shifts for an organization
async function getShiftsForOrg(orgId: string, startDate: string, endDate: string): Promise<any[]> {
  const dates = getDatesBetween(startDate, endDate);
  const allShifts: any[] = [];

  for (const date of dates) {
    const shifts = await db.queryGSI2(`ORG#${orgId}#SHIFTS`, {
      begins: `DATE#${date}`,
    });
    allShifts.push(...shifts);
  }

  return allShifts;
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

// Helper to get current week
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
