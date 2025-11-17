import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetScheduleRequest, GetScheduleResponse } from '@time-tracking/shared';
import { successResponse, validationErrorResponse, errorResponse } from '../utils/response';
import { queryItems } from '../utils/dynamodb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const claims = event.requestContext.authorizer?.claims;
    const authenticatedUserId = claims?.['custom:userId'] || claims?.sub;
    const orgId = claims?.['custom:orgId'];

    const locationId = event.queryStringParameters?.locationId;
    const userId = event.queryStringParameters?.userId || authenticatedUserId;
    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;

    if (!startDate || !endDate) {
      return validationErrorResponse('Start date and end date are required');
    }

    const shifts: any[] = [];

    if (locationId) {
      // Query by location
      const start = new Date(startDate);
      const end = new Date(endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];

        const dayShifts = await queryItems(
          'PK = :pk AND begins_with(SK, :sk)',
          {
            ':pk': `LOC#${locationId}#DATE#${dateStr}`,
            ':sk': 'SHIFT#',
          }
        );

        shifts.push(...dayShifts);
      }
    } else {
      // Query by user
      const userShifts = await queryItems(
        'GSI1PK = :pk AND GSI1SK BETWEEN :start AND :end',
        {
          ':pk': `USER#${userId}#SHIFTS`,
          ':start': `DATE#${startDate}`,
          ':end': `DATE#${endDate}#9999`,
        },
        'GSI1'
      );

      shifts.push(...userShifts);
    }

    const response: GetScheduleResponse = {
      shifts: shifts.map(shift => ({
        shiftId: shift.shiftId,
        userId: shift.userId,
        locationId: shift.locationId,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        position: shift.position,
        status: shift.status,
        payRate: shift.payRate,
        notes: shift.notes,
      })),
      totalShifts: shifts.length,
    };

    return successResponse(response);
  } catch (error: any) {
    console.error('Get schedule error:', error);
    return errorResponse(error);
  }
}
