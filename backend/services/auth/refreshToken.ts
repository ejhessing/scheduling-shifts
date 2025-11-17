import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error, unauthorized } from '../../shared/response';
import { verifyToken, generateToken, generateRefreshToken } from '../../shared/auth';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { refreshToken } = body;

    if (!refreshToken) {
      return unauthorized('Refresh token is required');
    }

    // Verify refresh token
    let payload;
    try {
      payload = verifyToken(refreshToken);
    } catch (err) {
      return unauthorized('Invalid or expired refresh token');
    }

    // Get user to ensure they still exist and are active
    const user = await db.get(`USER#${payload.userId}`, `PROFILE#${payload.userId}`);

    if (!user || !user.active) {
      return unauthorized('User not found or inactive');
    }

    // Generate new tokens
    const tokenPayload = {
      userId: user.userId,
      email: user.email,
      orgId: user.orgId,
      role: user.role,
    };

    const newToken = generateToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    return success({
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (err: any) {
    console.error('Refresh token error:', err);
    return error(err.message || 'Failed to refresh token', 500);
  }
};
