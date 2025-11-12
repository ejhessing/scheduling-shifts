import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, validationErrorResponse, errorResponse, notFoundResponse } from '../utils/response';
import { getItem, updateItem } from '../utils/dynamodb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const claims = event.requestContext.authorizer?.claims;
    const userId = claims?.['custom:userId'] || claims?.sub;

    const swapId = event.pathParameters?.swapId;
    const body = JSON.parse(event.body || '{}');
    const { action } = body; // 'accept' or 'decline'

    if (!swapId) {
      return validationErrorResponse('Swap ID is required');
    }

    if (!action || (action !== 'accept' && action !== 'decline')) {
      return validationErrorResponse('Action must be "accept" or "decline"');
    }

    // Get swap request
    const swapRequest = await getItem(`SWAP#${swapId}`, `SWAP#${swapId}`);

    if (!swapRequest) {
      return notFoundResponse('Swap request not found');
    }

    // Verify user is the target
    if (swapRequest.targetUserId !== userId) {
      return validationErrorResponse('Only the target user can respond to this request');
    }

    // Verify request is still pending
    if (swapRequest.status !== 'PENDING_TARGET') {
      return validationErrorResponse(`Request is already ${swapRequest.status.toLowerCase()}`);
    }

    const now = new Date().toISOString();

    if (action === 'decline') {
      // Reject the swap
      await updateItem(`SWAP#${swapId}`, `SWAP#${swapId}`, {
        status: 'REJECTED',
        respondedAt: now,
        rejectionReason: body.reason || 'Declined by target user',
        updatedAt: now,
      });

      return successResponse({
        message: 'Swap request declined',
        swapId,
      });
    }

    // Accept - move to manager approval
    await updateItem(`SWAP#${swapId}`, `SWAP#${swapId}`, {
      status: 'PENDING_MANAGER',
      respondedAt: now,
      updatedAt: now,
    });

    // TODO: Notify manager for approval

    return successResponse({
      message: 'Swap request accepted. Waiting for manager approval.',
      swapId,
      status: 'PENDING_MANAGER',
    });
  } catch (error: any) {
    console.error('Respond to swap error:', error);
    return errorResponse(error);
  }
}
