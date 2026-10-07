import { Router } from 'express';
import {
  shareAssignmentWithTeacher,
  getTeacherSharedAssignments,
  getCRSharedAssignments,
  downloadSharedAssignmentZip,
  downloadSharedAssignmentCsv,
  revokeSharedAssignment,
} from '../controllers/sharedAssignmentController.js';
import { authenticateCR, authenticateTeacher } from '../middleware/auth.js';

const router = Router();

// CR Endpoints
router.post('/share', authenticateCR, shareAssignmentWithTeacher);
router.get('/cr-shares', authenticateCR, getCRSharedAssignments);
router.delete('/:id', authenticateCR, revokeSharedAssignment);

// Teacher Endpoints
router.get('/teacher-received', authenticateTeacher, getTeacherSharedAssignments);
router.get('/:id/download-zip', authenticateTeacher, downloadSharedAssignmentZip);
router.get('/:id/download-csv', authenticateTeacher, downloadSharedAssignmentCsv);

export default router;
