import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { successResponse, errorResponse } from '../../shared/response';
import { getUserFromToken } from '../../shared/auth';
import { v4 as uuidv4 } from 'uuid';
import { Availability } from '../../shared/scheduling';

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
    const { userId, availabilities } = body;

    // Managers can set availability for others, employees can only set their own
    const targetUserId = userId || user.userId;

    if (targetUserId !== user.userId && !['manager', 'admin', 'owner'].includes(user.role)) {
      return errorResponse(403, 'You can only set your own availability');
    }

    // Validate availabilities array
    if (!Array.isArray(availabilities)) {
      return errorResponse(400, 'availabilities must be an array');
    }

    // Delete existing availabilities for this user
    const existingResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${targetUserId}`,
          ':sk': 'AVAILABILITY#',
        },
      })
    );

    // Delete old availabilities
    if (existingResult.Items && existingResult.Items.length > 0) {
      await Promise.all(
        existingResult.Items.map(item =>
          docClient.send(
            new DeleteCommand({
              TableName: TABLE_NAME,
              Key: {
                PK: item.PK,
                SK: item.SK,
              },
            })
          )
        )
      );
    }

    // Create new availabilities
    const createdAvailabilities: Availability[] = [];
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    for (const avail of availabilities) {
      const { dayOfWeek, startTime, endTime, effectiveDate, expiryDate, notes } = avail;

      // Validate required fields
      if (
        typeof dayOfWeek !== 'number' ||
        dayOfWeek < 0 ||
        dayOfWeek > 6 ||
        !startTime ||
        !endTime
      ) {
        return errorResponse(400, 'Each availability must have dayOfWeek (0-6), startTime, and endTime');
      }

      // Validate time format
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return errorResponse(400, 'Times must be in HH:mm format');
      }

      const availabilityId = uuidv4();

      const availability: Availability = {
        availabilityId,
        userId: targetUserId,
        organizationId: user.organizationId,
        dayOfWeek,
        startTime,
        endTime,
        effectiveDate: effectiveDate || new Date().toISOString().split('T')[0],
        expiryDate,
        isRecurring: true,
        notes,
      };

      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `USER#${targetUserId}`,
            SK: `AVAILABILITY#${availabilityId}`,
            GSI1PK: `ORG#${user.organizationId}`,
            GSI1SK: `AVAILABILITY#${targetUserId}#${dayOfWeek}`,
            ...availability,
          },
        })
      );

      createdAvailabilities.push(availability);
    }

    return successResponse({
      availabilities: createdAvailabilities,
      message: `Updated availability for user ${targetUserId}`,
    });
  } catch (error) {
    console.error('Error setting availability:', error);
    return errorResponse(500, 'Failed to set availability');
  }
};
