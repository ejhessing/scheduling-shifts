import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  ClockOutRequest,
  ClockOutResponse,
  isValidCoordinates,
  isAccuracyAcceptable,
  TimeEntryStatus,
  calculateTotalHours,
  calculateOvertimeHours,
  calculatePay,
} from '@time-tracking/shared';
import { successResponse, validationErrorResponse, errorResponse, notFoundResponse } from '../utils/response';
import { updateItem, getItem, queryItems } from '../utils/dynamodb';

const s3 = new S3Client({ region: process.env.REGION || 'us-east-1' });
const BUCKET_NAME = process.env.S3_BUCKET_NAME!;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body: ClockOutRequest = JSON.parse(event.body || '{}');
    const { entryId, location, photo } = body;

    // Get user info from Cognito claims
    const claims = event.requestContext.authorizer?.claims;
    const authenticatedUserId = claims?.['custom:userId'] || claims?.sub;
    const orgId = claims?.['custom:orgId'];

    // Validate input
    if (!entryId || !location) {
      return validationErrorResponse('Entry ID and GPS location are required');
    }

    if (!isValidCoordinates(location.latitude, location.longitude)) {
      return validationErrorResponse('Invalid GPS coordinates');
    }

    if (!isAccuracyAcceptable(location)) {
      return validationErrorResponse('GPS accuracy is insufficient. Please try again in a moment.');
    }

    // Get the time entry
    const today = new Date().toISOString().split('T')[0];
    const timeEntry = await getItem(`USER#${authenticatedUserId}#DATE#${today}`, `ENTRY#${entryId}`);

    if (!timeEntry) {
      return notFoundResponse('Time entry not found');
    }

    if (timeEntry.clockOutTime) {
      return validationErrorResponse('Already clocked out for this entry');
    }

    // Verify user owns this entry
    if (timeEntry.userId !== authenticatedUserId) {
      // TODO: Check if user has manager/admin role
      return validationErrorResponse('Not authorized to clock out this entry');
    }

    const clockOutTime = new Date().toISOString();

    // Upload photo to S3 if provided
    let photoKey: string | undefined;
    if (photo) {
      photoKey = `photos/${authenticatedUserId}/${entryId}-clock-out.jpg`;
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

    // Calculate hours worked
    const totalHours = calculateTotalHours(timeEntry.clockInTime, clockOutTime, timeEntry.breaks || []);

    // Get organization settings for overtime rules
    const orgData = await getItem(`ORG#${orgId}`, `ORG#${orgId}`);
    const overtimeRules = orgData?.complianceRules?.overtimeRules || [];

    // Calculate hours worked this week for overtime calculation
    const weekStart = getWeekStart(new Date());
    const weekEntries = await queryItems(
      'PK = :pk',
      {
        ':pk': `USER#${authenticatedUserId}#DATE#${weekStart}`,
      }
    );

    const hoursThisWeek = weekEntries.reduce((total, entry) => {
      if (entry.entryId !== entryId && entry.totalHours) {
        return total + entry.totalHours;
      }
      return total;
    }, 0);

    const { regularHours, overtimeHours } = calculateOvertimeHours(
      totalHours,
      overtimeRules,
      hoursThisWeek
    );

    // Calculate pay
    const overtimeMultiplier = overtimeRules[0]?.multiplier || 1.5;
    const totalPay = calculatePay(regularHours, overtimeHours, timeEntry.payRate, overtimeMultiplier);

    // Update time entry
    const updates: any = {
      clockOutTime,
      clockOutLocation: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp || clockOutTime,
      },
      totalHours,
      regularHours,
      overtimeHours,
      totalPay,
      status: orgData?.settings?.autoApproveTimeEntries
        ? TimeEntryStatus.APPROVED
        : TimeEntryStatus.PENDING,
      updatedAt: clockOutTime,
    };

    if (photoKey) {
      updates.photos = { ...timeEntry.photos, clockOut: photoKey };
    }

    await updateItem(
      `USER#${authenticatedUserId}#DATE#${today}`,
      `ENTRY#${entryId}`,
      updates
    );

    const response: ClockOutResponse = {
      entryId,
      clockOutTime,
      totalHours,
      regularHours,
      overtimeHours,
      totalPay,
      message: 'Clocked out successfully',
    };

    return successResponse(response);
  } catch (error: any) {
    console.error('Clock out error:', error);
    return errorResponse(error);
  }
}

/**
 * Helper function to get the start of the current week
 */
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Adjust to Sunday
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}
