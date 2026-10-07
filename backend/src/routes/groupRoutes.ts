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
import {
  authenticateStudent,
  authenticateAdmin,
  authenticateStudentOrAdmin,
  forbidTeacher,
  authenticateCR,
} from '../middleware/auth.js';

const router = Router();

// Strict Teacher blocker: Teachers cannot access group routes
router.use(forbidTeacher);

// Student Group Routes
router.post('/', authenticateStudent, createGroup);
router.post('/continue', authenticateStudent, continueGroup);
router.get('/my-previous-groups', authenticateStudent, getMyPreviousGroups);
router.get('/next-number', authenticateStudentOrAdmin, getNextGroupNumber);
router.get('/my-group/:subjectId', authenticateStudent, getMyGroupForSubject);
router.put('/:id', authenticateStudentOrAdmin, updateGroup);

// CR / Assistant Group Routes
router.get('/', authenticateCR, getGroups);
router.get('/export-csv', authenticateCR, exportGroupsCsv);
router.delete('/:id', authenticateCR, deleteGroup);

export default router;
