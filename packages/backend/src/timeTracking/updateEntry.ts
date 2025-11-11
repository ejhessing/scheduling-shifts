import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, validationErrorResponse, errorResponse, notFoundResponse } from '../utils/response';
import { updateItem, getItem } from '../utils/dynamodb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const claims = event.requestContext.authorizer?.claims;
    const authenticatedUserId = claims?.['custom:userId'] || claims?.sub;

    const entryId = event.pathParameters?.entryId;
    const body = JSON.parse(event.body || '{}');

    if (!entryId) {
      return validationErrorResponse('Entry ID is required');
    }

    // Find the time entry (need to query by date)
    const date = body.date || new Date().toISOString().split('T')[0];
    const timeEntry = await getItem(`USER#${authenticatedUserId}#DATE#${date}`, `ENTRY#${entryId}`);

    if (!timeEntry) {
      return notFoundResponse('Time entry not found');
    }

    // Build update object
    const updates: any = {
      updatedAt: new Date().toISOString(),
    };

    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.breaks !== undefined) updates.breaks = body.breaks;

    // Update the entry
    await updateItem(`USER#${authenticatedUserId}#DATE#${date}`, `ENTRY#${entryId}`, updates);

    return successResponse({
      message: 'Time entry updated successfully',
      entryId,
    });
  } catch (error: any) {
    console.error('Update entry error:', error);
    return errorResponse(error);
  }
}
