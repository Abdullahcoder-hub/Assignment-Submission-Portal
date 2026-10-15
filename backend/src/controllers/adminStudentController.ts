import { Response } from 'express';
import crypto from 'crypto';
import Student from '../models/Student.js';
import Submission from '../models/Submission.js';
import { AuthRequest } from '../middleware/auth.js';
import { validateRollNumber } from '../utils/rollValidator.js';
import { escapeRegex } from '../utils/fileValidation.js';
import { sendPasswordResetEmail } from '../config/brevo.js';
import { logError } from '../utils/logger.js';

const canManageStudent = (req: AuthRequest, student: { classId?: unknown }): boolean => {
  if (req.admin?.role === 'SUPER_ADMIN') return true;
  return ['CR', 'CR_ASSISTANT'].includes(req.admin?.role || '')
    && Boolean(req.admin?.assignedClassId)
    && String(student.classId || '') === req.admin?.assignedClassId;
};

/**
 * 1. LIST ALL REGISTERED STUDENTS (WITH SEARCH & PAGINATION)
 */
export const getStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search } = req.query;
    const filter: any = {};
    if (req.admin?.role !== 'SUPER_ADMIN') {
      if (!['CR', 'CR_ASSISTANT'].includes(req.admin?.role || '') || !req.admin?.assignedClassId) {
        res.status(403).json({ success: false, message: 'Access denied.' });
        return;
      }
      filter.classId = req.admin.assignedClassId;
    }

    if (search) {
      const searchRegex = new RegExp(escapeRegex((search as string).trim()), 'i');
      filter.$or = [
        { name: searchRegex },
        { rollNumber: searchRegex },
        { email: searchRegex },
      ];
    }

    const students = await Student.find(filter)
      .select('-passwordHash')
      .sort({ rollNumber: 1 });

    res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch registered students.' });
  }
};

/**
 * 2. UPDATE STUDENT DETAILS (NAME & ROLL NUMBER)
 */
export const updateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, rollNumber } = req.body;

    const student = await Student.findById(id);
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' });
      return;
    }
    if (!canManageStudent(req, student)) {
      res.status(403).json({ success: false, message: 'You can only manage students in your assigned class.' });
      return;
    }

    if (rollNumber && rollNumber.trim() !== student.rollNumber) {
      const cleanRoll = rollNumber.trim();
      const rollValidation = validateRollNumber(cleanRoll);
      if (!rollValidation.isValid) {
        res.status(400).json({ success: false, message: rollValidation.message });
        return;
      }
      const existingRoll = await Student.findOne({ rollNumber: cleanRoll, _id: { $ne: id } });
      if (existingRoll) {
        res.status(400).json({ success: false, message: `Roll number '${cleanRoll}' is already in use by another student.` });
        return;
      }
      student.rollNumber = cleanRoll;
    }

    if (name && name.trim()) {
      student.name = name.trim();
    }

    await student.save();

    res.status(200).json({
      success: true,
      message: 'Student details updated successfully.',
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
        isEmailVerified: student.isEmailVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update student details.' });
  }
};

/**
 * 3. CR RESET STUDENT PASSWORD
 */
export const resetStudentPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id);
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' });
      return;
    }
    if (!canManageStudent(req, student)) {
      res.status(403).json({ success: false, message: 'You can only manage students in your assigned class.' });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    student.resetPasswordToken = resetToken;
    student.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await student.save();

    const emailResult = await sendPasswordResetEmail(student.email, student.name, resetToken);
    if (!emailResult.success) {
      logError('[Admin Student Password Reset Email Error]', emailResult.error);
      if (student.resetPasswordToken === resetToken) {
        student.resetPasswordToken = undefined;
        student.resetPasswordExpires = undefined;
        await student.save();
      }
      res.status(502).json({ success: false, message: 'Failed to send password reset email. Please try again later.' });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Password reset link sent to ${student.email}.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reset student password.' });
  }
};

/**
 * 4. DELETE STUDENT ACCOUNT
 */
export const deleteStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id);
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' });
      return;
    }
    if (!canManageStudent(req, student)) {
      res.status(403).json({ success: false, message: 'You can only manage students in your assigned class.' });
      return;
    }

    // Delete student record and their submissions
    await Promise.all([
      Submission.deleteMany({ studentId: id }),
      Student.findByIdAndDelete(id),
    ]);

    res.status(200).json({
      success: true,
      message: `Student account for "${student.name}" (${student.rollNumber}) deleted successfully.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete student account.' });
  }
};
