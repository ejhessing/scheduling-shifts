import { z } from 'zod';

// Auth Schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signupSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    organizationName: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// User Schemas
export const userProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phoneNumber: z.string().optional(),
  position: z.string().optional(),
});

// Location Schemas
export const locationSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  address: z.string().min(1, 'Address is required'),
  coordinates: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  geofenceRadius: z.number().min(10).max(1000, 'Radius must be between 10 and 1000 meters'),
  color: z.string().optional(),
});

// Time-Off Schemas
export const timeOffRequestSchema = z
  .object({
    type: z.enum(['vacation', 'sick', 'personal', 'unpaid', 'other']),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    reason: z.string().optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return start <= end;
    },
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    }
  )
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return start >= today;
    },
    {
      message: 'Start date cannot be in the past',
      path: ['startDate'],
    }
  );

export const timeOffReviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
});

// Shift Schemas
export const shiftSchema = z
  .object({
    userId: z.string().min(1, 'Employee is required'),
    locationId: z.string().min(1, 'Location is required'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
    position: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      const [startHours, startMins] = data.startTime.split(':').map(Number);
      const [endHours, endMins] = data.endTime.split(':').map(Number);
      const startMinutes = startHours * 60 + startMins;
      const endMinutes = endHours * 60 + endMins;

      // Allow overnight shifts (end < start is valid)
      return true;
    },
    {
      message: 'End time must be different from start time',
      path: ['endTime'],
    }
  );

// Shift Template Schemas
export const shiftTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  locationId: z.string().min(1, 'Location is required'),
  position: z.string().optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  daysOfWeek: z.array(z.number().min(0).max(6)).min(1, 'Select at least one day'),
  color: z.string().optional(),
});

// Availability Schemas
export const availabilitySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  effectiveDate: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

export const setAvailabilitySchema = z.object({
  userId: z.string().optional(),
  availabilities: z.array(availabilitySchema).min(1, 'At least one availability slot is required'),
});

// Time Entry Schemas
export const clockInSchema = z.object({
  locationId: z.string().min(1, 'Location is required'),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number().optional(),
  }),
  notes: z.string().optional(),
  photo: z.string().optional(),
});

export const clockOutSchema = z.object({
  entryId: z.string().min(1, 'Entry ID is required'),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number().optional(),
  }),
  notes: z.string().optional(),
  photo: z.string().optional(),
});

// Report Schemas
export const generateReportSchema = z.object({
  type: z.enum(['timesheet', 'labor_cost', 'attendance', 'overtime']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  format: z.enum(['json', 'csv']).default('json'),
  userId: z.string().optional(),
});

// Helper to parse and validate data
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
} {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  result.error.errors.forEach((error) => {
    const path = error.path.join('.');
    errors[path] = error.message;
  });

  return { success: false, errors };
}

// Export types from schemas
export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type UserProfileFormData = z.infer<typeof userProfileSchema>;
export type LocationFormData = z.infer<typeof locationSchema>;
export type TimeOffRequestFormData = z.infer<typeof timeOffRequestSchema>;
export type ShiftFormData = z.infer<typeof shiftSchema>;
export type ShiftTemplateFormData = z.infer<typeof shiftTemplateSchema>;
export type AvailabilityFormData = z.infer<typeof availabilitySchema>;
