import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error, validationError, unauthorized } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';
import { now } from '../../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Check authorization - only managers and above can approve
    if (!['manager', 'admin', 'owner'].includes(currentUser.role)) {
      return unauthorized('Only managers and administrators can approve time entries');
    }

    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};
    const { entryIds, action } = body; // action: 'approve' or 'reject'

    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return validationError('Entry IDs are required');
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return validationError('Valid action is required (approve or reject)');
    }

    const results = {
      success: [] as string[],
      failed: [] as Array<{ entryId: string; reason: string }>,
    };

    // Process each entry
    for (const entryId of entryIds) {
      try {
        // Find the entry (search recent dates)
        const recentDates = getRecentDates(30);
        let found = false;

        for (const date of recentDates) {
          // Query all users' entries for this date in the org (using GSI2)
          const payPeriod = getPayPeriodFromDate(date);
          const entries = await db.queryGSI2(`ORG#${currentUser.orgId}#PAYPERIOD#${payPeriod}`);

          const entry = entries.find((e) => e.entryId === entryId);

          if (entry) {
            // Verify entry belongs to same org
            if (entry.orgId !== currentUser.orgId) {
              results.failed.push({
                entryId,
                reason: 'Entry not found in your organization',
              });
              found = true;
              break;
            }

            // Update entry
            const updates = {
              status: action === 'approve' ? 'approved' : 'rejected',
              approvedBy: currentUser.userId,
              approvedAt: now(),
              updatedAt: now(),
            };

            await db.update(entry.PK, entry.SK, updates);
            results.success.push(entryId);
            found = true;
            break;
          }
        }

        if (!found) {
          results.failed.push({
            entryId,
            reason: 'Entry not found',
          });
        }
      } catch (err: any) {
        results.failed.push({
          entryId,
          reason: err.message || 'Failed to process',
        });
      }
    }

    return success({
      message: `${action === 'approve' ? 'Approved' : 'Rejected'} ${results.success.length} time entries`,
      results,
    });
  } catch (err: any) {
    console.error('Approve entries error:', err);
    return error(err.message || 'Failed to approve entries', 500);
  }
};

// Helper to get recent dates
function getRecentDates(days: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

// Helper to get pay period from date
function getPayPeriodFromDate(date: string): string {
  const d = new Date(date);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + yearStart.getDay() + 1) / 7);
  return `${d.getFullYear()}-${String(weekNo).padStart(2, '0')}`;
}
