import { calculateHours } from './utils';

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'warning' | 'critical';
  category: 'overtime' | 'breaks' | 'rest' | 'shift_length' | 'minor_restrictions';
}

export interface ComplianceViolation {
  ruleId: string;
  ruleName: string;
  description: string;
  severity: 'warning' | 'critical';
  category: string;
  timestamp: string;
  userId: string;
  entryId?: string;
  shiftId?: string;
  details: Record<string, any>;
}

export interface ComplianceSettings {
  // Overtime rules
  dailyOvertimeThreshold: number; // hours
  weeklyOvertimeThreshold: number; // hours
  overtimeMultiplier: number;

  // Break rules
  requireBreaks: boolean;
  breakRules: Array<{
    minHours: number; // Minimum hours worked to require break
    breakDuration: number; // Minutes
    paid: boolean;
  }>;

  // Rest period rules
  minimumRestBetweenShifts: number; // hours
  minimumWeeklyRest: number; // hours

  // Shift length rules
  maximumShiftLength: number; // hours
  maximumConsecutiveDays: number;

  // Minor (under 18) restrictions
  minorMaxDailyHours: number;
  minorMaxWeeklyHours: number;
  minorProhibitedHours: Array<{ start: string; end: string }>; // e.g., "22:00" to "06:00"

  // Regional settings
  region: string; // e.g., "US-CA", "US-NY", "US-TX"
  timezone: string;
}

export const DEFAULT_COMPLIANCE_SETTINGS: ComplianceSettings = {
  // Federal FLSA standards
  dailyOvertimeThreshold: 8,
  weeklyOvertimeThreshold: 40,
  overtimeMultiplier: 1.5,

  requireBreaks: true,
  breakRules: [
    { minHours: 5, breakDuration: 30, paid: false }, // 30min break after 5 hours
    { minHours: 8, breakDuration: 30, paid: false }, // Additional break after 8 hours
  ],

  minimumRestBetweenShifts: 8,
  minimumWeeklyRest: 24,

  maximumShiftLength: 12,
  maximumConsecutiveDays: 6,

  // Federal youth employment standards
  minorMaxDailyHours: 8,
  minorMaxWeeklyHours: 40,
  minorProhibitedHours: [
    { start: '19:00', end: '07:00' }, // During school year
  ],

  region: 'US-FEDERAL',
  timezone: 'America/New_York',
};

/**
 * Compliance Rules Engine
 */
export class ComplianceEngine {
  private settings: ComplianceSettings;

  constructor(settings?: Partial<ComplianceSettings>) {
    this.settings = { ...DEFAULT_COMPLIANCE_SETTINGS, ...settings };
  }

  /**
   * Check all compliance rules for a time entry
   */
  checkTimeEntry(entry: {
    userId: string;
    entryId: string;
    clockInTime: string;
    clockOutTime: string;
    breaks: Array<{ start: string; end: string; paid: boolean }>;
    totalHours: number;
    isMinor?: boolean;
    previousShift?: { clockOutTime: string };
  }): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    // Check break compliance
    violations.push(...this.checkBreakCompliance(entry));

    // Check shift length
    violations.push(...this.checkShiftLength(entry));

    // Check rest period between shifts
    if (entry.previousShift) {
      violations.push(...this.checkRestPeriod(entry, entry.previousShift));
    }

    // Check minor restrictions
    if (entry.isMinor) {
      violations.push(...this.checkMinorRestrictions(entry));
    }

    return violations;
  }

  /**
   * Check overtime compliance for a week
   */
  checkWeeklyOvertime(entries: Array<{
    userId: string;
    totalHours: number;
  }>): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    const totalWeeklyHours = entries.reduce((sum, e) => sum + e.totalHours, 0);

    if (totalWeeklyHours > this.settings.weeklyOvertimeThreshold) {
      const overtimeHours = totalWeeklyHours - this.settings.weeklyOvertimeThreshold;
      violations.push({
        ruleId: 'weekly_overtime',
        ruleName: 'Weekly Overtime Limit',
        description: `Weekly hours (${totalWeeklyHours.toFixed(2)}) exceed threshold of ${this.settings.weeklyOvertimeThreshold} hours. Overtime: ${overtimeHours.toFixed(2)} hours.`,
        severity: 'warning',
        category: 'overtime',
        timestamp: new Date().toISOString(),
        userId: entries[0]?.userId || 'unknown',
        details: {
          totalWeeklyHours,
          threshold: this.settings.weeklyOvertimeThreshold,
          overtimeHours,
        },
      });
    }

    return violations;
  }

  /**
   * Check consecutive days worked
   */
  checkConsecutiveDays(shifts: Array<{
    userId: string;
    shiftId: string;
    startTime: string;
  }>): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    if (shifts.length < this.settings.maximumConsecutiveDays) {
      return violations;
    }

    // Sort by date
    const sorted = shifts.sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    let consecutiveDays = 1;
    let lastDate = new Date(sorted[0].startTime).toISOString().split('T')[0];

    for (let i = 1; i < sorted.length; i++) {
      const currentDate = new Date(sorted[i].startTime).toISOString().split('T')[0];
      const dayDiff = this.getDaysDifference(lastDate, currentDate);

      if (dayDiff === 1) {
        consecutiveDays++;
        if (consecutiveDays > this.settings.maximumConsecutiveDays) {
          violations.push({
            ruleId: 'consecutive_days',
            ruleName: 'Maximum Consecutive Days',
            description: `Employee has worked ${consecutiveDays} consecutive days, exceeding the maximum of ${this.settings.maximumConsecutiveDays} days.`,
            severity: 'warning',
            category: 'rest',
            timestamp: new Date().toISOString(),
            userId: shifts[0].userId,
            shiftId: sorted[i].shiftId,
            details: {
              consecutiveDays,
              maxAllowed: this.settings.maximumConsecutiveDays,
            },
          });
          break;
        }
      } else if (dayDiff > 1) {
        consecutiveDays = 1; // Reset counter
      }

      lastDate = currentDate;
    }

    return violations;
  }

  /**
   * Check break compliance
   */
  private checkBreakCompliance(entry: {
    totalHours: number;
    breaks: Array<{ start: string; end: string; paid: boolean }>;
    userId: string;
    entryId: string;
  }): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    if (!this.settings.requireBreaks) {
      return violations;
    }

    for (const rule of this.settings.breakRules) {
      if (entry.totalHours >= rule.minHours) {
        // Calculate total break time taken
        const totalBreakMinutes = entry.breaks.reduce((sum, brk) => {
          return sum + calculateHours(brk.start, brk.end) * 60;
        }, 0);

        if (totalBreakMinutes < rule.breakDuration) {
          violations.push({
            ruleId: 'break_required',
            ruleName: 'Required Break',
            description: `A ${rule.breakDuration}-minute break is required after ${rule.minHours} hours of work. Only ${totalBreakMinutes.toFixed(0)} minutes of break time recorded.`,
            severity: 'critical',
            category: 'breaks',
            timestamp: new Date().toISOString(),
            userId: entry.userId,
            entryId: entry.entryId,
            details: {
              requiredBreakMinutes: rule.breakDuration,
              actualBreakMinutes: totalBreakMinutes,
              hoursWorked: entry.totalHours,
            },
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check shift length
   */
  private checkShiftLength(entry: {
    clockInTime: string;
    clockOutTime: string;
    totalHours: number;
    userId: string;
    entryId: string;
  }): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    if (entry.totalHours > this.settings.maximumShiftLength) {
      violations.push({
        ruleId: 'max_shift_length',
        ruleName: 'Maximum Shift Length',
        description: `Shift length (${entry.totalHours.toFixed(2)} hours) exceeds maximum allowed (${this.settings.maximumShiftLength} hours).`,
        severity: 'warning',
        category: 'shift_length',
        timestamp: new Date().toISOString(),
        userId: entry.userId,
        entryId: entry.entryId,
        details: {
          shiftLength: entry.totalHours,
          maxAllowed: this.settings.maximumShiftLength,
        },
      });
    }

    return violations;
  }

  /**
   * Check rest period between shifts
   */
  private checkRestPeriod(
    currentEntry: {
      clockInTime: string;
      userId: string;
      entryId: string;
    },
    previousShift: {
      clockOutTime: string;
    }
  ): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    const restHours = calculateHours(previousShift.clockOutTime, currentEntry.clockInTime);

    if (restHours < this.settings.minimumRestBetweenShifts) {
      violations.push({
        ruleId: 'min_rest_period',
        ruleName: 'Minimum Rest Period',
        description: `Only ${restHours.toFixed(2)} hours of rest between shifts. Minimum required: ${this.settings.minimumRestBetweenShifts} hours.`,
        severity: 'critical',
        category: 'rest',
        timestamp: new Date().toISOString(),
        userId: currentEntry.userId,
        entryId: currentEntry.entryId,
        details: {
          actualRest: restHours,
          requiredRest: this.settings.minimumRestBetweenShifts,
          previousClockOut: previousShift.clockOutTime,
          currentClockIn: currentEntry.clockInTime,
        },
      });
    }

    return violations;
  }

  /**
   * Check minor (under 18) restrictions
   */
  private checkMinorRestrictions(entry: {
    clockInTime: string;
    clockOutTime: string;
    totalHours: number;
    userId: string;
    entryId: string;
  }): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    // Check daily hours limit
    if (entry.totalHours > this.settings.minorMaxDailyHours) {
      violations.push({
        ruleId: 'minor_daily_hours',
        ruleName: 'Minor Daily Hour Limit',
        description: `Minor worked ${entry.totalHours.toFixed(2)} hours, exceeding daily limit of ${this.settings.minorMaxDailyHours} hours.`,
        severity: 'critical',
        category: 'minor_restrictions',
        timestamp: new Date().toISOString(),
        userId: entry.userId,
        entryId: entry.entryId,
        details: {
          hoursWorked: entry.totalHours,
          maxAllowed: this.settings.minorMaxDailyHours,
        },
      });
    }

    // Check prohibited hours
    for (const prohibited of this.settings.minorProhibitedHours) {
      const clockInTime = new Date(entry.clockInTime);
      const clockOutTime = new Date(entry.clockOutTime);

      const clockInHour = clockInTime.getHours() + clockInTime.getMinutes() / 60;
      const clockOutHour = clockOutTime.getHours() + clockOutTime.getMinutes() / 60;

      const [prohibitedStartHour, prohibitedStartMin] = prohibited.start.split(':').map(Number);
      const [prohibitedEndHour, prohibitedEndMin] = prohibited.end.split(':').map(Number);

      const prohibitedStart = prohibitedStartHour + prohibitedStartMin / 60;
      const prohibitedEnd = prohibitedEndHour + prohibitedEndMin / 60;

      // Check if shift overlaps with prohibited hours
      const hasViolation =
        (clockInHour >= prohibitedStart && clockInHour < prohibitedEnd) ||
        (clockOutHour > prohibitedStart && clockOutHour <= prohibitedEnd) ||
        (clockInHour < prohibitedStart && clockOutHour > prohibitedEnd);

      if (hasViolation) {
        violations.push({
          ruleId: 'minor_prohibited_hours',
          ruleName: 'Minor Prohibited Hours',
          description: `Minor worked during prohibited hours (${prohibited.start} - ${prohibited.end}).`,
          severity: 'critical',
          category: 'minor_restrictions',
          timestamp: new Date().toISOString(),
          userId: entry.userId,
          entryId: entry.entryId,
          details: {
            clockIn: entry.clockInTime,
            clockOut: entry.clockOutTime,
            prohibitedStart: prohibited.start,
            prohibitedEnd: prohibited.end,
          },
        });
      }
    }

    return violations;
  }

  /**
   * Helper to calculate days difference
   */
  private getDaysDifference(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

/**
 * Get region-specific compliance settings
 */
export function getRegionalComplianceSettings(region: string): Partial<ComplianceSettings> {
  switch (region) {
    case 'US-CA': // California
      return {
        dailyOvertimeThreshold: 8,
        weeklyOvertimeThreshold: 40,
        breakRules: [
          { minHours: 5, breakDuration: 30, paid: false },
          { minHours: 10, breakDuration: 30, paid: false }, // Second meal break
        ],
        minimumRestBetweenShifts: 10, // California requires 10 hours
      };

    case 'US-NY': // New York
      return {
        breakRules: [
          { minHours: 6, breakDuration: 30, paid: false },
        ],
        minimumRestBetweenShifts: 8,
      };

    case 'US-TX': // Texas
      return {
        requireBreaks: false, // Texas doesn't mandate breaks for adults
        dailyOvertimeThreshold: 0, // No daily overtime requirement
      };

    default:
      return {};
  }
}
