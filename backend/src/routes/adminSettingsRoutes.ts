import { Router } from 'express';
import { getJoinCode, regenerateCode, toggleCode, updateJoinCode, getAdmins } from '../controllers/adminSettingsController.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/join-code', authenticateAdmin, getJoinCode);
router.put('/join-code', authenticateAdmin, updateJoinCode);
router.post('/join-code/regenerate', authenticateAdmin, regenerateCode);
router.patch('/join-code/toggle', authenticateAdmin, toggleCode);
router.get('/admins', authenticateAdmin, getAdmins);

export default router;
