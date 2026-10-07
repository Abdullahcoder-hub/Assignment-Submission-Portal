import { Router } from 'express';
import {
  getTeacherAssignments,
  getMyAssignedClasses,
  assignTeacherToClassSubject,
  removeTeacherAssignment,
  updateTeacherAssignmentStatus,
} from '../controllers/teacherAssignmentController.js';
import { authenticateAdmin, authenticateStaff } from '../middleware/auth.js';

const router = Router();

// Current teacher / staff view their assignments
router.get('/my-classes', authenticateStaff, getMyAssignedClasses);

// Admin view and manage all teacher assignments
router.get('/', authenticateAdmin, getTeacherAssignments);
router.post('/', authenticateAdmin, assignTeacherToClassSubject);
router.patch('/:id/status', authenticateAdmin, updateTeacherAssignmentStatus);
router.delete('/:id', authenticateAdmin, removeTeacherAssignment);

export default router;
