/**
 * Approve Payroll
 * Approves a payroll period, marking it as ready for payment
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, updateItem } from '../../shared/db';
import { verifyToken, checkPermission } from '../../shared/auth';
import { success, error } from '../../shared/response';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Verify authentication
    const user = await verifyToken(event);
    if (!user) {
      return error('Unauthorized', 401);
    }

    // Only managers can approve payroll
    if (!checkPermission(user.role, 'manager')) {
      return error('Forbidden: Manager access required', 403);
    }

    const db = getDb();
    const orgId = user.organizationId;
    const periodId = event.pathParameters?.periodId;
    const body = JSON.parse(event.body || '{}');
    const action = body.action; // 'approve' or 'mark_paid'

    if (!periodId) {
      return error('periodId is required', 400);
    }

    if (!action || !['approve', 'mark_paid'].includes(action)) {
      return error('action must be "approve" or "mark_paid"', 400);
    }

    let newStatus: string;
    let updateExpression: string;
    let expressionAttributeValues: any;

    if (action === 'approve') {
      newStatus = 'approved';
      updateExpression =
        'SET #status = :status, approvedBy = :approvedBy, approvedAt = :approvedAt, updatedAt = :updatedAt';
      expressionAttributeValues = {
        ':status': newStatus,
        ':approvedBy': user.userId,
        ':approvedAt': new Date().toISOString(),
        ':updatedAt': new Date().toISOString(),
      };
    } else {
      // mark_paid
      newStatus = 'paid';
      updateExpression = 'SET #status = :status, updatedAt = :updatedAt';
      expressionAttributeValues = {
        ':status': newStatus,
        ':updatedAt': new Date().toISOString(),
      };
    }

    // Update payroll period status
    await updateItem(db, {
      TableName: process.env.TABLE_NAME!,
      Key: {
        PK: `ORG#${orgId}`,
        SK: `PAYROLL#${periodId}`,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: expressionAttributeValues,
    });

    return success(
      { periodId, status: newStatus },
      `Payroll ${action === 'approve' ? 'approved' : 'marked as paid'} successfully`
    );
  } catch (err: any) {
    console.error('Error approving payroll:', err);
    return error(err.message || 'Internal server error', 500);
  }
};
