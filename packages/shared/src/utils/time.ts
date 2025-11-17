import { Break, TimeEntry, OvertimeRule } from '../types';

/**
 * Calculates the total hours worked including breaks
 * @param clockInTime Clock in timestamp (ISO 8601)
 * @param clockOutTime Clock out timestamp (ISO 8601)
 * @param breaks Array of breaks taken
 * @returns Total hours worked
 */
export function calculateTotalHours(
  clockInTime: string,
  clockOutTime: string,
  breaks: Break[]
): number {
  const startMs = new Date(clockInTime).getTime();
  const endMs = new Date(clockOutTime).getTime();
  const totalMs = endMs - startMs;

  // Calculate unpaid break time
  const unpaidBreakMs = breaks.reduce((total, breakItem) => {
    if (!breakItem.paid && breakItem.endTime) {
      const breakStart = new Date(breakItem.startTime).getTime();
      const breakEnd = new Date(breakItem.endTime).getTime();
      return total + (breakEnd - breakStart);
    }
    return total;
  }, 0);

  const workedMs = totalMs - unpaidBreakMs;
  return workedMs / (1000 * 60 * 60); // Convert to hours
}

/**
 * Calculates regular and overtime hours based on rules
 * @param totalHours Total hours worked
 * @param overtimeRules Array of overtime rules
 * @param hoursWorkedThisWeek Total hours worked this week (for weekly overtime)
 * @returns Object with regularHours and overtimeHours
 */
export function calculateOvertimeHours(
  totalHours: number,
  overtimeRules: OvertimeRule[],
  hoursWorkedThisWeek: number = 0
): { regularHours: number; overtimeHours: number } {
  if (!overtimeRules || overtimeRules.length === 0) {
    return { regularHours: totalHours, overtimeHours: 0 };
  }

  let overtimeHours = 0;
  let regularHours = totalHours;

  // Sort rules by threshold (lowest first)
  const sortedRules = [...overtimeRules].sort((a, b) => a.threshold - b.threshold);

  for (const rule of sortedRules) {
    if (rule.period === 'DAILY') {
      if (totalHours > rule.threshold) {
        const overtimeForThisRule = totalHours - rule.threshold;
        overtimeHours += overtimeForThisRule;
        regularHours -= overtimeForThisRule;
      }
    } else if (rule.period === 'WEEKLY') {
      const totalWeeklyHours = hoursWorkedThisWeek + totalHours;
      if (totalWeeklyHours > rule.threshold) {
        const overtimeForThisRule = Math.min(
          totalWeeklyHours - rule.threshold,
          totalHours
        );
        overtimeHours += overtimeForThisRule;
        regularHours -= overtimeForThisRule;
      }
    }
  }

  return {
    regularHours: Math.max(0, regularHours),
    overtimeHours: Math.max(0, overtimeHours),
  };
}

/**
 * Calculates total pay including overtime
 * @param regularHours Regular hours worked
 * @param overtimeHours Overtime hours worked
 * @param basePayRate Base hourly pay rate
 * @param overtimeMultiplier Overtime multiplier (e.g., 1.5 for time-and-a-half)
 * @returns Total pay amount
 */
export function calculatePay(
  regularHours: number,
  overtimeHours: number,
  basePayRate: number,
  overtimeMultiplier: number = 1.5
): number {
  const regularPay = regularHours * basePayRate;
  const overtimePay = overtimeHours * basePayRate * overtimeMultiplier;
  return regularPay + overtimePay;
}

/**
 * Validates if required breaks were taken
 * @param totalHours Total hours in shift
 * @param breaks Breaks taken
 * @param breakRules Required break rules
 * @returns Validation result with missing breaks
 */
export function validateBreaks(
  totalHours: number,
  breaks: Break[],
  breakRules: Array<{ minShiftDuration: number; breakDuration: number; paid: boolean }>
): { valid: boolean; missingBreaks: string[] } {
  const missingBreaks: string[] = [];

  for (const rule of breakRules) {
    if (totalHours >= rule.minShiftDuration) {
      const totalBreakMinutes = breaks.reduce((total, breakItem) => {
        if (breakItem.endTime) {
          const breakStart = new Date(breakItem.startTime).getTime();
          const breakEnd = new Date(breakItem.endTime).getTime();
          const breakMinutes = (breakEnd - breakStart) / (1000 * 60);
          return total + breakMinutes;
        }
        return total;
      }, 0);

      if (totalBreakMinutes < rule.breakDuration) {
        missingBreaks.push(
          `Required ${rule.breakDuration} minute break for ${rule.minShiftDuration}+ hour shift`
        );
      }
    }
  }

  return {
    valid: missingBreaks.length === 0,
    missingBreaks,
  };
}

/**
 * Formats hours to HH:MM format
 * @param hours Decimal hours (e.g., 8.5)
 * @returns Formatted string (e.g., "8:30")
 */
export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}

/**
 * Parses HH:MM format to decimal hours
 * @param formatted Formatted string (e.g., "8:30")
 * @returns Decimal hours (e.g., 8.5)
 */
export function parseHours(formatted: string): number {
  const [hours, minutes] = formatted.split(':').map(Number);
  return hours + minutes / 60;
}

/**
 * Checks if two time ranges overlap
 * @param start1 Start of first range (ISO 8601)
 * @param end1 End of first range (ISO 8601)
 * @param start2 Start of second range (ISO 8601)
 * @param end2 End of second range (ISO 8601)
 * @returns True if ranges overlap
 */
export function doTimeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();

  return s1 < e2 && s2 < e1;
}

/**
 * Gets the start and end of a pay period
 * @param date Reference date
 * @param periodType Type of pay period
 * @param weekStart Start day of week (0 = Sunday, 1 = Monday, etc.)
 * @returns Object with start and end dates
 */
export function getPayPeriod(
  date: Date,
  periodType: 'WEEKLY' | 'BI_WEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY',
  weekStart: number = 0
): { start: Date; end: Date } {
  const d = new Date(date);

  switch (periodType) {
    case 'WEEKLY': {
      const dayOfWeek = d.getDay();
      const diff = (dayOfWeek - weekStart + 7) % 7;
      const start = new Date(d);
      start.setDate(d.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    case 'BI_WEEKLY': {
      // This is simplified - in production, you'd need to track the start date
      const dayOfWeek = d.getDay();
      const diff = (dayOfWeek - weekStart + 7) % 7;
      const weekNumber = Math.floor((d.getDate() + diff) / 7);
      const isEvenWeek = weekNumber % 2 === 0;
      const start = new Date(d);
      start.setDate(d.getDate() - diff - (isEvenWeek ? 0 : 7));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 13);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    case 'SEMI_MONTHLY': {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() < 16 ? 1 : 16);
      const end = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate() < 16 ? 15 : new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      );
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    case 'MONTHLY': {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    default:
      throw new Error(`Unknown pay period type: ${periodType}`);
  }
}
