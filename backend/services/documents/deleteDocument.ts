/**
 * Delete Document
 * Deletes document from S3 and DynamoDB
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getDb, query, deleteItem } from '../../shared/db';
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

    const db = getDb();
    const s3 = new S3Client({});
    const orgId = user.organizationId;
    const documentId = event.pathParameters?.documentId;

    if (!documentId) {
      return error('documentId is required', 400);
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

    // Permission check: only the uploader or managers can delete
    const isUploader = docItem.uploadedBy === user.userId;
    const isManager = checkPermission(user.role, 'manager');

    if (!isUploader && !isManager) {
      return error('Forbidden: Cannot delete this document', 403);
    }

    // Delete from S3
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: docItem.s3Bucket,
          Key: docItem.s3Key,
        })
      );
    } catch (s3Error: any) {
      console.error('Error deleting from S3:', s3Error);
      // Continue with DynamoDB deletion even if S3 fails
    }

    // Delete from DynamoDB
    await deleteItem(db, {
      TableName: process.env.TABLE_NAME!,
      Key: {
        PK: docItem.PK,
        SK: docItem.SK,
      },
    });

    return success(null, 'Document deleted successfully');
  } catch (err: any) {
    console.error('Error deleting document:', err);
    return error(err.message || 'Internal server error', 500);
  }
};
