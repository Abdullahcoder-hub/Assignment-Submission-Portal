import { Router } from 'express';
import {
  getStudents,
  updateStudent,
  resetStudentPassword,
  deleteStudent,
} from '../controllers/adminStudentController.js';
import { authenticateCROrSuperAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateCROrSuperAdmin, getStudents);
router.put('/:id', authenticateCROrSuperAdmin, updateStudent);
router.patch('/:id/reset-password', authenticateCROrSuperAdmin, resetStudentPassword);
router.delete('/:id', authenticateCROrSuperAdmin, deleteStudent);

export default router;
