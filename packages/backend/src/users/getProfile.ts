import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, notFoundResponse, errorResponse } from '../utils/response';
import { getItem } from '../utils/dynamodb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const claims = event.requestContext.authorizer?.claims;
    const authenticatedUserId = claims?.['custom:userId'] || claims?.sub;

    const userId = event.pathParameters?.userId || authenticatedUserId;

    // Get user profile from DynamoDB
    const userProfile = await getItem(`USER#${userId}`, `PROFILE#${userId}`);

    if (!userProfile) {
      return notFoundResponse('User not found');
    }

    // Remove sensitive internal fields
    const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, ...profile } = userProfile;

    return successResponse(profile);
  } catch (error: any) {
    console.error('Get profile error:', error);
    return errorResponse(error);
  }
}
