import { Request, Response } from 'express';
import Subject from '../models/Subject.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Group from '../models/Group.js';
import LateRequest from '../models/LateRequest.js';
import Admin from '../models/Admin.js';
import { AuthRequest } from '../middleware/auth.js';

export const getSubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { includeInactive, classId } = req.query;
    const filter: any = includeInactive === 'true' ? {} : { isActive: true };

    if (['CR', 'CR_ASSISTANT'].includes(req.admin?.role || '') && req.admin?.assignedClassId) {
      filter.classId = req.admin.assignedClassId;
    } else if (req.student?.classId) {
      filter.classId = req.student.classId;
    } else if (classId) {
      filter.classId = classId;
    }

    const subjects = await Subject.find(filter).sort({ name: 1 }).lean();
    res.status(200).json({ success: true, count: subjects.length, subjects });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch subjects.' });
  }
};

export const createSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, description, isActive } = req.body;
    const classId = req.admin?.assignedClassId || req.body.classId;
    const crId = req.admin?.id || req.body.crId;

    if (!name || !code) {
      res.status(400).json({ success: false, message: 'Subject name and code are required.' });
      return;
    }

    if (crId) {
      const cr = await Admin.findById(crId);
      if (!cr) {
        res.status(400).json({ success: false, message: 'Class Representative not found.' });
        return;
      }
    }

    const uppercaseCode = code.trim().toUpperCase();
    const existingFilter: any = { code: uppercaseCode };
    if (classId) existingFilter.classId = classId;

    const existing = await Subject.findOne(existingFilter);
    if (existing) {
      const statusText = existing.isActive ? '' : ' (currently inactive)';
      res.status(400).json({
        success: false,
        message: `Subject code '${uppercaseCode}' already exists${statusText}. You can manage or activate it from the Subjects list.`,
      });
      return;
    }

    const subject = await Subject.create({
      name: name.trim(),
      code: uppercaseCode,
      description: description ? description.trim() : '',
      classId: classId || undefined,
      crId: crId || undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    res.status(201).json({ success: true, message: 'Subject created successfully.', subject });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create subject.' });
  }
};

export const updateSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, code, description, crId, isActive } = req.body;

    const subject = await Subject.findById(id);
    if (!subject) {
      res.status(404).json({ success: false, message: 'Subject not found.' });
      return;
    }

    if (crId) {
      const cr = await Admin.findById(crId);
      if (!cr) {
        res.status(400).json({ success: false, message: 'Class Representative not found.' });
        return;
      }
      subject.crId = crId;
    }

    if (name) subject.name = name.trim();
    if (code) {
      const upperCode = code.trim().toUpperCase();
      const existing = await Subject.findOne({ code: upperCode, _id: { $ne: id } });
      if (existing) {
        res.status(400).json({ success: false, message: `Subject code '${upperCode}' is already in use.` });
        return;
      }
      subject.code = upperCode;
    }
    if (description !== undefined) subject.description = description.trim();
    if (isActive !== undefined) subject.isActive = Boolean(isActive);

    await subject.save();

    res.status(200).json({ success: true, message: 'Subject updated successfully.', subject });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update subject.' });
  }
};

export const deleteSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const subject = await Subject.findById(id);
    if (!subject) {
      res.status(404).json({ success: false, message: 'Subject not found.' });
      return;
    }

    const assignments = await Assignment.find({ subjectId: id }).select('_id');
    const assignmentIds = assignments.map((assignment) => assignment._id);
    await Promise.all([
      Submission.deleteMany({ $or: [{ subjectId: id }, { assignmentId: { $in: assignmentIds } }] }),
      Group.deleteMany({ subjectId: id }),
      LateRequest.deleteMany({ $or: [{ subjectId: id }, { assignmentId: { $in: assignmentIds } }] }),
      Assignment.deleteMany({ subjectId: id }),
      Subject.findByIdAndDelete(id),
    ]);
    res.status(200).json({ success: true, message: 'Subject and all related records deleted permanently.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete subject.' });
  }
};
