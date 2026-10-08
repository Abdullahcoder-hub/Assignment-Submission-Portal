import { Router } from 'express';
import {
  getStudents,
  updateStudent,
  resetStudentPassword,
  deleteStudent,
} from '../controllers/adminStudentController.js';
import { authenticateStaff } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateStaff, getStudents);
router.put('/:id', authenticateStaff, updateStudent);
router.patch('/:id/reset-password', authenticateStaff, resetStudentPassword);
router.delete('/:id', authenticateStaff, deleteStudent);

export default router;
