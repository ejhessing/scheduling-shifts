import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { successResponse, errorResponse } from '../../shared/response';
import { getUserFromToken } from '../../shared/auth';
import { v4 as uuidv4 } from 'uuid';
import { ShiftTemplate } from '../../shared/scheduling';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const user = getUserFromToken(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
    }

    // Only managers and above can create shift templates
    if (!['manager', 'admin', 'owner'].includes(user.role)) {
      return errorResponse(403, 'Only managers can create shift templates');
    }

    const body = JSON.parse(event.body || '{}');
    const { name, description, locationId, position, startTime, endTime, daysOfWeek, color } = body;

    // Validate required fields
    if (!name || !locationId || !startTime || !endTime || !daysOfWeek || !Array.isArray(daysOfWeek)) {
      return errorResponse(400, 'Missing required fields: name, locationId, startTime, endTime, daysOfWeek');
    }

    // Validate daysOfWeek array
    if (!daysOfWeek.every((day: any) => typeof day === 'number' && day >= 0 && day <= 6)) {
      return errorResponse(400, 'daysOfWeek must be an array of numbers 0-6 (Sunday-Saturday)');
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return errorResponse(400, 'startTime and endTime must be in HH:mm format');
    }

    const templateId = uuidv4();
    const now = new Date().toISOString();

    const template: ShiftTemplate = {
      templateId,
      organizationId: user.organizationId,
      name,
      description,
      locationId,
      position,
      startTime,
      endTime,
      daysOfWeek,
      color: color || '#3B82F6',
      createdBy: user.userId,
      createdAt: now,
    };

    // Store in DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `ORG#${user.organizationId}`,
          SK: `TEMPLATE#${templateId}`,
          GSI1PK: `ORG#${user.organizationId}`,
          GSI1SK: `TEMPLATE#${name}`,
          ...template,
        },
      })
    );

    return successResponse({
      template,
      message: 'Shift template created successfully',
    });
  } catch (error) {
    console.error('Error creating shift template:', error);
    return errorResponse(500, 'Failed to create shift template');
  }
};
