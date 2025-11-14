/**
 * Get Document
 * Retrieves a single document and generates presigned URL for download
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getDb, query, updateItem } from '../../shared/db';
import { verifyToken, checkPermission } from '../../shared/auth';
import { success, error } from '../../shared/response';
import { Document, getPresignedUrlExpiration } from '../../shared/documents';

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

    // Find the document (need to search since we don't know the PK)
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

    const document: Document = {
      documentId: docItem.documentId,
      organizationId: docItem.organizationId,
      userId: docItem.userId,
      uploadedBy: docItem.uploadedBy,
      fileName: docItem.fileName,
      fileSize: docItem.fileSize,
      fileType: docItem.fileType,
      category: docItem.category,
      s3Key: docItem.s3Key,
      s3Bucket: docItem.s3Bucket,
      description: docItem.description,
      tags: docItem.tags,
      expirationDate: docItem.expirationDate,
      status: docItem.status,
      approvedBy: docItem.approvedBy,
      approvedAt: docItem.approvedAt,
      uploadedAt: docItem.uploadedAt,
      lastAccessedAt: docItem.lastAccessedAt,
      metadata: docItem.metadata,
    };

    // Permission check: employees can only view their own documents or org-wide documents
    if (document.userId && document.userId !== user.userId && !checkPermission(user.role, 'manager')) {
      return error('Forbidden: Cannot view this document', 403);
    }

    // Generate presigned URL for download
    const command = new GetObjectCommand({
      Bucket: document.s3Bucket,
      Key: document.s3Key,
    });

    const downloadUrl = await getSignedUrl(s3, command, {
      expiresIn: getPresignedUrlExpiration(),
    });

    // Update last accessed time
    await updateItem(db, {
      TableName: process.env.TABLE_NAME!,
      Key: {
        PK: docItem.PK,
        SK: docItem.SK,
      },
      UpdateExpression: 'SET lastAccessedAt = :lastAccessedAt',
      ExpressionAttributeValues: {
        ':lastAccessedAt': new Date().toISOString(),
      },
    });

    return success({
      document,
      downloadUrl,
      expiresIn: getPresignedUrlExpiration(),
    });
  } catch (err: any) {
    console.error('Error getting document:', err);
    return error(err.message || 'Internal server error', 500);
  }
};
