import { Router } from 'express';
import { getSubjects, createSubject, updateSubject, deleteSubject } from '../controllers/subjectController.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', getSubjects);
router.post('/', authenticateAdmin, createSubject);
router.put('/:id', authenticateAdmin, updateSubject);
router.delete('/:id', authenticateAdmin, deleteSubject);

export default router;
