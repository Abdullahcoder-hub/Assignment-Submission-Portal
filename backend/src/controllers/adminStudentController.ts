import { Response } from 'express';
import bcrypt from 'bcryptjs';
import Student from '../models/Student.js';
import Submission from '../models/Submission.js';
import { AuthRequest } from '../middleware/auth.js';
import { validatePasswordStrength } from '../utils/passwordValidator.js';
import { validateRollNumber } from '../utils/rollValidator.js';

/**
 * 1. LIST ALL REGISTERED STUDENTS (WITH SEARCH & PAGINATION)
 */
export const getStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search } = req.query;
    const filter: any = {};

    if (search) {
      const searchRegex = new RegExp((search as string).trim(), 'i');
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
    const { newPassword } = req.body;

    if (!newPassword) {
      res.status(400).json({ success: false, message: 'New password is required.' });
      return;
    }

    const passValidation = validatePasswordStrength(newPassword);
    if (!passValidation.isValid) {
      res.status(400).json({ success: false, message: passValidation.message });
      return;
    }

    const student = await Student.findById(id);
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    student.passwordHash = await bcrypt.hash(newPassword, salt);
    await student.save();

    res.status(200).json({
      success: true,
      message: `Password for student "${student.name}" (${student.rollNumber}) reset successfully.`,
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
