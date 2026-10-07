import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import Admin from '../models/Admin.js';
import Student from '../models/Student.js';
import { sendStudentVerificationEmail, sendStaffRegistrationApprovalEmail } from '../config/brevo.js';
import { validatePasswordStrength } from '../utils/passwordValidator.js';
import { logError } from '../utils/logger.js';
import Class from '../models/Class.js';

export const registerStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, confirmPassword, role } = req.body;

    if (!name || !email || !password || !confirmPassword || !role) {
      res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
      return;
    }

    if (!['TEACHER', 'CR', 'CR_ASSISTANT'].includes(role)) {
      res.status(400).json({
        success: false,
        message: 'Choose Teacher, CR, or CR Assistant.',
      });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ success: false, message: 'Passwords do not match.' });
      return;
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanName || !cleanEmail) {
      res.status(400).json({ success: false, message: 'Name and email are required.' });
      return;
    }

    const [existingStaff, existingStudent] = await Promise.all([
      Admin.findOne({ email: cleanEmail }),
      Student.findOne({ email: cleanEmail }),
    ]);

    // If already an approved staff/CR
    if (existingStaff && existingStaff.approvalStatus === 'Approved') {
      res.status(409).json({ success: false, message: 'An active staff/CR account with this email already exists.' });
      return;
    }

    // If a staff application is already pending
    if (existingStaff && existingStaff.approvalStatus === 'Pending') {
      res.status(409).json({
        success: false,
        message: 'A staff/CR registration request for this email is already pending Super Admin approval.',
      });
      return;
    }

    // Teacher and student identities remain separate; CR roles use their enrolled student account.
    if (role === 'TEACHER' && existingStudent) {
      res.status(409).json({
        success: false,
        message: 'This email is registered as a student. Teacher accounts cannot share student emails.',
      });
      return;
    }

    let assignedClassId = existingStudent?.classId;
    if (role === 'CR' || role === 'CR_ASSISTANT') {
      if (!existingStudent || !existingStudent.classId) {
        res.status(400).json({
          success: false,
          message: 'CR and CR Assistant registration requires an existing student account enrolled in a class. Use that student account email.',
        });
        return;
      }
      const classDoc = await Class.findOne({ _id: existingStudent.classId, isActive: true });
      if (!classDoc) {
        res.status(400).json({ success: false, message: 'Your enrolled class is not active.' });
        return;
      }
      assignedClassId = classDoc._id;

      const assignedStaffId = role === 'CR' ? classDoc.crId : classDoc.assistantId;
      if (assignedStaffId) {
        const activeStaff = await Admin.findOne({
          _id: assignedStaffId,
          isActive: true,
          approvalStatus: 'Approved',
        });
        if (activeStaff) {
          res.status(409).json({
            success: false,
            message: role === 'CR' ? 'Your class already has an active CR.' : 'Your class already has an active CR Assistant.',
          });
          return;
        }
      }
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      res.status(400).json({ success: false, message: passwordValidation.message });
      return;
    }

    const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
    const isStudentEmailVerified = existingStudent?.isEmailVerified ?? false;
    const verificationToken = isStudentEmailVerified ? undefined : crypto.randomBytes(32).toString('hex');
    const approvalToken = crypto.randomBytes(32).toString('hex');
    const approvalTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    let staff;
    if (existingStaff) {
      // Re-apply if previously rejected
      existingStaff.name = cleanName;
      existingStaff.passwordHash = passwordHash;
      existingStaff.role = role;
      existingStaff.studentId = role === 'TEACHER' ? undefined : existingStudent?._id;
      existingStaff.assignedClassId = role === 'TEACHER' ? undefined : assignedClassId;
      existingStaff.approvalStatus = 'Pending';
      existingStaff.approvalToken = approvalToken;
      existingStaff.approvalTokenExpires = approvalTokenExpires;
      existingStaff.isActive = true;
      existingStaff.isEmailVerified = isStudentEmailVerified || existingStaff.isEmailVerified;
      if (!existingStaff.isEmailVerified && verificationToken) {
        existingStaff.verificationToken = verificationToken;
        existingStaff.verificationTokenExpires = new Date(Date.now() + 5 * 60 * 1000);
      }
      staff = await existingStaff.save();
    } else {
      staff = await Admin.create({
        name: cleanName,
        email: cleanEmail,
        passwordHash,
        role,
        studentId: role === 'TEACHER' ? undefined : existingStudent?._id,
        assignedClassId: role === 'TEACHER' ? undefined : assignedClassId,
        isActive: true,
        isEmailVerified: isStudentEmailVerified,
        verificationToken,
        verificationTokenExpires: verificationToken ? new Date(Date.now() + 5 * 60 * 1000) : undefined,
        approvalStatus: 'Pending',
        approvalToken,
        approvalTokenExpires,
      });
    }

    // Notify Super Admin(s) via email if staff is already verified or immediately upon request
    try {
      const superAdmins = await Admin.find({ role: 'SUPER_ADMIN', isActive: true });
      let className: string | undefined;
      if (staff.assignedClassId) {
        const cls = await Class.findById(staff.assignedClassId);
        if (cls) className = `${cls.name} (${cls.section || 'General'})`.trim();
      }
      for (const admin of superAdmins) {
        await sendStaffRegistrationApprovalEmail({
          superAdminEmail: admin.email,
          superAdminName: admin.name,
          applicantName: staff.name,
          applicantEmail: staff.email,
          applicantRole: staff.role,
          className,
          staffId: staff._id.toString(),
          approvalToken,
        });
      }
    } catch (notifyErr) {
      logError('[Super Admin Notification Warning]', notifyErr);
    }

    // Send verification email only if not already verified
    if (!staff.isEmailVerified && verificationToken) {
      const emailResult = await sendStudentVerificationEmail(staff.email, staff.name, verificationToken);
      if (!emailResult.success) {
        logError('[Staff Register Email Error]', emailResult.error);
        res.status(502).json({
          success: false,
          message: 'Account created, but the verification email could not be sent. Use Resend Verification to try again.',
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Registration received. Please verify your email, then wait for Super Admin approval before signing in.',
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: `${role === 'TEACHER' ? 'Teacher' : role === 'CR' ? 'CR' : 'CR Assistant'} registration submitted successfully. Your request is now waiting for Super Admin approval.`,
    });
  } catch (error) {
    logError('[Staff Register Error]', error);
    res.status(500).json({ success: false, message: 'Server error during staff registration.' });
  }
};
