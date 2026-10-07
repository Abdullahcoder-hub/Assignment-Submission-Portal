import { Router } from 'express';
import {
  getAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} from '../controllers/assignmentController.js';
import {
  downloadAssignmentZip,
  exportAssignmentCsv,
} from '../controllers/submissionController.js';
import { forbidTeacher, authenticateCR, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Strict Teacher blocker: Any Teacher calling any assignment endpoint receives 403 Forbidden
router.use(forbidTeacher);

router.get('/', optionalAuth, getAssignments);
router.get('/:id', getAssignmentById);
router.post('/', authenticateCR, createAssignment);
router.put('/:id', authenticateCR, updateAssignment);
router.delete('/:id', authenticateCR, deleteAssignment);

// Assignment Submissions Batch Exports
router.get('/:assignmentId/submissions/download-zip', authenticateCR, downloadAssignmentZip);
router.get('/:assignmentId/submissions/export-csv', authenticateCR, exportAssignmentCsv);

export default router;
