import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Get all locations for the organization
    const locations = await db.query(`ORG#${currentUser.orgId}`, { begins: 'LOC#' });

    // Filter active locations
    const activeLocations = locations.filter((loc) => loc.active !== false);

    return success({
      locations: activeLocations,
      count: activeLocations.length,
    });
  } catch (err: any) {
    console.error('Get locations error:', err);
    return error(err.message || 'Failed to get locations', 500);
  }
};
