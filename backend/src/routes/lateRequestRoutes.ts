import { Router } from 'express';
import {
  createLateRequest,
  getMyLateRequestStatus,
  getLateRequests,
  updateLateRequestDecision,
  decideLateRequestByEmail,
  completeLateRequestDecisionByEmail,
} from '../controllers/lateRequestController.js';
import { authenticateStudent, authenticateAdmin } from '../middleware/auth.js';

const router = Router();

// Student routes
router.post('/', authenticateStudent, createLateRequest);
router.get('/my-status', authenticateStudent, getMyLateRequestStatus);
router.get('/email-decision/:id/:decision/:token', decideLateRequestByEmail);
router.post('/email-decision', completeLateRequestDecisionByEmail);

// Admin / CR routes
router.get('/', authenticateAdmin, getLateRequests);
router.patch('/:id/decision', authenticateAdmin, updateLateRequestDecision);

export default router;
