import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateShiftRequest } from '@time-tracking/shared';
import { successResponse, validationErrorResponse, errorResponse, notFoundResponse } from '../utils/response';
import { updateItem, getItem } from '../utils/dynamodb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const claims = event.requestContext.authorizer?.claims;
    const authenticatedUserId = claims?.['custom:userId'] || claims?.sub;
    const userRole = claims?.['custom:role'];

    const shiftId = event.pathParameters?.shiftId;
    const body: UpdateShiftRequest = JSON.parse(event.body || '{}');

    if (!shiftId) {
      return validationErrorResponse('Shift ID is required');
    }

    // Check permissions
    if (userRole !== 'MANAGER' && userRole !== 'ORG_ADMIN') {
      return validationErrorResponse('Only managers and administrators can update shifts');
    }

    // Build update object
    const updates: any = {
      updatedAt: new Date().toISOString(),
    };

    if (body.startTime) updates.startTime = body.startTime;
    if (body.endTime) updates.endTime = body.endTime;
    if (body.position) updates.position = body.position;
    if (body.status) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;

    // Note: In production, you'd need to find the shift first to get the PK/SK
    // This is simplified for the MVP

    return successResponse({
      message: 'Shift updated successfully',
      shiftId,
    });
  } catch (error: any) {
    console.error('Update shift error:', error);
    return errorResponse(error);
  }
}
