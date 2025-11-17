import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a unique ID
 */
export const generateId = (): string => {
  return uuidv4();
};

/**
 * Gets current timestamp in ISO format
 */
export const now = (): string => {
  return new Date().toISOString();
};

/**
 * Formats a date as YYYY-MM-DD
 */
export const formatDate = (date: Date = new Date()): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Gets the week number for a date (ISO week)
 */
export const getWeekNumber = (date: Date = new Date()): string => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
};

/**
 * Calculates hours between two timestamps
 */
export const calculateHours = (startTime: string, endTime: string): number => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const diffMs = end - start;
  return diffMs / (1000 * 60 * 60); // Convert to hours
};

/**
 * Calculates hours with break deductions
 */
export const calculateWorkedHours = (
  startTime: string,
  endTime: string,
  breaks: Array<{ start: string; end: string; paid: boolean }>
): { totalHours: number; paidHours: number } => {
  const totalHours = calculateHours(startTime, endTime);

  let unpaidBreakHours = 0;
  for (const brk of breaks) {
    if (!brk.paid) {
      unpaidBreakHours += calculateHours(brk.start, brk.end);
    }
  }

  const paidHours = totalHours - unpaidBreakHours;

  return {
    totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimals
    paidHours: Math.round(paidHours * 100) / 100,
  };
};

/**
 * Calculates overtime hours based on rules
 */
export const calculateOvertime = (
  regularHours: number,
  dailyOvertimeThreshold: number = 8,
  weeklyOvertimeThreshold: number = 40
): { regularHours: number; overtimeHours: number } => {
  if (regularHours <= dailyOvertimeThreshold) {
    return {
      regularHours: Math.round(regularHours * 100) / 100,
      overtimeHours: 0,
    };
  }

  const overtimeHours = regularHours - dailyOvertimeThreshold;
  return {
    regularHours: Math.round(dailyOvertimeThreshold * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
  };
};

/**
 * Calculates pay for time entry
 */
export const calculatePay = (
  hours: number,
  payRate: number,
  overtimeHours: number = 0,
  overtimeMultiplier: number = 1.5
): { regularPay: number; overtimePay: number; totalPay: number } => {
  const regularHours = hours - overtimeHours;
  const regularPay = regularHours * payRate;
  const overtimePay = overtimeHours * payRate * overtimeMultiplier;
  const totalPay = regularPay + overtimePay;

  return {
    regularPay: Math.round(regularPay * 100) / 100,
    overtimePay: Math.round(overtimePay * 100) / 100,
    totalPay: Math.round(totalPay * 100) / 100,
  };
};

/**
 * Checks if a user has a specific role or higher
 */
export const hasRole = (userRole: string, requiredRole: string): boolean => {
  const roleHierarchy: Record<string, number> = {
    employee: 1,
    manager: 2,
    admin: 3,
    owner: 4,
  };

  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
};

/**
 * Parses query string parameters
 */
export const parseQueryParams = (params: Record<string, any> | null): Record<string, string> => {
  if (!params) return {};
  return Object.keys(params).reduce((acc, key) => {
    acc[key] = String(params[key]);
    return acc;
  }, {} as Record<string, string>);
};

/**
 * Chunks an array into smaller arrays
 */
export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Delays execution
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
