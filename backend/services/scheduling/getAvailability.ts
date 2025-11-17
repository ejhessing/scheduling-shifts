import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { successResponse, errorResponse } from '../../shared/response';
import { getUserFromToken } from '../../shared/auth';
import { Availability, getDayName } from '../../shared/scheduling';

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

    // Get availabilities for the user
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'AVAILABILITY#',
        },
      })
    );

    const availabilities = (result.Items || []) as Availability[];

    // Sort by day of week
    availabilities.sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    // Group by day of week for easier frontend consumption
    const byDay: { [day: number]: Availability[] } = {};
    for (let i = 0; i <= 6; i++) {
      byDay[i] = availabilities.filter(a => a.dayOfWeek === i);
    }

    return successResponse({
      availabilities,
      byDay,
      summary: Object.entries(byDay).map(([day, avails]) => ({
        dayOfWeek: parseInt(day),
        dayName: getDayName(parseInt(day)),
        slots: avails.map(a => `${a.startTime}-${a.endTime}`),
      })),
    });
  } catch (error) {
    console.error('Error getting availability:', error);
    return errorResponse(500, 'Failed to get availability');
  }
};
