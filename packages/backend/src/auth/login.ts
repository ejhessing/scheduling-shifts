import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { successResponse, validationErrorResponse, errorResponse, unauthorizedResponse } from '../utils/response';

const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION || 'us-east-1' });
const CLIENT_ID = process.env.USER_POOL_CLIENT_ID!;

interface LoginRequest {
  email: string;
  password: string;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body: LoginRequest = JSON.parse(event.body || '{}');
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return validationErrorResponse('Email and password are required');
    }

    try {
      // Authenticate user with Cognito
      const authCommand = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      const authResult = await cognito.send(authCommand);

      if (!authResult.AuthenticationResult) {
        return unauthorizedResponse('Authentication failed');
      }

      const { AccessToken, IdToken, RefreshToken, ExpiresIn } = authResult.AuthenticationResult;

      return successResponse({
        message: 'Login successful',
        accessToken: AccessToken,
        idToken: IdToken,
        refreshToken: RefreshToken,
        expiresIn: ExpiresIn,
      });
    } catch (cognitoError: any) {
      console.error('Cognito error:', cognitoError);

      if (
        cognitoError.name === 'NotAuthorizedException' ||
        cognitoError.name === 'UserNotFoundException'
      ) {
        return unauthorizedResponse('Invalid email or password');
      }

      if (cognitoError.name === 'UserNotConfirmedException') {
        return unauthorizedResponse('User email not confirmed');
      }

      return errorResponse(cognitoError);
    }
  } catch (error: any) {
    console.error('Login error:', error);
    return errorResponse(error);
  }
}
