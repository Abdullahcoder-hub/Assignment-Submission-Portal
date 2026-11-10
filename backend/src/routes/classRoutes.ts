import { Router } from 'express';
import {
  getClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
  regenerateClassJoinCode,
  updateClassJoinCode,
  toggleClassJoinCode,
  getClassStudents,
} from '../controllers/classController.js';
import { authenticateAdmin, authenticateStaff, authenticateStudentOrAdmin } from '../middleware/auth.js';

const router = Router();

// Public / Student / Staff can get active classes list
router.get('/', authenticateStudentOrAdmin, getClasses);
router.get('/:id', authenticateStudentOrAdmin, getClassById);
router.get('/:id/students', authenticateStaff, getClassStudents);

// Super Admin / Admin class management
router.post('/', authenticateAdmin, createClass);
router.put('/:id', authenticateAdmin, updateClass);
router.delete('/:id', authenticateAdmin, deleteClass);
router.post('/:id/regenerate-code', authenticateAdmin, regenerateClassJoinCode);
router.put('/:id/join-code', authenticateAdmin, updateClassJoinCode);
router.post('/:id/toggle-code', authenticateAdmin, toggleClassJoinCode);

export default router;
