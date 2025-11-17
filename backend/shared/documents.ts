/**
 * Document Management Utilities
 * Handles document metadata, categories, expiration tracking, and S3 operations
 */

export interface Document {
  documentId: string;
  organizationId: string;
  userId?: string; // If associated with specific employee
  uploadedBy: string;
  fileName: string;
  fileSize: number;
  fileType: string; // MIME type
  category: DocumentCategory;
  s3Key: string;
  s3Bucket: string;
  description?: string;
  tags?: string[];
  expirationDate?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approvedBy?: string;
  approvedAt?: string;
  uploadedAt: string;
  lastAccessedAt?: string;
  metadata?: Record<string, any>;
}

export type DocumentCategory =
  | 'tax_form' // W-4, W-2, 1099
  | 'identification' // I-9, driver's license, passport
  | 'certification' // Professional certifications, licenses
  | 'employment' // Offer letter, contract, NDA
  | 'benefits' // Insurance forms, 401k enrollment
  | 'training' // Training certificates, course completion
  | 'performance' // Performance reviews, evaluations
  | 'policy' // Employee handbook, policies
  | 'timesheet' // Timesheet corrections, approvals
  | 'other';

export interface DocumentMetadata {
  // Tax Forms
  taxYear?: number;
  formType?: string; // W-4, W-2, 1099-MISC, etc.

  // Certifications
  certificationName?: string;
  certificationNumber?: string;
  issuingAuthority?: string;
  issueDate?: string;
  expirationDate?: string;

  // Identification
  idType?: string; // Driver's License, Passport, etc.
  idNumber?: string;
  expirationDate?: string;

  // Training
  trainingCourse?: string;
  completionDate?: string;
  instructor?: string;
  hoursCompleted?: number;

  // General
  notes?: string;
  requiresRenewal?: boolean;
}

/**
 * Generate S3 key for document storage
 */
export function generateS3Key(
  organizationId: string,
  category: DocumentCategory,
  userId: string | undefined,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

  if (userId) {
    // Employee-specific documents
    return `organizations/${organizationId}/employees/${userId}/${category}/${timestamp}_${sanitizedFileName}`;
  } else {
    // Organization-wide documents
    return `organizations/${organizationId}/documents/${category}/${timestamp}_${sanitizedFileName}`;
  }
}

/**
 * Get document category display name
 */
export function getCategoryDisplayName(category: DocumentCategory): string {
  const names: Record<DocumentCategory, string> = {
    tax_form: 'Tax Form',
    identification: 'Identification',
    certification: 'Certification/License',
    employment: 'Employment Document',
    benefits: 'Benefits Enrollment',
    training: 'Training Certificate',
    performance: 'Performance Review',
    policy: 'Policy Document',
    timesheet: 'Timesheet Document',
    other: 'Other',
  };
  return names[category];
}

/**
 * Check if document is expired
 */
export function isDocumentExpired(document: Document): boolean {
  if (!document.expirationDate) return false;
  return new Date(document.expirationDate) < new Date();
}

/**
 * Check if document is expiring soon (within 30 days)
 */
export function isDocumentExpiringSoon(document: Document, daysThreshold: number = 30): boolean {
  if (!document.expirationDate) return false;
  const expirationDate = new Date(document.expirationDate);
  const today = new Date();
  const daysUntilExpiration = Math.floor(
    (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysUntilExpiration > 0 && daysUntilExpiration <= daysThreshold;
}

/**
 * Get documents expiring soon
 */
export function getExpiringDocuments(
  documents: Document[],
  daysThreshold: number = 30
): Document[] {
  return documents.filter((doc) => isDocumentExpiringSoon(doc, daysThreshold));
}

/**
 * Get expired documents
 */
export function getExpiredDocuments(documents: Document[]): Document[] {
  return documents.filter(isDocumentExpired);
}

/**
 * Validate file type
 */
export function isAllowedFileType(mimeType: string): boolean {
  const allowedTypes = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',

    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  return allowedTypes.includes(mimeType);
}

/**
 * Validate file size (max 10MB)
 */
export function isAllowedFileSize(fileSize: number, maxSizeMB: number = 10): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return fileSize <= maxSizeBytes;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Generate presigned URL parameters
 */
export function getPresignedUrlExpiration(): number {
  return 3600; // 1 hour in seconds
}

/**
 * Sanitize metadata for storage
 */
export function sanitizeMetadata(metadata: any): DocumentMetadata {
  const sanitized: DocumentMetadata = {};

  // Only include allowed fields
  const allowedFields = [
    'taxYear',
    'formType',
    'certificationName',
    'certificationNumber',
    'issuingAuthority',
    'issueDate',
    'expirationDate',
    'idType',
    'idNumber',
    'trainingCourse',
    'completionDate',
    'instructor',
    'hoursCompleted',
    'notes',
    'requiresRenewal',
  ];

  for (const field of allowedFields) {
    if (metadata[field] !== undefined && metadata[field] !== null) {
      sanitized[field as keyof DocumentMetadata] = metadata[field];
    }
  }

  return sanitized;
}

/**
 * Group documents by category
 */
export function groupDocumentsByCategory(documents: Document[]): Record<DocumentCategory, Document[]> {
  const grouped: Partial<Record<DocumentCategory, Document[]>> = {};

  documents.forEach((doc) => {
    if (!grouped[doc.category]) {
      grouped[doc.category] = [];
    }
    grouped[doc.category]!.push(doc);
  });

  return grouped as Record<DocumentCategory, Document[]>;
}

/**
 * Group documents by user
 */
export function groupDocumentsByUser(documents: Document[]): Record<string, Document[]> {
  const grouped: Record<string, Document[]> = {};

  documents.forEach((doc) => {
    if (doc.userId) {
      if (!grouped[doc.userId]) {
        grouped[doc.userId] = [];
      }
      grouped[doc.userId].push(doc);
    }
  });

  return grouped;
}

/**
 * Filter documents by status
 */
export function filterDocumentsByStatus(
  documents: Document[],
  status: Document['status']
): Document[] {
  return documents.filter((doc) => doc.status === status);
}

/**
 * Filter documents by category
 */
export function filterDocumentsByCategory(
  documents: Document[],
  category: DocumentCategory
): Document[] {
  return documents.filter((doc) => doc.category === category);
}

/**
 * Search documents by filename or description
 */
export function searchDocuments(documents: Document[], query: string): Document[] {
  const lowerQuery = query.toLowerCase();
  return documents.filter(
    (doc) =>
      doc.fileName.toLowerCase().includes(lowerQuery) ||
      (doc.description && doc.description.toLowerCase().includes(lowerQuery)) ||
      (doc.tags && doc.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)))
  );
}

/**
 * Sort documents by upload date (most recent first)
 */
export function sortDocumentsByDate(documents: Document[], descending: boolean = true): Document[] {
  return [...documents].sort((a, b) => {
    const dateA = new Date(a.uploadedAt).getTime();
    const dateB = new Date(b.uploadedAt).getTime();
    return descending ? dateB - dateA : dateA - dateB;
  });
}
