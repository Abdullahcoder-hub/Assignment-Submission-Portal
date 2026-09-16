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

const decisionToken = (requestId: string, decision: 'Approved' | 'Rejected') => jwt.sign(
  { requestId, decision, purpose: 'late-request-decision' },
  process.env.JWT_SECRET || 'default_secret_key_change_in_production_12345',
  { expiresIn: '7d' }
);

const getLateRequestDetails = async (requestId: string) => LateRequest.findById(requestId)
  .populate('subjectId', 'name code')
  .populate('assignmentId', 'title');

const applyDecision = async (requestId: string, decision: 'Approved' | 'Rejected', adminId?: string) => {
  const lateReq = await LateRequest.findById(requestId);
  if (!lateReq) return null;
  lateReq.status = decision;
  lateReq.decidedAt = new Date();
  if (adminId) lateReq.decidedBy = adminId as any;
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

    const { subjectId, assignmentId, reason } = req.body;

    if (!subjectId || !assignmentId) {
      res.status(400).json({ success: false, message: 'Subject ID and Assignment ID are required.' });
      return;
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment || !assignment.isActive) {
      res.status(400).json({ success: false, message: 'Assignment not available.' });
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
    const filter: any = { assignmentId };
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
      groupId: group ? group._id : undefined,
      subjectId,
      assignmentId,
      studentName,
      rollNumber,
      reason: reason ? reason.trim() : 'Assignment deadline passed.',
      status: 'Pending',
      requestedAt: new Date(),
    });

    const admin = await Admin.findOne({ role: 'ADMIN' });
    const subject = await Subject.findById(subjectId).select('name code');
    if (admin && subject) {
      const baseUrl = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}/api`).replace(/\/$/, '');
      await sendLateRequestEmail({
        toEmail: admin.email,
        toName: admin.name,
        studentName,
        rollNumber,
        subjectName: subject.name,
        assignmentTitle: assignment.title,
        reason: newRequest.reason,
        approveUrl: `${baseUrl}/api/late-requests/email-decision/${newRequest._id}/Approved/${decisionToken(newRequest._id.toString(), 'Approved')}`,
        rejectUrl: `${baseUrl}/api/late-requests/email-decision/${newRequest._id}/Rejected/${decisionToken(newRequest._id.toString(), 'Rejected')}`,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Assignment deadline has passed. Your late submission request has been sent to the CR for approval.',
      request: newRequest,
    });
  } catch (error) {
    console.error('[Create Late Request Error]:', error);
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

    const { assignmentId } = req.query;
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

    const filter: any = { assignmentId };
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
    const { subjectId, assignmentId, status, search } = req.query;
    const filter: any = {};

    if (subjectId) filter.subjectId = subjectId;
    if (assignmentId) filter.assignmentId = assignmentId;
    if (status) filter.status = status;

    if (search) {
      const searchRegex = new RegExp((search as string).trim(), 'i');
      filter.$or = [
        { studentName: searchRegex },
        { rollNumber: searchRegex },
        { reason: searchRegex },
      ];
    }

    const requests = await LateRequest.find(filter)
      .populate('subjectId', 'name code')
      .populate('assignmentId', 'title deadline')
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
    const { decision } = req.body; // 'Approved' | 'Rejected'

    if (!decision || !['Approved', 'Rejected'].includes(decision)) {
      res.status(400).json({ success: false, message: 'Decision must be "Approved" or "Rejected".' });
      return;
    }

    const lateReq = await applyDecision(id, decision as 'Approved' | 'Rejected', req.admin?.id);
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
    console.error('[Update Decision Error]:', error);
    res.status(500).json({ success: false, message: 'Failed to update late submission decision.' });
  }
};

export const decideLateRequestByEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: rawId, decision: rawDecision, token: rawToken } = req.params;
    const id = String(rawId);
    const decision = String(rawDecision) as 'Approved' | 'Rejected';
    const token = String(rawToken);
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key_change_in_production_12345') as any;
    if (payload.requestId !== id || payload.decision !== decision || payload.purpose !== 'late-request-decision') {
      res.status(400).send('Invalid late request decision link.');
      return;
    }
    const lateReq = await applyDecision(id, decision as 'Approved' | 'Rejected');
    if (!lateReq) {
      res.status(404).send('Late submission request not found.');
      return;
    }
    await notifyStudentOfDecision(lateReq, decision);
    res.send(`Late submission request ${decision.toLowerCase()} successfully. The student has been notified by email.`);
  } catch {
    res.status(400).send('This late request link is invalid or expired.');
  }
};
