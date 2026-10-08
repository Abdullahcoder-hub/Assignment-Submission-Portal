import { Router } from 'express';
import {
  createQuiz,
  getQuizzes,
  getQuizById,
  startQuiz,
  interruptQuizAttempt,
  unlockQuizAttempt,
  submitQuiz,
  getQuizSubmissions,
  downloadQuizSubmissionsCsv,
  downloadQuizSubmissionsPdf,
  updateQuizResultsPublished,
  gradeQuizSubmission,
  downloadQuizSubmissionDocx,
  deleteQuiz,
} from '../controllers/quizController.js';
import {
  authenticateStudent,
  authenticateTeacher,
  authenticateStaff,
  authenticateStudentOrAdmin,
} from '../middleware/auth.js';

const router = Router();

// Student routes
router.post('/:id/submit', authenticateStudent, submitQuiz);
router.post('/:id/start', authenticateStudent, startQuiz);
router.post('/:id/interrupt', authenticateStudent, interruptQuizAttempt);

// Shared / Role-scoped routes
router.get('/', authenticateStudentOrAdmin, getQuizzes);
router.get('/:id', authenticateStudentOrAdmin, getQuizById);
router.get('/submission/:submissionId/docx', authenticateStudentOrAdmin, downloadQuizSubmissionDocx);

// Staff / Teacher routes
router.post('/', authenticateTeacher, createQuiz);
router.get('/:id/submissions', authenticateStaff, getQuizSubmissions);
router.get('/:id/submissions/csv', authenticateTeacher, downloadQuizSubmissionsCsv);
router.get('/:id/submissions/pdf', authenticateTeacher, downloadQuizSubmissionsPdf);
router.patch('/:id/attempts/:studentId/unlock', authenticateStaff, unlockQuizAttempt);
router.patch('/:id/results', authenticateTeacher, updateQuizResultsPublished);
router.put('/submissions/:submissionId/grade', authenticateTeacher, gradeQuizSubmission);
router.delete('/:id', authenticateTeacher, deleteQuiz);

export default router;
