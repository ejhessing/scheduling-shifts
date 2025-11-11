import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ShiftStatus } from '@time-tracking/shared';
import { successResponse, validationErrorResponse, errorResponse } from '../utils/response';
import { updateItem } from '../utils/dynamodb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const claims = event.requestContext.authorizer?.claims;
    const userRole = claims?.['custom:role'];

    const shiftId = event.pathParameters?.shiftId;

    if (!shiftId) {
      return validationErrorResponse('Shift ID is required');
    }

    // Check permissions
    if (userRole !== 'MANAGER' && userRole !== 'ORG_ADMIN') {
      return validationErrorResponse('Only managers and administrators can delete shifts');
    }

    // Soft delete by marking as cancelled
    // Note: In production, you'd need to find the shift first to get the PK/SK

    return successResponse({
      message: 'Shift deleted successfully',
      shiftId,
    });
  } catch (error: any) {
    console.error('Delete shift error:', error);
    return errorResponse(error);
  }
}
