import { SNSEvent } from 'aws-lambda';
import { db } from '../../shared/db';
import {
  sendEmail,
  shiftCreatedEmail,
  timeEntryApprovedEmail,
  timeEntryRejectedEmail,
  pendingApprovalsEmail,
  complianceViolationEmail,
  shiftReminderEmail,
} from '../../shared/notifications';

/**
 * Send notification via email
 * Triggered by SNS events
 */
export const handler = async (event: SNSEvent): Promise<void> => {
  console.log('Processing SNS event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.Sns.Message);
      await processNotification(message);
    } catch (error) {
      console.error('Failed to process notification:', error);
      // Continue processing other messages
    }
  }
};

async function processNotification(message: any): Promise<void> {
  const { type, data } = message;

  console.log(`Processing notification type: ${type}`);

  switch (type) {
    case 'shift_created':
      await handleShiftCreated(data);
      break;

    case 'time_entry_approved':
      await handleTimeEntryApproved(data);
      break;

    case 'time_entry_rejected':
      await handleTimeEntryRejected(data);
      break;

    case 'pending_approvals_reminder':
      await handlePendingApprovalsReminder(data);
      break;

    case 'compliance_violation':
      await handleComplianceViolation(data);
      break;

    case 'shift_reminder':
      await handleShiftReminder(data);
      break;

    default:
      console.log(`Unknown notification type: ${type}`);
  }
}

async function handleShiftCreated(data: {
  userId: string;
  shiftId: string;
  startTime: string;
  endTime: string;
  locationId: string;
  position?: string;
}): Promise<void> {
  // Get user and location details
  const user = await db.get(`USER#${data.userId}`, `PROFILE#${data.userId}`);
  const location = await db.get(`LOC#${data.locationId}`, `LOC#${data.locationId}`);

  if (!user?.email) {
    console.error('User email not found');
    return;
  }

  const emailTemplate = shiftCreatedEmail({
    userName: user.name,
    startTime: data.startTime,
    endTime: data.endTime,
    location: location?.name || 'Unknown Location',
    position: data.position,
  });

  await sendEmail({
    ...emailTemplate,
    to: user.email,
  });

  console.log(`Shift created notification sent to ${user.email}`);
}

async function handleTimeEntryApproved(data: {
  userId: string;
  entryId: string;
  date: string;
  hours: number;
  pay: number;
}): Promise<void> {
  const user = await db.get(`USER#${data.userId}`, `PROFILE#${data.userId}`);

  if (!user?.email) {
    console.error('User email not found');
    return;
  }

  const emailTemplate = timeEntryApprovedEmail({
    userName: user.name,
    date: data.date,
    hours: data.hours,
    pay: data.pay,
  });

  await sendEmail({
    ...emailTemplate,
    to: user.email,
  });

  console.log(`Time entry approved notification sent to ${user.email}`);
}

async function handleTimeEntryRejected(data: {
  userId: string;
  entryId: string;
  date: string;
  reason?: string;
}): Promise<void> {
  const user = await db.get(`USER#${data.userId}`, `PROFILE#${data.userId}`);

  if (!user?.email) {
    console.error('User email not found');
    return;
  }

  const emailTemplate = timeEntryRejectedEmail({
    userName: user.name,
    date: data.date,
    reason: data.reason,
  });

  await sendEmail({
    ...emailTemplate,
    to: user.email,
  });

  console.log(`Time entry rejected notification sent to ${user.email}`);
}

async function handlePendingApprovalsReminder(data: {
  managerId: string;
  pendingCount: number;
}): Promise<void> {
  const manager = await db.get(`USER#${data.managerId}`, `PROFILE#${data.managerId}`);

  if (!manager?.email) {
    console.error('Manager email not found');
    return;
  }

  const emailTemplate = pendingApprovalsEmail({
    managerName: manager.name,
    pendingCount: data.pendingCount,
  });

  await sendEmail({
    ...emailTemplate,
    to: manager.email,
  });

  console.log(`Pending approvals reminder sent to ${manager.email}`);
}

async function handleComplianceViolation(data: {
  userId: string;
  violationType: string;
  description: string;
  severity: 'warning' | 'critical';
}): Promise<void> {
  const user = await db.get(`USER#${data.userId}`, `PROFILE#${data.userId}`);

  if (!user?.email) {
    console.error('User email not found');
    return;
  }

  const emailTemplate = complianceViolationEmail({
    userName: user.name,
    violationType: data.violationType,
    description: data.description,
    severity: data.severity,
  });

  await sendEmail({
    ...emailTemplate,
    to: user.email,
  });

  // Also notify manager/admin
  const managers = await db.query(`ORG#${user.orgId}#USERS`, undefined, 'GSI1');
  const managerEmails = managers
    .filter((u: any) => ['manager', 'admin', 'owner'].includes(u.role))
    .map((u: any) => u.email)
    .filter(Boolean);

  for (const managerEmail of managerEmails) {
    await sendEmail({
      ...emailTemplate,
      to: managerEmail,
      subject: `${data.severity === 'critical' ? 'Critical' : 'Warning'}: Compliance Violation - ${user.name}`,
    });
  }

  console.log(`Compliance violation notification sent to ${user.email} and managers`);
}

async function handleShiftReminder(data: {
  userId: string;
  shiftId: string;
  startTime: string;
  locationId: string;
  hoursUntil: number;
}): Promise<void> {
  const user = await db.get(`USER#${data.userId}`, `PROFILE#${data.userId}`);
  const location = await db.get(`LOC#${data.locationId}`, `LOC#${data.locationId}`);

  if (!user?.email) {
    console.error('User email not found');
    return;
  }

  const emailTemplate = shiftReminderEmail({
    userName: user.name,
    startTime: data.startTime,
    location: location?.name || 'Unknown Location',
    hoursUntil: data.hoursUntil,
  });

  await sendEmail({
    ...emailTemplate,
    to: user.email,
  });

  console.log(`Shift reminder sent to ${user.email}`);
}
