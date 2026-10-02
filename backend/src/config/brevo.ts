import axios from 'axios';
import moment from 'moment-timezone';
import dotenv from 'dotenv';
import { escapeHtml } from '../utils/fileValidation.js';

dotenv.config();

const apiKey = process.env.BREVO_API_KEY || '';
if (process.env.NODE_ENV === 'production' && (!apiKey || apiKey === 'xkeysib-demo')) {
  throw new Error('BREVO_API_KEY must be configured in production.');
}
const senderEmail = process.env.BREVO_SENDER_EMAIL || 'cr@assignmentportal.com';
const senderName = process.env.BREVO_SENDER_NAME || 'Class Representative';
const timezone = process.env.TIMEZONE || 'Asia/Karachi';
const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '');

if (!frontendUrl) {
  throw new Error('FRONTEND_URL must be configured before starting the backend.');
}

const sendBrevoEmail = async (subject: string, htmlContent: string, toEmail: string, toName: string) => {
  await axios.post('https://api.brevo.com/v3/smtp/email', {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: toEmail, name: toName }],
    subject,
    htmlContent,
  }, { headers: { 'api-key': apiKey, 'content-type': 'application/json' } });
};

export const sendLateRequestEmail = async (params: {
  toEmail: string;
  toName: string;
  studentName: string;
  rollNumber: string;
  subjectName: string;
  assignmentTitle: string;
  reason: string;
  approveUrl?: string;
  rejectUrl?: string;
  decision?: 'Approved' | 'Rejected';
  isStudentNotification?: boolean;
  requestType?: 'Submission' | 'GroupRegistration';
  groupName?: string;
  groupMembers?: string;
  rejectionReason?: string;
}): Promise<{ success: boolean }> => {
  let decisionText: string;
  let actionHtml: string;
  let emailSubject: string;
  let additionalInfo: string = '';

  const requestTypeText = params.requestType === 'GroupRegistration' ? 'Late Group Registration' : 'Late Assignment Submission';

  if (params.isStudentNotification) {
    decisionText = 'Your late submission request has been submitted successfully and is pending approval from the Class Representative.';
    actionHtml = '<p>You will receive an email notification once your request is reviewed. Please check the portal for updates.</p>';
    emailSubject = `Late Request Submitted — ${params.assignmentTitle}`;
  } else if (params.decision) {
    if (params.decision === 'Approved') {
      decisionText = `Your late ${requestTypeText.toLowerCase()} request has been <strong>approved</strong> by the Class Representative. You can now continue with the requested action through the portal.`;
    } else {
      decisionText = `Your late ${requestTypeText.toLowerCase()} request has been <strong>rejected</strong> by the Class Representative.`;
      if (params.rejectionReason) {
        decisionText += `<br><br><strong>Rejection Reason:</strong> ${escapeHtml(params.rejectionReason)}`;
      }
    }
    actionHtml = '<p>Please open the portal to submit again.</p>';
    emailSubject = `Late Request ${params.decision} — ${params.assignmentTitle}`;
  } else {
    decisionText = 'A student has submitted a late permission request.';
    actionHtml = `<p><a href="${escapeHtml(params.approveUrl)}" style="background:#16a34a;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px;">Approve</a> <a href="${escapeHtml(params.rejectUrl)}" style="background:#dc2626;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px;">Reject</a></p>`;
    emailSubject = `New Late Request — ${params.assignmentTitle}`;
  }

  if (params.requestType === 'GroupRegistration' && params.groupName) {
    additionalInfo = `<br><strong>Request Type:</strong> Late Group Registration<br><strong>Group:</strong> ${escapeHtml(params.groupName)}`;
    if (params.groupMembers) {
      additionalInfo += `<br><strong>Group Members:</strong> ${escapeHtml(params.groupMembers)}`;
    }
  } else if (params.requestType === 'Submission') {
    additionalInfo = `<br><strong>Request Type:</strong> Late Assignment Submission`;
  }

  const htmlContent = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e5e7eb;border-radius:8px;background:#ffffff"><h2 style="color:#1f2937;margin-top:0">Late Request Notification</h2><p>Hello <strong>${escapeHtml(params.toName)}</strong>,</p><p>${decisionText}</p><div style="background:#f9fafb;padding:15px;border-radius:6px;margin:15px 0"><p style="margin:0"><strong>Student:</strong> ${escapeHtml(params.studentName)}<br><strong>Roll No:</strong> ${escapeHtml(params.rollNumber)}<br><strong>Subject:</strong> ${escapeHtml(params.subjectName)}<br><strong>Assignment:</strong> ${escapeHtml(params.assignmentTitle)}${additionalInfo}<br><strong>Reason:</strong> ${escapeHtml(params.reason)}</p></div>${actionHtml}</div>`;

  try {
    if (!apiKey || apiKey === 'xkeysib-demo') {
      console.info('[Brevo Email Mock] Late request email skipped.');
      return { success: true };
    }
    await sendBrevoEmail(
      emailSubject,
      htmlContent,
      params.toEmail,
      params.toName
    );
    return { success: true };
  } catch (error) {
    console.error('[Brevo Late Request Email Error] Delivery failed.');
    return { success: false };
  }
};

export interface SendConfirmationEmailParams {
  toEmail: string;
  toName: string;
  rollNumber: string;
  subjectName: string;
  subjectCode: string;
  assignmentTitle: string;
  submissionId: string;
  originalFileName: string;
  submittedAt: Date;
  isLate: boolean;
}

export const sendSubmissionConfirmationEmail = async (
  params: SendConfirmationEmailParams
): Promise<{ success: boolean; error?: string }> => {
  if (!apiKey || apiKey === 'xkeysib-demo') {
    console.info('[Brevo Email Mock] Submission confirmation email skipped.');
    return { success: true };
  }

  const formattedDate = moment(params.submittedAt).tz(timezone).format('DD MMMM YYYY, hh:mm A');
  const statusLabel = params.isLate ? 'Late Submission' : 'Submitted On Time';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: #2563eb; color: #ffffff; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 600; }
        .content { padding: 24px; }
        .receipt-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 20px; }
        .row { display: flex; justify-content: space-between; border-bottom: 1px solid #edf2f7; padding: 8px 0; font-size: 14px; }
        .row:last-child { border-bottom: none; }
        .label { font-weight: bold; color: #64748b; }
        .value { font-weight: 600; color: #1e293b; text-align: right; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .badge-ontime { background: #dcfce7; color: #166534; }
        .badge-late { background: #fee2e2; color: #991b1b; }
        .footer { text-align: center; padding: 16px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Assignment Submission Receipt</h1>
        </div>
        <div class="content">
          <p>Dear <strong>${escapeHtml(params.toName)}</strong>,</p>
          <p>Your assignment submission has been recorded successfully in the Class Portal.</p>

          <div class="receipt-card">
            <div class="row">
              <span class="label">Submission ID</span>
              <span class="value">${escapeHtml(params.submissionId)}</span>
            </div>
            <div class="row">
              <span class="label">Student Name</span>
              <span class="value">${escapeHtml(params.toName)}</span>
            </div>
            <div class="row">
              <span class="label">Roll Number</span>
              <span class="value">${escapeHtml(params.rollNumber)}</span>
            </div>
            <div class="row">
              <span class="label">Subject</span>
              <span class="value">${escapeHtml(params.subjectName)} (${escapeHtml(params.subjectCode)})</span>
            </div>
            <div class="row">
              <span class="label">Assignment</span>
              <span class="value">${escapeHtml(params.assignmentTitle)}</span>
            </div>
            <div class="row">
              <span class="label">Uploaded File</span>
              <span class="value">${escapeHtml(params.originalFileName)}</span>
            </div>
            <div class="row">
              <span class="label">Submitted At</span>
              <span class="value">${formattedDate} (${timezone})</span>
            </div>
            <div class="row">
              <span class="label">Status</span>
              <span class="value">
                <span class="badge ${params.isLate ? 'badge-late' : 'badge-ontime'}">${statusLabel}</span>
              </span>
            </div>
          </div>

          <p>Please keep this email receipt for your records.</p>
        </div>
        <div class="footer">
          Class Assignment Submission Portal &bull; Generated automatically by server
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await sendBrevoEmail(`Assignment Submission Confirmation — ${params.subjectCode} ${params.assignmentTitle}`, htmlContent, params.toEmail, params.toName);
    return { success: true };
  } catch (error: any) {
    console.error('[Brevo Email Error] Submission confirmation delivery failed.');
    return { success: false, error: error?.message || 'Failed to send confirmation email via Brevo.' };
  }
};

/**
 * Send Student Account Email Verification Link via Brevo
 */
export const sendStudentVerificationEmail = async (
  toEmail: string,
  toName: string,
  verificationToken: string
): Promise<{ success: boolean; error?: string }> => {
  const verifyUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

  if (!apiKey || apiKey === 'xkeysib-demo') {
    console.info('[Brevo Email Mock] Verification email skipped.');
    return { success: true };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h2 style="color: #1e293b; margin-top: 0;">Verify Your Student Account Email</h2>
        <p style="color: #475569;">Hello <strong>${escapeHtml(toName)}</strong>,</p>
        <p style="color: #475569;">Thank you for registering on the Class Assignment Submission Portal. Please click the button below to verify your email address and activate your account:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${verifyUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; font-weight: bold; border-radius: 8px; text-decoration: none; display: inline-block;">Verify Email Address</a>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">If you did not register for this portal, please ignore this email.</p>
      </div>
    </body>
    </html>
  `;

  try {
    await sendBrevoEmail('Verify Your Email — Class Assignment Portal', htmlContent, toEmail, toName);
    return { success: true };
  } catch (error: any) {
    console.error('[Brevo Verification Email Error] Delivery failed.');
    return { success: false, error: 'Failed to send verification email.' };
  }
};

/**
 * Send Password Reset Link via Brevo
 */
export const sendPasswordResetEmail = async (
  toEmail: string,
  toName: string,
  resetToken: string
): Promise<{ success: boolean; error?: string }> => {
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  if (!apiKey || apiKey === 'xkeysib-demo') {
    console.info('[Brevo Email Mock] Password reset email skipped.');
    return { success: true };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h2 style="color: #1e293b; margin-top: 0;">Reset Your Password</h2>
        <p style="color: #475569;">Hello <strong>${escapeHtml(toName)}</strong>,</p>
        <p style="color: #475569;">You requested a password reset for your Class Portal account. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #dc2626; color: #ffffff; padding: 12px 24px; font-weight: bold; border-radius: 8px; text-decoration: none; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">If you did not request a password reset, you can safely ignore this email.</p>
      </div>
    </body>
    </html>
  `;

  try {
    await sendBrevoEmail('Reset Password — Class Assignment Portal', htmlContent, toEmail, toName);
    return { success: true };
  } catch (error: any) {
    console.error('[Brevo Reset Email Error] Delivery failed.');
    return { success: false, error: 'Failed to send password reset email.' };
  }
};
