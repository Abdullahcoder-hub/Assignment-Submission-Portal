import { Response } from 'express';
import LateRequest from '../models/LateRequest.js';
import Assignment from '../models/Assignment.js';
import Subject from '../models/Subject.js';
import Group from '../models/Group.js';
import { AuthRequest } from '../middleware/auth.js';

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
    const { id } = req.params;
    const { decision } = req.body; // 'Approved' | 'Rejected'

    if (!decision || !['Approved', 'Rejected'].includes(decision)) {
      res.status(400).json({ success: false, message: 'Decision must be "Approved" or "Rejected".' });
      return;
    }

    const lateReq = await LateRequest.findById(id);
    if (!lateReq) {
      res.status(404).json({ success: false, message: 'Late submission request not found.' });
      return;
    }

    lateReq.status = decision as 'Approved' | 'Rejected';
    lateReq.decidedAt = new Date();
    if (req.admin) {
      lateReq.decidedBy = req.admin.id as any;
    }

    await lateReq.save();

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
