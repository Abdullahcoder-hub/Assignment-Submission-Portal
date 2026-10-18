import { Router } from 'express';
import {
  getAdmins,
  getBackendConfiguration,
  recordBackendConfigurationEvent,
  updateBackendConfiguration,
} from '../controllers/adminSettingsController.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/admins', authenticateAdmin, getAdmins);
router.get('/backends', authenticateAdmin, getBackendConfiguration);
router.put('/backends', authenticateAdmin, updateBackendConfiguration);
router.post('/backends/events', authenticateAdmin, recordBackendConfigurationEvent);

export default router;
