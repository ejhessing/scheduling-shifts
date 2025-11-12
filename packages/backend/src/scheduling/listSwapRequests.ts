import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../utils/response';
import { queryItems } from '../utils/dynamodb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const claims = event.requestContext.authorizer?.claims;
    const userId = claims?.['custom:userId'] || claims?.sub;
    const userRole = claims?.['custom:role'];

    const type = event.queryStringParameters?.type || 'received'; // 'received', 'sent', 'pending_approval'

    let swapRequests: any[] = [];

    if (type === 'received') {
      // Get swap requests where user is the target
      swapRequests = await queryItems(
        'GSI2PK = :pk',
        {
          ':pk': `USER#${userId}#SWAP_REQUESTS`,
        },
        'GSI2'
      );
    } else if (type === 'sent') {
      // Get swap requests initiated by user
      swapRequests = await queryItems(
        'GSI1PK = :pk',
        {
          ':pk': `USER#${userId}#SWAPS`,
        },
        'GSI1'
      );
    } else if (type === 'pending_approval' && (userRole === 'MANAGER' || userRole === 'ORG_ADMIN')) {
      // Get all swaps pending manager approval
      const orgId = claims?.['custom:orgId'];
      // TODO: Add GSI3 for org-wide swap queries
      // For now, return empty array
      swapRequests = [];
    }

    // Remove internal DynamoDB fields
    const sanitized = swapRequests.map((swap: any) => {
      const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, ...rest } = swap;
      return rest;
    });

    return successResponse({
      swapRequests: sanitized,
      total: sanitized.length,
      type,
    });
  } catch (error: any) {
    console.error('List swap requests error:', error);
    return errorResponse(error);
  }
}
