import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error, validationError } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';
import { validateBody, clockInSchema } from '../../shared/validators';
import { validateGeofence, isAccuracyAcceptable } from '../../shared/geofence';
import { generateId, now, formatDate } from '../../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Validate request body
    const body = validateBody(clockInSchema, event.body);

    // Check if user already has an active time entry (not clocked out)
    const today = formatDate();
    const existingEntries = await db.query(`USER#${currentUser.userId}#DATE#${today}`);

    const activeEntry = existingEntries.find((entry) => !entry.clockOutTime);
    if (activeEntry) {
      return validationError('You already have an active time entry. Please clock out first.');
    }

    // Get location details
    const location = await db.get(`LOC#${body.locationId}`, `LOC#${body.locationId}`);

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

    // Validate geofence
    const geofenceResult = validateGeofence(body.location, [
      {
        id: location.locationId,
        name: location.name,
        lat: location.address.lat,
        lng: location.address.lng,
        radius: location.geofenceRadius || 100,
      },
    ]);

    if (!geofenceResult.valid) {
      return validationError('You are not within the allowed location for clock-in', {
        nearestDistance: geofenceResult.nearestDistance,
        required: 'Must be within geofence radius',
      });
    }

    // Get organization settings for compliance rules
    const org = await db.get(`ORG#${currentUser.orgId}`, `ORG#${currentUser.orgId}`);

    // Create time entry
    const entryId = generateId();
    const clockInTime = now();

    const timeEntry = {
      PK: `USER#${currentUser.userId}#DATE#${today}`,
      SK: `ENTRY#${entryId}`,
      GSI1PK: `LOC#${body.locationId}#DATE#${today}`,
      GSI1SK: `ENTRY#${clockInTime}`,
      GSI2PK: `ORG#${currentUser.orgId}#PAYPERIOD#${getPayPeriod()}`,
      GSI2SK: `USER#${currentUser.userId}#${clockInTime}`,
      entryId,
      userId: currentUser.userId,
      locationId: body.locationId,
      orgId: currentUser.orgId,
      clockInTime,
      clockInLocation: {
        lat: body.location.lat,
        lng: body.location.lng,
        accuracy: body.location.accuracy,
        distance: geofenceResult.distance,
      },
      clockOutTime: null,
      clockOutLocation: null,
      breaks: [],
      notes: body.notes || '',
      status: 'active',
      totalHours: 0,
      regularHours: 0,
      overtimeHours: 0,
      totalPay: 0,
      createdAt: clockInTime,
      updatedAt: clockInTime,
    };

    await db.put(timeEntry);

    return success({
      entry: timeEntry,
      message: 'Clocked in successfully',
    }, 201);
  } catch (err: any) {
    console.error('Clock in error:', err);
    return error(err.message || 'Failed to clock in', 500);
  }
};

// Helper to get current pay period (year-week format)
function getPayPeriod(): string {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((now.getTime() - yearStart.getTime()) / 86400000) + yearStart.getDay() + 1) / 7);
  return `${now.getFullYear()}-${String(weekNo).padStart(2, '0')}`;
}
