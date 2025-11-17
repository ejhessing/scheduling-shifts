import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { successResponse, errorResponse } from '../../shared/response';
import { getUserFromToken } from '../../shared/auth';
import {
  TimeOffRequest,
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

    const queryParams = event.queryStringParameters || {};
    const userId = queryParams.userId || user.userId;

    // Managers can view any user's balance, employees can only view their own
    if (userId !== user.userId && !['manager', 'admin', 'owner'].includes(user.role)) {
      return errorResponse(403, 'You can only view your own time-off balance');
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
          PK: `USER#${userId}`,
          SK: 'PROFILE',
        },
      })
    );

    if (!userResult.Item) {
      return errorResponse(404, 'User not found');
    }

    const hireDate = userResult.Item.hireDate || new Date().toISOString().split('T')[0];

    // Get all time-off requests for this user
    const requestsResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'TIMEOFF#',
        },
      })
    );

    const allRequests = (requestsResult.Items || []) as TimeOffRequest[];
    const approvedRequests = allRequests.filter(r => r.status === 'approved');
    const pendingRequests = allRequests.filter(r => r.status === 'pending');

    // Calculate current balance
    const balance = calculateTimeOffBalance(
      hireDate,
      new Date().toISOString().split('T')[0],
      policy,
      approvedRequests,
      pendingRequests
    );

    // Add user info to response
    balance.userId = userId;

    // Get upcoming time-off (next 90 days)
    const today = new Date();
    const ninetyDaysFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
    const upcomingTimeOff = approvedRequests.filter(r => {
      const startDate = new Date(r.startDate);
      return startDate >= today && startDate <= ninetyDaysFromNow;
    }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    return successResponse({
      balance,
      policy: {
        vacationDaysPerYear: policy.vacationDaysPerYear,
        sickDaysPerYear: policy.sickDaysPerYear,
        personalDaysPerYear: policy.personalDaysPerYear,
        carryoverLimit: policy.carryoverLimit,
        minRequestNotice: policy.minRequestNotice,
        maxConsecutiveDays: policy.maxConsecutiveDays,
      },
      upcomingTimeOff,
    });
  } catch (error) {
    console.error('Error getting time-off balance:', error);
    return errorResponse(500, 'Failed to get time-off balance');
  }
};
