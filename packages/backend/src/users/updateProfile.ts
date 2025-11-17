import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, validationErrorResponse, errorResponse, forbiddenResponse } from '../utils/response';
import { updateItem } from '../utils/dynamodb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const claims = event.requestContext.authorizer?.claims;
    const authenticatedUserId = claims?.['custom:userId'] || claims?.sub;
    const userRole = claims?.['custom:role'];

    const userId = event.pathParameters?.userId;

    if (!userId) {
      return validationErrorResponse('User ID is required');
    }

    // Check if user is updating their own profile or has admin rights
    if (userId !== authenticatedUserId && userRole !== 'ORG_ADMIN') {
      return forbiddenResponse('You can only update your own profile');
    }

    const body = JSON.parse(event.body || '{}');

    // Build update object
    const updates: any = {
      updatedAt: new Date().toISOString(),
    };

    // Allow specific fields to be updated
    if (body.name) updates.name = body.name;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.preferences) updates.preferences = body.preferences;
    if (body.skills) updates.skills = body.skills;

    // Only admins can update role and locationIds
    if (userRole === 'ORG_ADMIN') {
      if (body.role) updates.role = body.role;
      if (body.locationIds) updates.locationIds = body.locationIds;
    }

    // Update the profile
    await updateItem(`USER#${userId}`, `PROFILE#${userId}`, updates);

    return successResponse({
      message: 'Profile updated successfully',
      userId,
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return errorResponse(error);
  }
}
