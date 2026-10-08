import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import TeacherAssignment from '../models/TeacherAssignment.js';
import { AuthRequest } from '../middleware/auth.js';
import { getJwtSecret } from '../config/security.js';
import { validatePasswordStrength } from '../utils/passwordValidator.js';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Please provide both email and password.' });
      return;
    }

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() })
      .populate('assignedClassId', 'name semester section')
      .lean();
    if (!admin) {
      res.status(401).json({ success: false, message: 'Incorrect email or password.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Incorrect email or password.' });
      return;
    }

    if (admin.role === 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Admin accounts are no longer supported. Sign in with the Super Admin account or register as Teacher/CR.',
      });
      return;
    }

    if (admin.isEmailVerified === false) {
      res.status(403).json({
        success: false,
        message: 'Please verify your email using the link we sent before signing in.',
      });
      return;
    }

    if (admin.approvalStatus === 'Pending') {
      res.status(403).json({
        success: false,
        message: 'Your email is verified. Your account is waiting for Super Admin approval.',
      });
      return;
    }

    if (admin.approvalStatus === 'Rejected') {
      res.status(403).json({
        success: false,
        message: 'Your staff account request was not approved. Please contact the Super Admin.',
      });
      return;
    }

    if (admin.isActive === false) {
      res.status(403).json({ success: false, message: 'This account has been deactivated. Please contact Super Admin.' });
      return;
    }

    // If TEACHER, fetch their active class + subject assignments from the database
    let teacherAssignments: any[] = [];
    if (admin.role === 'TEACHER') {
      teacherAssignments = await TeacherAssignment.find({ teacherId: admin._id, isActive: true })
        .populate('classId', 'name semester section')
        .populate('subjectId', 'name code')
        .lean();
    }

    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        role: admin.role,
        assignedClassId: (admin as any).assignedClassId?._id?.toString(),
        tokenVersion: admin.tokenVersion ?? 0,
      },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        assignedClassId: (admin as any).assignedClassId,
        teacherAssignments: admin.role === 'TEACHER' ? teacherAssignments : undefined,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ success: false, message: 'Not authenticated.' });
      return;
    }
    const admin = await Admin.findById(req.admin.id)
      .select('name email role assignedClassId isActive isEmailVerified approvalStatus')
      .populate('assignedClassId', 'name semester section')
      .lean();
    if (!admin) {
      res.status(404).json({ success: false, message: 'Staff profile not found.' });
      return;
    }

    let teacherAssignments: any[] = [];
    if (admin.role === 'TEACHER') {
      teacherAssignments = await TeacherAssignment.find({ teacherId: (admin as any)._id, isActive: true })
        .populate('classId', 'name semester section')
        .populate('subjectId', 'name code')
        .lean();
    }

    res.status(200).json({
      success: true,
      admin: {
        id: (admin as any)._id,
        name: (admin as any).name,
        email: (admin as any).email,
        role: (admin as any).role,
        assignedClassId: (admin as any).assignedClassId,
        isEmailVerified: (admin as any).isEmailVerified !== false,
        approvalStatus: (admin as any).approvalStatus || 'Approved',
        teacherAssignments: admin.role === 'TEACHER' ? teacherAssignments : undefined,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching profile.' });
  }
};

export const changeStaffPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ success: false, message: 'Not authenticated.' });
      return;
    }
    if (!['TEACHER', 'CR', 'CR_ASSISTANT'].includes(req.admin.role)) {
      res.status(403).json({ success: false, message: 'Use environment-managed credentials for Super Admin accounts.' });
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
      res.status(400).json({ success: false, message: 'Enter current password and confirm your new password.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(400).json({ success: false, message: 'New passwords do not match.' });
      return;
    }

    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      res.status(400).json({ success: false, message: validation.message });
      return;
    }

    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      res.status(404).json({ success: false, message: 'Staff account not found.' });
      return;
    }
    if (!(await bcrypt.compare(currentPassword, admin.passwordHash))) {
      res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      return;
    }

    admin.passwordHash = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    admin.tokenVersion = (admin.tokenVersion ?? 0) + 1;
    await admin.save();

    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        role: admin.role,
        assignedClassId: admin.assignedClassId?.toString(),
        tokenVersion: admin.tokenVersion,
      },
      getJwtSecret(),
      { expiresIn: '7d' }
    );
    res.status(200).json({
      success: true,
      message: 'Password changed. Other sessions have been signed out.',
      token,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
};
