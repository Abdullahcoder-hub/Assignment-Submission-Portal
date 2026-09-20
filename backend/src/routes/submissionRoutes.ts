import { Router } from 'express';
import {
  createSubmission,
  getSubmissions,
  getDashboardStats,
  downloadSingleSubmission,
  viewSubmissionFile,
  deleteSubmission,
  deleteStudentSubmission,
  getDefaulters,
  exportDefaultersCsv,
} from '../controllers/submissionController.js';
import { uploadMiddleware } from '../middleware/upload.js';
import { authenticateAdmin, authenticateStudent, authenticateStudentOrAdmin } from '../middleware/auth.js';

const router = Router();

// Student submission endpoints (Authenticated student required)
router.post('/', authenticateStudent, uploadMiddleware.single('file'), createSubmission);
router.delete('/student/:id', authenticateStudent, deleteStudentSubmission);

// Submission file view endpoint (Authenticated student or admin)
router.get('/:id/view', authenticateStudentOrAdmin, viewSubmissionFile);

// Admin dashboard & management endpoints
router.get('/stats/dashboard', authenticateAdmin, getDashboardStats);
router.get('/', authenticateAdmin, getSubmissions);
router.get('/:id/download', authenticateAdmin, downloadSingleSubmission);
router.get('/defaulters/:assignmentId', authenticateAdmin, getDefaulters);
router.get('/defaulters/:assignmentId/export-csv', authenticateAdmin, exportDefaultersCsv);
router.delete('/:id', authenticateAdmin, deleteSubmission);

export default router;
