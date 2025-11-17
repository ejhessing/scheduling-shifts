import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { v4 as uuidv4 } from 'uuid';
import { putItem, getItem } from '../utils/dynamodb';

const sns = new SNSClient({ region: process.env.REGION || 'us-east-1' });

export interface SendNotificationParams {
  userId: string;
  type: string;
  title: string;
  content: string;
  actionUrl?: string;
  data?: any;
}

export async function sendNotification(params: SendNotificationParams): Promise<void> {
  const { userId, type, title, content, actionUrl, data } = params;

  // Get user profile to check notification preferences
  const userProfile = await getItem(`USER#${userId}`, `PROFILE#${userId}`);
  if (!userProfile) {
    throw new Error('User not found');
  }

  const preferences = userProfile.preferences?.notifications || {};
  const notifId = uuidv4();
  const now = new Date().toISOString();

  // Store notification in DynamoDB
  await putItem({
    PK: `USER#${userId}#NOTIFICATIONS`,
    SK: `NOTIF#${now}#${notifId}`,
    notifId,
    userId,
    type,
    title,
    content,
    read: false,
    actionUrl: actionUrl || null,
    data: data || null,
    createdAt: now,
  });

  // Send push notification if user has enabled it
  if (preferences.push && userProfile.deviceTokens?.length > 0) {
    const message = {
      default: content,
      GCM: JSON.stringify({
        notification: {
          title,
          body: content,
        },
        data: {
          type,
          actionUrl,
          ...data,
        },
      }),
      APNS: JSON.stringify({
        aps: {
          alert: {
            title,
            body: content,
          },
          badge: 1,
          sound: 'default',
        },
        type,
        actionUrl,
        ...data,
      }),
    };

    // Send to each device token
    for (const token of userProfile.deviceTokens) {
      try {
        await sns.send(
          new PublishCommand({
            TargetArn: token.endpointArn,
            Message: JSON.stringify(message),
            MessageStructure: 'json',
          })
        );
      } catch (error) {
        console.error(`Failed to send push to ${token.endpointArn}:`, error);
      }
    }
  }

  // Send email if enabled (using SES)
  if (preferences.email && userProfile.email) {
    // TODO: Implement email sending with SES
    console.log(`Would send email to ${userProfile.email}: ${title}`);
  }

  // Send SMS if enabled (using SNS)
  if (preferences.sms && userProfile.phone) {
    try {
      await sns.send(
        new PublishCommand({
          PhoneNumber: userProfile.phone,
          Message: `${title}: ${content}`,
        })
      );
    } catch (error) {
      console.error(`Failed to send SMS to ${userProfile.phone}:`, error);
    }
  }
}

// Helper function to send shift reminder notifications
export async function sendShiftReminder(shiftId: string, userId: string): Promise<void> {
  // Get shift details
  // TODO: Query shift from DynamoDB

  await sendNotification({
    userId,
    type: 'SHIFT_REMINDER',
    title: 'Upcoming Shift',
    content: 'You have a shift starting in 1 hour',
    actionUrl: `/schedule`,
    data: { shiftId },
  });
}

// Helper function to send overtime warning
export async function sendOvertimeWarning(userId: string, hours: number): Promise<void> {
  await sendNotification({
    userId,
    type: 'OVERTIME_WARNING',
    title: 'Overtime Alert',
    content: `You have worked ${hours} hours this week. Approaching overtime threshold.`,
    actionUrl: `/timesheet`,
    data: { hours },
  });
}
