import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { v4 as uuidv4 } from 'uuid';
import { putItem, queryItems } from '../utils/dynamodb';

const apiGatewayClient = new ApiGatewayManagementApiClient({
  endpoint: process.env.WEBSOCKET_API_ENDPOINT,
});

interface SendMessageBody {
  channelId: string;
  content: string;
  attachments?: any[];
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const connectionId = event.requestContext.connectionId!;
    const body: SendMessageBody = JSON.parse(event.body || '{}');
    const { channelId, content, attachments = [] } = body;

    // Get sender info from connection
    // In production, you'd get this from the connection record
    const senderId = 'user-id-from-connection'; // TODO: Get from connection
    const orgId = 'org-id-from-connection'; // TODO: Get from connection

    const messageId = uuidv4();
    const now = new Date().toISOString();

    // Store message in DynamoDB
    const message = {
      PK: `ORG#${orgId}#CHANNEL#${channelId}`,
      SK: `MSG#${now}#${messageId}`,
      GSI1PK: `USER#${senderId}#MESSAGES`,
      GSI1SK: `CHANNEL#${channelId}#${now}`,
      messageId,
      senderId,
      channelId,
      orgId,
      content,
      attachments,
      readBy: [senderId],
      timestamp: now,
    };

    await putItem(message);

    // Get all connections for the channel (users in the channel)
    // TODO: Query connections for channel members
    const channelMemberConnections: any[] = []; // Placeholder

    // Send message to all connected users in the channel
    const sendPromises = channelMemberConnections.map(async (conn) => {
      try {
        await apiGatewayClient.send(
          new PostToConnectionCommand({
            ConnectionId: conn.connectionId,
            Data: Buffer.from(JSON.stringify({
              type: 'message',
              data: message,
            })),
          })
        );
      } catch (error: any) {
        if (error.statusCode === 410) {
          // Connection is stale, remove it
          console.log(`Removing stale connection: ${conn.connectionId}`);
          // TODO: Delete stale connection
        } else {
          console.error(`Failed to send to ${conn.connectionId}:`, error);
        }
      }
    });

    await Promise.all(sendPromises);

    return { statusCode: 200, body: JSON.stringify({ messageId }) };
  } catch (error: any) {
    console.error('WebSocket send message error:', error);
    return { statusCode: 500, body: 'Failed to send message' };
  }
}
