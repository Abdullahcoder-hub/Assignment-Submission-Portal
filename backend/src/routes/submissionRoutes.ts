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
import {
  authenticateAdmin,
  authenticateStudent,
  authenticateStudentOrAdmin,
  forbidTeacher,
  authenticateCR,
  authenticateCROrSuperAdmin,
} from '../middleware/auth.js';

const router = Router();

// Strict Teacher blocker: Teachers cannot access any assignment submission routes
router.use(forbidTeacher);

// Student submission endpoints (Authenticated student required)
router.post('/', authenticateStudent, uploadMiddleware.single('file'), createSubmission);
router.delete('/student/:id', authenticateStudent, deleteStudentSubmission);

// Submission file view endpoint (Authenticated student or admin)
router.get('/:id/view', authenticateStudentOrAdmin, viewSubmissionFile);

// Management endpoints (CR / CR Assistant only)
router.get('/stats/dashboard', authenticateCROrSuperAdmin, getDashboardStats);
router.get('/', authenticateCR, getSubmissions);
router.get('/:id/download', authenticateCR, downloadSingleSubmission);
router.get('/defaulters/:assignmentId', authenticateCR, getDefaulters);
router.get('/defaulters/:assignmentId/export-csv', authenticateCR, exportDefaultersCsv);
router.delete('/:id', authenticateCR, deleteSubmission);

export default router;
