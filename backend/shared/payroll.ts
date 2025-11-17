/**
 * Payroll Utilities
 * Handles payroll calculations, period management, and export formatting
 */

import { TimeEntry, User } from './types';

export interface PayrollPeriod {
  periodId: string;
  organizationId: string;
  startDate: string;
  endDate: string;
  payDate: string;
  status: 'draft' | 'processing' | 'approved' | 'paid' | 'cancelled';
  periodType: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
  totalGrossPay: number;
  totalNetPay?: number;
  totalTaxes?: number;
  totalDeductions?: number;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface PayrollEntry {
  entryId: string;
  periodId: string;
  userId: string;
  userName: string;
  employeeNumber?: string;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours?: number;
  regularRate: number;
  overtimeRate: number;
  doubleTimeRate?: number;
  grossPay: number;
  federalTax?: number;
  stateTax?: number;
  socialSecurity?: number;
  medicare?: number;
  deductions?: PayrollDeduction[];
  netPay?: number;
  timeEntries: string[]; // Array of time entry IDs
}

export interface PayrollDeduction {
  type: 'health_insurance' | 'dental' | 'vision' | '401k' | 'other';
  name: string;
  amount: number;
  pretax: boolean;
}

export interface PayrollSettings {
  organizationId: string;
  periodType: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
  weekStartDay: number; // 0 = Sunday, 1 = Monday, etc.
  overtimeThreshold: number; // Weekly hours before OT kicks in
  overtimeMultiplier: number; // Usually 1.5
  doubleTimeThreshold?: number; // CA requires 2x after 12 hours
  doubleTimeMultiplier?: number; // Usually 2.0
  defaultDeductions?: PayrollDeduction[];
}

/**
 * Calculate payroll periods for a year
 */
export function generatePayrollPeriods(
  year: number,
  periodType: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly',
  weekStartDay: number = 0 // 0 = Sunday
): Array<{ startDate: string; endDate: string }> {
  const periods: Array<{ startDate: string; endDate: string }> = [];

  if (periodType === 'weekly') {
    // 52 weeks per year
    let currentDate = new Date(year, 0, 1);

    // Find first occurrence of weekStartDay
    while (currentDate.getDay() !== weekStartDay) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    for (let i = 0; i < 52; i++) {
      const startDate = new Date(currentDate);
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + 6);

      periods.push({
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
      });

      currentDate.setDate(currentDate.getDate() + 7);
    }
  } else if (periodType === 'biweekly') {
    // 26 periods per year
    let currentDate = new Date(year, 0, 1);

    while (currentDate.getDay() !== weekStartDay) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    for (let i = 0; i < 26; i++) {
      const startDate = new Date(currentDate);
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + 13);

      periods.push({
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
      });

      currentDate.setDate(currentDate.getDate() + 14);
    }
  } else if (periodType === 'semimonthly') {
    // 24 periods per year (1st-15th and 16th-end of month)
    for (let month = 0; month < 12; month++) {
      // First period: 1st to 15th
      periods.push({
        startDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
        endDate: `${year}-${String(month + 1).padStart(2, '0')}-15`,
      });

      // Second period: 16th to last day of month
      const lastDay = new Date(year, month + 1, 0).getDate();
      periods.push({
        startDate: `${year}-${String(month + 1).padStart(2, '0')}-16`,
        endDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      });
    }
  } else if (periodType === 'monthly') {
    // 12 periods per year
    for (let month = 0; month < 12; month++) {
      const lastDay = new Date(year, month + 1, 0).getDate();
      periods.push({
        startDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
        endDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      });
    }
  }

  return periods;
}

/**
 * Calculate payroll entries from time entries
 */
export function calculatePayrollEntries(
  timeEntries: TimeEntry[],
  users: Map<string, User>,
  settings: PayrollSettings
): PayrollEntry[] {
  // Group time entries by user
  const entriesByUser = new Map<string, TimeEntry[]>();

  timeEntries.forEach((entry) => {
    if (!entriesByUser.has(entry.userId)) {
      entriesByUser.set(entry.userId, []);
    }
    entriesByUser.get(entry.userId)!.push(entry);
  });

  const payrollEntries: PayrollEntry[] = [];

  // Calculate payroll for each user
  entriesByUser.forEach((entries, userId) => {
    const user = users.get(userId);
    if (!user) return;

    const regularRate = user.hourlyRate || 15;
    const overtimeRate = regularRate * settings.overtimeMultiplier;
    const doubleTimeRate = settings.doubleTimeMultiplier
      ? regularRate * settings.doubleTimeMultiplier
      : overtimeRate;

    let totalHours = 0;
    entries.forEach((entry) => {
      totalHours += entry.totalHours || 0;
    });

    // Calculate regular, overtime, and double time
    let regularHours = 0;
    let overtimeHours = 0;
    let doubleTimeHours = 0;

    if (totalHours <= settings.overtimeThreshold) {
      regularHours = totalHours;
    } else if (!settings.doubleTimeThreshold || totalHours <= settings.doubleTimeThreshold) {
      regularHours = settings.overtimeThreshold;
      overtimeHours = totalHours - settings.overtimeThreshold;
    } else {
      regularHours = settings.overtimeThreshold;
      overtimeHours = settings.doubleTimeThreshold - settings.overtimeThreshold;
      doubleTimeHours = totalHours - settings.doubleTimeThreshold;
    }

    const grossPay =
      (regularHours * regularRate) +
      (overtimeHours * overtimeRate) +
      (doubleTimeHours * doubleTimeRate);

    payrollEntries.push({
      entryId: `payroll-${userId}-${Date.now()}`,
      periodId: '',
      userId,
      userName: `${user.firstName} ${user.lastName}`,
      employeeNumber: user.employeeNumber,
      regularHours,
      overtimeHours,
      doubleTimeHours: doubleTimeHours > 0 ? doubleTimeHours : undefined,
      regularRate,
      overtimeRate,
      doubleTimeRate: doubleTimeHours > 0 ? doubleTimeRate : undefined,
      grossPay,
      timeEntries: entries.map((e) => e.entryId),
    });
  });

  return payrollEntries;
}

/**
 * Export payroll to CSV format
 */
export function exportPayrollToCSV(entries: PayrollEntry[]): string {
  const headers = [
    'Employee Name',
    'Employee Number',
    'Regular Hours',
    'Overtime Hours',
    'Double Time Hours',
    'Regular Rate',
    'Overtime Rate',
    'Double Time Rate',
    'Gross Pay',
    'Federal Tax',
    'State Tax',
    'Social Security',
    'Medicare',
    'Total Deductions',
    'Net Pay',
  ];

  const rows = entries.map((entry) => {
    const totalDeductions = (entry.deductions || []).reduce((sum, d) => sum + d.amount, 0);

    return [
      entry.userName,
      entry.employeeNumber || '',
      entry.regularHours.toFixed(2),
      entry.overtimeHours.toFixed(2),
      entry.doubleTimeHours?.toFixed(2) || '0.00',
      entry.regularRate.toFixed(2),
      entry.overtimeRate.toFixed(2),
      entry.doubleTimeRate?.toFixed(2) || entry.overtimeRate.toFixed(2),
      entry.grossPay.toFixed(2),
      entry.federalTax?.toFixed(2) || '0.00',
      entry.stateTax?.toFixed(2) || '0.00',
      entry.socialSecurity?.toFixed(2) || '0.00',
      entry.medicare?.toFixed(2) || '0.00',
      totalDeductions.toFixed(2),
      entry.netPay?.toFixed(2) || entry.grossPay.toFixed(2),
    ];
  });

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

/**
 * Export payroll to QuickBooks IIF format
 */
export function exportPayrollToQuickBooks(
  entries: PayrollEntry[],
  period: PayrollPeriod,
  companyName: string
): string {
  const lines: string[] = [];

  // Header
  lines.push('!TIMERHDR\tVER\tREL\tCOMPANYNAME\tIMPORTEDBEFORE');
  lines.push(`TIMERHDR\t8\t0\t${companyName}\tN`);
  lines.push('');

  // Time activities
  lines.push('!TIMEACT\tDATE\tJOB\tEMP\tITEM\tPITEM\tDURATION\tPROJ\tNOTE\tBILLINGSTATUS');

  entries.forEach((entry) => {
    const regularLine = [
      'TIMEACT',
      period.endDate,
      '',
      entry.userName,
      'Regular',
      '',
      entry.regularHours.toFixed(2),
      '',
      `Regular hours for period ${period.startDate} to ${period.endDate}`,
      '0',
    ].join('\t');
    lines.push(regularLine);

    if (entry.overtimeHours > 0) {
      const overtimeLine = [
        'TIMEACT',
        period.endDate,
        '',
        entry.userName,
        'Overtime',
        '',
        entry.overtimeHours.toFixed(2),
        '',
        `Overtime hours for period ${period.startDate} to ${period.endDate}`,
        '0',
      ].join('\t');
      lines.push(overtimeLine);
    }

    if (entry.doubleTimeHours && entry.doubleTimeHours > 0) {
      const doubleTimeLine = [
        'TIMEACT',
        period.endDate,
        '',
        entry.userName,
        'Double Time',
        '',
        entry.doubleTimeHours.toFixed(2),
        '',
        `Double time hours for period ${period.startDate} to ${period.endDate}`,
        '0',
      ].join('\t');
      lines.push(doubleTimeLine);
    }
  });

  return lines.join('\n');
}

/**
 * Export payroll to ADP format
 */
export function exportPayrollToADP(entries: PayrollEntry[], period: PayrollPeriod): string {
  const headers = [
    'Co Code',
    'Batch ID',
    'File #',
    'Reg Hours',
    'O/T Hours',
    'Reg Earnings',
    'O/T Earnings',
    'Gross Pay',
  ];

  const rows = entries.map((entry) => {
    const regularEarnings = entry.regularHours * entry.regularRate;
    const overtimeEarnings = entry.overtimeHours * entry.overtimeRate;
    const doubleTimeEarnings = (entry.doubleTimeHours || 0) * (entry.doubleTimeRate || entry.overtimeRate);
    const totalOvertimeHours = entry.overtimeHours + (entry.doubleTimeHours || 0);
    const totalOvertimeEarnings = overtimeEarnings + doubleTimeEarnings;

    return [
      '001', // Company code (configurable)
      period.periodId.slice(0, 10),
      entry.employeeNumber || entry.userId.slice(0, 10),
      entry.regularHours.toFixed(2),
      totalOvertimeHours.toFixed(2),
      regularEarnings.toFixed(2),
      totalOvertimeEarnings.toFixed(2),
      entry.grossPay.toFixed(2),
    ];
  });

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

/**
 * Export payroll to generic JSON format
 */
export function exportPayrollToJSON(
  entries: PayrollEntry[],
  period: PayrollPeriod
): string {
  const data = {
    period: {
      id: period.periodId,
      startDate: period.startDate,
      endDate: period.endDate,
      payDate: period.payDate,
      status: period.status,
    },
    summary: {
      totalGrossPay: entries.reduce((sum, e) => sum + e.grossPay, 0),
      totalRegularHours: entries.reduce((sum, e) => sum + e.regularHours, 0),
      totalOvertimeHours: entries.reduce((sum, e) => sum + e.overtimeHours, 0),
      employeeCount: entries.length,
    },
    entries: entries.map((entry) => ({
      employee: {
        id: entry.userId,
        name: entry.userName,
        number: entry.employeeNumber,
      },
      hours: {
        regular: entry.regularHours,
        overtime: entry.overtimeHours,
        doubleTime: entry.doubleTimeHours,
      },
      rates: {
        regular: entry.regularRate,
        overtime: entry.overtimeRate,
        doubleTime: entry.doubleTimeRate,
      },
      earnings: {
        gross: entry.grossPay,
        net: entry.netPay,
      },
      taxes: {
        federal: entry.federalTax,
        state: entry.stateTax,
        socialSecurity: entry.socialSecurity,
        medicare: entry.medicare,
      },
      deductions: entry.deductions,
    })),
  };

  return JSON.stringify(data, null, 2);
}

// Helper functions
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
