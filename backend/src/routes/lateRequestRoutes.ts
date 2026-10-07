import { Router } from 'express';
import {
  createLateRequest,
  getMyLateRequestStatus,
  getLateRequests,
  updateLateRequestDecision,
  decideLateRequestByEmail,
  completeLateRequestDecisionByEmail,
} from '../controllers/lateRequestController.js';
import { authenticateStudent, authenticateStaff } from '../middleware/auth.js';

const router = Router();

// Student routes
router.post('/', authenticateStudent, createLateRequest);
router.get('/my-status', authenticateStudent, getMyLateRequestStatus);
router.get('/email-decision/:id/:decision/:token', decideLateRequestByEmail);
router.post('/email-decision', completeLateRequestDecisionByEmail);

// Staff review quiz access requests; assignment late requests remain CR-managed.
router.get('/', authenticateStaff, getLateRequests);
router.patch('/:id/decision', authenticateStaff, updateLateRequestDecision);

export default router;
