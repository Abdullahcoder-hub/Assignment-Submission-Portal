import { Router } from 'express';
import {
  applyForCR,
  getMyCRApplicationStatus,
  getAllCRApplications,
  decideCRApplication,
} from '../controllers/crApplicationController.js';
import { authenticateStudent, authenticateAdmin } from '../middleware/auth.js';

const router = Router();

// Student endpoints
router.post('/apply', authenticateStudent, applyForCR);
router.get('/my-status', authenticateStudent, getMyCRApplicationStatus);

// Super Admin endpoints
router.get('/admin/all', authenticateAdmin, getAllCRApplications);
router.patch('/admin/:id/decision', authenticateAdmin, decideCRApplication);

export default router;
