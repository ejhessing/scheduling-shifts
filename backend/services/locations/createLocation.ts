import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error, validationError, unauthorized } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';
import { generateId, now } from '../../shared/utils';
import { z } from 'zod';

const createLocationSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string().default('US'),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  geofenceRadius: z.number().min(10).max(1000).default(100), // meters
  timezone: z.string().default('America/New_York'),
  description: z.string().optional(),
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Check authorization - only managers and above can create locations
    if (!['manager', 'admin', 'owner'].includes(currentUser.role)) {
      return unauthorized('Only managers and administrators can create locations');
    }

    // Parse and validate request body
    const body = event.body ? JSON.parse(event.body) : {};
    const data = createLocationSchema.parse(body);

    // Create location
    const locationId = generateId();
    const timestamp = now();

    const location = {
      PK: `ORG#${currentUser.orgId}`,
      SK: `LOC#${locationId}`,
      GSI1PK: `LOC#${locationId}`,
      GSI1SK: `LOC#${locationId}`,
      locationId,
      orgId: currentUser.orgId,
      name: data.name,
      address: data.address,
      geofenceRadius: data.geofenceRadius,
      timezone: data.timezone,
      description: data.description || '',
      settings: {
        requirePhoto: false,
        allowManualEntry: true,
        requireNotes: false,
      },
      active: true,
      createdBy: currentUser.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await db.put(location);

    return success({
      location,
      message: 'Location created successfully',
    }, 201);
  } catch (err: any) {
    console.error('Create location error:', err);
    if (err.name === 'ZodError') {
      return validationError('Invalid location data', err.errors);
    }
    return error(err.message || 'Failed to create location', 500);
  }
};
