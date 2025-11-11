import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, validationErrorResponse, errorResponse } from '../utils/response';
import { queryItems } from '../utils/dynamodb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const claims = event.requestContext.authorizer?.claims;
    const authenticatedUserId = claims?.['custom:userId'] || claims?.sub;

    // Get query parameters
    const userId = event.queryStringParameters?.userId || authenticatedUserId;
    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;

    // Validate input
    if (!startDate || !endDate) {
      return validationErrorResponse('Start date and end date are required');
    }

    // TODO: Check if user has permission to view other users' timesheets

    // Query time entries for the date range
    const entries: any[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Iterate through each date in the range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      const dayEntries = await queryItems(
        'PK = :pk AND begins_with(SK, :sk)',
        {
          ':pk': `USER#${userId}#DATE#${dateStr}`,
          ':sk': 'ENTRY#',
        }
      );

      entries.push(...dayEntries);
    }

    // Calculate summary statistics
    const summary = {
      totalEntries: entries.length,
      totalHours: entries.reduce((sum, entry) => sum + (entry.totalHours || 0), 0),
      regularHours: entries.reduce((sum, entry) => sum + (entry.regularHours || 0), 0),
      overtimeHours: entries.reduce((sum, entry) => sum + (entry.overtimeHours || 0), 0),
      totalPay: entries.reduce((sum, entry) => sum + (entry.totalPay || 0), 0),
      pendingApproval: entries.filter(e => e.status === 'PENDING').length,
      approved: entries.filter(e => e.status === 'APPROVED').length,
    };

    return successResponse({
      entries: entries.map(entry => ({
        entryId: entry.entryId,
        userId: entry.userId,
        locationId: entry.locationId,
        date: entry.date,
        clockInTime: entry.clockInTime,
        clockOutTime: entry.clockOutTime,
        totalHours: entry.totalHours,
        regularHours: entry.regularHours,
        overtimeHours: entry.overtimeHours,
        totalPay: entry.totalPay,
        status: entry.status,
        breaks: entry.breaks,
      })),
      summary,
      startDate,
      endDate,
    });
  } catch (error: any) {
    console.error('Get timesheet error:', error);
    return errorResponse(error);
  }
}
