/**
 * Time-Off Management Utilities
 * Handles PTO balance calculations, accruals, and validation
 */

export type TimeOffType = 'vacation' | 'sick' | 'personal' | 'unpaid' | 'other';
export type TimeOffStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface TimeOffRequest {
  requestId: string;
  userId: string;
  organizationId: string;
  type: TimeOffType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalDays: number;
  reason?: string;
  status: TimeOffStatus;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface TimeOffPolicy {
  organizationId: string;
  vacationDaysPerYear: number;
  sickDaysPerYear: number;
  personalDaysPerYear: number;
  accrualPeriod: 'yearly' | 'monthly' | 'biweekly'; // How often PTO accrues
  carryoverLimit: number; // Max days that can carry over to next year
  minRequestNotice: number; // Days in advance required for requests
  maxConsecutiveDays: number; // Max consecutive days allowed
  requireManagerApproval: boolean;
  allowNegativeBalance: boolean;
  yearStartMonth: number; // 1-12, when PTO year resets
}

export interface TimeOffBalance {
  userId: string;
  organizationId: string;
  year: number;
  vacation: {
    accrued: number;
    used: number;
    pending: number;
    available: number;
  };
  sick: {
    accrued: number;
    used: number;
    pending: number;
    available: number;
  };
  personal: {
    accrued: number;
    used: number;
    pending: number;
    available: number;
  };
  lastUpdated: string;
}

export const DEFAULT_TIME_OFF_POLICY: Omit<TimeOffPolicy, 'organizationId'> = {
  vacationDaysPerYear: 10,
  sickDaysPerYear: 5,
  personalDaysPerYear: 3,
  accrualPeriod: 'monthly',
  carryoverLimit: 5,
  minRequestNotice: 7, // 1 week notice
  maxConsecutiveDays: 14, // 2 weeks max
  requireManagerApproval: true,
  allowNegativeBalance: false,
  yearStartMonth: 1, // January
};

/**
 * Calculate business days between two dates (excluding weekends)
 */
export function calculateBusinessDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  let days = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days++;
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
}

/**
 * Calculate accrued PTO based on hire date and policy
 */
export function calculateAccruedPTO(
  hireDate: string,
  currentDate: string,
  daysPerYear: number,
  accrualPeriod: 'yearly' | 'monthly' | 'biweekly'
): number {
  const hire = new Date(hireDate);
  const current = new Date(currentDate);

  const monthsWorked = (current.getFullYear() - hire.getFullYear()) * 12
    + (current.getMonth() - hire.getMonth());

  if (monthsWorked < 0) return 0;

  switch (accrualPeriod) {
    case 'yearly':
      // Accrues all at once on anniversary
      const yearsWorked = Math.floor(monthsWorked / 12);
      return yearsWorked * daysPerYear;

    case 'monthly':
      // Accrues monthly
      const monthlyRate = daysPerYear / 12;
      return Math.floor(monthsWorked * monthlyRate * 100) / 100; // Round to 2 decimals

    case 'biweekly':
      // Accrues every 2 weeks (26 periods per year)
      const daysWorked = Math.floor((current.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24));
      const biweeklyPeriods = Math.floor(daysWorked / 14);
      const biweeklyRate = daysPerYear / 26;
      return Math.floor(biweeklyPeriods * biweeklyRate * 100) / 100;

    default:
      return 0;
  }
}

/**
 * Calculate PTO balance for a user
 */
export function calculateTimeOffBalance(
  hireDate: string,
  currentDate: string,
  policy: TimeOffPolicy,
  approvedRequests: TimeOffRequest[],
  pendingRequests: TimeOffRequest[]
): TimeOffBalance {
  const year = new Date(currentDate).getFullYear();

  // Calculate accrued days
  const vacationAccrued = calculateAccruedPTO(
    hireDate,
    currentDate,
    policy.vacationDaysPerYear,
    policy.accrualPeriod
  );
  const sickAccrued = calculateAccruedPTO(
    hireDate,
    currentDate,
    policy.sickDaysPerYear,
    policy.accrualPeriod
  );
  const personalAccrued = calculateAccruedPTO(
    hireDate,
    currentDate,
    policy.personalDaysPerYear,
    policy.accrualPeriod
  );

  // Calculate used days (approved requests in current year)
  const currentYear = new Date(currentDate).getFullYear();
  const vacationUsed = approvedRequests
    .filter(r => r.type === 'vacation' && new Date(r.startDate).getFullYear() === currentYear)
    .reduce((sum, r) => sum + r.totalDays, 0);
  const sickUsed = approvedRequests
    .filter(r => r.type === 'sick' && new Date(r.startDate).getFullYear() === currentYear)
    .reduce((sum, r) => sum + r.totalDays, 0);
  const personalUsed = approvedRequests
    .filter(r => r.type === 'personal' && new Date(r.startDate).getFullYear() === currentYear)
    .reduce((sum, r) => sum + r.totalDays, 0);

  // Calculate pending days
  const vacationPending = pendingRequests
    .filter(r => r.type === 'vacation')
    .reduce((sum, r) => sum + r.totalDays, 0);
  const sickPending = pendingRequests
    .filter(r => r.type === 'sick')
    .reduce((sum, r) => sum + r.totalDays, 0);
  const personalPending = pendingRequests
    .filter(r => r.type === 'personal')
    .reduce((sum, r) => sum + r.totalDays, 0);

  return {
    userId: approvedRequests[0]?.userId || pendingRequests[0]?.userId || '',
    organizationId: policy.organizationId,
    year,
    vacation: {
      accrued: vacationAccrued,
      used: vacationUsed,
      pending: vacationPending,
      available: vacationAccrued - vacationUsed - vacationPending,
    },
    sick: {
      accrued: sickAccrued,
      used: sickUsed,
      pending: sickPending,
      available: sickAccrued - sickUsed - sickPending,
    },
    personal: {
      accrued: personalAccrued,
      used: personalUsed,
      pending: personalPending,
      available: personalAccrued - personalUsed - personalPending,
    },
    lastUpdated: currentDate,
  };
}

/**
 * Validate time-off request against policy
 */
export function validateTimeOffRequest(
  request: Partial<TimeOffRequest>,
  policy: TimeOffPolicy,
  balance: TimeOffBalance,
  existingRequests: TimeOffRequest[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!request.startDate || !request.endDate) {
    errors.push('Start date and end date are required');
    return { valid: false, errors };
  }

  const start = new Date(request.startDate);
  const end = new Date(request.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if dates are valid
  if (start > end) {
    errors.push('Start date must be before end date');
  }

  // Check minimum notice requirement
  const daysUntilStart = Math.floor((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilStart < policy.minRequestNotice) {
    errors.push(`Time-off requests require at least ${policy.minRequestNotice} days notice`);
  }

  // Check maximum consecutive days
  const totalDays = request.totalDays || calculateBusinessDays(request.startDate, request.endDate);
  if (totalDays > policy.maxConsecutiveDays) {
    errors.push(`Cannot request more than ${policy.maxConsecutiveDays} consecutive days`);
  }

  // Check balance availability
  if (request.type && !policy.allowNegativeBalance) {
    const typeBalance = balance[request.type as 'vacation' | 'sick' | 'personal'];
    if (typeBalance && totalDays > typeBalance.available) {
      errors.push(`Insufficient ${request.type} balance. Available: ${typeBalance.available} days`);
    }
  }

  // Check for overlapping requests
  const hasOverlap = existingRequests.some(existing => {
    if (existing.status === 'rejected' || existing.status === 'cancelled') return false;

    const existingStart = new Date(existing.startDate);
    const existingEnd = new Date(existing.endDate);

    return (start <= existingEnd && end >= existingStart);
  });

  if (hasOverlap) {
    errors.push('Request overlaps with an existing time-off request');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a date falls within any approved time-off
 */
export function isDateDuringTimeOff(
  date: string,
  approvedRequests: TimeOffRequest[]
): boolean {
  const checkDate = new Date(date);

  return approvedRequests.some(request => {
    const start = new Date(request.startDate);
    const end = new Date(request.endDate);
    return checkDate >= start && checkDate <= end;
  });
}
