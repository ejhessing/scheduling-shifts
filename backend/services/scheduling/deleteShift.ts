import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error, notFound, unauthorized } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Check authorization - only managers and above can delete shifts
    if (!['manager', 'admin', 'owner'].includes(currentUser.role)) {
      return unauthorized('Only managers and administrators can delete shifts');
    }

    // Get shiftId from path parameters
    const shiftId = event.pathParameters?.shiftId;

    if (!shiftId) {
      return error('Shift ID is required');
    }

    // Find the shift
    const dates = getDateRange(30, 90);
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

    // Verify shift belongs to same org
    if (shift.orgId !== currentUser.orgId) {
      return unauthorized('You do not have permission to delete this shift');
    }

    // Delete the shift
    await db.delete(shiftPK, shiftSK);

    return success({
      message: 'Shift deleted successfully',
      shiftId,
    });
  } catch (err: any) {
    console.error('Delete shift error:', err);
    return error(err.message || 'Failed to delete shift', 500);
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
