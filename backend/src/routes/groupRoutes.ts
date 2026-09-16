import { Router } from 'express';
import {
  createGroup,
  continueGroup,
  getMyPreviousGroups,
  getMyGroupForSubject,
  getGroups,
  exportGroupsCsv,
} from '../controllers/groupController.js';
import { authenticateStudent, authenticateAdmin } from '../middleware/auth.js';

const router = Router();

// Student Group Routes
router.post('/', authenticateStudent, createGroup);
router.post('/continue', authenticateStudent, continueGroup);
router.get('/my-previous-groups', authenticateStudent, getMyPreviousGroups);
router.get('/my-group/:subjectId', authenticateStudent, getMyGroupForSubject);

// Admin / CR Group Routes
router.get('/', authenticateAdmin, getGroups);
router.get('/export-csv', authenticateAdmin, exportGroupsCsv);

export default router;
