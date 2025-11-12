// API Configuration
export const API_VERSION = 'v1';
export const API_TIMEOUT = 30000; // 30 seconds

// Time Constants
export const MILLISECONDS_PER_HOUR = 3600000;
export const MILLISECONDS_PER_MINUTE = 60000;
export const HOURS_PER_DAY = 24;
export const DAYS_PER_WEEK = 7;

// Geofence Defaults
export const DEFAULT_GEOFENCE_RADIUS = 100; // meters
export const MAX_GPS_ACCURACY = 50; // meters
export const MIN_GPS_ACCURACY = 10; // meters

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// File Upload
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
];

// Date Formats
export const DATE_FORMAT = 'YYYY-MM-DD';
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export const TIME_FORMAT = 'HH:mm';

// Pay Rate Limits
export const MIN_PAY_RATE = 0;
export const MAX_PAY_RATE = 1000;

// Shift Duration Limits (in hours)
export const MIN_SHIFT_DURATION = 0.25; // 15 minutes
export const MAX_SHIFT_DURATION = 24;

// Break Duration Limits (in minutes)
export const MIN_BREAK_DURATION = 5;
export const MAX_BREAK_DURATION = 120; // 2 hours

// Compliance Defaults
export const DEFAULT_OVERTIME_THRESHOLD = 40; // hours per week
export const DEFAULT_OVERTIME_MULTIPLIER = 1.5;
export const DEFAULT_MIN_REST_BETWEEN_SHIFTS = 8; // hours

// Notification Settings
export const SHIFT_REMINDER_ADVANCE = 60; // minutes before shift
export const CERTIFICATION_EXPIRY_WARNING = 30; // days before expiry

// Cache TTL (in seconds)
export const CACHE_TTL = {
  USER_SESSION: 3600, // 1 hour
  ORG_SETTINGS: 86400, // 24 hours
  SCHEDULE_DATA: 900, // 15 minutes
  USER_PREFERENCES: 3600, // 1 hour
  GEOFENCE_BOUNDARIES: 86400, // 24 hours
  ACTIVE_SHIFTS: 300, // 5 minutes
};

// Rate Limiting
export const RATE_LIMITS = {
  CLOCK_IN_OUT: { requests: 10, window: 60 }, // 10 requests per minute
  API_GENERAL: { requests: 100, window: 60 }, // 100 requests per minute
  LOGIN: { requests: 5, window: 300 }, // 5 requests per 5 minutes
};

// Pricing Tiers (monthly per user)
export const PRICING = {
  FREE: { maxUsers: 10, price: 0 },
  STARTER: { price: 2.99 },
  PROFESSIONAL: { price: 5.99 },
  ENTERPRISE: { price: 'custom' },
};

// Feature Flags by Plan
export const FEATURES_BY_PLAN = {
  FREE: [
    'time_tracking',
    'basic_scheduling',
    'mobile_apps',
    'gps_tracking',
    'basic_reporting',
  ],
  STARTER: [
    'time_tracking',
    'basic_scheduling',
    'advanced_scheduling',
    'mobile_apps',
    'gps_tracking',
    'basic_reporting',
    'shift_swapping',
    'break_compliance',
  ],
  PROFESSIONAL: [
    'time_tracking',
    'basic_scheduling',
    'advanced_scheduling',
    'mobile_apps',
    'gps_tracking',
    'basic_reporting',
    'advanced_reporting',
    'shift_swapping',
    'break_compliance',
    'auto_scheduling',
    'payroll_integration',
    'document_management',
    'api_access',
  ],
  ENTERPRISE: ['all'],
};

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// DynamoDB Configuration
export const DYNAMODB_CONFIG = {
  TABLE_NAME: process.env.TABLE_NAME || 'TimeTrackingApp',
  GSI1_NAME: 'GSI1',
  GSI2_NAME: 'GSI2',
  GSI3_NAME: 'GSI3',
};

// S3 Configuration
export const S3_CONFIG = {
  BUCKET_NAME: process.env.S3_BUCKET_NAME || 'time-tracking-app-files',
  PHOTO_PREFIX: 'photos/',
  DOCUMENT_PREFIX: 'documents/',
  PRESIGNED_URL_EXPIRY: 3600, // 1 hour
};

// WebSocket Configuration
export const WEBSOCKET_CONFIG = {
  PING_INTERVAL: 30000, // 30 seconds
  IDLE_TIMEOUT: 600000, // 10 minutes
};

// Cognito Configuration
export const COGNITO_CONFIG = {
  USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
  CLIENT_ID: process.env.COGNITO_CLIENT_ID,
  TOKEN_EXPIRY: 3600, // 1 hour
  REFRESH_TOKEN_EXPIRY: 2592000, // 30 days
};
