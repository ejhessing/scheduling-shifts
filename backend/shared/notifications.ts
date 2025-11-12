import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({});

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@timetracking.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.timetracking.com';

interface EmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

/**
 * Send email via SES
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: {
      ToAddresses: [options.to],
    },
    Message: {
      Subject: {
        Data: options.subject,
      },
      Body: {
        Html: {
          Data: options.htmlBody,
        },
        Text: {
          Data: options.textBody,
        },
      },
    },
  });

  try {
    await sesClient.send(command);
    console.log(`Email sent successfully to ${options.to}`);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

/**
 * Email Templates
 */

export function shiftCreatedEmail(data: {
  userName: string;
  startTime: string;
  endTime: string;
  location: string;
  position?: string;
}): EmailOptions {
  return {
    to: '', // Will be set by caller
    subject: 'New Shift Assigned',
    htmlBody: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #0ea5e9;">New Shift Assigned</h2>
            <p>Hi ${data.userName},</p>
            <p>You have been assigned a new shift:</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Location:</strong> ${data.location}</p>
              ${data.position ? `<p style="margin: 5px 0;"><strong>Position:</strong> ${data.position}</p>` : ''}
              <p style="margin: 5px 0;"><strong>Start:</strong> ${new Date(data.startTime).toLocaleString()}</p>
              <p style="margin: 5px 0;"><strong>End:</strong> ${new Date(data.endTime).toLocaleString()}</p>
            </div>
            <p>
              <a href="${FRONTEND_URL}/schedule" style="background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Schedule
              </a>
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This is an automated email. Please do not reply.
            </p>
          </div>
        </body>
      </html>
    `,
    textBody: `
New Shift Assigned

Hi ${data.userName},

You have been assigned a new shift:

Location: ${data.location}
${data.position ? `Position: ${data.position}` : ''}
Start: ${new Date(data.startTime).toLocaleString()}
End: ${new Date(data.endTime).toLocaleString()}

View your schedule at: ${FRONTEND_URL}/schedule

This is an automated email. Please do not reply.
    `,
  };
}

export function timeEntryApprovedEmail(data: {
  userName: string;
  date: string;
  hours: number;
  pay: number;
}): EmailOptions {
  return {
    to: '',
    subject: 'Time Entry Approved',
    htmlBody: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10b981;">Time Entry Approved ✓</h2>
            <p>Hi ${data.userName},</p>
            <p>Your time entry has been approved:</p>
            <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
              <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(data.date).toLocaleDateString()}</p>
              <p style="margin: 5px 0;"><strong>Hours:</strong> ${data.hours.toFixed(2)}</p>
              <p style="margin: 5px 0;"><strong>Pay:</strong> $${data.pay.toFixed(2)}</p>
            </div>
            <p>
              <a href="${FRONTEND_URL}/timesheet" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Timesheet
              </a>
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This is an automated email. Please do not reply.
            </p>
          </div>
        </body>
      </html>
    `,
    textBody: `
Time Entry Approved

Hi ${data.userName},

Your time entry has been approved:

Date: ${new Date(data.date).toLocaleDateString()}
Hours: ${data.hours.toFixed(2)}
Pay: $${data.pay.toFixed(2)}

View your timesheet at: ${FRONTEND_URL}/timesheet

This is an automated email. Please do not reply.
    `,
  };
}

export function timeEntryRejectedEmail(data: {
  userName: string;
  date: string;
  reason?: string;
}): EmailOptions {
  return {
    to: '',
    subject: 'Time Entry Requires Attention',
    htmlBody: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #ef4444;">Time Entry Requires Attention</h2>
            <p>Hi ${data.userName},</p>
            <p>Your time entry for ${new Date(data.date).toLocaleDateString()} needs to be reviewed and corrected.</p>
            ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
            <p>Please update your time entry and resubmit for approval.</p>
            <p>
              <a href="${FRONTEND_URL}/timesheet" style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Update Time Entry
              </a>
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This is an automated email. Please do not reply.
            </p>
          </div>
        </body>
      </html>
    `,
    textBody: `
Time Entry Requires Attention

Hi ${data.userName},

Your time entry for ${new Date(data.date).toLocaleDateString()} needs to be reviewed and corrected.

${data.reason ? `Reason: ${data.reason}` : ''}

Please update your time entry and resubmit for approval.

View your timesheet at: ${FRONTEND_URL}/timesheet

This is an automated email. Please do not reply.
    `,
  };
}

export function pendingApprovalsEmail(data: {
  managerName: string;
  pendingCount: number;
}): EmailOptions {
  return {
    to: '',
    subject: `${data.pendingCount} Time Entries Awaiting Approval`,
    htmlBody: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #f59e0b;">Pending Time Entry Approvals</h2>
            <p>Hi ${data.managerName},</p>
            <p>You have <strong>${data.pendingCount}</strong> time ${data.pendingCount === 1 ? 'entry' : 'entries'} awaiting your approval.</p>
            <p>Please review and approve or reject these entries at your earliest convenience.</p>
            <p>
              <a href="${FRONTEND_URL}/admin" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Review Entries
              </a>
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This is an automated email. Please do not reply.
            </p>
          </div>
        </body>
      </html>
    `,
    textBody: `
Pending Time Entry Approvals

Hi ${data.managerName},

You have ${data.pendingCount} time ${data.pendingCount === 1 ? 'entry' : 'entries'} awaiting your approval.

Please review and approve or reject these entries at your earliest convenience.

Review entries at: ${FRONTEND_URL}/admin

This is an automated email. Please do not reply.
    `,
  };
}

export function complianceViolationEmail(data: {
  userName: string;
  violationType: string;
  description: string;
  severity: 'warning' | 'critical';
}): EmailOptions {
  const severityColor = data.severity === 'critical' ? '#ef4444' : '#f59e0b';
  const severityLabel = data.severity === 'critical' ? 'Critical' : 'Warning';

  return {
    to: '',
    subject: `${severityLabel}: Compliance Violation Detected`,
    htmlBody: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: ${severityColor};">${severityLabel}: Compliance Violation</h2>
            <p>Hi ${data.userName},</p>
            <p>A compliance issue has been detected:</p>
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${severityColor};">
              <p style="margin: 5px 0;"><strong>Type:</strong> ${data.violationType}</p>
              <p style="margin: 5px 0;"><strong>Description:</strong> ${data.description}</p>
            </div>
            <p>Please review this issue with your manager to ensure compliance with labor regulations.</p>
            <p>
              <a href="${FRONTEND_URL}/timesheet" style="background: ${severityColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Details
              </a>
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This is an automated email. Please do not reply.
            </p>
          </div>
        </body>
      </html>
    `,
    textBody: `
${severityLabel}: Compliance Violation

Hi ${data.userName},

A compliance issue has been detected:

Type: ${data.violationType}
Description: ${data.description}

Please review this issue with your manager to ensure compliance with labor regulations.

View details at: ${FRONTEND_URL}/timesheet

This is an automated email. Please do not reply.
    `,
  };
}

export function shiftReminderEmail(data: {
  userName: string;
  startTime: string;
  location: string;
  hoursUntil: number;
}): EmailOptions {
  return {
    to: '',
    subject: `Shift Reminder: Starting in ${data.hoursUntil} hours`,
    htmlBody: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #0ea5e9;">Shift Reminder</h2>
            <p>Hi ${data.userName},</p>
            <p>This is a reminder that your shift starts in <strong>${data.hoursUntil} hours</strong>.</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Location:</strong> ${data.location}</p>
              <p style="margin: 5px 0;"><strong>Start Time:</strong> ${new Date(data.startTime).toLocaleString()}</p>
            </div>
            <p>See you soon!</p>
            <p>
              <a href="${FRONTEND_URL}/schedule" style="background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Schedule
              </a>
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This is an automated email. Please do not reply.
            </p>
          </div>
        </body>
      </html>
    `,
    textBody: `
Shift Reminder

Hi ${data.userName},

This is a reminder that your shift starts in ${data.hoursUntil} hours.

Location: ${data.location}
Start Time: ${new Date(data.startTime).toLocaleString()}

See you soon!

View your schedule at: ${FRONTEND_URL}/schedule

This is an automated email. Please do not reply.
    `,
  };
}
