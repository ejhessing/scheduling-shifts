import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error, unauthorized } from '../../shared/response';
import { comparePassword, generateToken, generateRefreshToken } from '../../shared/auth';
import { validateBody, loginSchema } from '../../shared/validators';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Validate request body
    const body = validateBody(loginSchema, event.body);

    // Find user by email
    const emailLookup = await db.get(`USER#EMAIL#${body.email}`, `USER#EMAIL#${body.email}`);

    if (!emailLookup) {
      return unauthorized('Invalid email or password');
    }

    // Get user profile
    const user = await db.get(`USER#${emailLookup.userId}`, `PROFILE#${emailLookup.userId}`);

    if (!user || !user.active) {
      return unauthorized('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await comparePassword(body.password, user.password);

    if (!isPasswordValid) {
      return unauthorized('Invalid email or password');
    }

    // Generate JWT tokens
    const tokenPayload = {
      userId: user.userId,
      email: user.email,
      orgId: user.orgId,
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
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return error(err.message || 'Failed to login', 500);
  }
};
