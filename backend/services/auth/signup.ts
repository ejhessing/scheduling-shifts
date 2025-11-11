import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error, validationError } from '../../shared/response';
import { hashPassword, generateToken, generateRefreshToken } from '../../shared/auth';
import { validateBody, signupSchema } from '../../shared/validators';
import { generateId, now } from '../../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Validate request body
    const body = validateBody(signupSchema, event.body);

    // Check if user already exists
    const existingUsers = await db.query(`USER#EMAIL#${body.email}`, undefined);
    if (existingUsers && existingUsers.length > 0) {
      return validationError('Email already registered');
    }

    // Generate IDs
    const userId = generateId();
    let orgId = body.orgId;

    // If no orgId provided, create a new organization
    if (!orgId && body.orgName) {
      orgId = generateId();

      const organization = {
        PK: `ORG#${orgId}`,
        SK: `ORG#${orgId}`,
        orgId,
        name: body.orgName,
        plan: 'free', // Default to free plan
        settings: {
          timezone: 'America/New_York',
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '12h',
          weekStart: 'sunday',
        },
        complianceRules: {
          overtimeThreshold: 40, // hours per week
          dailyOvertimeThreshold: 8, // hours per day
          overtimeMultiplier: 1.5,
          requireBreaks: true,
          breakRules: [
            { minHours: 5, breakDuration: 30, paid: false },
            { minHours: 8, breakDuration: 30, paid: false },
          ],
        },
        createdAt: now(),
        createdBy: userId,
      };

      await db.put(organization);
    }

    if (!orgId) {
      return validationError('Either orgId or orgName must be provided');
    }

    // Hash password
    const hashedPassword = await hashPassword(body.password);

    // Create user entity
    const user = {
      PK: `USER#${userId}`,
      SK: `PROFILE#${userId}`,
      GSI1PK: `ORG#${orgId}#USERS`,
      GSI1SK: `USER#${userId}`,
      userId,
      email: body.email,
      password: hashedPassword,
      name: body.name,
      phone: body.phone || '',
      role: body.orgId ? 'employee' : 'owner', // First user in new org is owner
      orgId,
      locationIds: [],
      preferences: {},
      certifications: [],
      skills: [],
      active: true,
      createdAt: now(),
      updatedAt: now(),
    };

    await db.put(user);

    // Create email lookup entry (for faster email-based queries)
    await db.put({
      PK: `USER#EMAIL#${body.email}`,
      SK: `USER#EMAIL#${body.email}`,
      userId,
      orgId,
    });

    // Generate JWT tokens
    const tokenPayload = {
      userId,
      email: body.email,
      orgId,
      role: user.role,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Remove sensitive data before returning
    const { password: _, ...userWithoutPassword } = user;

    return success({
      user: userWithoutPassword,
      token,
      refreshToken,
    }, 201);
  } catch (err: any) {
    console.error('Signup error:', err);
    return error(err.message || 'Failed to sign up', 500);
  }
};
