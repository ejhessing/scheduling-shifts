import { ApiError, ErrorCode } from '../types';

/**
 * Validates email format
 * @param email Email address to validate
 * @returns True if valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates phone number format (US format)
 * @param phone Phone number to validate
 * @returns True if valid
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?1?\d{10,}$/;
  return phoneRegex.test(phone.replace(/[-\s()]/g, ''));
}

/**
 * Validates password strength
 * @param password Password to validate
 * @returns Object with valid flag and error message
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
}

/**
 * Validates that a date string is in YYYY-MM-DD format
 * @param dateString Date string to validate
 * @returns True if valid
 */
export function isValidDateString(dateString: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validates that a timestamp is in ISO 8601 format
 * @param timestamp Timestamp string to validate
 * @returns True if valid
 */
export function isValidTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Creates a standardized API error response
 * @param code Error code
 * @param message Error message
 * @param details Additional error details
 * @returns ApiError object
 */
export function createError(code: ErrorCode, message: string, details?: any): ApiError {
  return {
    code,
    message,
    details,
  };
}

/**
 * Validates required fields in an object
 * @param obj Object to validate
 * @param requiredFields Array of required field names
 * @returns Validation result with missing fields
 */
export function validateRequiredFields(
  obj: any,
  requiredFields: string[]
): { valid: boolean; missingFields: string[] } {
  const missingFields = requiredFields.filter(field => {
    const value = obj[field];
    return value === undefined || value === null || value === '';
  });

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Sanitizes user input to prevent XSS attacks
 * @param input User input string
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validates pay rate
 * @param payRate Pay rate to validate
 * @returns True if valid
 */
export function isValidPayRate(payRate: number): boolean {
  return typeof payRate === 'number' && payRate >= 0 && payRate <= 1000;
}

/**
 * Validates coordinates
 * @param latitude Latitude
 * @param longitude Longitude
 * @returns True if valid
 */
export function isValidCoordinates(latitude: number, longitude: number): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
