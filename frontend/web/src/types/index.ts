// User and Auth Types
export interface User {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'employee' | 'manager' | 'admin' | 'owner';
  organizationId: string;
  hireDate?: string;
  phoneNumber?: string;
  position?: string;
}

// Time-Off Types
export type TimeOffType = 'vacation' | 'sick' | 'personal' | 'unpaid' | 'other';
export type TimeOffStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface TimeOffRequest {
  requestId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  type: TimeOffType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  status: TimeOffStatus;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
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

// Location Types
export interface Location {
  locationId: string;
  organizationId: string;
  name: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  geofenceRadius: number;
  color?: string;
  createdAt: string;
}

// Time Entry Types
export type TimeEntryStatus = 'pending' | 'approved' | 'rejected';

export interface TimeEntry {
  entryId: string;
  userId: string;
  organizationId: string;
  locationId: string;
  clockInTime: string;
  clockOutTime?: string;
  totalHours?: number;
  status: TimeEntryStatus;
  clockInLocation: {
    lat: number;
    lng: number;
  };
  clockOutLocation?: {
    lat: number;
    lng: number;
  };
  notes?: string;
  breaks?: Array<{
    startTime: string;
    endTime: string;
    duration: number;
  }>;
}

// Shift Types
export type ShiftStatus = 'draft' | 'published' | 'completed' | 'cancelled';

export interface Shift {
  shiftId: string;
  userId: string;
  organizationId: string;
  locationId: string;
  date: string;
  startTime: string;
  endTime: string;
  position?: string;
  notes?: string;
  status: ShiftStatus;
  createdBy: string;
  createdAt: string;
}

// Shift Template Types
export interface ShiftTemplate {
  templateId: string;
  organizationId: string;
  name: string;
  description?: string;
  locationId: string;
  position?: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  color?: string;
  createdBy: string;
  createdAt: string;
}

// Availability Types
export interface Availability {
  availabilityId: string;
  userId: string;
  organizationId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveDate?: string;
  expiryDate?: string;
  isRecurring: boolean;
  notes?: string;
}

// Schedule Conflict Types
export type ConflictType =
  | 'overlap'
  | 'double_booking'
  | 'unavailable'
  | 'time_off'
  | 'insufficient_rest'
  | 'overtime_risk';

export interface ScheduleConflict {
  type: ConflictType;
  severity: 'error' | 'warning';
  shiftId?: string;
  userId: string;
  date: string;
  description: string;
  conflictingShiftId?: string;
}

// Compliance Types
export type ViolationType =
  | 'missing_break'
  | 'excessive_shift_length'
  | 'insufficient_rest_period'
  | 'daily_overtime'
  | 'weekly_overtime'
  | 'excessive_consecutive_days'
  | 'minor_work_hours'
  | 'minor_prohibited_hours';

export interface ComplianceViolation {
  type: ViolationType;
  severity: 'warning' | 'critical';
  description: string;
  userId: string;
  entryId?: string;
  date: string;
}

// Report Types
export type ReportType = 'timesheet' | 'labor_cost' | 'attendance' | 'overtime';

export interface Report {
  reportId: string;
  type: ReportType;
  organizationId: string;
  startDate: string;
  endDate: string;
  generatedBy: string;
  generatedAt: string;
  data: any;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
