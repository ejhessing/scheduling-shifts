import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  AdminConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { v4 as uuidv4 } from 'uuid';
import { isValidEmail, validatePassword, UserRole } from '@time-tracking/shared';
import { successResponse, validationErrorResponse, errorResponse } from '../utils/response';
import { putItem } from '../utils/dynamodb';

const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION || 'us-east-1' });
const USER_POOL_ID = process.env.USER_POOL_ID!;
const CLIENT_ID = process.env.USER_POOL_CLIENT_ID!;

interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  orgName?: string; // For first user creating an org
  orgId?: string; // For joining existing org
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body: SignupRequest = JSON.parse(event.body || '{}');
    const { email, password, firstName, lastName, phone, orgName, orgId } = body;

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      return validationErrorResponse('Email, password, first name, and last name are required');
    }

    if (!isValidEmail(email)) {
      return validationErrorResponse('Invalid email format');
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return validationErrorResponse(passwordValidation.message!);
    }

    // Determine if creating new org or joining existing one
    const isNewOrg = !orgId && orgName;
    const userId = uuidv4();
    const finalOrgId = orgId || uuidv4();
    const role = isNewOrg ? UserRole.ORG_ADMIN : UserRole.EMPLOYEE;

    // Create user in Cognito
    try {
      const signUpCommand = new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'given_name', Value: firstName },
          { Name: 'family_name', Value: lastName },
          { Name: 'custom:orgId', Value: finalOrgId },
          { Name: 'custom:role', Value: role },
        ],
      });

      const signUpResult = await cognito.send(signUpCommand);

      // Auto-confirm user (in production, use email verification)
      if (process.env.AUTO_CONFIRM_USERS === 'true') {
        await cognito.send(
          new AdminConfirmSignUpCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
          })
        );
      }

      // Create user record in DynamoDB
      const now = new Date().toISOString();
      await putItem({
        PK: `USER#${userId}`,
        SK: `PROFILE#${userId}`,
        GSI1PK: `ORG#${finalOrgId}#USERS`,
        GSI1SK: `USER#${userId}`,
        userId,
        email,
        name: `${firstName} ${lastName}`,
        phone: phone || null,
        role,
        orgId: finalOrgId,
        locationIds: [],
        preferences: {
          theme: 'light',
          notifications: {
            email: true,
            push: true,
            sms: false,
            shiftReminders: true,
            scheduleChanges: true,
          },
        },
        certifications: [],
        skills: [],
        createdAt: now,
        updatedAt: now,
      });

      // If creating new org, create org record
      if (isNewOrg) {
        await putItem({
          PK: `ORG#${finalOrgId}`,
          SK: `ORG#${finalOrgId}`,
          orgId: finalOrgId,
          name: orgName,
          plan: 'FREE',
          settings: {
            workWeekStart: 0,
            overtimeThreshold: 40,
            requireClockInPhoto: false,
            requireGeofence: true,
            autoApproveTimeEntries: false,
            payPeriodType: 'WEEKLY',
          },
          complianceRules: {
            breakRules: [
              {
                minShiftDuration: 6,
                breakDuration: 30,
                paid: false,
              },
            ],
            overtimeRules: [
              {
                threshold: 40,
                multiplier: 1.5,
                period: 'WEEKLY',
              },
            ],
          },
          timezone: 'America/New_York',
          billingInfo: {
            billingEmail: email,
          },
          createdAt: now,
          updatedAt: now,
        });
      }

      return successResponse(
        {
          message: 'User created successfully',
          userId,
          email,
          orgId: finalOrgId,
          role,
          confirmationRequired: !process.env.AUTO_CONFIRM_USERS,
        },
        201
      );
    } catch (cognitoError: any) {
      console.error('Cognito error:', cognitoError);

      if (cognitoError.name === 'UsernameExistsException') {
        return validationErrorResponse('User with this email already exists');
      }

      return errorResponse(cognitoError);
    }
  } catch (error: any) {
    console.error('Signup error:', error);
    return errorResponse(error);
  }
}
