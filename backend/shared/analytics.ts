/**
 * Analytics Utilities
 * Data aggregation and metrics calculation
 */

import { TimeEntry, Shift } from './types';

export interface AnalyticsMetrics {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  totalCost: number;
  regularCost: number;
  overtimeCost: number;
  shiftsScheduled: number;
  shiftsCompleted: number;
  attendanceRate: number;
  employeeCount: number;
}

export interface TrendDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface DepartmentMetrics {
  locationId: string;
  locationName: string;
  hours: number;
  cost: number;
  employeeCount: number;
  attendanceRate: number;
}

export interface EmployeeMetrics {
  userId: string;
  userName: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  scheduledShifts: number;
  completedShifts: number;
  missedShifts: number;
  lateClockIns: number;
  attendanceRate: number;
  averageHoursPerWeek: number;
}

export interface BudgetStatus {
  periodStart: string;
  periodEnd: string;
  budgetAmount: number;
  actualSpent: number;
  projectedSpend: number;
  remainingBudget: number;
  percentageUsed: number;
  onTrack: boolean;
  daysRemaining: number;
}

/**
 * Calculate metrics from time entries
 */
export function calculateMetricsFromEntries(
  entries: TimeEntry[],
  payRates: Map<string, number>,
  overtimeThreshold = 40
): AnalyticsMetrics {
  const uniqueEmployees = new Set(entries.map(e => e.userId));

  let totalHours = 0;
  let regularHours = 0;
  let overtimeHours = 0;
  let totalCost = 0;
  let regularCost = 0;
  let overtimeCost = 0;

  // Group by user for overtime calculation
  const hoursByUser = new Map<string, number>();

  entries.forEach(entry => {
    const hours = entry.totalHours || 0;
    totalHours += hours;

    const currentUserHours = hoursByUser.get(entry.userId) || 0;
    hoursByUser.set(entry.userId, currentUserHours + hours);
  });

  // Calculate regular vs overtime
  hoursByUser.forEach((hours, userId) => {
    const payRate = payRates.get(userId) || 15; // Default $15/hr

    if (hours <= overtimeThreshold) {
      regularHours += hours;
      regularCost += hours * payRate;
    } else {
      regularHours += overtimeThreshold;
      regularCost += overtimeThreshold * payRate;

      const otHours = hours - overtimeThreshold;
      overtimeHours += otHours;
      overtimeCost += otHours * payRate * 1.5; // 1.5x overtime
    }
  });

  totalCost = regularCost + overtimeCost;

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    regularCost: Math.round(regularCost * 100) / 100,
    overtimeCost: Math.round(overtimeCost * 100) / 100,
    shiftsScheduled: 0, // Calculated separately
    shiftsCompleted: entries.filter(e => e.clockOutTime).length,
    attendanceRate: 0, // Calculated separately
    employeeCount: uniqueEmployees.size,
  };
}

/**
 * Calculate attendance rate from shifts and entries
 */
export function calculateAttendanceRate(
  scheduledShifts: Shift[],
  timeEntries: TimeEntry[]
): number {
  if (scheduledShifts.length === 0) return 100;

  const completedShifts = scheduledShifts.filter(shift => {
    // Check if there's a time entry for this shift
    return timeEntries.some(entry =>
      entry.userId === shift.userId &&
      entry.clockInTime.startsWith(shift.date)
    );
  });

  return Math.round((completedShifts.length / scheduledShifts.length) * 100);
}

/**
 * Generate trend data by grouping entries by date
 */
export function generateTrendData(
  entries: TimeEntry[],
  payRates: Map<string, number>,
  groupBy: 'day' | 'week' | 'month' = 'day',
  metric: 'hours' | 'cost' = 'hours'
): TrendDataPoint[] {
  const groups = new Map<string, TimeEntry[]>();

  entries.forEach(entry => {
    const date = new Date(entry.clockInTime);
    let key: string;

    if (groupBy === 'day') {
      key = date.toISOString().split('T')[0];
    } else if (groupBy === 'week') {
      // Get Monday of the week
      const monday = new Date(date);
      monday.setDate(date.getDate() - date.getDay() + 1);
      key = monday.toISOString().split('T')[0];
    } else {
      // Month
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(entry);
  });

  const trend: TrendDataPoint[] = [];

  groups.forEach((groupEntries, dateKey) => {
    let value = 0;

    if (metric === 'hours') {
      value = groupEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0);
    } else {
      // Cost
      value = groupEntries.reduce((sum, e) => {
        const payRate = payRates.get(e.userId) || 15;
        return sum + ((e.totalHours || 0) * payRate);
      }, 0);
    }

    trend.push({
      date: dateKey,
      value: Math.round(value * 100) / 100,
    });
  });

  // Sort by date
  return trend.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate metrics by department/location
 */
export function calculateDepartmentMetrics(
  entries: TimeEntry[],
  shifts: Shift[],
  payRates: Map<string, number>,
  locations: Map<string, { name: string }>
): DepartmentMetrics[] {
  const deptMap = new Map<string, {
    entries: TimeEntry[];
    shifts: Shift[];
    employees: Set<string>;
  }>();

  // Group entries by location
  entries.forEach(entry => {
    if (!deptMap.has(entry.locationId)) {
      deptMap.set(entry.locationId, {
        entries: [],
        shifts: [],
        employees: new Set(),
      });
    }
    const dept = deptMap.get(entry.locationId)!;
    dept.entries.push(entry);
    dept.employees.add(entry.userId);
  });

  // Group shifts by location
  shifts.forEach(shift => {
    if (!deptMap.has(shift.locationId)) {
      deptMap.set(shift.locationId, {
        entries: [],
        shifts: [],
        employees: new Set(),
      });
    }
    deptMap.get(shift.locationId)!.shifts.push(shift);
  });

  const metrics: DepartmentMetrics[] = [];

  deptMap.forEach((data, locationId) => {
    const hours = data.entries.reduce((sum, e) => sum + (e.totalHours || 0), 0);
    const cost = data.entries.reduce((sum, e) => {
      const payRate = payRates.get(e.userId) || 15;
      return sum + ((e.totalHours || 0) * payRate);
    }, 0);

    const attendanceRate = data.shifts.length > 0
      ? (data.entries.filter(e => e.clockOutTime).length / data.shifts.length) * 100
      : 100;

    metrics.push({
      locationId,
      locationName: locations.get(locationId)?.name || 'Unknown',
      hours: Math.round(hours * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      employeeCount: data.employees.size,
      attendanceRate: Math.round(attendanceRate),
    });
  });

  return metrics.sort((a, b) => b.cost - a.cost);
}

/**
 * Calculate employee performance metrics
 */
export function calculateEmployeeMetrics(
  userId: string,
  entries: TimeEntry[],
  shifts: Shift[],
  payRate: number,
  startDate: Date,
  endDate: Date
): EmployeeMetrics {
  const userEntries = entries.filter(e => e.userId === userId);
  const userShifts = shifts.filter(s => s.userId === userId);

  const totalHours = userEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0);

  // Simple overtime calculation (>40 hours per week)
  const weeksInPeriod = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  const averageHoursPerWeek = totalHours / weeksInPeriod;
  const overtimeHours = Math.max(0, totalHours - (40 * weeksInPeriod));
  const regularHours = totalHours - overtimeHours;

  const completedShifts = userShifts.filter(shift => {
    return userEntries.some(entry => entry.clockInTime.startsWith(shift.date));
  }).length;

  const missedShifts = userShifts.length - completedShifts;

  // Count late clock-ins (>5 minutes after shift start)
  const lateClockIns = userEntries.filter(entry => {
    const shift = userShifts.find(s => entry.clockInTime.startsWith(s.date));
    if (!shift) return false;

    const shiftStart = new Date(`${shift.date}T${shift.startTime}`);
    const clockIn = new Date(entry.clockInTime);
    const diffMinutes = (clockIn.getTime() - shiftStart.getTime()) / (1000 * 60);

    return diffMinutes > 5;
  }).length;

  const attendanceRate = userShifts.length > 0
    ? (completedShifts / userShifts.length) * 100
    : 100;

  return {
    userId,
    userName: '', // Will be populated by caller
    totalHours: Math.round(totalHours * 100) / 100,
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    scheduledShifts: userShifts.length,
    completedShifts,
    missedShifts,
    lateClockIns,
    attendanceRate: Math.round(attendanceRate),
    averageHoursPerWeek: Math.round(averageHoursPerWeek * 100) / 100,
  };
}

/**
 * Calculate budget status
 */
export function calculateBudgetStatus(
  budgetAmount: number,
  actualSpent: number,
  periodStart: Date,
  periodEnd: Date,
  currentDate: Date = new Date()
): BudgetStatus {
  const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.ceil((currentDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = totalDays - daysElapsed;

  const expectedSpendRate = budgetAmount / totalDays;
  const expectedSpendToDate = expectedSpendRate * daysElapsed;
  const actualSpendRate = actualSpent / Math.max(1, daysElapsed);
  const projectedSpend = actualSpendRate * totalDays;

  const remainingBudget = budgetAmount - actualSpent;
  const percentageUsed = (actualSpent / budgetAmount) * 100;

  // On track if actual spending is within 10% of expected
  const onTrack = actualSpent <= expectedSpendToDate * 1.1;

  return {
    periodStart: periodStart.toISOString().split('T')[0],
    periodEnd: periodEnd.toISOString().split('T')[0],
    budgetAmount: Math.round(budgetAmount * 100) / 100,
    actualSpent: Math.round(actualSpent * 100) / 100,
    projectedSpend: Math.round(projectedSpend * 100) / 100,
    remainingBudget: Math.round(remainingBudget * 100) / 100,
    percentageUsed: Math.round(percentageUsed),
    onTrack,
    daysRemaining: Math.max(0, daysRemaining),
  };
}

/**
 * Detect anomalies in time tracking data
 */
export function detectAnomalies(
  entries: TimeEntry[],
  threshold: { hours?: number; cost?: number } = {}
): Array<{ type: string; description: string; entryId: string; severity: 'low' | 'medium' | 'high' }> {
  const anomalies: Array<{ type: string; description: string; entryId: string; severity: 'low' | 'medium' | 'high' }> = [];

  entries.forEach(entry => {
    const hours = entry.totalHours || 0;

    // Excessive hours
    if (threshold.hours && hours > threshold.hours) {
      anomalies.push({
        type: 'excessive_hours',
        description: `Entry has ${hours} hours, exceeds threshold of ${threshold.hours}`,
        entryId: entry.entryId,
        severity: hours > threshold.hours * 1.5 ? 'high' : 'medium',
      });
    }

    // Missing clock out
    if (!entry.clockOutTime) {
      const clockInDate = new Date(entry.clockInTime);
      const now = new Date();
      const hoursSinceClockIn = (now.getTime() - clockInDate.getTime()) / (1000 * 60 * 60);

      if (hoursSinceClockIn > 24) {
        anomalies.push({
          type: 'missing_clock_out',
          description: `No clock-out for ${Math.round(hoursSinceClockIn)} hours`,
          entryId: entry.entryId,
          severity: 'high',
        });
      }
    }

    // Very short shifts (< 1 hour)
    if (hours > 0 && hours < 1) {
      anomalies.push({
        type: 'short_shift',
        description: `Very short shift: ${hours} hours`,
        entryId: entry.entryId,
        severity: 'low',
      });
    }
  });

  return anomalies;
}
