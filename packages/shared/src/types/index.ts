// Core Entity Types

export interface User {
  userId: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  orgId: string;
  locationIds: string[];
  preferences: UserPreferences;
  certifications: Certification[];
  skills: string[];
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORG_ADMIN = 'ORG_ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

export interface UserPreferences {
  theme?: 'light' | 'dark';
  notifications?: NotificationPreferences;
  timezone?: string;
  language?: string;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  shiftReminders: boolean;
  scheduleChanges: boolean;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  documentUrl?: string;
}

export interface Organization {
  orgId: string;
  name: string;
  plan: PricingPlan;
  settings: OrganizationSettings;
  complianceRules: ComplianceRules;
  timezone: string;
  billingInfo: BillingInfo;
  createdAt: string;
  updatedAt: string;
}

export enum PricingPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

export interface OrganizationSettings {
  workWeekStart: number; // 0 = Sunday, 1 = Monday, etc.
  overtimeThreshold: number; // hours per week
  requireClockInPhoto: boolean;
  requireGeofence: boolean;
  autoApproveTimeEntries: boolean;
  payPeriodType: 'WEEKLY' | 'BI_WEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY';
}

export interface ComplianceRules {
  maxHoursPerDay?: number;
  maxHoursPerWeek?: number;
  minRestBetweenShifts?: number; // hours
  breakRules: BreakRule[];
  overtimeRules: OvertimeRule[];
}

export interface BreakRule {
  minShiftDuration: number; // hours
  breakDuration: number; // minutes
  paid: boolean;
}

export interface OvertimeRule {
  threshold: number; // hours
  multiplier: number; // e.g., 1.5 for time-and-a-half
  period: 'DAILY' | 'WEEKLY';
}

export interface BillingInfo {
  customerId?: string;
  subscriptionId?: string;
  paymentMethodId?: string;
  billingEmail: string;
}

export interface Location {
  locationId: string;
  orgId: string;
  name: string;
  address: Address;
  geofence: Geofence;
  timezone: string;
  settings: LocationSettings;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface Geofence {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface LocationSettings {
  allowedClockInMethods: ClockInMethod[];
  requirePhoto: boolean;
  requireBiometric: boolean;
}

export enum ClockInMethod {
  MOBILE = 'MOBILE',
  WEB = 'WEB',
  KIOSK = 'KIOSK',
  QR_CODE = 'QR_CODE',
}

export interface Shift {
  shiftId: string;
  userId: string;
  locationId: string;
  orgId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  position: string;
  status: ShiftStatus;
  breakRules: BreakRule[];
  payRate: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export enum ShiftStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export interface TimeEntry {
  entryId: string;
  userId: string;
  shiftId?: string;
  locationId: string;
  orgId: string;
  date: string; // YYYY-MM-DD
  clockInTime: string; // ISO 8601
  clockOutTime?: string; // ISO 8601
  clockInLocation: GeoLocation;
  clockOutLocation?: GeoLocation;
  breaks: Break[];
  totalHours?: number;
  regularHours?: number;
  overtimeHours?: number;
  photos?: {
    clockIn?: string; // S3 key
    clockOut?: string; // S3 key
  };
  status: TimeEntryStatus;
  approvedBy?: string;
  approvedAt?: string;
  payRate: number;
  totalPay?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export enum TimeEntryStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
  timestamp: string;
}

export interface Break {
  startTime: string; // ISO 8601
  endTime?: string; // ISO 8601
  paid: boolean;
  duration?: number; // minutes
}

export interface Message {
  messageId: string;
  senderId: string;
  channelId: string;
  orgId: string;
  content: string;
  attachments: Attachment[];
  readBy: string[];
  timestamp: string;
  editedAt?: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string; // S3 presigned URL
}

export interface Document {
  docId: string;
  userId: string;
  orgId: string;
  name: string;
  type: DocumentType;
  s3Key: string;
  uploadedBy: string;
  uploadedAt: string;
  expiresAt?: string;
  status: DocumentStatus;
}

export enum DocumentType {
  CERTIFICATION = 'CERTIFICATION',
  LICENSE = 'LICENSE',
  ID = 'ID',
  CONTRACT = 'CONTRACT',
  HANDBOOK = 'HANDBOOK',
  OTHER = 'OTHER',
}

export enum DocumentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export interface Notification {
  notifId: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

export enum NotificationType {
  SHIFT_ASSIGNED = 'SHIFT_ASSIGNED',
  SHIFT_REMINDER = 'SHIFT_REMINDER',
  SHIFT_CHANGED = 'SHIFT_CHANGED',
  SHIFT_CANCELLED = 'SHIFT_CANCELLED',
  SHIFT_SWAP_REQUEST = 'SHIFT_SWAP_REQUEST',
  TIME_ENTRY_APPROVED = 'TIME_ENTRY_APPROVED',
  TIME_ENTRY_REJECTED = 'TIME_ENTRY_REJECTED',
  CERTIFICATION_EXPIRING = 'CERTIFICATION_EXPIRING',
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  OVERTIME_WARNING = 'OVERTIME_WARNING',
}

// API Request/Response Types

export interface ClockInRequest {
  userId: string;
  locationId: string;
  location: GeoLocation;
  photo?: string; // base64 encoded
  method: ClockInMethod;
}

export interface ClockInResponse {
  entryId: string;
  clockInTime: string;
  validGeofence: boolean;
  message: string;
}

export interface ClockOutRequest {
  entryId: string;
  location: GeoLocation;
  photo?: string; // base64 encoded
}

export interface ClockOutResponse {
  entryId: string;
  clockOutTime: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  totalPay: number;
  message: string;
}

export interface CreateShiftRequest {
  userId: string;
  locationId: string;
  startTime: string;
  endTime: string;
  position: string;
  payRate: number;
  notes?: string;
}

export interface UpdateShiftRequest {
  shiftId: string;
  startTime?: string;
  endTime?: string;
  position?: string;
  status?: ShiftStatus;
  notes?: string;
}

export interface GetScheduleRequest {
  locationId?: string;
  userId?: string;
  startDate: string;
  endDate: string;
}

export interface GetScheduleResponse {
  shifts: Shift[];
  totalShifts: number;
}

// Error Types

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  GEOFENCE_VIOLATION = 'GEOFENCE_VIOLATION',
  ALREADY_CLOCKED_IN = 'ALREADY_CLOCKED_IN',
  NOT_CLOCKED_IN = 'NOT_CLOCKED_IN',
  SHIFT_CONFLICT = 'SHIFT_CONFLICT',
  OVERTIME_LIMIT = 'OVERTIME_LIMIT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
