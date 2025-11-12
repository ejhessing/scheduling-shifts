import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { successResponse, errorResponse } from '../../shared/response';
import { getUserFromToken } from '../../shared/auth';
import { v4 as uuidv4 } from 'uuid';
import {
  TimeOffRequest,
  TimeOffType,
  calculateBusinessDays,
  validateTimeOffRequest,
  calculateTimeOffBalance,
  DEFAULT_TIME_OFF_POLICY,
} from '../../shared/timeOff';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const user = getUserFromToken(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
    }

    const body = JSON.parse(event.body || '{}');
    const { type, startDate, endDate, reason } = body;

    // Validate required fields
    if (!type || !startDate || !endDate) {
      return errorResponse(400, 'Missing required fields: type, startDate, endDate');
    }

    if (!['vacation', 'sick', 'personal', 'unpaid', 'other'].includes(type)) {
      return errorResponse(400, 'Invalid time-off type');
    }

    // Calculate business days
    const totalDays = calculateBusinessDays(startDate, endDate);

    if (totalDays <= 0) {
      return errorResponse(400, 'Invalid date range');
    }

    // Get organization's time-off policy
    const policyResult = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `ORG#${user.organizationId}`,
          SK: 'POLICY#TIMEOFF',
        },
      })
    );

    const policy = policyResult.Item
      ? { ...DEFAULT_TIME_OFF_POLICY, ...policyResult.Item.policy }
      : { ...DEFAULT_TIME_OFF_POLICY, organizationId: user.organizationId };

    // Get user's profile for hire date
    const userResult = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${user.userId}`,
          SK: 'PROFILE',
        },
      })
    );

    if (!userResult.Item) {
      return errorResponse(404, 'User profile not found');
    }

    const hireDate = userResult.Item.hireDate || new Date().toISOString().split('T')[0];

    // Get all existing time-off requests for this user
    const existingResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${user.userId}`,
          ':sk': 'TIMEOFF#',
        },
      })
    );

    const existingRequests = (existingResult.Items || []) as TimeOffRequest[];
    const approvedRequests = existingRequests.filter(r => r.status === 'approved');
    const pendingRequests = existingRequests.filter(r => r.status === 'pending');

    // Calculate current balance
    const balance = calculateTimeOffBalance(
      hireDate,
      new Date().toISOString().split('T')[0],
      policy,
      approvedRequests,
      pendingRequests
    );

    // Validate the request
    const validation = validateTimeOffRequest(
      { type, startDate, endDate, totalDays },
      policy,
      balance,
      existingRequests
    );

    if (!validation.valid) {
      return errorResponse(400, validation.errors.join('; '));
    }

    // Create the time-off request
    const requestId = uuidv4();
    const now = new Date().toISOString();

    const timeOffRequest: TimeOffRequest = {
      requestId,
      userId: user.userId,
      organizationId: user.organizationId,
      type: type as TimeOffType,
      startDate,
      endDate,
      totalDays,
      reason,
      status: 'pending',
      requestedAt: now,
    };

    // Store in DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `USER#${user.userId}`,
          SK: `TIMEOFF#${requestId}`,
          GSI1PK: `ORG#${user.organizationId}`,
          GSI1SK: `TIMEOFF#pending#${startDate}`,
          ...timeOffRequest,
        },
      })
    );

    // TODO: Send notification to manager
    // await publishNotification('time_off_requested', { userId: user.userId, requestId });

    return successResponse({
      request: timeOffRequest,
      balance,
    });
  } catch (error) {
    console.error('Error requesting time off:', error);
    return errorResponse(500, 'Failed to request time off');
  }
};
