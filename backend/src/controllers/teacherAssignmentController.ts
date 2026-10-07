import { Request, Response } from 'express';
import mongoose from 'mongoose';
import TeacherAssignment from '../models/TeacherAssignment.js';
import Admin from '../models/Admin.js';
import Class from '../models/Class.js';
import Subject from '../models/Subject.js';
import { AuthRequest } from '../middleware/auth.js';

/**
 * 1. GET ALL TEACHER ASSIGNMENTS (Admin / Super Admin)
 */
export const getTeacherAssignments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId, classId, subjectId } = req.query;
    const filter: any = { isActive: true };

    if (teacherId) filter.teacherId = teacherId;
    if (classId) filter.classId = classId;
    if (subjectId) filter.subjectId = subjectId;

    const assignments = await TeacherAssignment.find(filter)
      .populate('teacherId', 'name email role')
      .populate('classId', 'name semester section joinCode')
      .populate('subjectId', 'name code')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch teacher assignments.' });
  }
};

/**
 * 2. GET CURRENT AUTHENTICATED TEACHER'S ASSIGNED CLASSES & SUBJECTS
 */
export const getMyAssignedClasses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const filter: any = { isActive: true };
    if (req.admin.role === 'TEACHER') {
      filter.teacherId = req.admin.id;
    } else if (req.admin.role === 'CR' && req.admin.assignedClassId) {
      filter.classId = req.admin.assignedClassId;
    }

    const assignments = await TeacherAssignment.find(filter)
      .populate('teacherId', 'name email')
      .populate('classId', 'name semester section joinCode crId')
      .populate('subjectId', 'name code')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch teacher classes.' });
  }
};

/**
 * 3. ASSIGN TEACHER TO CLASS + SUBJECT
 * RULE: Class + Subject = ONE ACTIVE TEACHER
 */
export const assignTeacherToClassSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId, classId, subjectId } = req.body;

    if (!teacherId || !classId || !subjectId) {
      res.status(400).json({
        success: false,
        message: 'Teacher, Class, and Subject are all required.',
      });
      return;
    }

    // Only approved, active teacher accounts can be assigned to classes.
    const teacher = await Admin.findById(teacherId);
    if (!teacher || teacher.role !== 'TEACHER' || !teacher.isActive || teacher.approvalStatus !== 'Approved') {
      res.status(400).json({ success: false, message: 'An approved, active Teacher account is required.' });
      return;
    }

    // Verify Class exists
    const classDoc = await Class.findById(classId);
    if (!classDoc || !classDoc.isActive) {
      res.status(400).json({ success: false, message: 'Valid Class not found.' });
      return;
    }

    // Verify Subject exists
    const subject = await Subject.findById(subjectId);
    if (!subject || !subject.isActive) {
      res.status(400).json({ success: false, message: 'Valid Subject not found.' });
      return;
    }

    // CRITICAL ENFORCEMENT: Class + Subject = ONE ACTIVE TEACHER
    const existingAssignment = await TeacherAssignment.findOne({
      classId,
      subjectId,
      isActive: true,
    }).populate('teacherId', 'name email');

    if (existingAssignment) {
      if (existingAssignment.teacherId._id.toString() === teacher._id.toString()) {
        res.status(400).json({
          success: false,
          message: `${teacher.name} is already assigned to ${subject.name} for ${classDoc.name}.`,
        });
        return;
      }

      const currentTeacherName = (existingAssignment.teacherId as any)?.name || 'Another teacher';
      res.status(400).json({
        success: false,
        message: 'This subject already has a teacher assigned to this class.',
        details: `${currentTeacherName} is currently assigned to ${subject.name} for ${classDoc.name}. Please remove or reassign that first.`,
      });
      return;
    }

    const assignment = await TeacherAssignment.create({
      teacherId: teacher._id,
      classId: classDoc._id,
      subjectId: subject._id,
      isActive: true,
    });

    const populated = await TeacherAssignment.findById(assignment._id)
      .populate('teacherId', 'name email role')
      .populate('classId', 'name semester section')
      .populate('subjectId', 'name code');

    res.status(201).json({
      success: true,
      message: `Teacher ${teacher.name} successfully assigned to ${subject.name} for ${classDoc.name}.`,
      assignment: populated,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(400).json({
        success: false,
        message: 'This subject already has a teacher assigned to this class.',
      });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to assign teacher.' });
  }
};

/**
 * 4. REMOVE TEACHER ASSIGNMENT
 */
export const removeTeacherAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const assignment = await TeacherAssignment.findById(id);
    if (!assignment) {
      res.status(404).json({ success: false, message: 'Teacher assignment not found.' });
      return;
    }

    await TeacherAssignment.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Teacher assignment removed successfully.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to remove teacher assignment.' });
  }
};

/**
 * 5. TOGGLE / UPDATE TEACHER ASSIGNMENT STATUS (Activate / Deactivate)
 */
export const updateTeacherAssignmentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const assignment = await TeacherAssignment.findById(id);
    if (!assignment) {
      res.status(404).json({ success: false, message: 'Teacher assignment not found.' });
      return;
    }

    if (isActive !== undefined) {
      assignment.isActive = Boolean(isActive);
    } else {
      assignment.isActive = !assignment.isActive;
    }

    await assignment.save();

    res.status(200).json({
      success: true,
      message: `Teacher assignment ${assignment.isActive ? 'activated' : 'deactivated'} successfully.`,
      assignment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update teacher assignment.' });
  }
};
