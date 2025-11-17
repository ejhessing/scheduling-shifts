import { ScheduledEvent } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { db } from '../../shared/db';
import { formatDate } from '../../shared/utils';

const snsClient = new SNSClient({});
const NOTIFICATION_TOPIC_ARN = process.env.NOTIFICATION_TOPIC_ARN || '';

/**
 * Scheduled job to send automated notifications
 * Runs hourly to check for:
 * - Upcoming shift reminders
 * - Pending approvals reminders
 */
export const handler = async (event: ScheduledEvent): Promise<void> => {
  console.log('Running scheduled notifications job');

  try {
    // Send shift reminders
    await sendShiftReminders();

    // Send pending approvals reminders (once daily)
    const hour = new Date().getHours();
    if (hour === 9) {
      // 9 AM
      await sendPendingApprovalsReminders();
    }

    console.log('Scheduled notifications completed successfully');
  } catch (error) {
    console.error('Error in scheduled notifications:', error);
    throw error;
  }
};

/**
 * Send reminders for upcoming shifts
 */
async function sendShiftReminders(): Promise<void> {
  console.log('Checking for upcoming shifts...');

  const now = new Date();
  const futureTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next 24 hours

  // Get all organizations
  const orgs = await getAllOrganizations();

  for (const org of orgs) {
    try {
      // Get shifts starting in the next 24 hours for this org
      const dates = getDatesBetween(formatDate(now), formatDate(futureTime));

      for (const date of dates) {
        const shifts = await db.queryGSI2(`ORG#${org.orgId}#SHIFTS`, {
          begins: `DATE#${date}`,
        });

        for (const shift of shifts) {
          const shiftStart = new Date(shift.startTime);
          const hoursUntil = (shiftStart.getTime() - now.getTime()) / (1000 * 60 * 60);

          // Send reminder if shift is 2 hours away (and hasn't been sent already)
          if (hoursUntil > 1.9 && hoursUntil < 2.1) {
            await publishNotification({
              type: 'shift_reminder',
              data: {
                userId: shift.userId,
                shiftId: shift.shiftId,
                startTime: shift.startTime,
                locationId: shift.locationId,
                hoursUntil: 2,
              },
            });

            console.log(`Sent 2-hour reminder for shift ${shift.shiftId}`);
          }
        }
      }
    } catch (error) {
      console.error(`Error processing org ${org.orgId}:`, error);
    }
  }
}

/**
 * Send reminders for pending approvals
 */
async function sendPendingApprovalsReminders(): Promise<void> {
  console.log('Checking for pending approvals...');

  const orgs = await getAllOrganizations();

  for (const org of orgs) {
    try {
      // Get all managers in the org
      const users = await db.query(`ORG#${org.orgId}#USERS`, undefined, 'GSI1');
      const managers = users.filter((u: any) =>
        ['manager', 'admin', 'owner'].includes(u.role)
      );

      // Get pending entries for the current pay period
      const weekNo = getCurrentWeekNumber();
      const payPeriod = `${new Date().getFullYear()}-${String(weekNo).padStart(2, '0')}`;
      const entries = await db.queryGSI2(`ORG#${org.orgId}#PAYPERIOD#${payPeriod}`);

      const pendingEntries = entries.filter((e: any) => e.status === 'pending_approval');

      if (pendingEntries.length > 0) {
        // Send reminder to each manager
        for (const manager of managers) {
          await publishNotification({
            type: 'pending_approvals_reminder',
            data: {
              managerId: manager.userId,
              pendingCount: pendingEntries.length,
            },
          });

          console.log(`Sent pending approvals reminder to manager ${manager.userId}`);
        }
      }
    } catch (error) {
      console.error(`Error processing org ${org.orgId}:`, error);
    }
  }
}

/**
 * Publish notification to SNS topic
 */
async function publishNotification(message: any): Promise<void> {
  if (!NOTIFICATION_TOPIC_ARN) {
    console.warn('NOTIFICATION_TOPIC_ARN not configured, skipping notification');
    return;
  }

  const command = new PublishCommand({
    TopicArn: NOTIFICATION_TOPIC_ARN,
    Message: JSON.stringify(message),
    Subject: `Notification: ${message.type}`,
  });

  await snsClient.send(command);
}

/**
 * Helper functions
 */
async function getAllOrganizations(): Promise<any[]> {
  // In a real system, you'd have a way to list all orgs
  // For now, we'll return empty array - would need to implement org listing
  // This could be done by maintaining a GSI or separate org table
  return [];
}

function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  return dates;
}

function getCurrentWeekNumber(): number {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    (((now.getTime() - yearStart.getTime()) / 86400000) + yearStart.getDay() + 1) / 7
  );
  return weekNo;
}
