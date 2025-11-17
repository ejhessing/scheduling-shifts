import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { successResponse, errorResponse } from '../../shared/response';
import { getUserFromToken } from '../../shared/auth';
import { detectScheduleConflicts } from '../../shared/scheduling';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const user = getUserFromToken(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
    }

    // Only managers can check schedule conflicts
    if (!['manager', 'admin', 'owner'].includes(user.role)) {
      return errorResponse(403, 'Only managers can check schedule conflicts');
    }

    const queryParams = event.queryStringParameters || {};
    const startDate = queryParams.startDate;
    const endDate = queryParams.endDate;

    if (!startDate || !endDate) {
      return errorResponse(400, 'Missing required parameters: startDate, endDate');
    }

    // Get all shifts in date range
    const shiftsResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :orgId AND GSI1SK BETWEEN :start AND :end',
        ExpressionAttributeValues: {
          ':orgId': `ORG#${user.organizationId}`,
          ':start': `SHIFT#${startDate}`,
          ':end': `SHIFT#${endDate}#ZZZZ`,
        },
      })
    );

    const shifts = (shiftsResult.Items || []).map((item: any) => ({
      shiftId: item.shiftId,
      userId: item.userId,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      locationId: item.locationId,
    }));

    // Get all employee availabilities
    const availabilitiesResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :orgId AND begins_with(GSI1SK, :sk)',
        ExpressionAttributeValues: {
          ':orgId': `ORG#${user.organizationId}`,
          ':sk': 'AVAILABILITY#',
        },
      })
    );

    const availabilities = availabilitiesResult.Items || [];

    // Get approved time-off requests in date range
    const timeOffResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :orgId AND begins_with(GSI1SK, :sk)',
        ExpressionAttributeValues: {
          ':orgId': `ORG#${user.organizationId}`,
          ':sk': 'TIMEOFF#approved',
        },
      })
    );

    const timeOffRequests = (timeOffResult.Items || []).filter((item: any) => {
      // Filter to only include time-off that overlaps with our date range
      return item.startDate <= endDate && item.endDate >= startDate;
    });

    // Detect conflicts
    const conflicts = detectScheduleConflicts(
      shifts,
      availabilities,
      timeOffRequests,
      [] // No existing shifts to compare against (we're checking the entire set)
    );

    // Group conflicts by severity
    const errors = conflicts.filter(c => c.severity === 'error');
    const warnings = conflicts.filter(c => c.severity === 'warning');

    return successResponse({
      conflicts,
      summary: {
        total: conflicts.length,
        errors: errors.length,
        warnings: warnings.length,
        shiftsChecked: shifts.length,
      },
      details: {
        doubleBookings: conflicts.filter(c => c.type === 'double_booking').length,
        timeOffConflicts: conflicts.filter(c => c.type === 'time_off').length,
        availabilityConflicts: conflicts.filter(c => c.type === 'unavailable').length,
        restPeriodWarnings: conflicts.filter(c => c.type === 'insufficient_rest').length,
      },
    });
  } catch (error) {
    console.error('Error checking schedule conflicts:', error);
    return errorResponse(500, 'Failed to check schedule conflicts');
  }
};
