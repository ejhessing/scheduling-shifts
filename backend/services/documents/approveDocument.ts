/**
 * Approve Document
 * Approves or rejects a pending document
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, query, updateItem } from '../../shared/db';
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

    // Only managers can approve documents
    if (!checkPermission(user.role, 'manager')) {
      return error('Forbidden: Manager access required', 403);
    }

    const db = getDb();
    const orgId = user.organizationId;
    const documentId = event.pathParameters?.documentId;
    const body = JSON.parse(event.body || '{}');
    const action = body.action; // 'approve' or 'reject'
    const notes = body.notes;

    if (!documentId) {
      return error('documentId is required', 400);
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return error('action must be "approve" or "reject"', 400);
    }

    // Find the document
    const result = await query(db, {
      TableName: process.env.TABLE_NAME!,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gsi1pk',
      FilterExpression: 'documentId = :documentId',
      ExpressionAttributeValues: {
        ':gsi1pk': `ORG#${orgId}#DOCUMENTS`,
        ':documentId': documentId,
      },
    });

    if (!result.Items || result.Items.length === 0) {
      return error('Document not found', 404);
    }

    const docItem = result.Items[0];

    if (docItem.status !== 'pending') {
      return error('Document is not in pending status', 400);
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update document status
    let updateExpression = 'SET #status = :status, approvedBy = :approvedBy, approvedAt = :approvedAt';
    const expressionAttributeValues: any = {
      ':status': newStatus,
      ':approvedBy': user.userId,
      ':approvedAt': new Date().toISOString(),
    };

    if (notes) {
      updateExpression += ', approvalNotes = :notes';
      expressionAttributeValues[':notes'] = notes;
    }

    await updateItem(db, {
      TableName: process.env.TABLE_NAME!,
      Key: {
        PK: docItem.PK,
        SK: docItem.SK,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: expressionAttributeValues,
    });

    return success(
      { documentId, status: newStatus },
      `Document ${action}d successfully`
    );
  } catch (err: any) {
    console.error('Error approving document:', err);
    return error(err.message || 'Internal server error', 500);
  }
};
