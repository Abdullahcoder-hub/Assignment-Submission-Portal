import { Router } from 'express';
import { getSubjects, createSubject, updateSubject, deleteSubject } from '../controllers/subjectController.js';
import { authenticateCR, optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, getSubjects);
router.post('/', authenticateCR, createSubject);
router.put('/:id', authenticateCR, updateSubject);
router.delete('/:id', authenticateCR, deleteSubject);

export default router;
