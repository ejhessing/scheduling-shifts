import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error, notFound, unauthorized } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';
import { now } from '../../shared/utils';
import { z } from 'zod';

const updateLocationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional(),
  geofenceRadius: z.number().min(10).max(1000).optional(),
  timezone: z.string().optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  settings: z.object({
    requirePhoto: z.boolean().optional(),
    allowManualEntry: z.boolean().optional(),
    requireNotes: z.boolean().optional(),
  }).optional(),
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Check authorization
    if (!['manager', 'admin', 'owner'].includes(currentUser.role)) {
      return unauthorized('Only managers and administrators can update locations');
    }

    // Get locationId from path
    const locationId = event.pathParameters?.locationId;
    if (!locationId) {
      return error('Location ID is required');
    }

    // Parse and validate request body
    const body = event.body ? JSON.parse(event.body) : {};
    const data = updateLocationSchema.parse(body);

    // Get existing location
    const existingLocation = await db.get(`ORG#${currentUser.orgId}`, `LOC#${locationId}`);

    if (!existingLocation) {
      return notFound('Location not found');
    }

    // Build updates
    const updates: Record<string, any> = {
      updatedAt: now(),
      updatedBy: currentUser.userId,
    };

    if (data.name !== undefined) updates.name = data.name;
    if (data.address !== undefined) updates.address = data.address;
    if (data.geofenceRadius !== undefined) updates.geofenceRadius = data.geofenceRadius;
    if (data.timezone !== undefined) updates.timezone = data.timezone;
    if (data.description !== undefined) updates.description = data.description;
    if (data.active !== undefined) updates.active = data.active;
    if (data.settings !== undefined) {
      updates.settings = {
        ...existingLocation.settings,
        ...data.settings,
      };
    }

    // Update location
    const updatedLocation = await db.update(`ORG#${currentUser.orgId}`, `LOC#${locationId}`, updates);

    return success({
      location: updatedLocation,
      message: 'Location updated successfully',
    });
  } catch (err: any) {
    console.error('Update location error:', err);
    if (err.name === 'ZodError') {
      return error('Invalid location data', 400);
    }
    return error(err.message || 'Failed to update location', 500);
  }
};
