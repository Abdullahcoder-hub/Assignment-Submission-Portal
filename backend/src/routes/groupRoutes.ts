import { Router } from 'express';
import {
  createGroup,
  continueGroup,
  getMyPreviousGroups,
  getMyGroupForSubject,
  getGroups,
  exportGroupsCsv,
  deleteGroup,
  getNextGroupNumber,
  updateGroup,
} from '../controllers/groupController.js';
import { authenticateStudent, authenticateAdmin, authenticateStudentOrAdmin } from '../middleware/auth.js';

const router = Router();

// Student Group Routes
router.post('/', authenticateStudent, createGroup);
router.post('/continue', authenticateStudent, continueGroup);
router.get('/my-previous-groups', authenticateStudent, getMyPreviousGroups);
router.get('/next-number', authenticateStudentOrAdmin, getNextGroupNumber);
router.get('/my-group/:subjectId', authenticateStudent, getMyGroupForSubject);
router.put('/:id', authenticateStudentOrAdmin, updateGroup);

// Admin / CR Group Routes
router.get('/', authenticateAdmin, getGroups);
router.get('/export-csv', authenticateAdmin, exportGroupsCsv);
router.delete('/:id', authenticateAdmin, deleteGroup);

export default router;
