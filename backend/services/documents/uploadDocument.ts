/**
 * Upload Document
 * Generates presigned URL for direct S3 upload and creates document metadata
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getDb, putItem } from '../../shared/db';
import { verifyToken } from '../../shared/auth';
import { success, error } from '../../shared/response';
import {
  Document,
  DocumentCategory,
  generateS3Key,
  isAllowedFileType,
  isAllowedFileSize,
  sanitizeMetadata,
} from '../../shared/documents';
import { v4 as uuidv4 } from 'uuid';

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
    const body = JSON.parse(event.body || '{}');

    // Validate input
    const { fileName, fileSize, fileType, category, userId, description, tags, expirationDate, metadata } = body;

    if (!fileName || !fileSize || !fileType || !category) {
      return error('fileName, fileSize, fileType, and category are required', 400);
    }

    // Validate file type
    if (!isAllowedFileType(fileType)) {
      return error('File type not allowed. Allowed types: PDF, Word, Excel, Images', 400);
    }

    // Validate file size (10MB limit)
    if (!isAllowedFileSize(fileSize)) {
      return error('File size exceeds 10MB limit', 400);
    }

    // Validate category
    const validCategories: DocumentCategory[] = [
      'tax_form',
      'identification',
      'certification',
      'employment',
      'benefits',
      'training',
      'performance',
      'policy',
      'timesheet',
      'other',
    ];

    if (!validCategories.includes(category)) {
      return error('Invalid category', 400);
    }

    // If userId provided, verify access
    // Employees can only upload to their own documents, managers can upload to anyone
    if (userId && userId !== user.userId) {
      const isManager = ['manager', 'admin', 'owner'].includes(user.role);
      if (!isManager) {
        return error('Forbidden: Cannot upload documents for other users', 403);
      }
    }

    const orgId = user.organizationId;
    const documentId = uuidv4();
    const s3Bucket = process.env.BUCKET_NAME!;
    const s3Key = generateS3Key(orgId, category, userId, fileName);

    // Create document metadata
    const document: Document = {
      documentId,
      organizationId: orgId,
      userId: userId || undefined,
      uploadedBy: user.userId,
      fileName,
      fileSize,
      fileType,
      category,
      s3Key,
      s3Bucket,
      description: description || undefined,
      tags: tags || undefined,
      expirationDate: expirationDate || undefined,
      status: 'pending',
      uploadedAt: new Date().toISOString(),
      metadata: metadata ? sanitizeMetadata(metadata) : undefined,
    };

    // Generate presigned URL for upload
    const command = new PutObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      ContentType: fileType,
      Metadata: {
        documentId,
        organizationId: orgId,
        uploadedBy: user.userId,
        category,
      },
    });

    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 minutes

    // Store document metadata in DynamoDB
    await putItem(db, {
      TableName: process.env.TABLE_NAME!,
      Item: {
        PK: userId ? `ORG#${orgId}#USER#${userId}` : `ORG#${orgId}`,
        SK: `DOCUMENT#${documentId}`,
        GSI1PK: `ORG#${orgId}#DOCUMENTS`,
        GSI1SK: `CATEGORY#${category}#${document.uploadedAt}`,
        ...document,
      },
    });

    return success(
      {
        document,
        uploadUrl: presignedUrl,
        expiresIn: 300,
      },
      'Presigned URL generated successfully'
    );
  } catch (err: any) {
    console.error('Error uploading document:', err);
    return error(err.message || 'Internal server error', 500);
  }
};
