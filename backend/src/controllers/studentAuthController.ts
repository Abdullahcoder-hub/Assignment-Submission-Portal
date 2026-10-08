import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import Student from '../models/Student.js';
import Admin from '../models/Admin.js';
import Submission from '../models/Submission.js';
import { findAndVerifyClassByJoinCode, verifyClassJoinCode } from '../utils/joinCode.js';
import { validatePasswordStrength } from '../utils/passwordValidator.js';
import { validateRollNumber } from '../utils/rollValidator.js';
import { sendStudentVerificationEmail, sendPasswordResetEmail } from '../config/brevo.js';
import { AuthRequest } from '../middleware/auth.js';
import { getJwtSecret } from '../config/security.js';
import { logError } from '../utils/logger.js';

const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(googleClientId);

/**
 * 1. STUDENT REGISTRATION WITH CLASS JOIN CODE & EMAIL VERIFICATION
 */
export const registerStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, rollNumber, email, password, confirmPassword, joinCode } = req.body;

    if (!name || !rollNumber || !email || !password || !joinCode) {
      res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
      return;
    }

    const cleanRoll = rollNumber.trim();
    const rollValidation = validateRollNumber(cleanRoll);
    if (!rollValidation.isValid) {
      res.status(400).json({ success: false, message: rollValidation.message });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ success: false, message: 'Passwords do not match.' });
      return;
    }

    // Validate Class Join Code & Resolve Class
    const matchedClass = await findAndVerifyClassByJoinCode(joinCode);
    if (!matchedClass) {
      res.status(400).json({ success: false, message: 'Invalid or inactive Class Join Code.' });
      return;
    }

    // Validate Password Rules
    const passValidation = validatePasswordStrength(password);
    if (!passValidation.isValid) {
      res.status(400).json({ success: false, message: passValidation.message });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check existing email or roll number
    const [existingEmail, existingStaffEmail] = await Promise.all([
      Student.exists({ email: cleanEmail }),
      Admin.exists({ email: cleanEmail }),
    ]);
    if (existingEmail || existingStaffEmail) {
      res.status(400).json({ success: false, message: 'An account with this email already exists.' });
      return;
    }

    const existingRoll = await Student.findOne({ rollNumber: cleanRoll });
    if (existingRoll) {
      res.status(400).json({ success: false, message: 'An account with this roll number already exists.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 5 * 60 * 1000);

    const student = await Student.create({
      name: name.trim(),
      email: cleanEmail,
      rollNumber: cleanRoll,
      classId: matchedClass._id,
      passwordHash,
      isEmailVerified: false,
      verificationToken,
      verificationTokenExpires,
    });


    // Send verification email via Brevo
    const emailResult = await sendStudentVerificationEmail(student.email, student.name, verificationToken);
    if (!emailResult.success) {
      logError('[Student Register Email Error]', emailResult.error);
      res.status(502).json({
        success: false,
        message: 'Account created, but the verification email could not be sent. Use Resend Verification to try again.',
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful! A verification email has been sent to your inbox. Please verify before logging in.',
    });
  } catch (error: any) {
    logError('[Student Register Error]', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

/**
 * 2. EMAIL VERIFICATION ENDPOINT
 */
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
      res.status(400).json({ success: false, message: 'Verification token is required.' });
      return;
    }

    const [student, staff] = await Promise.all([
      Student.findOne({
        verificationToken: token,
        verificationTokenExpires: { $gt: new Date() },
      }),
      Admin.findOne({
        verificationToken: token,
        verificationTokenExpires: { $gt: new Date() },
      }),
    ]);

    const account = student || staff;
    if (!account) {
      res.status(400).json({ success: false, message: 'Invalid or expired verification link.' });
      return;
    }

    account.isEmailVerified = true;
    account.verificationToken = undefined;
    account.verificationTokenExpires = undefined;
    await account.save();

    const isStaff = Boolean(staff);
    res.status(200).json({
      success: true,
      role: isStaff ? staff!.role : 'STUDENT',
      message: isStaff
        ? 'Email verified. Your account is now waiting for Super Admin approval.'
        : 'Email verified successfully! You can now log in to your account.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to verify email address.' });
  }
};

/**
 * 2.5 RESEND VERIFICATION EMAIL
 */
export const resendVerificationEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'Please enter your email address.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const [student, staff] = await Promise.all([
      Student.findOne({ email: cleanEmail }),
      Admin.findOne({ email: cleanEmail }),
    ]);
    const account = student || staff;
    if (!account) {
      res.status(200).json({
        success: true,
        message: 'If an unverified account exists with this email, a new verification link has been sent.',
      });
      return;
    }

    if (account.isEmailVerified) {
      res.status(400).json({ success: false, message: 'This email is already verified.' });
      return;
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    account.verificationToken = verificationToken;
    account.verificationTokenExpires = new Date(Date.now() + 5 * 60 * 1000);
    await account.save();

    const emailResult = await sendStudentVerificationEmail(account.email, account.name, verificationToken);
    if (!emailResult.success) {
      logError('[Verification Email Error]', emailResult.error);
      res.status(502).json({ success: false, message: 'Failed to send verification email. Please try again later.' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'A new verification link has been sent to your email. Please check your inbox.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to resend verification email.' });
  }
};

/**
 * 3. STUDENT EMAIL / PASSWORD LOGIN
 */
export const loginStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Please enter both email and password.' });
      return;
    }

    const student = await Student.findOne({ email: email.trim().toLowerCase() }).lean();
    if (!student || !student.passwordHash) {
      res.status(401).json({ success: false, message: 'Incorrect email or password.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, student.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Incorrect email or password.' });
      return;
    }

    if (!student.isEmailVerified) {
      res.status(403).json({
        success: false,
        message: 'Your email address is not verified yet. Please check your inbox for the verification link.',
      });
      return;
    }

    // Check if student has an approved CR or CR_ASSISTANT role
    const staffRecord = await Admin.findOne({
      email: student.email,
      isActive: true,
      approvalStatus: 'Approved',
      role: { $in: ['CR', 'CR_ASSISTANT'] },
    }).lean();

    const effectiveStaffId = staffRecord ? staffRecord._id.toString() : undefined;

    const token = jwt.sign(
      {
        id: student._id,
        email: student.email,
        role: 'STUDENT',
        classId: (student as any).classId?.toString(),
        tokenVersion: student.tokenVersion ?? 0,
      },
      getJwtSecret(),
      { expiresIn: '7d' }
    );
    const staffPortalToken = staffRecord
      ? jwt.sign(
          {
            id: staffRecord._id,
            email: staffRecord.email,
            role: staffRecord.role,
            assignedClassId: staffRecord.assignedClassId?.toString(),
            tokenVersion: staffRecord.tokenVersion ?? 0,
          },
          getJwtSecret(),
          { expiresIn: '7d' }
        )
      : undefined;

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      staffPortalToken,
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
        classId: (student as any).classId,
        role: student.role,
        staffRole: staffRecord ? staffRecord.role : null,
        staffId: effectiveStaffId,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

/**
 * 4. GOOGLE OAUTH LOGIN / REGISTER
 */
export const googleAuthStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken, rollNumber, joinCode } = req.body;

    if (!idToken) {
      res.status(400).json({ success: false, message: 'Google authentication token is missing.' });
      return;
    }

    let googlePayload;
    try {
      if (googleClientId) {
        const ticket = await googleClient.verifyIdToken({
          idToken,
          audience: googleClientId,
        });
        googlePayload = ticket.getPayload();
      } else {
        if (process.env.NODE_ENV === 'production') {
          res.status(500).json({ success: false, message: 'Google OAuth is not configured on the production server.' });
          return;
        }
        // Fallback ONLY in local development mode
        console.warn('[Google OAuth Warning] GOOGLE_CLIENT_ID not configured. Simulating dev token decode.');
        const decodedToken = jwt.decode(idToken) as any;
        googlePayload = decodedToken || { email: req.body.email, name: req.body.name, sub: req.body.googleId };
      }
    } catch (gErr) {
      logError('[Google OAuth Token Error]', gErr);
      res.status(400).json({ success: false, message: 'Invalid or expired Google authentication token.' });
      return;
    }

    if (!googlePayload || !googlePayload.email) {
      res.status(400).json({ success: false, message: 'Unable to retrieve user details from Google.' });
      return;
    }

    const email = googlePayload.email.toLowerCase().trim();
    const name = googlePayload.name || 'Student';
    const googleId = googlePayload.sub;

    let student = await Student.findOne({ email });

    if (!student) {
      if (await Admin.exists({ email })) {
        res.status(409).json({ success: false, message: 'An account with this email already exists.' });
        return;
      }

      // New Google registration requires Class Join Code and Roll Number
      if (!joinCode || !rollNumber) {
        res.status(202).json({
          success: false,
          requiresJoinCode: true,
          email,
          name,
          googleId,
          message: 'Class Join Code and Roll Number are required for first-time Google registration.',
        });
        return;
      }

      const cleanRoll = rollNumber.trim();
      const rollValidation = validateRollNumber(cleanRoll);
      if (!rollValidation.isValid) {
        res.status(400).json({ success: false, message: rollValidation.message });
        return;
      }

      const matchedClass = await findAndVerifyClassByJoinCode(joinCode);
      if (!matchedClass) {
        res.status(400).json({ success: false, message: 'Invalid or inactive Class Join Code.' });
        return;
      }

      const existingRoll = await Student.findOne({ rollNumber: cleanRoll });
      if (existingRoll) {
        res.status(400).json({ success: false, message: 'An account with this roll number already exists.' });
        return;
      }

      student = await Student.create({
        name,
        email,
        rollNumber: cleanRoll,
        classId: matchedClass._id,
        googleId,
        isEmailVerified: true, // Google OAuth automatically verifies email
      });
    } else {
      // Existing student logging in via Google
      if (!student.isEmailVerified) {
        student.isEmailVerified = true;
      }
      if (!student.googleId) {
        student.googleId = googleId;
      }
      await student.save();
    }

    const token = jwt.sign(
      {
        id: student._id,
        email: student.email,
        role: 'STUDENT',
        classId: student.classId?.toString(),
        tokenVersion: student.tokenVersion ?? 0,
      },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Google login successful.',
      token,
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
        classId: student.classId,
        role: student.role,
      },
    });

  } catch (error: any) {
    logError('[Google Auth Error]', error);
    res.status(500).json({ success: false, message: 'Server error during Google authentication.' });
  }
};

/**
 * 5. FORGOT PASSWORD
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ success: false, message: 'Please enter your email address.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const [student, staff] = await Promise.all([
      Student.findOne({ email: cleanEmail }),
      Admin.findOne({ email: cleanEmail }),
    ]);
    const account = student || staff;
    if (!account) {
      // Don't leak whether email exists
      res.status(200).json({
        success: true,
        message: 'If an account exists for this email, password reset instructions have been sent.',
      });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    account.resetPasswordToken = resetToken;
    account.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 Hour
    await account.save();

    const emailResult = await sendPasswordResetEmail(account.email, account.name, resetToken);
    if (!emailResult.success) {
      logError('[Password Reset Email Error]', emailResult.error);
      res.status(502).json({ success: false, message: 'Failed to send password reset email. Please try again later.' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'If an account exists for this email, password reset instructions have been sent.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to process password reset request.' });
  }
};

/**
 * 6. RESET PASSWORD
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token) || !newPassword) {
      res.status(400).json({ success: false, message: 'Token and new password are required.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ success: false, message: 'Passwords do not match.' });
      return;
    }

    const passValidation = validatePasswordStrength(newPassword);
    if (!passValidation.isValid) {
      res.status(400).json({ success: false, message: passValidation.message });
      return;
    }

    const [student, staff] = await Promise.all([
      Student.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: new Date() } }),
      Admin.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: new Date() } }),
    ]);
    const account = student || staff;

    if (!account) {
      res.status(400).json({ success: false, message: 'Invalid or expired password reset link.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    account.passwordHash = await bcrypt.hash(newPassword, salt);
    account.resetPasswordToken = undefined;
    account.resetPasswordExpires = undefined;
    account.tokenVersion = (account.tokenVersion ?? 0) + 1;
    await account.save();

    res.status(200).json({
      success: true,
      role: student ? 'STUDENT' : staff!.role,
      message: 'Password reset successfully! You can now log in with your new password.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
};

/**
 * 7. GET CURRENT STUDENT PROFILE & SUBMISSION HISTORY
 */
export const getStudentProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Not authenticated.' });
      return;
    }

    const student = await Student.findById(req.student.id)
      .select('name email rollNumber isEmailVerified role classId')
      .populate('classId', 'name semester section')
      .lean();
    if (!student) {
      res.status(404).json({ success: false, message: 'Student profile not found.' });
      return;
    }

    // Fetch ONLY this student's submissions
    const mySubmissions = await Submission.find({ studentId: (student as any)._id })
      .populate('subjectId', 'name code')
      .populate('assignmentId', 'title deadline')
      .sort({ submittedAt: -1 })
      .lean();

    // Check if student is also an approved CR or Assistant
    const staffRecord = await Admin.findOne({
       email: student.email,
       isActive: true,
       approvalStatus: 'Approved',
       role: { $in: ['CR', 'CR_ASSISTANT'] },
    }).lean();

    res.status(200).json({
      success: true,
      student: {
        id: (student as any)._id,
        name: (student as any).name,
        email: (student as any).email,
        rollNumber: (student as any).rollNumber,
        isEmailVerified: (student as any).isEmailVerified,
        classId: (student as any).classId,
        class: (student as any).classId,
        role: (student as any).role,
        staffRole: staffRecord ? staffRecord.role : null,
      },
      submissions: mySubmissions,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch student profile.' });
  }
};

/**
 * 8. LOGGED-IN STUDENT CHANGE PASSWORD
 */
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Not authenticated.' });
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, message: 'Please enter current and new password.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ success: false, message: 'New passwords do not match.' });
      return;
    }

    const passValidation = validatePasswordStrength(newPassword);
    if (!passValidation.isValid) {
      res.status(400).json({ success: false, message: passValidation.message });
      return;
    }

    const student = await Student.findById(req.student.id);
    if (!student || !student.passwordHash) {
      res.status(404).json({ success: false, message: 'Student account not found.' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, student.passwordHash);
    if (!isMatch) {
      res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    student.passwordHash = await bcrypt.hash(newPassword, salt);
    student.tokenVersion = (student.tokenVersion ?? 0) + 1;
    await student.save();

    const token = jwt.sign(
      { id: student._id, email: student.email, role: 'STUDENT', tokenVersion: student.tokenVersion },
      getJwtSecret(),
      { expiresIn: '7d' },
    );
    res.status(200).json({ success: true, message: 'Password changed successfully. Other sessions have been signed out.', token });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
};

/**
 * 9. REAL-TIME CHECK ROLL NUMBER AVAILABILITY
 */
export const checkRollNumberAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const rollNumber = String(req.query.rollNumber || req.body.rollNumber || '').trim();
    if (!rollNumber) {
      res.status(400).json({ success: false, message: 'Roll number is required.' });
      return;
    }

    const rollValidation = validateRollNumber(rollNumber);
    if (!rollValidation.isValid) {
      res.status(400).json({ success: false, available: false, exists: false, message: rollValidation.message });
      return;
    }

    const existingStudent = await Student.findOne({ rollNumber }).select('name rollNumber').lean();
    if (existingStudent) {
      res.json({
        success: true,
        available: false,
        exists: true,
        message: `Roll number ${rollNumber} is already registered.`,
      });
      return;
    }

    res.json({
      success: true,
      available: true,
      exists: false,
      message: `Roll number ${rollNumber} is available.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to verify roll number.' });
  }
};
