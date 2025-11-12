import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
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

    const queryParams = event.queryStringParameters || {};
    const userId = queryParams.userId;
    const status = queryParams.status; // 'pending', 'approved', 'rejected', 'cancelled'
    const startDate = queryParams.startDate;
    const endDate = queryParams.endDate;

    // If userId is specified, return that user's requests
    // Otherwise, if user is manager/admin/owner, return all org requests
    // Otherwise, return current user's requests
    let requests: TimeOffRequest[] = [];

    if (userId) {
      // Get specific user's requests (managers can see any user, employees can only see their own)
      if (userId !== user.userId && !['manager', 'admin', 'owner'].includes(user.role)) {
        return errorResponse(403, 'You can only view your own time-off requests');
      }

      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk': 'TIMEOFF#',
          },
        })
      );

      requests = (result.Items || []) as TimeOffRequest[];
    } else if (['manager', 'admin', 'owner'].includes(user.role)) {
      // Get all org requests for managers
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :orgId AND begins_with(GSI1SK, :sk)',
          ExpressionAttributeValues: {
            ':orgId': `ORG#${user.organizationId}`,
            ':sk': status ? `TIMEOFF#${status}` : 'TIMEOFF#',
          },
        })
      );

      requests = (result.Items || []) as TimeOffRequest[];
    } else {
      // Get current user's requests
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `USER#${user.userId}`,
            ':sk': 'TIMEOFF#',
          },
        })
      );

      requests = (result.Items || []) as TimeOffRequest[];
    }

    // Filter by status if specified and not already filtered in query
    if (status && !['manager', 'admin', 'owner'].includes(user.role)) {
      requests = requests.filter(r => r.status === status);
    }

    // Filter by date range if specified
    if (startDate) {
      requests = requests.filter(r => r.startDate >= startDate);
    }
    if (endDate) {
      requests = requests.filter(r => r.endDate <= endDate);
    }

    // Sort by start date (most recent first)
    requests.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    // For managers, also get user details for each request
    if (['manager', 'admin', 'owner'].includes(user.role)) {
      // Get unique user IDs
      const userIds = [...new Set(requests.map(r => r.userId))];

      // Fetch user profiles in parallel
      const userProfiles = await Promise.all(
        userIds.map(async (userId) => {
          const result = await docClient.send(
            new QueryCommand({
              TableName: TABLE_NAME,
              KeyConditionExpression: 'PK = :pk AND SK = :sk',
              ExpressionAttributeValues: {
                ':pk': `USER#${userId}`,
                ':sk': 'PROFILE',
              },
            })
          );
          return { userId, profile: result.Items?.[0] };
        })
      );

      const userMap = new Map(userProfiles.map(u => [u.userId, u.profile]));

      // Enhance requests with user info
      requests = requests.map(r => ({
        ...r,
        userName: userMap.get(r.userId)?.firstName + ' ' + userMap.get(r.userId)?.lastName,
        userEmail: userMap.get(r.userId)?.email,
      }));
    }

    return successResponse({
      requests,
      count: requests.length,
    });
  } catch (error) {
    console.error('Error getting time-off requests:', error);
    return errorResponse(500, 'Failed to get time-off requests');
  }
};
