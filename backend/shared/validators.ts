import { z } from 'zod';

// Common schemas
export const emailSchema = z.string().email();
export const passwordSchema = z.string().min(8).max(100);
export const uuidSchema = z.string().uuid();
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const isoDateTimeSchema = z.string().datetime();

// Location schema
export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
});

// User schemas
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1).max(100),
  phone: z.string().optional(),
  orgName: z.string().min(1).max(200).optional(), // For creating new org
  orgId: z.string().optional(), // For joining existing org
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  preferences: z.record(z.any()).optional(),
  skills: z.array(z.string()).optional(),
});

// Time tracking schemas
export const clockInSchema = z.object({
  locationId: z.string(),
  location: locationSchema,
  photo: z.string().optional(), // Base64 encoded image
  notes: z.string().optional(),
});

export const clockOutSchema = z.object({
  entryId: z.string(),
  location: locationSchema,
  photo: z.string().optional(),
  notes: z.string().optional(),
});

export const updateTimeEntrySchema = z.object({
  clockInTime: isoDateTimeSchema.optional(),
  clockOutTime: isoDateTimeSchema.optional(),
  breaks: z
    .array(
      z.object({
        start: isoDateTimeSchema,
        end: isoDateTimeSchema,
        paid: z.boolean(),
      })
    )
    .optional(),
  notes: z.string().optional(),
});

// Scheduling schemas
export const createShiftSchema = z.object({
  userId: z.string(),
  locationId: z.string(),
  startTime: isoDateTimeSchema,
  endTime: isoDateTimeSchema,
  position: z.string().optional(),
  notes: z.string().optional(),
  payRate: z.number().positive().optional(),
  breakRules: z
    .array(
      z.object({
        duration: z.number().positive(), // in minutes
        paid: z.boolean(),
        required: z.boolean(),
      })
    )
    .optional(),
});

export const updateShiftSchema = z.object({
  startTime: isoDateTimeSchema.optional(),
  endTime: isoDateTimeSchema.optional(),
  position: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled']).optional(),
  payRate: z.number().positive().optional(),
});

export const swapShiftSchema = z.object({
  shiftId: z.string(),
  targetUserId: z.string(),
  message: z.string().optional(),
});

// Helper to validate and parse request body
export function validateBody<T>(schema: z.Schema<T>, body: string | null): T {
  if (!body) {
    throw new Error('Request body is required');
  }

  try {
    const parsed = JSON.parse(body);
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map((e) => e.message).join(', ')}`);
    }
    throw error;
  }
}
