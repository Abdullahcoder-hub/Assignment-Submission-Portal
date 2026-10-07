import { Router } from 'express';
import {
  createLateRequest,
  getMyLateRequestStatus,
  getLateRequests,
  updateLateRequestDecision,
  decideLateRequestByEmail,
  completeLateRequestDecisionByEmail,
} from '../controllers/lateRequestController.js';
import {
  authenticateStudent,
  forbidTeacher,
  authenticateCR,
} from '../middleware/auth.js';

const router = Router();

// Strict Teacher blocker: Teachers cannot access late requests
router.use(forbidTeacher);

// Student routes
router.post('/', authenticateStudent, createLateRequest);
router.get('/my-status', authenticateStudent, getMyLateRequestStatus);
router.get('/email-decision/:id/:decision/:token', decideLateRequestByEmail);
router.post('/email-decision', completeLateRequestDecisionByEmail);

// CR / Assistant routes
router.get('/', authenticateCR, getLateRequests);
router.patch('/:id/decision', authenticateCR, updateLateRequestDecision);

export default router;
