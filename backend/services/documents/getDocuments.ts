/**
 * Get Documents
 * Retrieves documents with filtering by user, category, status
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, query } from '../../shared/db';
import { verifyToken, checkPermission } from '../../shared/auth';
import { success, error } from '../../shared/response';
import {
  Document,
  DocumentCategory,
  filterDocumentsByStatus,
  filterDocumentsByCategory,
  searchDocuments,
  sortDocumentsByDate,
  getExpiredDocuments,
  getExpiringDocuments,
  isDocumentExpired,
} from '../../shared/documents';

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
    const orgId = user.organizationId;

    // Parse query parameters
    const userId = event.queryStringParameters?.userId;
    const category = event.queryStringParameters?.category as DocumentCategory | undefined;
    const status = event.queryStringParameters?.status as Document['status'] | undefined;
    const searchQuery = event.queryStringParameters?.search;
    const expiringOnly = event.queryStringParameters?.expiring === 'true';
    const expiredOnly = event.queryStringParameters?.expired === 'true';

    // Permission check: employees can only view their own documents
    if (userId && userId !== user.userId && !checkPermission(user.role, 'manager')) {
      return error('Forbidden: Cannot view other users documents', 403);
    }

    let documents: Document[];

    if (userId) {
      // Get documents for specific user
      const result = await query(db, {
        TableName: process.env.TABLE_NAME!,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `ORG#${orgId}#USER#${userId}`,
          ':prefix': 'DOCUMENT#',
        },
      });

      documents = (result.Items || []).map((item: any) => ({
        documentId: item.documentId,
        organizationId: item.organizationId,
        userId: item.userId,
        uploadedBy: item.uploadedBy,
        fileName: item.fileName,
        fileSize: item.fileSize,
        fileType: item.fileType,
        category: item.category,
        s3Key: item.s3Key,
        s3Bucket: item.s3Bucket,
        description: item.description,
        tags: item.tags,
        expirationDate: item.expirationDate,
        status: item.status,
        approvedBy: item.approvedBy,
        approvedAt: item.approvedAt,
        uploadedAt: item.uploadedAt,
        lastAccessedAt: item.lastAccessedAt,
        metadata: item.metadata,
      }));
    } else {
      // Get all documents in organization
      const result = await query(db, {
        TableName: process.env.TABLE_NAME!,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: {
          ':gsi1pk': `ORG#${orgId}#DOCUMENTS`,
        },
      });

      documents = (result.Items || []).map((item: any) => ({
        documentId: item.documentId,
        organizationId: item.organizationId,
        userId: item.userId,
        uploadedBy: item.uploadedBy,
        fileName: item.fileName,
        fileSize: item.fileSize,
        fileType: item.fileType,
        category: item.category,
        s3Key: item.s3Key,
        s3Bucket: item.s3Bucket,
        description: item.description,
        tags: item.tags,
        expirationDate: item.expirationDate,
        status: item.status,
        approvedBy: item.approvedBy,
        approvedAt: item.approvedAt,
        uploadedAt: item.uploadedAt,
        lastAccessedAt: item.lastAccessedAt,
        metadata: item.metadata,
      }));

      // For non-managers, filter to only their documents and organization-wide documents
      if (!checkPermission(user.role, 'manager')) {
        documents = documents.filter(
          (doc) => !doc.userId || doc.userId === user.userId
        );
      }
    }

    // Update expired status
    documents.forEach((doc) => {
      if (doc.status !== 'expired' && isDocumentExpired(doc)) {
        doc.status = 'expired';
      }
    });

    // Apply filters
    if (category) {
      documents = filterDocumentsByCategory(documents, category);
    }

    if (status) {
      documents = filterDocumentsByStatus(documents, status);
    }

    if (searchQuery) {
      documents = searchDocuments(documents, searchQuery);
    }

    if (expiringOnly) {
      documents = getExpiringDocuments(documents);
    }

    if (expiredOnly) {
      documents = getExpiredDocuments(documents);
    }

    // Sort by upload date (most recent first)
    documents = sortDocumentsByDate(documents);

    return success(documents);
  } catch (err: any) {
    console.error('Error getting documents:', err);
    return error(err.message || 'Internal server error', 500);
  }
};
