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
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', getAssignments);
router.get('/:id', getAssignmentById);
router.post('/', authenticateAdmin, createAssignment);
router.put('/:id', authenticateAdmin, updateAssignment);
router.delete('/:id', authenticateAdmin, deleteAssignment);

// Assignment Submissions Batch Exports
router.get('/:assignmentId/submissions/download-zip', authenticateAdmin, downloadAssignmentZip);
router.get('/:assignmentId/submissions/export-csv', authenticateAdmin, exportAssignmentCsv);

export default router;
