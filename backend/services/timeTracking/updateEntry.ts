import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error, notFound, unauthorized } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';
import { validateBody, updateTimeEntrySchema } from '../../shared/validators';
import { now, calculateWorkedHours, calculateOvertime, calculatePay } from '../../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Get entryId from path parameters
    const entryId = event.pathParameters?.entryId;

    if (!entryId) {
      return error('Entry ID is required');
    }

    // Validate request body
    const body = validateBody(updateTimeEntrySchema, event.body);

    // Find the time entry
    const recentDates = getRecentDates(30); // Check last 30 days
    let timeEntry: any = null;
    let entryPK = '';
    let entrySK = '';

    for (const date of recentDates) {
      const entries = await db.query(`USER#${currentUser.userId}#DATE#${date}`);
      const found = entries.find((e) => e.entryId === entryId);
      if (found) {
        timeEntry = found;
        entryPK = `USER#${currentUser.userId}#DATE#${date}`;
        entrySK = `ENTRY#${entryId}`;
        break;
      }
    }

    if (!timeEntry) {
      // Check if manager/admin is trying to update someone else's entry
      if (['manager', 'admin', 'owner'].includes(currentUser.role)) {
        // Search org-wide (simplified - in production use GSI2)
        // For now, return not found
        return notFound('Time entry not found');
      }
      return notFound('Time entry not found');
    }

    // Check authorization
    if (timeEntry.userId !== currentUser.userId && !['manager', 'admin', 'owner'].includes(currentUser.role)) {
      return unauthorized('You do not have permission to update this entry');
    }

    // Only allow updates if entry is not approved/paid
    if (['approved', 'paid'].includes(timeEntry.status) && currentUser.role !== 'owner') {
      return error('Cannot update an approved or paid time entry', 403);
    }

    // Build updates
    const updates: Record<string, any> = {
      updatedAt: now(),
    };

    if (body.clockInTime) updates.clockInTime = body.clockInTime;
    if (body.clockOutTime) updates.clockOutTime = body.clockOutTime;
    if (body.breaks) updates.breaks = body.breaks;
    if (body.notes) updates.notes = body.notes;

    // Recalculate hours if times changed
    if (body.clockInTime || body.clockOutTime || body.breaks) {
      const clockInTime = body.clockInTime || timeEntry.clockInTime;
      const clockOutTime = body.clockOutTime || timeEntry.clockOutTime;
      const breaks = body.breaks || timeEntry.breaks || [];

      if (clockInTime && clockOutTime) {
        const { totalHours, paidHours } = calculateWorkedHours(clockInTime, clockOutTime, breaks);
        const overtimeResult = calculateOvertime(paidHours);

        const payRate = timeEntry.payRate || 0;
        const payResult = calculatePay(
          overtimeResult.regularHours + overtimeResult.overtimeHours,
          payRate,
          overtimeResult.overtimeHours
        );

        updates.totalHours = totalHours;
        updates.regularHours = overtimeResult.regularHours;
        updates.overtimeHours = overtimeResult.overtimeHours;
        updates.totalPay = payResult.totalPay;
      }
    }

    // Update entry
    const updatedEntry = await db.update(entryPK, entrySK, updates);

    return success({
      entry: updatedEntry,
      message: 'Time entry updated successfully',
    });
  } catch (err: any) {
    console.error('Update entry error:', err);
    return error(err.message || 'Failed to update time entry', 500);
  }
};

// Helper to get recent dates
function getRecentDates(days: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}
