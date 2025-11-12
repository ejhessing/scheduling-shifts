import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { successResponse, errorResponse } from '../../shared/response';
import { getUserFromToken } from '../../shared/auth';
import { TimeOffRequest } from '../../shared/timeOff';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const user = getUserFromToken(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
    }

    // Only managers, admins, and owners can review time-off requests
    if (!['manager', 'admin', 'owner'].includes(user.role)) {
      return errorResponse(403, 'Only managers can review time-off requests');
    }

    const requestId = event.pathParameters?.requestId;
    const body = JSON.parse(event.body || '{}');
    const { action, notes } = body; // action: 'approve' or 'reject'

    if (!requestId || !action) {
      return errorResponse(400, 'Missing required fields: requestId, action');
    }

    if (!['approve', 'reject'].includes(action)) {
      return errorResponse(400, 'Invalid action. Must be "approve" or "reject"');
    }

    // Get the time-off request
    // First, we need to find it by requestId across all users
    // Query GSI1 for the request
    const requestResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :orgId',
        FilterExpression: 'requestId = :requestId',
        ExpressionAttributeValues: {
          ':orgId': `ORG#${user.organizationId}`,
          ':requestId': requestId,
        },
      })
    );

    if (!requestResult.Items || requestResult.Items.length === 0) {
      return errorResponse(404, 'Time-off request not found');
    }

    const request = requestResult.Items[0] as TimeOffRequest & { PK: string; SK: string };

    if (request.status !== 'pending') {
      return errorResponse(400, `Request is already ${request.status}`);
    }

    // Update the request status
    const now = new Date().toISOString();
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: request.PK,
          SK: request.SK,
        },
        UpdateExpression: 'SET #status = :status, reviewedBy = :reviewedBy, reviewedAt = :reviewedAt, reviewNotes = :notes, GSI1SK = :gsi1sk',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': newStatus,
          ':reviewedBy': user.userId,
          ':reviewedAt': now,
          ':notes': notes || '',
          ':gsi1sk': `TIMEOFF#${newStatus}#${request.startDate}`,
        },
      })
    );

    // TODO: Send notification to employee
    // await publishNotification('time_off_reviewed', {
    //   userId: request.userId,
    //   requestId,
    //   status: newStatus
    // });

    return successResponse({
      message: `Time-off request ${action}d successfully`,
      requestId,
      status: newStatus,
    });
  } catch (error) {
    console.error('Error reviewing time off:', error);
    return errorResponse(500, 'Failed to review time-off request');
  }
};
