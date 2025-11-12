import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error, notFound, unauthorized } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Check authorization - only admins and owners can delete locations
    if (!['admin', 'owner'].includes(currentUser.role)) {
      return unauthorized('Only administrators and owners can delete locations');
    }

    // Get locationId from path
    const locationId = event.pathParameters?.locationId;
    if (!locationId) {
      return error('Location ID is required');
    }

    // Get existing location
    const existingLocation = await db.get(`ORG#${currentUser.orgId}`, `LOC#${locationId}`);

    if (!existingLocation) {
      return notFound('Location not found');
    }

    // Soft delete by marking as inactive (safer than hard delete)
    await db.update(`ORG#${currentUser.orgId}`, `LOC#${locationId}`, {
      active: false,
      deletedBy: currentUser.userId,
      deletedAt: new Date().toISOString(),
    });

    return success({
      message: 'Location deleted successfully',
      locationId,
    });
  } catch (err: any) {
    console.error('Delete location error:', err);
    return error(err.message || 'Failed to delete location', 500);
  }
};
