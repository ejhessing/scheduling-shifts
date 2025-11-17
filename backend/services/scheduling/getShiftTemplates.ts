import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { successResponse, errorResponse } from '../../shared/response';
import { getUserFromToken } from '../../shared/auth';
import { ShiftTemplate, getDayName } from '../../shared/scheduling';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const user = getUserFromToken(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
    }

    // Get all shift templates for the organization
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `ORG#${user.organizationId}`,
          ':sk': 'TEMPLATE#',
        },
      })
    );

    const templates = (result.Items || []) as ShiftTemplate[];

    // Enhance templates with day names
    const enhancedTemplates = templates.map(t => ({
      ...t,
      daysOfWeekNames: t.daysOfWeek.map(d => getDayName(d)),
      daysSummary: t.daysOfWeek.map(d => getDayName(d).substring(0, 3)).join(', '),
    }));

    return successResponse({
      templates: enhancedTemplates,
      count: templates.length,
    });
  } catch (error) {
    console.error('Error getting shift templates:', error);
    return errorResponse(500, 'Failed to get shift templates');
  }
};
