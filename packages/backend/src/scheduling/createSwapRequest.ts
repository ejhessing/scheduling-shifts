import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { ShiftSwapStatus } from '@time-tracking/shared';
import { successResponse, validationErrorResponse, errorResponse, notFoundResponse } from '../utils/response';
import { putItem, getItem, queryItems } from '../utils/dynamodb';

interface ShiftSwapRequestBody {
  shiftId: string;
  targetUserId: string;
  notes?: string;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const claims = event.requestContext.authorizer?.claims;
    const requesterId = claims?.['custom:userId'] || claims?.sub;
    const orgId = claims?.['custom:orgId'];

    const body: ShiftSwapRequestBody = JSON.parse(event.body || '{}');
    const { shiftId, targetUserId, notes } = body;

    if (!shiftId || !targetUserId) {
      return validationErrorResponse('Shift ID and target user ID are required');
    }

    if (requesterId === targetUserId) {
      return validationErrorResponse('Cannot swap shift with yourself');
    }

    // Get requester profile
    const requesterProfile = await getItem(`USER#${requesterId}`, `PROFILE#${requesterId}`);
    if (!requesterProfile) {
      return notFoundResponse('Requester profile not found');
    }

    // Get target user profile
    const targetProfile = await getItem(`USER#${targetUserId}`, `PROFILE#${targetUserId}`);
    if (!targetProfile) {
      return notFoundResponse('Target user not found');
    }

    // Find the shift (need to query to get it)
    // For simplicity, we'll assume the shift date is provided or we query recent shifts
    const today = new Date();
    const searchDates = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d.toISOString().split('T')[0];
    });

    let shift = null;
    for (const date of searchDates) {
      const shifts = await queryItems(
        'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
        {
          ':pk': `USER#${requesterId}#SHIFTS`,
          ':sk': `DATE#${date}`,
        },
        'GSI1'
      );
      shift = shifts.find((s: any) => s.shiftId === shiftId);
      if (shift) break;
    }

    if (!shift) {
      return notFoundResponse('Shift not found');
    }

    // Verify shift belongs to requester
    if (shift.userId !== requesterId) {
      return validationErrorResponse('You can only swap your own shifts');
    }

    // Verify shift is not already in the past
    if (new Date(shift.startTime) < new Date()) {
      return validationErrorResponse('Cannot swap shifts that have already started');
    }

    // Check if target user has conflicting shifts
    const targetShifts = await queryItems(
      'GSI1PK = :pk AND GSI1SK = :sk',
      {
        ':pk': `USER#${targetUserId}#SHIFTS`,
        ':sk': `DATE#${shift.date}#${shift.startTime}`,
      },
      'GSI1'
    );

    const hasConflict = targetShifts.some((s: any) => {
      const sStart = new Date(s.startTime).getTime();
      const sEnd = new Date(s.endTime).getTime();
      const reqStart = new Date(shift.startTime).getTime();
      const reqEnd = new Date(shift.endTime).getTime();
      return sStart < reqEnd && reqStart < sEnd;
    });

    if (hasConflict) {
      return validationErrorResponse('Target user has a conflicting shift at this time');
    }

    // Create swap request
    const swapId = uuidv4();
    const now = new Date().toISOString();

    const swapRequest = {
      PK: `SWAP#${swapId}`,
      SK: `SWAP#${swapId}`,
      GSI1PK: `USER#${requesterId}#SWAPS`,
      GSI1SK: `SWAP#${now}`,
      GSI2PK: `USER#${targetUserId}#SWAP_REQUESTS`,
      GSI2SK: `SWAP#${now}`,
      swapId,
      requesterId,
      requesterName: requesterProfile.name,
      targetUserId,
      targetUserName: targetProfile.name,
      shiftId,
      shiftDetails: {
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        position: shift.position,
        locationId: shift.locationId,
      },
      status: 'PENDING_TARGET',
      requestedAt: now,
      notes: notes || null,
      orgId,
      createdAt: now,
      updatedAt: now,
    };

    await putItem(swapRequest);

    // TODO: Send notification to target user

    return successResponse(
      {
        message: 'Shift swap request created successfully',
        swapId,
        targetUserName: targetProfile.name,
        shiftDate: shift.date,
        status: 'PENDING_TARGET',
      },
      201
    );
  } catch (error: any) {
    console.error('Create swap request error:', error);
    return errorResponse(error);
  }
}
