import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, validationErrorResponse, errorResponse, notFoundResponse } from '../utils/response';
import { getItem, updateItem } from '../utils/dynamodb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const claims = event.requestContext.authorizer?.claims;
    const managerId = claims?.['custom:userId'] || claims?.sub;
    const userRole = claims?.['custom:role'];

    // Verify user is manager or admin
    if (userRole !== 'MANAGER' && userRole !== 'ORG_ADMIN') {
      return validationErrorResponse('Only managers can approve shift swaps');
    }

    const swapId = event.pathParameters?.swapId;
    const body = JSON.parse(event.body || '{}');
    const { action, reason } = body; // 'approve' or 'reject'

    if (!swapId) {
      return validationErrorResponse('Swap ID is required');
    }

    if (!action || (action !== 'approve' && action !== 'reject')) {
      return validationErrorResponse('Action must be "approve" or "reject"');
    }

    // Get swap request
    const swapRequest = await getItem(`SWAP#${swapId}`, `SWAP#${swapId}`);

    if (!swapRequest) {
      return notFoundResponse('Swap request not found');
    }

    // Verify request is pending manager approval
    if (swapRequest.status !== 'PENDING_MANAGER') {
      return validationErrorResponse(`Request is not pending manager approval (current status: ${swapRequest.status})`);
    }

    const now = new Date().toISOString();

    if (action === 'reject') {
      // Reject the swap
      await updateItem(`SWAP#${swapId}`, `SWAP#${swapId}`, {
        status: 'REJECTED',
        approvedBy: managerId,
        approvedAt: now,
        rejectionReason: reason || 'Rejected by manager',
        updatedAt: now,
      });

      // TODO: Notify requester and target of rejection

      return successResponse({
        message: 'Swap request rejected',
        swapId,
      });
    }

    // Approve - perform the actual swap
    const { shiftId, requesterId, targetUserId, shiftDetails } = swapRequest;

    // Update the original shift to assign to target user
    // Note: In production, you'd need to find the shift using the date
    const date = shiftDetails.date;
    const locationId = shiftDetails.locationId;

    try {
      await updateItem(
        `LOC#${locationId}#DATE#${date}`,
        `SHIFT#${shiftId}`,
        {
          userId: targetUserId,
          updatedAt: now,
          updatedBy: managerId,
          swappedFrom: requesterId,
          swapId,
        }
      );

      // Also update GSI1 entries if needed (depends on implementation)

      // Mark swap as approved
      await updateItem(`SWAP#${swapId}`, `SWAP#${swapId}`, {
        status: 'APPROVED',
        approvedBy: managerId,
        approvedAt: now,
        updatedAt: now,
      });

      // TODO: Notify requester and target of approval

      return successResponse({
        message: 'Shift swap approved successfully',
        swapId,
        shiftId,
        newAssignee: targetUserId,
      });
    } catch (shiftUpdateError: any) {
      console.error('Error updating shift:', shiftUpdateError);
      return errorResponse(new Error('Failed to perform shift swap'));
    }
  } catch (error: any) {
    console.error('Approve swap error:', error);
    return errorResponse(error);
  }
}
