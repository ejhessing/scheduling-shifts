import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { deleteItem } from '../utils/dynamodb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const connectionId = event.requestContext.connectionId!;

    // Remove connection from DynamoDB
    await deleteItem(`CONNECTION#${connectionId}`, `CONNECTION#${connectionId}`);

    return { statusCode: 200, body: 'Disconnected' };
  } catch (error: any) {
    console.error('WebSocket disconnect error:', error);
    return { statusCode: 500, body: 'Failed to disconnect' };
  }
}
