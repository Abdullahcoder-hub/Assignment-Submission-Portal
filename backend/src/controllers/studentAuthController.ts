import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import Student from '../models/Student.js';
import Submission from '../models/Submission.js';
import { verifyClassJoinCode } from '../utils/joinCode.js';
import { validatePasswordStrength } from '../utils/passwordValidator.js';
import { sendStudentVerificationEmail, sendPasswordResetEmail } from '../config/brevo.js';
import { AuthRequest } from '../middleware/auth.js';

const secret = process.env.JWT_SECRET || 'default_secret_key_change_in_production_12345';
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

    if (password !== confirmPassword) {
      res.status(400).json({ success: false, message: 'Passwords do not match.' });
      return;
    }

    // Validate Class Join Code
    const isValidCode = await verifyClassJoinCode(joinCode);
    if (!isValidCode) {
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
    const cleanRoll = rollNumber.trim();

    // Check existing email or roll number
    const existingEmail = await Student.findOne({ email: cleanEmail });
    if (existingEmail) {
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
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours

    const student = await Student.create({
      name: name.trim(),
      email: cleanEmail,
      rollNumber: cleanRoll,
      passwordHash,
      isEmailVerified: false,
      verificationToken,
      verificationTokenExpires,
    });

    // Send verification email via Brevo
    await sendStudentVerificationEmail(student.email, student.name, verificationToken);

    res.status(201).json({
      success: true,
      message: 'Registration successful! A verification email has been sent to your inbox. Please verify before logging in.',
    });
  } catch (error: any) {
    console.error('[Student Register Error]:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

/**
 * 2. EMAIL VERIFICATION ENDPOINT
 */
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query;

    if (!token) {
      res.status(400).json({ success: false, message: 'Verification token is required.' });
      return;
    }

    const student = await Student.findOne({
      verificationToken: token as string,
      verificationTokenExpires: { $gt: new Date() },
    });

    if (!student) {
      res.status(400).json({ success: false, message: 'Invalid or expired verification link.' });
      return;
    }

    student.isEmailVerified = true;
    student.verificationToken = undefined;
    student.verificationTokenExpires = undefined;
    await student.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now log in to your account.',
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

    const student = await Student.findOne({ email: email.trim().toLowerCase() });
    if (!student) {
      res.status(200).json({
        success: true,
        message: 'If an unverified account exists with this email, a new verification link has been sent.',
      });
      return;
    }

    if (student.isEmailVerified) {
      res.status(400).json({ success: false, message: 'This email is already verified. You can log in.' });
      return;
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    student.verificationToken = verificationToken;
    student.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await student.save();

    await sendStudentVerificationEmail(student.email, student.name, verificationToken);

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

    const student = await Student.findOne({ email: email.trim().toLowerCase() });
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

    const token = jwt.sign(
      { id: student._id, email: student.email, role: 'STUDENT' },
      secret,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
        role: student.role,
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
        // Fallback for dev / unconfigured client ID
        const decodedToken = jwt.decode(idToken) as any;
        googlePayload = decodedToken || { email: req.body.email, name: req.body.name, sub: req.body.googleId };
      }
    } catch (gErr) {
      console.error('[Google OAuth Token Error]:', gErr);
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

      const isValidCode = await verifyClassJoinCode(joinCode);
      if (!isValidCode) {
        res.status(400).json({ success: false, message: 'Invalid or inactive Class Join Code.' });
        return;
      }

      const existingRoll = await Student.findOne({ rollNumber: rollNumber.trim() });
      if (existingRoll) {
        res.status(400).json({ success: false, message: 'An account with this roll number already exists.' });
        return;
      }

      student = await Student.create({
        name,
        email,
        rollNumber: rollNumber.trim(),
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
      { id: student._id, email: student.email, role: 'STUDENT' },
      secret,
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
        role: student.role,
      },
    });
  } catch (error: any) {
    console.error('[Google Auth Error]:', error);
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

    const student = await Student.findOne({ email: email.trim().toLowerCase() });
    if (!student) {
      // Don't leak whether email exists
      res.status(200).json({
        success: true,
        message: 'If an account exists for this email, password reset instructions have been sent.',
      });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    student.resetPasswordToken = resetToken;
    student.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 Hour
    await student.save();

    await sendPasswordResetEmail(student.email, student.name, resetToken);

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

    if (!token || !newPassword) {
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

    const student = await Student.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!student) {
      res.status(400).json({ success: false, message: 'Invalid or expired password reset link.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    student.passwordHash = await bcrypt.hash(newPassword, salt);
    student.resetPasswordToken = undefined;
    student.resetPasswordExpires = undefined;
    await student.save();

    res.status(200).json({
      success: true,
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

    const student = await Student.findById(req.student.id).select('-passwordHash');
    if (!student) {
      res.status(404).json({ success: false, message: 'Student profile not found.' });
      return;
    }

    // Fetch ONLY this student's submissions
    const mySubmissions = await Submission.find({ studentId: student._id })
      .populate('subjectId', 'name code')
      .populate('assignmentId', 'title deadline')
      .sort({ submittedAt: -1 });

    res.status(200).json({
      success: true,
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
        isEmailVerified: student.isEmailVerified,
        role: student.role,
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
    await student.save();

    res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
};
