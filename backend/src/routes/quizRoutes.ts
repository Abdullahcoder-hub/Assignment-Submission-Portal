import express, { Router } from 'express';
import {
  createQuiz,
  updateQuiz,
  getQuizzes,
  getQuizById,
  getQuizSubmissionForGrading,
  startQuiz,
  interruptQuizAttempt,
  unlockQuizAttempt,
  submitQuiz,
  getQuizSubmissions,
  downloadQuizSubmissionsCsv,
  downloadQuizGradesExcel,
  downloadQuizSubmissionsPdf,
  uploadQuizGradesCsv,
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
router.put('/:id', authenticateTeacher, updateQuiz);
router.get('/:id/submissions', authenticateStaff, getQuizSubmissions);
router.get('/submissions/:submissionId/grade', authenticateTeacher, getQuizSubmissionForGrading);
router.get('/:id/submissions/csv', authenticateTeacher, downloadQuizSubmissionsCsv);
router.get('/:id/submissions/grades-excel', authenticateTeacher, downloadQuizGradesExcel);
router.post('/:id/submissions/grades-csv', authenticateTeacher, express.text({ type: ['text/csv', 'application/vnd.ms-excel'], limit: '5mb' }), uploadQuizGradesCsv);
router.post('/:id/submissions/grades-excel', authenticateTeacher, express.raw({ type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', limit: '5mb' }), uploadQuizGradesCsv);
router.get('/:id/submissions/pdf', authenticateTeacher, downloadQuizSubmissionsPdf);
router.patch('/:id/attempts/:studentId/unlock', authenticateStaff, unlockQuizAttempt);
router.patch('/:id/results', authenticateTeacher, updateQuizResultsPublished);
router.put('/submissions/:submissionId/grade', authenticateTeacher, gradeQuizSubmission);
router.delete('/:id', authenticateTeacher, deleteQuiz);

export default router;
