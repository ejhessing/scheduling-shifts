import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error, notFound, unauthorized } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Get userId from path parameters
    const userId = event.pathParameters?.userId;

    if (!userId) {
      return error('User ID is required');
    }

    // Get user profile
    const user = await db.get(`USER#${userId}`, `PROFILE#${userId}`);

    if (!user) {
      return notFound('User not found');
    }

    // Check authorization: users can only view their own profile or profiles in their org
    if (user.orgId !== currentUser.orgId) {
      return unauthorized('You do not have permission to view this user');
    }

    // Remove sensitive data
    const { password: _, ...userWithoutPassword } = user;

    return success(userWithoutPassword);
  } catch (err: any) {
    console.error('Get profile error:', err);
    return error(err.message || 'Failed to get user profile', 500);
  }
};
