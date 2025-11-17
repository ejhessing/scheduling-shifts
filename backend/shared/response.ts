import { APIGatewayProxyResult } from 'aws-lambda';

export const success = (data: any, statusCode: number = 200): APIGatewayProxyResult => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({
      success: true,
      data,
    }),
  };
};

export const error = (
  message: string,
  statusCode: number = 400,
  details?: any
): APIGatewayProxyResult => {
  console.error('Error response:', { message, statusCode, details });

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({
      success: false,
      error: {
        message,
        details,
      },
    }),
  };
};

export const unauthorized = (message: string = 'Unauthorized'): APIGatewayProxyResult => {
  return error(message, 401);
};

export const forbidden = (message: string = 'Forbidden'): APIGatewayProxyResult => {
  return error(message, 403);
};

export const notFound = (message: string = 'Not found'): APIGatewayProxyResult => {
  return error(message, 404);
};

export const validationError = (message: string, details?: any): APIGatewayProxyResult => {
  return error(message, 400, details);
};

export const serverError = (message: string = 'Internal server error'): APIGatewayProxyResult => {
  return error(message, 500);
};
