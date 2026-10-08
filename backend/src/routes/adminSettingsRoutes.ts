import { Router } from 'express';
import { getAdmins } from '../controllers/adminSettingsController.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/admins', authenticateAdmin, getAdmins);

export default router;
