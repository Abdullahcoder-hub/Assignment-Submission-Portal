import { Router } from 'express';
import {
  createLateRequest,
  getMyLateRequestStatus,
  getLateRequests,
  updateLateRequestDecision,
} from '../controllers/lateRequestController.js';
import { authenticateStudent, authenticateAdmin } from '../middleware/auth.js';

const router = Router();

// Student routes
router.post('/', authenticateStudent, createLateRequest);
router.get('/my-status', authenticateStudent, getMyLateRequestStatus);

// Admin / CR routes
router.get('/', authenticateAdmin, getLateRequests);
router.patch('/:id/decision', authenticateAdmin, updateLateRequestDecision);

export default router;
