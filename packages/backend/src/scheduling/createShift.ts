import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { CreateShiftRequest, ShiftStatus, doTimeRangesOverlap } from '@time-tracking/shared';
import { successResponse, validationErrorResponse, errorResponse, conflictResponse } from '../utils/response';
import { putItem, queryItems } from '../utils/dynamodb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const claims = event.requestContext.authorizer?.claims;
    const authenticatedUserId = claims?.['custom:userId'] || claims?.sub;
    const orgId = claims?.['custom:orgId'];
    const userRole = claims?.['custom:role'];

    // Check if user has permission to create shifts
    if (userRole !== 'MANAGER' && userRole !== 'ORG_ADMIN') {
      return validationErrorResponse('Only managers and administrators can create shifts');
    }

    const body: CreateShiftRequest = JSON.parse(event.body || '{}');
    const { userId, locationId, startTime, endTime, position, payRate, notes } = body;

    // Validate input
    if (!userId || !locationId || !startTime || !endTime || !position || payRate === undefined) {
      return validationErrorResponse('All required fields must be provided');
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
      return validationErrorResponse('End time must be after start time');
    }

    // Check for shift conflicts
    const date = start.toISOString().split('T')[0];
    const existingShifts = await queryItems(
      'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      {
        ':pk': `USER#${userId}#SHIFTS`,
        ':sk': `DATE#${date}`,
      },
      'GSI1'
    );

    const hasConflict = existingShifts.some((shift: any) => {
      if (shift.status === 'CANCELLED') return false;
      return doTimeRangesOverlap(startTime, endTime, shift.startTime, shift.endTime);
    });

    if (hasConflict) {
      return conflictResponse('User already has a shift scheduled during this time');
    }

    // Create shift
    const shiftId = uuidv4();
    const now = new Date().toISOString();

    const shift = {
      PK: `LOC#${locationId}#DATE#${date}`,
      SK: `SHIFT#${shiftId}`,
      GSI1PK: `USER#${userId}#SHIFTS`,
      GSI1SK: `DATE#${date}#${startTime}`,
      GSI2PK: `ORG#${orgId}#SHIFTS`,
      GSI2SK: `DATE#${date}#${startTime}`,
      shiftId,
      userId,
      locationId,
      orgId,
      date,
      startTime,
      endTime,
      position,
      status: ShiftStatus.SCHEDULED,
      breakRules: [], // TODO: Get from org settings
      payRate,
      notes: notes || null,
      createdAt: now,
      updatedAt: now,
      createdBy: authenticatedUserId,
    };

    await putItem(shift);

    return successResponse(
      {
        message: 'Shift created successfully',
        shift: {
          shiftId,
          userId,
          locationId,
          startTime,
          endTime,
          position,
          status: ShiftStatus.SCHEDULED,
        },
      },
      201
    );
  } catch (error: any) {
    console.error('Create shift error:', error);
    return errorResponse(error);
  }
}
