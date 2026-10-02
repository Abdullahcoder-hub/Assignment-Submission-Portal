import { Request, Response } from 'express';
import LateRequest from '../models/LateRequest.js';
import Assignment from '../models/Assignment.js';
import Subject from '../models/Subject.js';
import Group from '../models/Group.js';
import Admin from '../models/Admin.js';
import Student from '../models/Student.js';
import jwt from 'jsonwebtoken';
import { sendLateRequestEmail } from '../config/brevo.js';
import { AuthRequest } from '../middleware/auth.js';
import { getJwtSecret } from '../config/security.js';
import { escapeRegex } from '../utils/fileValidation.js';
import { escapeHtml } from '../utils/fileValidation.js';
import { logError } from '../utils/logger.js';

const decisionToken = (requestId: string, decision: 'Approved' | 'Rejected') => jwt.sign(
  { requestId, decision, purpose: 'late-request-decision' },
  getJwtSecret(),
  { expiresIn: '24h' }
);

const getLateRequestDetails = async (requestId: string) => LateRequest.findById(requestId)
  .populate('subjectId', 'name code')
  .populate('assignmentId', 'title');

const applyDecision = async (requestId: string, decision: 'Approved' | 'Rejected', adminId?: string, rejectionReason?: string) => {
  const lateReq = await LateRequest.findById(requestId);
  if (!lateReq) return null;
  lateReq.status = decision;
  lateReq.decidedAt = new Date();
  if (adminId) lateReq.decidedBy = adminId as any;
  if (decision === 'Rejected' && rejectionReason) {
    lateReq.rejectionReason = rejectionReason;
  }
  await lateReq.save();
  return lateReq;
};

const notifyStudentOfDecision = async (lateReq: any, decision: 'Approved' | 'Rejected') => {
  const details = await getLateRequestDetails(lateReq._id.toString());
  const student = await Student.findById(lateReq.studentId);
  if (!student || !details) return;
  const subject = details.subjectId as any;
  const assignment = details.assignmentId as any;
  await sendLateRequestEmail({
    toEmail: student.email,
    toName: student.name,
    studentName: student.name,
    rollNumber: student.rollNumber,
    subjectName: subject.name,
    assignmentTitle: assignment.title,
    reason: lateReq.reason,
    decision,
    rejectionReason: lateReq.rejectionReason,
  });
};

/**
 * 1. STUDENT SUBMIT LATE REQUEST
 */
export const createLateRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Student authentication required.' });
      return;
    }

    const { subjectId, assignmentId, reason, requestType = 'Submission' } = req.body;

    if (!subjectId || !assignmentId) {
      res.status(400).json({ success: false, message: 'Subject ID and Assignment ID are required.' });
      return;
    }

    if (!['Submission', 'GroupRegistration'].includes(requestType)) {
      res.status(400).json({ success: false, message: 'Invalid late request type.' });
      return;
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment || !assignment.isActive) {
      res.status(400).json({ success: false, message: 'Assignment not available.' });
      return;
    }

    if (requestType === 'GroupRegistration' && assignment.submissionType !== 'Group') {
      res.status(400).json({ success: false, message: 'Late group registration is only available for group assignments.' });
      return;
    }

    const studentId = req.student.id;
    const studentName = req.student.name;
    const rollNumber = req.student.rollNumber;

    // Check if student belongs to a group for this subject
    const group = await Group.findOne({
      subjectId,
      'members.studentId': studentId,
    });

    // Check existing late request for student or group for this assignment
    const filter: any = {
      assignmentId,
      requestType: requestType === 'Submission' ? { $in: ['Submission', null] } : requestType,
    };
    if (group) {
      filter.$or = [{ groupId: group._id }, { studentId }];
    } else {
      filter.studentId = studentId;
    }

    let existingRequest = await LateRequest.findOne(filter);

    if (existingRequest) {
      res.status(200).json({
        success: true,
        message: existingRequest.status === 'Approved'
          ? 'Late submission request has already been approved by CR.'
          : existingRequest.status === 'Rejected'
          ? 'Late submission request was rejected by CR.'
          : 'Late submission request is pending CR approval.',
        request: existingRequest,
      });
      return;
    }

    const newRequest = await LateRequest.create({
      studentId,
      requestType,
      groupId: group ? group._id : undefined,
      subjectId,
      assignmentId,
      studentName,
      rollNumber,
      reason: reason ? reason.trim() : 'Assignment deadline passed.',
      status: 'Pending',
      requestedAt: new Date(),
    });

    const student = await Student.findById(studentId).select('name email').lean();
    const subject = await Subject.findById(assignment.subjectId).select('name code crId').populate('crId', 'name email').lean();
    const admin = await Admin.findOne({ role: 'ADMIN' }).select('name email').lean();
    let crEmails: string[] = [];
    let crName = 'Class Representative';

    if (subject && subject.crId && (subject.crId as any).email) {
      crEmails.push((subject.crId as any).email.trim());
      crName = (subject.crId as any).name || 'Class Representative';
    } else {
      const fallbackAdminEmails = Array.from(new Set([
        admin?.email?.trim(),
        process.env.ADMIN_EMAIL?.trim(),
      ].filter((email): email is string => Boolean(email))));
      crEmails = fallbackAdminEmails;
      crName = admin?.name || process.env.ADMIN_NAME || 'Class Representative';
    }

    let crNotified = false;
    let studentNotified = false;

    if (crEmails.length > 0 && subject) {
      const configuredBackendUrl = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
      const apiBaseUrl = configuredBackendUrl.endsWith('/api') ? configuredBackendUrl : `${configuredBackendUrl}/api`;
      if (configuredBackendUrl.includes('localhost') || configuredBackendUrl.includes('127.0.0.1')) {
        console.warn('[Late Request] WARNING: Using localhost URL for email links. Set BACKEND_URL environment variable in production.');
      }
      const groupInfo = group ? await Group.findById(group._id).select('groupName members').lean() : null;
      const groupMembers = groupInfo?.members.map((m: any) => `${m.name} (${m.rollNumber})`).join(', ') || '';
      for (const crEmail of crEmails) {
        const emailResult = await sendLateRequestEmail({
          toEmail: crEmail,
          toName: crName,
          studentName,
          rollNumber,
          subjectName: subject.name,
          assignmentTitle: requestType === 'GroupRegistration' ? `${assignment.title} (Late Group Registration)` : assignment.title,
          reason: newRequest.reason,
          approveUrl: `${apiBaseUrl}/late-requests/email-decision/${newRequest._id}/Approved/${decisionToken(newRequest._id.toString(), 'Approved')}`,
          rejectUrl: `${apiBaseUrl}/late-requests/email-decision/${newRequest._id}/Rejected/${decisionToken(newRequest._id.toString(), 'Rejected')}`,
          requestType,
          groupName: groupInfo?.groupName || '',
          groupMembers,
        });
        crNotified = crNotified || emailResult.success;
        if (!emailResult.success) {
          console.error('[Late Request] CR email delivery failed.');
        }
      }
    } else {
      console.error('[Late Request] CR notification skipped: no CR email or subject was found.');
    }

    if (student && subject) {
      const studentEmailResult = await sendLateRequestEmail({
        toEmail: student.email,
        toName: student.name,
        studentName,
        rollNumber,
        subjectName: subject.name,
        assignmentTitle: requestType === 'GroupRegistration' ? `${assignment.title} (Late Group Registration)` : assignment.title,
        reason: newRequest.reason,
        isStudentNotification: true,
      });
      studentNotified = studentEmailResult.success;
      if (!studentEmailResult.success) {
        console.error('[Late Request] Student email delivery failed.');
      }
    } else {
      console.error('[Late Request] Student notification skipped: no student email or subject was found.');
    }

    res.status(201).json({
      success: true,
      message: crNotified && studentNotified
        ? 'Assignment deadline has passed. Your late submission request has been sent to the CR for approval. A confirmation email has been sent to your email address.'
        : crNotified
        ? 'Assignment deadline has passed. Your late submission request has been sent to the CR for approval. (Student notification email failed)'
        : studentNotified
        ? 'Your request was saved and a confirmation email has been sent, but the CR notification email could not be sent. Please contact the CR directly.'
        : 'Your request was saved, but the notification emails could not be sent. Please contact the CR directly.',
      request: newRequest,
    });
  } catch (error) {
    logError('[Create Late Request Error]', error);
    res.status(500).json({ success: false, message: 'Failed to submit late request.' });
  }
};

/**
 * 2. GET STUDENT'S LATE REQUEST STATUS FOR AN ASSIGNMENT
 */
export const getMyLateRequestStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Student authentication required.' });
      return;
    }

    const { assignmentId, requestType = 'Submission' } = req.query;
    if (!assignmentId) {
      res.status(400).json({ success: false, message: 'Assignment ID is required.' });
      return;
    }

    const studentId = req.student.id;

    // Find if student is in a group for this assignment
    const assignment = await Assignment.findById(assignmentId);
    let group = null;
    if (assignment) {
      group = await Group.findOne({ subjectId: assignment.subjectId, 'members.studentId': studentId });
    }

    const filter: any = {
      assignmentId,
      requestType: requestType === 'Submission' ? { $in: ['Submission', null] } : requestType,
    };
    if (group) {
      filter.$or = [{ groupId: group._id }, { studentId }];
    } else {
      filter.studentId = studentId;
    }

    const request = await LateRequest.findOne(filter);

    res.status(200).json({
      success: true,
      request: request || null,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch late request status.' });
  }
};

/**
 * 3. CR GET ALL LATE SUBMISSION REQUESTS
 */
export const getLateRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId, assignmentId, status, search, requestType } = req.query;
    const filter: any = {};

    if (subjectId) filter.subjectId = subjectId;
    if (assignmentId) filter.assignmentId = assignmentId;
    if (status) filter.status = status;
    if (requestType) {
      filter.requestType = requestType === 'Submission' ? { $in: ['Submission', null] } : requestType;
    }

    if (search) {
      const searchRegex = new RegExp(escapeRegex((search as string).trim()), 'i');
      filter.$or = [
        { studentName: searchRegex },
        { rollNumber: searchRegex },
        { reason: searchRegex },
      ];
    }

    const requests = await LateRequest.find(filter)
      .populate('subjectId', 'name code')
      .populate('assignmentId', 'title deadline submissionType allowLateGroupRegistration')
      .populate('groupId', 'groupName leader members')
      .sort({ requestedAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch late submission requests.' });
  }
};

/**
 * 4. CR DECIDE LATE SUBMISSION REQUEST (Approve / Reject)
 */
export const updateLateRequestDecision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { decision, rejectionReason } = req.body; // 'Approved' | 'Rejected'

    if (!decision || !['Approved', 'Rejected'].includes(decision)) {
      res.status(400).json({ success: false, message: 'Decision must be "Approved" or "Rejected".' });
      return;
    }

    const lateReq = await applyDecision(id, decision as 'Approved' | 'Rejected', req.admin?.id, rejectionReason);
    if (!lateReq) {
      res.status(404).json({ success: false, message: 'Late submission request not found.' });
      return;
    }

    await notifyStudentOfDecision(lateReq, decision as 'Approved' | 'Rejected');

    res.status(200).json({
      success: true,
      message: `Late submission request ${decision.toLowerCase()} successfully.`,
      request: lateReq,
    });
  } catch (error) {
    logError('[Update Decision Error]', error);
    res.status(500).json({ success: false, message: 'Failed to update late submission decision.' });
  }
};

export const decideLateRequestByEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: rawId, decision: rawDecision, token: rawToken } = req.params;
    const id = String(rawId);
    const decision = String(rawDecision) as 'Approved' | 'Rejected';
    const token = String(rawToken);
    if (!['Approved', 'Rejected'].includes(decision)) {
      res.status(400).send('Invalid late request decision link.');
      return;
    }
    const payload = jwt.verify(token, getJwtSecret()) as any;
    if (payload.requestId !== id || payload.decision !== decision || payload.purpose !== 'late-request-decision') {
      res.status(400).send('Invalid late request decision link.');
      return;
    }
    const lateReq = await LateRequest.findOne({ _id: id, status: 'Pending' });
    if (!lateReq) {
      res.status(409).send('This late request has already been decided or no longer exists.');
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm late request</title></head><body><main><h1>Confirm ${decision.toLowerCase()} decision</h1><p>This action will notify the student. Confirm only if you intend to proceed.</p><form method="post" action="${escapeHtml(`${req.baseUrl}/email-decision`)}"><input type="hidden" name="id" value="${escapeHtml(id)}"><input type="hidden" name="decision" value="${escapeHtml(decision)}"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">Confirm ${decision.toLowerCase()}</button></form></main></body></html>`);
  } catch {
    res.status(400).send('This late request link is invalid or expired.');
  }
};

export const completeLateRequestDecisionByEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, decision, token } = req.body;
    if (typeof id !== 'string' || typeof token !== 'string' || !['Approved', 'Rejected'].includes(decision)) {
      res.status(400).send('Invalid late request decision.');
      return;
    }
    const payload = jwt.verify(token, getJwtSecret()) as any;
    if (payload.requestId !== id || payload.decision !== decision || payload.purpose !== 'late-request-decision') {
      res.status(400).send('Invalid late request decision.');
      return;
    }

    const lateReq = await LateRequest.findOneAndUpdate(
      { _id: id, status: 'Pending' },
      { $set: { status: decision, decidedAt: new Date() } },
      { new: true },
    );
    if (!lateReq) {
      res.status(409).send('This late request has already been decided or no longer exists.');
      return;
    }
    await notifyStudentOfDecision(lateReq, decision);
    res.send(`Late submission request ${decision.toLowerCase()} successfully. The student has been notified by email.`);
  } catch {
    res.status(400).send('This late request link is invalid or expired.');
  }
};
