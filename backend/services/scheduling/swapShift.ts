import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error, notFound, validationError } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';
import { validateBody, swapShiftSchema } from '../../shared/validators';
import { generateId, now } from '../../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Validate request body
    const body = validateBody(swapShiftSchema, event.body);

    // Find the shift to swap
    const dates = getDateRange(0, 90); // Only future shifts
    let shift: any = null;
    let shiftPK = '';
    let shiftSK = '';

    for (const date of dates) {
      const shifts = await db.query(`USER#${currentUser.userId}#SHIFTS`, {
        begins: `DATE#${date}`,
      }, 'GSI1');

      const found = shifts.find((s) => s.shiftId === body.shiftId);
      if (found) {
        shift = found;
        shiftPK = found.PK;
        shiftSK = found.SK;
        break;
      }
    }

    if (!shift) {
      return notFound('Shift not found');
    }

    // Verify shift belongs to current user
    if (shift.userId !== currentUser.userId) {
      return validationError('You can only swap your own shifts');
    }

    // Verify shift is not already completed or cancelled
    if (['completed', 'cancelled'].includes(shift.status)) {
      return validationError('Cannot swap a completed or cancelled shift');
    }

    // Get target user
    const targetUser = await db.get(`USER#${body.targetUserId}`, `PROFILE#${body.targetUserId}`);

    if (!targetUser) {
      return validationError('Target user not found');
    }

    // Verify target user is in same organization
    if (targetUser.orgId !== currentUser.orgId) {
      return validationError('Cannot swap shift with user from different organization');
    }

    // Check if target user has conflicting shifts
    const shiftDate = new Date(shift.startTime).toISOString().split('T')[0];
    const targetShifts = await db.query(`USER#${body.targetUserId}#SHIFTS`, {
      begins: `DATE#${shiftDate}`,
    }, 'GSI1');

    const conflicts = targetShifts.filter((targetShift) => {
      if (targetShift.status === 'cancelled') return false;

      const targetStart = new Date(targetShift.startTime).getTime();
      const targetEnd = new Date(targetShift.endTime).getTime();
      const shiftStart = new Date(shift.startTime).getTime();
      const shiftEnd = new Date(shift.endTime).getTime();

      // Check for overlap
      return (
        (shiftStart >= targetStart && shiftStart < targetEnd) ||
        (shiftEnd > targetStart && shiftEnd <= targetEnd) ||
        (shiftStart <= targetStart && shiftEnd >= targetEnd)
      );
    });

    if (conflicts.length > 0) {
      return validationError('Target user has conflicting shifts', {
        conflicts: conflicts.map((s) => ({
          shiftId: s.shiftId,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      });
    }

    // Create swap request
    const swapRequestId = generateId();
    const swapRequest = {
      PK: `SWAP#${swapRequestId}`,
      SK: `SWAP#${swapRequestId}`,
      GSI1PK: `USER#${body.targetUserId}#SWAPS`,
      GSI1SK: `PENDING#${now()}`,
      swapRequestId,
      shiftId: shift.shiftId,
      fromUserId: currentUser.userId,
      toUserId: body.targetUserId,
      orgId: currentUser.orgId,
      message: body.message || '',
      status: 'pending',
      shiftDetails: {
        locationId: shift.locationId,
        startTime: shift.startTime,
        endTime: shift.endTime,
        position: shift.position,
      },
      createdAt: now(),
      updatedAt: now(),
    };

    await db.put(swapRequest);

    // TODO: Send notification to target user

    return success({
      swapRequest,
      message: 'Shift swap request created successfully',
    }, 201);
  } catch (err: any) {
    console.error('Swap shift error:', err);
    return error(err.message || 'Failed to create shift swap request', 500);
  }
};

// Helper to get date range
function getDateRange(daysBack: number, daysForward: number): string[] {
  const dates: string[] = [];
  const today = new Date();

  for (let i = -daysBack; i <= daysForward; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
}
