import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';
import { ComplianceEngine, getRegionalComplianceSettings } from '../../shared/compliance';
import { formatDate } from '../../shared/utils';

/**
 * Check compliance for time entries
 * Can be called manually or triggered automatically
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Get parameters
    const queryParams = event.queryStringParameters || {};
    const userId = queryParams.userId || currentUser.userId;
    const startDate = queryParams.startDate || formatDate();
    const endDate = queryParams.endDate || formatDate();

    // Check authorization
    const canCheckOthers = ['manager', 'admin', 'owner'].includes(currentUser.role);
    if (userId !== currentUser.userId && !canCheckOthers) {
      return error('You can only check your own compliance', 403);
    }

    // Get organization settings
    const org = await db.get(`ORG#${currentUser.orgId}`, `ORG#${currentUser.orgId}`);
    const complianceSettings = org?.complianceRules || {};

    // Get regional settings if specified
    const regionalSettings = org?.settings?.region
      ? getRegionalComplianceSettings(org.settings.region)
      : {};

    // Initialize compliance engine
    const engine = new ComplianceEngine({
      ...complianceSettings,
      ...regionalSettings,
    });

    // Get time entries for the period
    const dates = getDatesBetween(startDate, endDate);
    const allEntries: any[] = [];

    for (const date of dates) {
      const entries = await db.query(`USER#${userId}#DATE#${date}`);
      allEntries.push(...entries);
    }

    // Sort entries by clock-in time
    allEntries.sort((a, b) =>
      new Date(a.clockInTime).getTime() - new Date(b.clockInTime).getTime()
    );

    // Get user info
    const user = await db.get(`USER#${userId}`, `PROFILE#${userId}`);
    const isMinor = user?.birthdate ? isUnder18(user.birthdate) : false;

    // Check each entry for violations
    const allViolations: any[] = [];

    for (let i = 0; i < allEntries.length; i++) {
      const entry = allEntries[i];

      if (!entry.clockOutTime) continue; // Skip active entries

      const previousShift = i > 0 ? allEntries[i - 1] : null;

      const violations = engine.checkTimeEntry({
        userId,
        entryId: entry.entryId,
        clockInTime: entry.clockInTime,
        clockOutTime: entry.clockOutTime,
        breaks: entry.breaks || [],
        totalHours: entry.totalHours || 0,
        isMinor,
        previousShift: previousShift?.clockOutTime
          ? { clockOutTime: previousShift.clockOutTime }
          : undefined,
      });

      allViolations.push(...violations);
    }

    // Check weekly overtime
    const weeklyViolations = engine.checkWeeklyOvertime(
      allEntries.map((e) => ({ userId, totalHours: e.totalHours || 0 }))
    );
    allViolations.push(...weeklyViolations);

    // Get shifts for consecutive days check
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() - 7); // Check last 7 days
    const shifts = await getShiftsForUser(
      userId,
      formatDate(weekStart),
      endDate
    );

    if (shifts.length > 0) {
      const consecutiveViolations = engine.checkConsecutiveDays(
        shifts.map((s) => ({
          userId,
          shiftId: s.shiftId,
          startTime: s.startTime,
        }))
      );
      allViolations.push(...consecutiveViolations);
    }

    // Categorize violations
    const critical = allViolations.filter((v) => v.severity === 'critical');
    const warnings = allViolations.filter((v) => v.severity === 'warning');

    return success({
      userId,
      startDate,
      endDate,
      violations: allViolations,
      summary: {
        total: allViolations.length,
        critical: critical.length,
        warnings: warnings.length,
      },
      byCategory: groupByCategory(allViolations),
    });
  } catch (err: any) {
    console.error('Check compliance error:', err);
    return error(err.message || 'Failed to check compliance', 500);
  }
};

// Helper functions
function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  return dates;
}

function isUnder18(birthdate: string): boolean {
  const today = new Date();
  const birth = new Date(birthdate);
  const age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    return age - 1 < 18;
  }

  return age < 18;
}

async function getShiftsForUser(userId: string, startDate: string, endDate: string): Promise<any[]> {
  const dates = getDatesBetween(startDate, endDate);
  const allShifts: any[] = [];

  for (const date of dates) {
    const shifts = await db.query(`USER#${userId}#SHIFTS`, {
      begins: `DATE#${date}`,
    }, 'GSI1');
    allShifts.push(...shifts);
  }

  return allShifts;
}

function groupByCategory(violations: any[]): Record<string, number> {
  const grouped: Record<string, number> = {};

  for (const violation of violations) {
    grouped[violation.category] = (grouped[violation.category] || 0) + 1;
  }

  return grouped;
}
