import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiError, HTTP_STATUS } from '@time-tracking/shared';

/**
 * Creates a successful API response
 */
export function successResponse(data: any, statusCode: number = HTTP_STATUS.OK): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(data),
  };
}

/**
 * Creates an error API response
 */
export function errorResponse(
  error: ApiError | Error,
  statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR
): APIGatewayProxyResult {
  let errorBody: ApiError;

  if ('code' in error && 'message' in error) {
    // It's an ApiError
    errorBody = error as ApiError;
  } else {
    // It's a regular Error
    errorBody = {
      code: 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
    };
  }

  console.error('Error:', errorBody);

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({ error: errorBody }),
  };
}

/**
 * Creates a validation error response
 */
export function validationErrorResponse(message: string, details?: any): APIGatewayProxyResult {
  return errorResponse(
    {
      code: 'VALIDATION_ERROR',
      message,
      details,
    },
    HTTP_STATUS.BAD_REQUEST
  );
}

/**
 * Creates an unauthorized error response
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): APIGatewayProxyResult {
  return errorResponse(
    {
      code: 'UNAUTHORIZED',
      message,
    },
    HTTP_STATUS.UNAUTHORIZED
  );
}

/**
 * Creates a forbidden error response
 */
export function forbiddenResponse(message: string = 'Forbidden'): APIGatewayProxyResult {
  return errorResponse(
    {
      code: 'FORBIDDEN',
      message,
    },
    HTTP_STATUS.FORBIDDEN
  );
}

/**
 * Creates a not found error response
 */
export function notFoundResponse(message: string = 'Resource not found'): APIGatewayProxyResult {
  return errorResponse(
    {
      code: 'NOT_FOUND',
      message,
    },
    HTTP_STATUS.NOT_FOUND
  );
}

/**
 * Creates a conflict error response
 */
export function conflictResponse(message: string, details?: any): APIGatewayProxyResult {
  return errorResponse(
    {
      code: 'CONFLICT',
      message,
      details,
    },
    HTTP_STATUS.CONFLICT
  );
}
