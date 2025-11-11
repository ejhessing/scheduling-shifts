import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error, notFound, unauthorized } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';
import { validateBody, updateProfileSchema } from '../../shared/validators';
import { now } from '../../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Get userId from path parameters
    const userId = event.pathParameters?.userId;

    if (!userId) {
      return error('User ID is required');
    }

    // Check authorization: users can only update their own profile or if they're a manager/admin
    if (userId !== currentUser.userId && !['manager', 'admin', 'owner'].includes(currentUser.role)) {
      return unauthorized('You do not have permission to update this user');
    }

    // Validate request body
    const body = validateBody(updateProfileSchema, event.body);

    // Get existing user
    const existingUser = await db.get(`USER#${userId}`, `PROFILE#${userId}`);

    if (!existingUser) {
      return notFound('User not found');
    }

    // Check if user is in the same organization
    if (existingUser.orgId !== currentUser.orgId) {
      return unauthorized('You do not have permission to update this user');
    }

    // Build update object
    const updates: Record<string, any> = {
      updatedAt: now(),
    };

    if (body.name !== undefined) updates.name = body.name;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.preferences !== undefined) updates.preferences = body.preferences;
    if (body.skills !== undefined) updates.skills = body.skills;

    // Update user
    const updatedUser = await db.update(`USER#${userId}`, `PROFILE#${userId}`, updates);

    // Remove sensitive data
    const { password: _, ...userWithoutPassword } = updatedUser;

    return success(userWithoutPassword);
  } catch (err: any) {
    console.error('Update profile error:', err);
    return error(err.message || 'Failed to update user profile', 500);
  }
};
