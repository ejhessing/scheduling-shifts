import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { successResponse, validationErrorResponse, errorResponse, unauthorizedResponse } from '../utils/response';

const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION || 'us-east-1' });
const CLIENT_ID = process.env.USER_POOL_CLIENT_ID!;

interface RefreshTokenRequest {
  refreshToken: string;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body: RefreshTokenRequest = JSON.parse(event.body || '{}');
    const { refreshToken } = body;

    // Validate input
    if (!refreshToken) {
      return validationErrorResponse('Refresh token is required');
    }

    try {
      // Refresh tokens with Cognito
      const authCommand = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        ClientId: CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      const authResult = await cognito.send(authCommand);

      if (!authResult.AuthenticationResult) {
        return unauthorizedResponse('Token refresh failed');
      }

      const { AccessToken, IdToken, ExpiresIn } = authResult.AuthenticationResult;

      return successResponse({
        message: 'Token refreshed successfully',
        accessToken: AccessToken,
        idToken: IdToken,
        expiresIn: ExpiresIn,
      });
    } catch (cognitoError: any) {
      console.error('Cognito error:', cognitoError);

      if (cognitoError.name === 'NotAuthorizedException') {
        return unauthorizedResponse('Invalid or expired refresh token');
      }

      return errorResponse(cognitoError);
    }
  } catch (error: any) {
    console.error('Refresh token error:', error);
    return errorResponse(error);
  }
}
