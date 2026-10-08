import { Router } from 'express';
import {
  getMyCRApplicationStatus,
  getAllCRApplications,
  decideCRApplication,
} from '../controllers/crApplicationController.js';
import { authenticateStudent, authenticateAdmin } from '../middleware/auth.js';

const router = Router();

// Existing application status remains readable; new CR accounts register through /staff/register.
router.get('/my-status', authenticateStudent, getMyCRApplicationStatus);

// Super Admin endpoints
router.get('/admin/all', authenticateAdmin, getAllCRApplications);
router.patch('/admin/:id/decision', authenticateAdmin, decideCRApplication);

export default router;
