import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { putItem } from '../utils/dynamodb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const connectionId = event.requestContext.connectionId!;
    const userId = event.queryStringParameters?.userId;

    if (!userId) {
      return { statusCode: 400, body: 'Missing userId' };
    }

    const now = new Date().toISOString();

    // Store connection in DynamoDB
    await putItem({
      PK: `CONNECTION#${connectionId}`,
      SK: `CONNECTION#${connectionId}`,
      GSI1PK: `USER#${userId}#CONNECTIONS`,
      GSI1SK: `CONNECTION#${connectionId}`,
      connectionId,
      userId,
      connectedAt: now,
      lastPingAt: now,
      deviceInfo: {
        userAgent: event.requestContext.identity?.userAgent || '',
        sourceIp: event.requestContext.identity?.sourceIp || '',
      },
    });

    return { statusCode: 200, body: 'Connected' };
  } catch (error: any) {
    console.error('WebSocket connect error:', error);
    return { statusCode: 500, body: 'Failed to connect' };
  }
}
