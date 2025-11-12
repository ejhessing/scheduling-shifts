import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export class TimeTrackingStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly bucket: s3.Bucket;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========== DynamoDB Table ==========
    this.table = new dynamodb.Table(this, 'TimeTrackingTable', {
      tableName: 'TimeTrackingApp',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Global Secondary Index 1
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Global Secondary Index 2
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: {
        name: 'GSI2PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI2SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ========== S3 Bucket ==========
    this.bucket = new s3.Bucket(this, 'FileStorageBucket', {
      bucketName: `time-tracking-app-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldPhotos',
          prefix: 'photos/',
          expiration: cdk.Duration.days(90),
        },
        {
          id: 'ArchiveOldDocuments',
          prefix: 'documents/',
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ['*'], // TODO: Restrict in production
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ========== Cognito User Pool ==========
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'TimeTrackingUserPool',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        orgId: new cognito.StringAttribute({ minLen: 1, maxLen: 256, mutable: true }),
        role: new cognito.StringAttribute({ minLen: 1, maxLen: 50, mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
    });

    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: 'TimeTrackingWebClient',
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: true,
      },
      generateSecret: false,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // ========== Lambda Layer for Shared Code ==========
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../../shared/dist')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Shared utilities and types',
    });

    // Common Lambda environment variables
    const lambdaEnvironment = {
      TABLE_NAME: this.table.tableName,
      S3_BUCKET_NAME: this.bucket.bucketName,
      USER_POOL_ID: this.userPool.userPoolId,
      USER_POOL_CLIENT_ID: this.userPoolClient.userPoolClientId,
      REGION: this.region,
    };

    // Common Lambda execution role
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant permissions
    this.table.grantReadWriteData(lambdaRole);
    this.bucket.grantReadWrite(lambdaRole);

    // ========== API Gateway ==========
    this.api = new apigateway.RestApi(this, 'TimeTrackingApi', {
      restApiName: 'Time Tracking API',
      description: 'API for Time Tracking and Scheduling Application',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // TODO: Restrict in production
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
    });

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
      cognitoUserPools: [this.userPool],
    });

    // ========== Lambda Functions ==========

    // Helper function to create Lambda functions
    const createLambdaFunction = (
      id: string,
      entry: string,
      description: string
    ): NodejsFunction => {
      return new NodejsFunction(this, id, {
        functionName: `TimeTracking-${id}`,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: path.join(__dirname, '../../backend/src', entry),
        handler: 'handler',
        environment: lambdaEnvironment,
        role: lambdaRole,
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        description,
        bundling: {
          externalModules: ['aws-sdk'],
          minify: true,
          sourceMap: true,
        },
        logRetention: logs.RetentionDays.ONE_WEEK,
      });
    };

    // Auth Functions
    const signupFunction = createLambdaFunction(
      'Signup',
      'auth/signup.ts',
      'User signup function'
    );
    const loginFunction = createLambdaFunction('Login', 'auth/login.ts', 'User login function');
    const refreshTokenFunction = createLambdaFunction(
      'RefreshToken',
      'auth/refreshToken.ts',
      'Refresh access token'
    );

    // User Management Functions
    const getUserProfileFunction = createLambdaFunction(
      'GetUserProfile',
      'users/getProfile.ts',
      'Get user profile'
    );
    const updateUserProfileFunction = createLambdaFunction(
      'UpdateUserProfile',
      'users/updateProfile.ts',
      'Update user profile'
    );
    const listUsersFunction = createLambdaFunction(
      'ListUsers',
      'users/listUsers.ts',
      'List organization users'
    );

    // Time Tracking Functions
    const clockInFunction = createLambdaFunction(
      'ClockIn',
      'timeTracking/clockIn.ts',
      'Clock in to work'
    );
    const clockOutFunction = createLambdaFunction(
      'ClockOut',
      'timeTracking/clockOut.ts',
      'Clock out from work'
    );
    const getTimesheetFunction = createLambdaFunction(
      'GetTimesheet',
      'timeTracking/getTimesheet.ts',
      'Get timesheet data'
    );
    const updateTimeEntryFunction = createLambdaFunction(
      'UpdateTimeEntry',
      'timeTracking/updateEntry.ts',
      'Update time entry'
    );
    const approveTimeEntriesFunction = createLambdaFunction(
      'ApproveTimeEntries',
      'timeTracking/approveEntries.ts',
      'Approve time entries'
    );

    // Scheduling Functions
    const createShiftFunction = createLambdaFunction(
      'CreateShift',
      'scheduling/createShift.ts',
      'Create a new shift'
    );
    const updateShiftFunction = createLambdaFunction(
      'UpdateShift',
      'scheduling/updateShift.ts',
      'Update an existing shift'
    );
    const deleteShiftFunction = createLambdaFunction(
      'DeleteShift',
      'scheduling/deleteShift.ts',
      'Delete a shift'
    );
    const getScheduleFunction = createLambdaFunction(
      'GetSchedule',
      'scheduling/getSchedule.ts',
      'Get schedule for date range'
    );
    const swapShiftFunction = createLambdaFunction(
      'SwapShift',
      'scheduling/swapShift.ts',
      'Request shift swap'
    );

    // ========== API Routes ==========

    // Auth routes (no authorization required)
    const authResource = this.api.root.addResource('auth');
    authResource.addResource('signup').addMethod('POST', new apigateway.LambdaIntegration(signupFunction));
    authResource.addResource('login').addMethod('POST', new apigateway.LambdaIntegration(loginFunction));
    authResource.addResource('refresh').addMethod('POST', new apigateway.LambdaIntegration(refreshTokenFunction));

    // User routes
    const usersResource = this.api.root.addResource('users');
    usersResource.addMethod('GET', new apigateway.LambdaIntegration(listUsersFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const userResource = usersResource.addResource('{userId}');
    userResource.addMethod('GET', new apigateway.LambdaIntegration(getUserProfileFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    userResource.addMethod('PUT', new apigateway.LambdaIntegration(updateUserProfileFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Time Tracking routes
    const timeTrackingResource = this.api.root.addResource('time-tracking');
    timeTrackingResource.addResource('clock-in').addMethod('POST', new apigateway.LambdaIntegration(clockInFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    timeTrackingResource.addResource('clock-out').addMethod('POST', new apigateway.LambdaIntegration(clockOutFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    timeTrackingResource.addResource('timesheet').addMethod('GET', new apigateway.LambdaIntegration(getTimesheetFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const timeEntryResource = timeTrackingResource.addResource('entries').addResource('{entryId}');
    timeEntryResource.addMethod('PUT', new apigateway.LambdaIntegration(updateTimeEntryFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    timeTrackingResource.addResource('approve').addMethod('POST', new apigateway.LambdaIntegration(approveTimeEntriesFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Scheduling routes
    const scheduleResource = this.api.root.addResource('schedule');
    scheduleResource.addMethod('GET', new apigateway.LambdaIntegration(getScheduleFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const shiftsResource = scheduleResource.addResource('shifts');
    shiftsResource.addMethod('POST', new apigateway.LambdaIntegration(createShiftFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const shiftResource = shiftsResource.addResource('{shiftId}');
    shiftResource.addMethod('PUT', new apigateway.LambdaIntegration(updateShiftFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    shiftResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteShiftFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    shiftsResource.addResource('swap').addMethod('POST', new apigateway.LambdaIntegration(swapShiftFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // ========== Outputs ==========
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 Bucket Name',
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'DynamoDB Table Name',
    });
  }
}
