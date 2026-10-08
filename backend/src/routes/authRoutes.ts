import { Router } from 'express';
import { login, getMe, changeStaffPassword } from '../controllers/authController.js';
import { authenticateStaff } from '../middleware/auth.js';
import { registerStaff } from '../controllers/staffAuthController.js';
import {
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
} from '../controllers/studentAuthController.js';

const router = Router();

router.post('/login', login);
router.post('/staff/register', registerStaff);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticateStaff, getMe);
router.post('/change-password', authenticateStaff, changeStaffPassword);

export default router;
