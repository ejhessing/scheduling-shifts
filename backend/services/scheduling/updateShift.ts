import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error, notFound, unauthorized } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';
import { validateBody, updateShiftSchema } from '../../shared/validators';
import { now } from '../../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Get shiftId from path parameters
    const shiftId = event.pathParameters?.shiftId;

    if (!shiftId) {
      return error('Shift ID is required');
    }

    // Validate request body
    const body = validateBody(updateShiftSchema, event.body);

    // Find the shift (search recent and future dates)
    const dates = getDateRange(30, 90); // 30 days back, 90 days forward
    let shift: any = null;
    let shiftPK = '';
    let shiftSK = '';

    for (const date of dates) {
      const shifts = await db.queryGSI2(`ORG#${currentUser.orgId}#SHIFTS`, {
        begins: `DATE#${date}`,
      });

      const found = shifts.find((s) => s.shiftId === shiftId);
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

    // Check authorization
    const isManager = ['manager', 'admin', 'owner'].includes(currentUser.role);
    const isOwnShift = shift.userId === currentUser.userId;

    if (!isManager && !isOwnShift) {
      return unauthorized('You do not have permission to update this shift');
    }

    // Employees can only confirm/reject their own shifts
    if (!isManager && body.status && !['confirmed', 'cancelled'].includes(body.status)) {
      return unauthorized('You can only confirm or cancel your own shifts');
    }

    // Build updates
    const updates: Record<string, any> = {
      updatedAt: now(),
      updatedBy: currentUser.userId,
    };

    if (body.startTime) updates.startTime = body.startTime;
    if (body.endTime) updates.endTime = body.endTime;
    if (body.position) updates.position = body.position;
    if (body.notes) updates.notes = body.notes;
    if (body.status) updates.status = body.status;
    if (body.payRate !== undefined) updates.payRate = body.payRate;

    // Validate times if updated
    if (body.startTime || body.endTime) {
      const startTime = body.startTime || shift.startTime;
      const endTime = body.endTime || shift.endTime;

      if (new Date(startTime) >= new Date(endTime)) {
        return error('Start time must be before end time', 400);
      }
    }

    // Update shift
    const updatedShift = await db.update(shiftPK, shiftSK, updates);

    return success({
      shift: updatedShift,
      message: 'Shift updated successfully',
    });
  } catch (err: any) {
    console.error('Update shift error:', err);
    return error(err.message || 'Failed to update shift', 500);
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
