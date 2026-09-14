import { Router } from 'express';
import { login, getMe } from '../controllers/authController.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.get('/me', authenticateAdmin, getMe);

export default router;
