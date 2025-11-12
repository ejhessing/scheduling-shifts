import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, validationErrorResponse, errorResponse } from '../utils/response';
import { queryItems } from '../utils/dynamodb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const claims = event.requestContext.authorizer?.claims;
    const orgId = claims?.['custom:orgId'];
    const userRole = claims?.['custom:role'];

    if (userRole !== 'MANAGER' && userRole !== 'ORG_ADMIN') {
      return validationErrorResponse('Insufficient permissions');
    }

    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;

    if (!startDate || !endDate) {
      return validationErrorResponse('Start date and end date are required');
    }

    // Get all shifts in the date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates: string[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    // Query shifts for the period
    const allShifts: any[] = [];
    for (const date of dates) {
      const shifts = await queryItems(
        'GSI2PK = :pk AND begins_with(GSI2SK, :sk)',
        {
          ':pk': `ORG#${orgId}#SHIFTS`,
          ':sk': `DATE#${date}`,
        },
        'GSI2'
      );
      allShifts.push(...shifts);
    }

    // Get all time entries for the same period
    const weeks: string[] = [];
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

    // Match entries to shifts
    const shiftMap = new Map(allShifts.map(s => [s.shiftId, s]));
    const entryMap = new Map(allEntries.map(e => [e.shiftId, e]));

    // Calculate attendance metrics
    const totalShifts = allShifts.length;
    const completedShifts = allShifts.filter(s => s.status === 'COMPLETED').length;
    const noShows = allShifts.filter(s => s.status === 'NO_SHOW').length;
    const cancelled = allShifts.filter(s => s.status === 'CANCELLED').length;

    // By user
    const byUser: { [key: string]: any } = {};
    allShifts.forEach(shift => {
      if (!byUser[shift.userId]) {
        byUser[shift.userId] = {
          userId: shift.userId,
          scheduled: 0,
          completed: 0,
          noShows: 0,
          cancelled: 0,
          lateClockIns: 0,
          earlyClockOuts: 0,
        };
      }

      byUser[shift.userId].scheduled += 1;

      if (shift.status === 'COMPLETED') {
        byUser[shift.userId].completed += 1;

        // Check if there was a time entry
        const entry = entryMap.get(shift.shiftId);
        if (entry) {
          const shiftStart = new Date(shift.startTime).getTime();
          const clockIn = new Date(entry.clockInTime).getTime();
          const shiftEnd = new Date(shift.endTime).getTime();
          const clockOut = entry.clockOutTime ? new Date(entry.clockOutTime).getTime() : null;

          // Late if clocked in > 5 minutes after shift start
          if (clockIn > shiftStart + 300000) {
            byUser[shift.userId].lateClockIns += 1;
          }

          // Early if clocked out > 5 minutes before shift end
          if (clockOut && clockOut < shiftEnd - 300000) {
            byUser[shift.userId].earlyClockOuts += 1;
          }
        }
      } else if (shift.status === 'NO_SHOW') {
        byUser[shift.userId].noShows += 1;
      } else if (shift.status === 'CANCELLED') {
        byUser[shift.userId].cancelled += 1;
      }
    });

    // Calculate attendance rate for each user
    Object.values(byUser).forEach((user: any) => {
      const attendable = user.scheduled - user.cancelled;
      user.attendanceRate = attendable > 0
        ? Math.round((user.completed / attendable) * 100)
        : 100;
    });

    return successResponse({
      summary: {
        totalShifts,
        completedShifts,
        noShows,
        cancelled,
        attendanceRate: totalShifts > 0
          ? Math.round((completedShifts / (totalShifts - cancelled)) * 100)
          : 100,
      },
      byUser: Object.values(byUser).sort((a: any, b: any) => b.scheduled - a.scheduled),
      period: {
        startDate,
        endDate,
      },
    });
  } catch (error: any) {
    console.error('Attendance report error:', error);
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
