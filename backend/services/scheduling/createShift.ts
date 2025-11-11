import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error, validationError, unauthorized } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';
import { validateBody, createShiftSchema } from '../../shared/validators';
import { generateId, now } from '../../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Check authorization - only managers and above can create shifts
    if (!['manager', 'admin', 'owner'].includes(currentUser.role)) {
      return unauthorized('Only managers and administrators can create shifts');
    }

    // Validate request body
    const body = validateBody(createShiftSchema, event.body);

    // Validate that start time is before end time
    if (new Date(body.startTime) >= new Date(body.endTime)) {
      return validationError('Start time must be before end time');
    }

    // Get the user this shift is for
    const user = await db.get(`USER#${body.userId}`, `PROFILE#${body.userId}`);

    if (!user) {
      return validationError('User not found');
    }

    // Verify user is in the same organization
    if (user.orgId !== currentUser.orgId) {
      return unauthorized('Cannot create shift for user in different organization');
    }

    // Get location
    const location = await db.get(`LOC#${body.locationId}`, `LOC#${body.locationId}`);

    if (!location) {
      return validationError('Location not found');
    }

    // Check for conflicting shifts (same user, overlapping times)
    const shiftDate = new Date(body.startTime).toISOString().split('T')[0];
    const existingShifts = await db.query(`LOC#${body.locationId}#DATE#${shiftDate}`);

    const conflicts = existingShifts.filter((shift) => {
      if (shift.userId !== body.userId) return false;
      if (shift.status === 'cancelled') return false;

      const existingStart = new Date(shift.startTime).getTime();
      const existingEnd = new Date(shift.endTime).getTime();
      const newStart = new Date(body.startTime).getTime();
      const newEnd = new Date(body.endTime).getTime();

      // Check for overlap
      return (
        (newStart >= existingStart && newStart < existingEnd) ||
        (newEnd > existingStart && newEnd <= existingEnd) ||
        (newStart <= existingStart && newEnd >= existingEnd)
      );
    });

    if (conflicts.length > 0) {
      return validationError('This shift conflicts with an existing shift', {
        conflicts: conflicts.map((s) => ({
          shiftId: s.shiftId,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      });
    }

    // Create shift
    const shiftId = generateId();
    const timestamp = now();

    const shift = {
      PK: `LOC#${body.locationId}#DATE#${shiftDate}`,
      SK: `SHIFT#${shiftId}`,
      GSI1PK: `USER#${body.userId}#SHIFTS`,
      GSI1SK: `DATE#${shiftDate}#${timestamp}`,
      GSI2PK: `ORG#${currentUser.orgId}#SHIFTS`,
      GSI2SK: `DATE#${shiftDate}#${timestamp}`,
      shiftId,
      userId: body.userId,
      locationId: body.locationId,
      orgId: currentUser.orgId,
      startTime: body.startTime,
      endTime: body.endTime,
      position: body.position || '',
      notes: body.notes || '',
      status: 'scheduled',
      breakRules: body.breakRules || [],
      payRate: body.payRate || user.defaultPayRate || 0,
      createdBy: currentUser.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await db.put(shift);

    // TODO: Send notification to user about new shift

    return success({
      shift,
      message: 'Shift created successfully',
    }, 201);
  } catch (err: any) {
    console.error('Create shift error:', err);
    return error(err.message || 'Failed to create shift', 500);
  }
};
