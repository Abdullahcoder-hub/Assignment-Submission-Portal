import { Router } from 'express';
import {
  registerStudent,
  verifyEmail,
  resendVerificationEmail,
  loginStudent,
  googleAuthStudent,
  forgotPassword,
  resetPassword,
  getStudentProfile,
  changePassword,
} from '../controllers/studentAuthController.js';
import { authenticateStudent } from '../middleware/auth.js';

const router = Router();

router.post('/register', registerStudent);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);
router.post('/login', loginStudent);
router.post('/google', googleAuthStudent);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticateStudent, getStudentProfile);
router.post('/change-password', authenticateStudent, changePassword);

export default router;
