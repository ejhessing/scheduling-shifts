import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  ClockInRequest,
  ClockInResponse,
  validateGeofence,
  isValidCoordinates,
  isAccuracyAcceptable,
  TimeEntryStatus,
  ErrorCode,
} from '@time-tracking/shared';
import { successResponse, validationErrorResponse, errorResponse, conflictResponse } from '../utils/response';
import { putItem, queryItems, getItem } from '../utils/dynamodb';

const s3 = new S3Client({ region: process.env.REGION || 'us-east-1' });
const BUCKET_NAME = process.env.S3_BUCKET_NAME!;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body: ClockInRequest = JSON.parse(event.body || '{}');
    const { userId, locationId, location, photo, method } = body;

    // Get user info from Cognito claims
    const claims = event.requestContext.authorizer?.claims;
    const authenticatedUserId = claims?.['custom:userId'] || claims?.sub;
    const orgId = claims?.['custom:orgId'];

    // Validate that the user is clocking in for themselves (or has permission)
    if (userId !== authenticatedUserId) {
      // TODO: Check if user has manager/admin role to clock in for others
    }

    // Validate input
    if (!userId || !locationId || !location) {
      return validationErrorResponse('User ID, location ID, and GPS location are required');
    }

    if (!isValidCoordinates(location.latitude, location.longitude)) {
      return validationErrorResponse('Invalid GPS coordinates');
    }

    if (!isAccuracyAcceptable(location)) {
      return validationErrorResponse('GPS accuracy is insufficient. Please try again in a moment.');
    }

    // Check if user is already clocked in
    const today = new Date().toISOString().split('T')[0];
    const existingEntries = await queryItems(
      'PK = :pk AND begins_with(SK, :sk)',
      {
        ':pk': `USER#${userId}#DATE#${today}`,
        ':sk': 'ENTRY#',
      }
    );

    const activeClock = existingEntries.find(entry => !entry.clockOutTime);
    if (activeClock) {
      return conflictResponse('User is already clocked in', {
        entryId: activeClock.entryId,
        clockInTime: activeClock.clockInTime,
      });
    }

    // Get location details for geofence validation
    const locationData = await getItem(`ORG#${orgId}`, `LOC#${locationId}`);
    if (!locationData) {
      return validationErrorResponse('Location not found');
    }

    // Validate geofence
    const geofenceResult = validateGeofence(location, [
      {
        id: locationId,
        name: locationData.name,
        geofence: locationData.geofence,
      },
    ]);

    // Get organization settings to check if geofence is required
    const orgData = await getItem(`ORG#${orgId}`, `ORG#${orgId}`);
    if (orgData?.settings?.requireGeofence && !geofenceResult.valid) {
      return validationErrorResponse(geofenceResult.message, {
        distance: geofenceResult.distance,
      });
    }

    // Get user's pay rate
    const userData = await getItem(`USER#${userId}`, `PROFILE#${userId}`);
    const payRate = userData?.payRate || 15; // Default pay rate

    // Create time entry
    const entryId = uuidv4();
    const clockInTime = new Date().toISOString();

    // Upload photo to S3 if provided
    let photoKey: string | undefined;
    if (photo) {
      photoKey = `photos/${userId}/${entryId}-clock-in.jpg`;
      const photoBuffer = Buffer.from(photo.replace(/^data:image\/\w+;base64,/, ''), 'base64');

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: photoKey,
          Body: photoBuffer,
          ContentType: 'image/jpeg',
        })
      );
    }

    const timeEntry = {
      PK: `USER#${userId}#DATE#${today}`,
      SK: `ENTRY#${entryId}`,
      GSI1PK: `LOC#${locationId}#DATE#${today}`,
      GSI1SK: `ENTRY#${clockInTime}`,
      GSI2PK: `ORG#${orgId}#PAYPERIOD#${getPayPeriodKey(new Date())}`,
      GSI2SK: `USER#${userId}#${clockInTime}`,
      entryId,
      userId,
      locationId,
      orgId,
      date: today,
      clockInTime,
      clockInLocation: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp || clockInTime,
      },
      breaks: [],
      status: TimeEntryStatus.DRAFT,
      payRate,
      photos: photoKey ? { clockIn: photoKey } : {},
      createdAt: clockInTime,
      updatedAt: clockInTime,
    };

    await putItem(timeEntry);

    const response: ClockInResponse = {
      entryId,
      clockInTime,
      validGeofence: geofenceResult.valid,
      message: geofenceResult.valid
        ? 'Clocked in successfully'
        : `Clocked in outside geofence (${geofenceResult.distance}m away)`,
    };

    return successResponse(response, 201);
  } catch (error: any) {
    console.error('Clock in error:', error);
    return errorResponse(error);
  }
}

/**
 * Helper function to get pay period key (YYYY-WW format)
 */
function getPayPeriodKey(date: Date): string {
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  return `${year}-${week.toString().padStart(2, '0')}`;
}

/**
 * Helper function to get ISO week number
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
