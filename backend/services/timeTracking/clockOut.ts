import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error, validationError, notFound } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';
import { validateBody, clockOutSchema } from '../../shared/validators';
import { validateGeofence, isAccuracyAcceptable } from '../../shared/geofence';
import { now, calculateWorkedHours, calculateOvertime, calculatePay } from '../../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Validate request body
    const body = validateBody(clockOutSchema, event.body);

    // Find the time entry
    // We need to search for the entry since we don't know the date
    // In production, you might want to cache the active entry ID
    const recentDates = getRecentDates(3); // Check last 3 days
    let timeEntry: any = null;
    let entryPK = '';
    let entrySK = '';

    for (const date of recentDates) {
      const entries = await db.query(`USER#${currentUser.userId}#DATE#${date}`);
      const found = entries.find((e) => e.entryId === body.entryId);
      if (found) {
        timeEntry = found;
        entryPK = `USER#${currentUser.userId}#DATE#${date}`;
        entrySK = `ENTRY#${body.entryId}`;
        break;
      }
    }

    if (!timeEntry) {
      return notFound('Time entry not found');
    }

    if (timeEntry.clockOutTime) {
      return validationError('This time entry is already clocked out');
    }

    // Get location details
    const location = await db.get(`LOC#${timeEntry.locationId}`, `LOC#${timeEntry.locationId}`);

    if (!location) {
      return validationError('Location not found');
    }

    // Validate GPS accuracy
    if (!isAccuracyAcceptable(body.location)) {
      return validationError('GPS accuracy is too low. Please ensure GPS is enabled and try again.', {
        accuracy: body.location.accuracy,
        maxAccuracy: 50,
      });
    }

    // Validate geofence (optional for clock-out, but recommended)
    const geofenceResult = validateGeofence(body.location, [
      {
        id: location.locationId,
        name: location.name,
        lat: location.address.lat,
        lng: location.address.lng,
        radius: location.geofenceRadius || 100,
      },
    ]);

    const clockOutTime = now();

    // Calculate hours worked
    const { totalHours, paidHours } = calculateWorkedHours(
      timeEntry.clockInTime,
      clockOutTime,
      timeEntry.breaks || []
    );

    // Calculate overtime
    const overtimeResult = calculateOvertime(paidHours);

    // Get user's pay rate (from shift or profile)
    let payRate = timeEntry.payRate || 0;
    if (!payRate) {
      const user = await db.get(`USER#${currentUser.userId}`, `PROFILE#${currentUser.userId}`);
      payRate = user.defaultPayRate || 0;
    }

    // Calculate pay
    const payResult = calculatePay(
      overtimeResult.regularHours + overtimeResult.overtimeHours,
      payRate,
      overtimeResult.overtimeHours
    );

    // Update time entry
    const updates = {
      clockOutTime,
      clockOutLocation: {
        lat: body.location.lat,
        lng: body.location.lng,
        accuracy: body.location.accuracy,
        distance: geofenceResult.distance,
        withinGeofence: geofenceResult.valid,
      },
      totalHours,
      regularHours: overtimeResult.regularHours,
      overtimeHours: overtimeResult.overtimeHours,
      totalPay: payResult.totalPay,
      payRate,
      status: 'pending_approval',
      updatedAt: clockOutTime,
      notes: body.notes ? `${timeEntry.notes}\n${body.notes}` : timeEntry.notes,
    };

    const updatedEntry = await db.update(entryPK, entrySK, updates);

    return success({
      entry: updatedEntry,
      message: 'Clocked out successfully',
      summary: {
        totalHours,
        regularHours: overtimeResult.regularHours,
        overtimeHours: overtimeResult.overtimeHours,
        totalPay: payResult.totalPay,
      },
    });
  } catch (err: any) {
    console.error('Clock out error:', err);
    return error(err.message || 'Failed to clock out', 500);
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
