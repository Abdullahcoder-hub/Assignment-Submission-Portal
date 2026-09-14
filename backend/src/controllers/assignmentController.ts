import { Request, Response } from 'express';
import Assignment from '../models/Assignment.js';
import Subject from '../models/Subject.js';
import Submission from '../models/Submission.js';
import { AuthRequest } from '../middleware/auth.js';

export const getAssignments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subjectId, includeInactive } = req.query;
    const filter: any = {};

    if (subjectId) {
      filter.subjectId = subjectId;
    }

    if (includeInactive !== 'true') {
      filter.isActive = true;
    }

    const assignments = await Assignment.find(filter)
      .populate('subjectId', 'name code')
      .sort({ deadline: 1 });

    res.status(200).json({ success: true, count: assignments.length, assignments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch assignments.' });
  }
};

export const getAssignmentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const assignment = await Assignment.findById(id).populate('subjectId', 'name code');
    if (!assignment) {
      res.status(404).json({ success: false, message: 'Assignment not found.' });
      return;
    }
    res.status(200).json({ success: true, assignment });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch assignment details.' });
  }
};

export const createAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      subjectId,
      title,
      description,
      deadline,
      allowLateSubmission,
      allowedFileTypes,
      maxFileSize,
      isActive,
    } = req.body;

    if (!subjectId || !title || !deadline) {
      res.status(400).json({ success: false, message: 'Subject, Title, and Deadline are required.' });
      return;
    }

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      res.status(400).json({ success: false, message: 'Invalid subject ID.' });
      return;
    }

    const assignment = await Assignment.create({
      subjectId,
      title: title.trim(),
      description: description ? description.trim() : '',
      deadline: new Date(deadline),
      allowLateSubmission: Boolean(allowLateSubmission),
      allowedFileTypes: Array.isArray(allowedFileTypes) && allowedFileTypes.length > 0
        ? allowedFileTypes.map((t: string) => t.replace('.', '').toLowerCase().trim())
        : ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'zip'],
      maxFileSize: Number(maxFileSize) > 0 ? Number(maxFileSize) : 10,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    const populated = await Assignment.findById(assignment._id).populate('subjectId', 'name code');

    res.status(201).json({
      success: true,
      message: 'Assignment created successfully.',
      assignment: populated,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create assignment.' });
  }
};

export const updateAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      deadline,
      allowLateSubmission,
      allowedFileTypes,
      maxFileSize,
      isActive,
      subjectId,
    } = req.body;

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      res.status(404).json({ success: false, message: 'Assignment not found.' });
      return;
    }

    if (subjectId) {
      const subject = await Subject.findById(subjectId);
      if (!subject) {
        res.status(400).json({ success: false, message: 'Invalid subject ID.' });
        return;
      }
      assignment.subjectId = subjectId;
    }

    if (title) assignment.title = title.trim();
    if (description !== undefined) assignment.description = description.trim();
    if (deadline) assignment.deadline = new Date(deadline);
    if (allowLateSubmission !== undefined) assignment.allowLateSubmission = Boolean(allowLateSubmission);
    if (Array.isArray(allowedFileTypes) && allowedFileTypes.length > 0) {
      assignment.allowedFileTypes = allowedFileTypes.map((t: string) => t.replace('.', '').toLowerCase().trim());
    }
    if (maxFileSize && Number(maxFileSize) > 0) assignment.maxFileSize = Number(maxFileSize);
    if (isActive !== undefined) assignment.isActive = Boolean(isActive);

    await assignment.save();

    const populated = await Assignment.findById(assignment._id).populate('subjectId', 'name code');

    res.status(200).json({
      success: true,
      message: 'Assignment updated successfully.',
      assignment: populated,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update assignment.' });
  }
};

export const deleteAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      res.status(404).json({ success: false, message: 'Assignment not found.' });
      return;
    }

    const submissionCount = await Submission.countDocuments({ assignmentId: id });
    if (submissionCount > 0) {
      assignment.isActive = false;
      await assignment.save();
      res.status(200).json({
        success: true,
        message: `Assignment deactivated safely instead of permanently deleted because it has ${submissionCount} submission(s).`,
        assignment,
      });
      return;
    }

    await Assignment.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Assignment deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete assignment.' });
  }
};
