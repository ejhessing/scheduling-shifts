import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/db';
import { success, error } from '../../shared/response';
import { getUserFromEvent } from '../../shared/auth';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get authenticated user
    const currentUser = getUserFromEvent(event);

    // Query users in the organization using GSI1
    const users = await db.query(`ORG#${currentUser.orgId}#USERS`, undefined, 'GSI1');

    // Remove sensitive data from all users
    const sanitizedUsers = users.map((user) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return success({
      users: sanitizedUsers,
      count: sanitizedUsers.length,
    });
  } catch (err: any) {
    console.error('List users error:', err);
    return error(err.message || 'Failed to list users', 500);
  }
};
