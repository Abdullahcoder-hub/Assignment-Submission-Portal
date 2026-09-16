import { Router } from 'express';
import {
  getStudents,
  updateStudent,
  resetStudentPassword,
  deleteStudent,
} from '../controllers/adminStudentController.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateAdmin, getStudents);
router.put('/:id', authenticateAdmin, updateStudent);
router.patch('/:id/reset-password', authenticateAdmin, resetStudentPassword);
router.delete('/:id', authenticateAdmin, deleteStudent);

export default router;
