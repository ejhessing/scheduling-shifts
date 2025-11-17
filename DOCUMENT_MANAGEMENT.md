# Document Management & Employee Files

## Overview

The Document Management system provides secure storage, organization, and access control for employee documents, certifications, and company files. Built on AWS S3 with DynamoDB metadata storage, it supports file uploads, expiration tracking, approval workflows, and comprehensive access controls.

## Features

### 1. Document Categories

**Employee-Specific**:
- **Tax Forms**: W-4, W-2, 1099, state tax forms
- **Identification**: I-9, driver's license, passport, work authorization
- **Certifications**: Professional licenses, certifications, credentials
- **Employment**: Offer letter, contract, NDA, employment agreement
- **Benefits**: Insurance enrollment, 401k, HSA, benefits elections
- **Training**: Course completion certificates, safety training
- **Performance**: Performance reviews, evaluations, feedback

**Organization-Wide**:
- **Policy**: Employee handbook, company policies, procedures
- **Timesheet**: Approved timesheets, corrections, export files
- **Other**: Miscellaneous documents

### 2. File Storage & Security

**S3 Storage Structure**:
```
organizations/{orgId}/
  ├── employees/{userId}/
  │   ├── tax_form/{timestamp}_{filename}
  │   ├── certification/{timestamp}_{filename}
  │   └── ...
  └── documents/
      ├── policy/{timestamp}_{filename}
      └── ...
```

**Security**:
- Presigned URLs with 5-minute upload expiration
- Presigned URLs with 1-hour download expiration
- Role-based access control (employees can only see their own documents)
- Managers can view/manage all employee documents
- S3 bucket encryption at rest
- DynamoDB encryption enabled

### 3. Document Metadata

**Core Fields**:
- Document ID (UUID)
- Filename and file size
- File type (MIME type)
- Category
- Description and tags
- Upload timestamp and uploader

**Expiration Tracking**:
- Expiration date for certifications/licenses
- Auto-expiration status updates
- "Expiring Soon" warnings (30 days)
- Renewal requirement flagging

**Status Workflow**:
- **Pending**: Awaiting manager approval
- **Approved**: Verified and accepted
- **Rejected**: Rejected by manager
- **Expired**: Past expiration date

### 4. File Type Support

**Allowed Types** (10MB limit):
- **Documents**: PDF, Word (.doc, .docx), Excel (.xls, .xlsx), Text, CSV
- **Images**: JPEG, JPG, PNG, GIF, WebP

### 5. Access Control

**Employees**:
- Upload documents to their own profile
- View their own documents
- View organization-wide policy documents
- Download their own files

**Managers/Admins**:
- Upload documents for any employee
- View all employee documents
- Approve/reject pending documents
- Delete any document
- Upload organization-wide documents

## API Endpoints

### POST /documents
Upload document metadata and get presigned URL for S3 upload.

**Request Body**:
```json
{
  "fileName": "certification.pdf",
  "fileSize": 245678,
  "fileType": "application/pdf",
  "category": "certification",
  "userId": "user-123",  // optional, for employee-specific docs
  "description": "CPR Certification",
  "tags": ["medical", "certification"],
  "expirationDate": "2026-01-15",
  "metadata": {
    "certificationName": "CPR/AED",
    "certificationNumber": "CPR12345",
    "issuingAuthority": "Red Cross",
    "requiresRenewal": true
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Presigned URL generated successfully",
  "data": {
    "document": {
      "documentId": "doc-uuid",
      "fileName": "certification.pdf",
      "status": "pending",
      ...
    },
    "uploadUrl": "https://s3.amazonaws.com/...",
    "expiresIn": 300
  }
}
```

**Upload Flow**:
1. Call POST /documents to get metadata + upload URL
2. Use presigned URL to upload file directly to S3 via PUT request
3. Document appears in list with "pending" status

### GET /documents
List documents with filtering.

**Query Parameters**:
- `userId`: Filter by specific user
- `category`: Filter by category
- `status`: Filter by status (pending, approved, rejected, expired)
- `search`: Search filename/description
- `expiring`: Show only documents expiring within 30 days
- `expired`: Show only expired documents

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "documentId": "doc-uuid",
      "fileName": "certification.pdf",
      "fileSize": 245678,
      "fileType": "application/pdf",
      "category": "certification",
      "description": "CPR Certification",
      "expirationDate": "2026-01-15",
      "status": "approved",
      "uploadedBy": "user-456",
      "uploadedAt": "2025-01-01T10:30:00Z",
      "approvedBy": "manager-789",
      "approvedAt": "2025-01-01T14:00:00Z",
      "userId": "user-123"
    }
  ]
}
```

### GET /documents/{documentId}
Get single document with download URL.

**Response**:
```json
{
  "success": true,
  "data": {
    "document": {...},
    "downloadUrl": "https://s3.amazonaws.com/...",
    "expiresIn": 3600
  }
}
```

### DELETE /documents/{documentId}
Delete document from S3 and DynamoDB.

**Authorization**: Document uploader or managers only

**Response**:
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

### POST /documents/{documentId}/approve
Approve or reject document.

**Authorization**: Managers only

**Request Body**:
```json
{
  "action": "approve",  // or "reject"
  "notes": "Verified certification is current"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Document approved successfully",
  "data": {
    "documentId": "doc-uuid",
    "status": "approved"
  }
}
```

## Frontend Usage

Navigate to `/documents` in the web application.

### Upload Document
1. Click "Upload Document" button
2. Select file from computer (PDF, Word, Excel, Images)
3. Choose category (Tax Form, Certification, etc.)
4. Add description (optional)
5. Set expiration date for certifications (optional)
6. Click "Upload"
7. Document uploads directly to S3
8. Appears in list with "pending" status

### Filter Documents
- **Search**: Type filename or description
- **Category Filter**: Select specific category
- **Status Filter**: Pending, Approved, Rejected, Expired

### View & Download
- Click download icon to open document
- Opens in new tab for viewing/downloading
- Downloads use presigned URLs (expire after 1 hour)

### Approve Documents (Managers)
- View pending documents
- Click approve ✓ or reject ✗ icons
- Add notes during approval/rejection
- Status updates immediately

### Expiration Tracking
- Documents with expiration dates show date in table
- Orange warning icon appears for documents expiring within 30 days
- Expired documents automatically marked as "expired" status
- Filter by "Expiring" or "Expired" to find documents needing renewal

## Backend Implementation

### Lambda Functions

1. **uploadDocument.ts**: Presigned URL generation
   - Validates file type and size
   - Generates S3 key with timestamp
   - Creates presigned URL for upload
   - Stores metadata in DynamoDB
   - Returns upload URL to client

2. **getDocuments.ts**: List with filtering
   - Fetches documents from DynamoDB
   - Applies access control (employees see own docs only)
   - Filters by category, status, search query
   - Updates expired status automatically
   - Sorts by upload date

3. **getDocument.ts**: Single document + download URL
   - Fetches document metadata
   - Validates access permissions
   - Generates presigned download URL
   - Updates last accessed timestamp

4. **deleteDocument.ts**: Delete from S3 + DynamoDB
   - Validates user is uploader or manager
   - Deletes file from S3
   - Removes metadata from DynamoDB
   - Returns success confirmation

5. **approveDocument.ts**: Approval workflow
   - Manager-only endpoint
   - Updates document status
   - Records approver and timestamp
   - Supports approval notes

### Shared Utilities (`/backend/shared/documents.ts`)

**Document Management**:
- `generateS3Key()`: Create organized S3 keys
- `isDocumentExpired()`: Check expiration status
- `isDocumentExpiringSoon()`: Warn of upcoming expiration
- `getExpiringDocuments()`: Filter documents expiring soon
- `getCategoryDisplayName()`: Human-readable category names

**Validation**:
- `isAllowedFileType()`: Validate MIME type
- `isAllowedFileSize()`: Enforce 10MB limit
- `sanitizeMetadata()`: Clean user input

**Filtering & Search**:
- `filterDocumentsByStatus()`: Filter by status
- `filterDocumentsByCategory()`: Filter by category
- `searchDocuments()`: Search by filename/description
- `groupDocumentsByCategory()`: Group for display
- `sortDocumentsByDate()`: Sort by upload date

**Display Helpers**:
- `formatFileSize()`: Format bytes to KB/MB/GB
- `getFileExtension()`: Extract file extension

## Use Cases

### Employee Onboarding
1. New hire uploads I-9, W-4, direct deposit form
2. HR manager reviews and approves documents
3. All documents stored securely in employee folder
4. Accessible for future reference

### Certification Tracking
1. Employee uploads professional certification
2. Sets expiration date (e.g., CPR expires annually)
3. System shows "expiring soon" warning 30 days before
4. Manager receives notification to renew
5. Employee uploads renewed certification

### Performance Reviews
1. Manager uploads annual performance review
2. Stored in employee's performance folder
3. Employee can view their own reviews
4. Historical reviews accessible for reference

### Company Policies
1. Admin uploads employee handbook
2. Categorized as "Policy" document
3. All employees can view and download
4. Updates tracked with upload timestamps

### Tax Season
1. Employees download their W-2 forms
2. Previous years' tax documents accessible
3. W-4 updates uploaded when needed
4. All tax docs organized in tax_form category

## Database Schema

### Document Metadata
```
PK: ORG#{organizationId}#USER#{userId}  // or ORG#{orgId} for org-wide
SK: DOCUMENT#{documentId}
GSI1PK: ORG#{organizationId}#DOCUMENTS
GSI1SK: CATEGORY#{category}#{uploadedAt}

Attributes:
- documentId: UUID
- organizationId: string
- userId: string (optional)
- uploadedBy: string
- fileName: string
- fileSize: number
- fileType: string
- category: DocumentCategory
- s3Key: string
- s3Bucket: string
- description: string (optional)
- tags: string[] (optional)
- expirationDate: string (optional)
- status: 'pending' | 'approved' | 'rejected' | 'expired'
- approvedBy: string (optional)
- approvedAt: string (optional)
- uploadedAt: string
- lastAccessedAt: string (optional)
- metadata: object (optional)
```

## S3 Bucket Configuration

**Bucket Name**: From environment variable `BUCKET_NAME`

**Encryption**: Enabled (AES-256)

**Lifecycle Policy** (Recommended):
```json
{
  "Rules": [
    {
      "Id": "DeleteRejectedAfter30Days",
      "Filter": {
        "Tag": {
          "Key": "status",
          "Value": "rejected"
        }
      },
      "Status": "Enabled",
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
```

## Cost Considerations

### S3 Storage
- **Standard Storage**: $0.023/GB/month
- **Average Document**: 500KB = $0.012/year
- **1000 Documents**: ~$12/year

### S3 Requests
- **PUT (Upload)**: $0.005 per 1000 requests
- **GET (Download)**: $0.0004 per 1000 requests
- **Typical Cost**: <$1/month for normal usage

### Lambda Invocations
- **5 Document Functions**: 512MB each
- **Typical Cost**: $0.10-0.50/month

### DynamoDB
- **Metadata Storage**: Negligible (KB per document)
- **Reads/Writes**: Pay-per-request (minimal cost)

**Total Estimated Cost**: $1-2/month for typical small business

## Security Best Practices

1. **Access Control**:
   - Never expose S3 bucket publicly
   - Always use presigned URLs
   - Validate user permissions before generating URLs
   - Employees cannot access other employees' documents

2. **File Validation**:
   - Validate file type before upload
   - Enforce file size limits (10MB)
   - Sanitize filenames to prevent injection

3. **Audit Trail**:
   - Track who uploaded each document
   - Record approval/rejection with timestamp
   - Log all access (lastAccessedAt)

4. **Data Retention**:
   - Retain tax documents for 7 years (IRS requirement)
   - Retain I-9 forms for 3 years after hire or 1 year after termination
   - Set lifecycle policies for automatic deletion

## Future Enhancements

1. **Version Control**: Track document revisions and history
2. **E-Signatures**: Digital signature workflow for contracts
3. **OCR/Text Extraction**: Extract text from PDFs for search
4. **Document Templates**: Pre-built templates for common forms
5. **Bulk Upload**: Upload multiple documents at once
6. **Email Notifications**: Notify on approval, expiration, etc.
7. **Document Sharing**: Share documents with external parties
8. **Advanced Search**: Full-text search across document contents
9. **Folder Organization**: Custom folder structures
10. **Compliance Reporting**: Generate compliance reports for audits

## Troubleshooting

### Upload Fails
- Check file size (<10MB)
- Verify file type is allowed
- Ensure presigned URL hasn't expired (5 minutes)
- Check S3 bucket permissions

### Cannot View Document
- Verify user has permission (own document or manager)
- Check if download URL has expired (regenerate)
- Ensure document exists in S3

### Expiration Not Showing
- Verify expirationDate is in YYYY-MM-DD format
- Check that date is in the future
- Confirm status is not already "expired"

### Access Denied
- Employees can only view their own documents
- Managers can view all documents
- Check user role in auth token

## Compliance Notes

### HIPAA (if applicable)
- Encrypt all data at rest (S3 encryption enabled)
- Use HTTPS for all transfers (presigned URLs use HTTPS)
- Maintain audit logs (uploadedBy, lastAccessedAt)
- Implement access controls (role-based permissions)

### GDPR (if applicable)
- Allow users to download their documents (export data)
- Support document deletion (right to be forgotten)
- Track consent for document storage
- Provide data retention policies

### Employment Law
- I-9 forms: Retain for 3 years after hire or 1 year after termination
- Tax documents: Retain for 7 years (IRS requirement)
- Personnel files: Retain per state law (varies by state)

## Support

For additional help:
- Review CloudWatch logs for Lambda errors
- Check S3 bucket for uploaded files
- Verify DynamoDB entries for metadata
- Test presigned URLs for expiration issues
