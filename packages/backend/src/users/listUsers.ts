import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../utils/response';
import { queryItems } from '../utils/dynamodb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const claims = event.requestContext.authorizer?.claims;
    const orgId = claims?.['custom:orgId'];
    const userRole = claims?.['custom:role'];

    // Check permissions (managers and admins can list users)
    if (userRole !== 'MANAGER' && userRole !== 'ORG_ADMIN') {
      return successResponse({ users: [], total: 0 });
    }

    // Query users by organization
    const users = await queryItems(
      'GSI1PK = :pk',
      {
        ':pk': `ORG#${orgId}#USERS`,
      },
      'GSI1'
    );

    // Remove sensitive fields
    const sanitizedUsers = users.map((user: any) => {
      const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, ...profile } = user;
      return profile;
    });

    return successResponse({
      users: sanitizedUsers,
      total: sanitizedUsers.length,
    });
  } catch (error: any) {
    console.error('List users error:', error);
    return errorResponse(error);
  }
}
