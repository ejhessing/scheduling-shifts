import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export class TimeTrackingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========== DynamoDB Table ==========
    // Single-table design for all entities
    const mainTable = new dynamodb.Table(this, 'MainTable', {
      tableName: 'TimeTrackingApp',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand pricing
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Don't delete data on stack deletion
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // For change data capture
    });

    // Global Secondary Index 1: For organization-based queries
    mainTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Global Secondary Index 2: For user-based queries
    mainTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: {
        name: 'GSI2PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI2SK',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // ========== S3 Bucket for Documents & Images ==========
    const documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      bucketName: `timetracking-documents-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          noncurrentVersionExpiration: cdk.Duration.days(90),
        },
      ],
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: ['*'], // TODO: Restrict to frontend domain
          allowedHeaders: ['*'],
        },
      ],
    });

    // ========== Cognito User Pool ==========
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'TimeTrackingUsers',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
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
    });

    const userPoolClient = userPool.addClient('WebClient', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
      },
    });

    // ========== Lambda Layer for Shared Dependencies ==========
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../../shared')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Shared utilities and dependencies',
    });

    // Common Lambda environment variables
    const commonEnv = {
      TABLE_NAME: mainTable.tableName,
      DOCUMENTS_BUCKET: documentsBucket.bucketName,
      USER_POOL_ID: userPool.userPoolId,
      USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    };

    // Common Lambda props
    const lambdaDefaults = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: commonEnv,
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray
    };

    // ========== Authentication Lambda Functions ==========
    const signupFunction = new NodejsFunction(this, 'SignupFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/auth/signup.ts'),
      handler: 'handler',
      description: 'User signup',
    });

    const loginFunction = new NodejsFunction(this, 'LoginFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/auth/login.ts'),
      handler: 'handler',
      description: 'User login',
    });

    const refreshTokenFunction = new NodejsFunction(this, 'RefreshTokenFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/auth/refreshToken.ts'),
      handler: 'handler',
      description: 'Refresh JWT token',
    });

    // ========== User Management Lambda Functions ==========
    const getUserProfileFunction = new NodejsFunction(this, 'GetUserProfileFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/users/getProfile.ts'),
      handler: 'handler',
      description: 'Get user profile',
    });

    const updateUserProfileFunction = new NodejsFunction(this, 'UpdateUserProfileFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/users/updateProfile.ts'),
      handler: 'handler',
      description: 'Update user profile',
    });

    const listUsersFunction = new NodejsFunction(this, 'ListUsersFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/users/listUsers.ts'),
      handler: 'handler',
      description: 'List users in organization',
    });

    // ========== Time Tracking Lambda Functions ==========
    const clockInFunction = new NodejsFunction(this, 'ClockInFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/timeTracking/clockIn.ts'),
      handler: 'handler',
      description: 'Clock in with GPS validation',
    });

    const clockOutFunction = new NodejsFunction(this, 'ClockOutFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/timeTracking/clockOut.ts'),
      handler: 'handler',
      description: 'Clock out with GPS validation',
    });

    const getTimesheetFunction = new NodejsFunction(this, 'GetTimesheetFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/timeTracking/getTimesheet.ts'),
      handler: 'handler',
      description: 'Get timesheet for user',
    });

    const updateTimeEntryFunction = new NodejsFunction(this, 'UpdateTimeEntryFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/timeTracking/updateEntry.ts'),
      handler: 'handler',
      description: 'Update time entry',
    });

    const approveEntriesFunction = new NodejsFunction(this, 'ApproveEntriesFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/timeTracking/approveEntries.ts'),
      handler: 'handler',
      description: 'Approve time entries',
    });

    // ========== Location Management Lambda Functions ==========
    const createLocationFunction = new NodejsFunction(this, 'CreateLocationFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/locations/createLocation.ts'),
      handler: 'handler',
      description: 'Create location',
    });

    const getLocationsFunction = new NodejsFunction(this, 'GetLocationsFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/locations/getLocations.ts'),
      handler: 'handler',
      description: 'Get all locations',
    });

    const updateLocationFunction = new NodejsFunction(this, 'UpdateLocationFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/locations/updateLocation.ts'),
      handler: 'handler',
      description: 'Update location',
    });

    const deleteLocationFunction = new NodejsFunction(this, 'DeleteLocationFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/locations/deleteLocation.ts'),
      handler: 'handler',
      description: 'Delete location',
    });

    // ========== Scheduling Lambda Functions ==========
    const createShiftFunction = new NodejsFunction(this, 'CreateShiftFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/scheduling/createShift.ts'),
      handler: 'handler',
      description: 'Create new shift',
    });

    const updateShiftFunction = new NodejsFunction(this, 'UpdateShiftFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/scheduling/updateShift.ts'),
      handler: 'handler',
      description: 'Update shift',
    });

    const deleteShiftFunction = new NodejsFunction(this, 'DeleteShiftFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/scheduling/deleteShift.ts'),
      handler: 'handler',
      description: 'Delete shift',
    });

    const getScheduleFunction = new NodejsFunction(this, 'GetScheduleFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/scheduling/getSchedule.ts'),
      handler: 'handler',
      description: 'Get schedule for date range',
    });

    const swapShiftFunction = new NodejsFunction(this, 'SwapShiftFunction', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../../services/scheduling/swapShift.ts'),
      handler: 'handler',
      description: 'Request shift swap',
    });

    // ========== Grant Permissions ==========
    // Grant all Lambda functions read/write access to DynamoDB
    const allFunctions = [
      signupFunction,
      loginFunction,
      refreshTokenFunction,
      getUserProfileFunction,
      updateUserProfileFunction,
      listUsersFunction,
      createLocationFunction,
      getLocationsFunction,
      updateLocationFunction,
      deleteLocationFunction,
      clockInFunction,
      clockOutFunction,
      getTimesheetFunction,
      updateTimeEntryFunction,
      approveEntriesFunction,
      createShiftFunction,
      updateShiftFunction,
      deleteShiftFunction,
      getScheduleFunction,
      swapShiftFunction,
    ];

    allFunctions.forEach((fn) => {
      mainTable.grantReadWriteData(fn);
      documentsBucket.grantReadWrite(fn);
    });

    // Grant Cognito permissions
    [signupFunction, loginFunction, refreshTokenFunction].forEach((fn) => {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            'cognito-idp:AdminCreateUser',
            'cognito-idp:AdminSetUserPassword',
            'cognito-idp:AdminInitiateAuth',
            'cognito-idp:AdminGetUser',
          ],
          resources: [userPool.userPoolArn],
        })
      );
    });

    // ========== API Gateway ==========
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'TimeTrackingApi',
      description: 'Time Tracking and Scheduling API',
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true, // Enable X-Ray
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // TODO: Restrict to frontend domain
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date'],
      },
    });

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [userPool],
    });

    // Auth routes (no authorization required)
    const authResource = api.root.addResource('auth');
    authResource.addResource('signup').addMethod('POST', new apigateway.LambdaIntegration(signupFunction));
    authResource.addResource('login').addMethod('POST', new apigateway.LambdaIntegration(loginFunction));
    authResource.addResource('refresh').addMethod('POST', new apigateway.LambdaIntegration(refreshTokenFunction));

    // User routes
    const usersResource = api.root.addResource('users');
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

    // Location routes
    const locationsResource = api.root.addResource('locations');
    locationsResource.addMethod('GET', new apigateway.LambdaIntegration(getLocationsFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    locationsResource.addMethod('POST', new apigateway.LambdaIntegration(createLocationFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const locationResource = locationsResource.addResource('{locationId}');
    locationResource.addMethod('PUT', new apigateway.LambdaIntegration(updateLocationFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    locationResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteLocationFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Time tracking routes
    const timeResource = api.root.addResource('time');
    timeResource.addResource('clock-in').addMethod('POST', new apigateway.LambdaIntegration(clockInFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    timeResource.addResource('clock-out').addMethod('POST', new apigateway.LambdaIntegration(clockOutFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    timeResource.addResource('timesheet').addMethod('GET', new apigateway.LambdaIntegration(getTimesheetFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const entryResource = timeResource.addResource('entry').addResource('{entryId}');
    entryResource.addMethod('PUT', new apigateway.LambdaIntegration(updateTimeEntryFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    timeResource.addResource('approve').addMethod('POST', new apigateway.LambdaIntegration(approveEntriesFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Scheduling routes
    const scheduleResource = api.root.addResource('schedule');
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
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: mainTable.tableName,
      description: 'DynamoDB Table Name',
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: documentsBucket.bucketName,
      description: 'S3 Bucket Name',
    });
  }
}
