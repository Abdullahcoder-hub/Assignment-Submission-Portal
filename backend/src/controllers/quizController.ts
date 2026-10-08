import { Request, Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import Quiz, { IQuizQuestion } from '../models/Quiz.js';
import QuizSubmission from '../models/QuizSubmission.js';
import QuizAttempt from '../models/QuizAttempt.js';
import Class from '../models/Class.js';
import Subject from '../models/Subject.js';
import Student from '../models/Student.js';
import LateRequest from '../models/LateRequest.js';
import TeacherAssignment from '../models/TeacherAssignment.js';
import { AuthRequest } from '../middleware/auth.js';
import { generateQuizSubmissionDocx } from '../utils/docxGenerator.js';
import { generateSubmissionId } from '../utils/submissionId.js';
import { escapeRegex, sanitizeCsvField } from '../utils/fileValidation.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import ExcelJS from 'exceljs';

/**
 * Helper: Strip correct answers for students
 */
const sanitizeQuizForStudent = (quiz: any) => {
  const sanitizedQuestions = quiz.questions.map((q: any) => {
    const { correctOptionIndex, ...rest } = q.toObject ? q.toObject() : q;
    return rest;
  });
  const quizObj = quiz.toObject ? quiz.toObject() : { ...quiz };
  quizObj.questions = sanitizedQuestions;
  return quizObj;
};

const canTeacherManageQuiz = async (quiz: any, teacherId: string): Promise<boolean> => (
  quiz.teacherId.toString() === teacherId ||
  Boolean(await TeacherAssignment.exists({
    teacherId,
    classId: quiz.classId?._id || quiz.classId,
    subjectId: quiz.subjectId?._id || quiz.subjectId,
    isActive: true,
  }))
);

/**
 * 1. CREATE QUIZ (Teacher assigned to Class+Subject OR Super Admin)
 * AUTOMATIC QUIZ CR RESOLUTION: CR is automatically determined from Class
 */
export const createQuiz = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ success: false, message: 'Teacher authentication required.' });
      return;
    }

    const {
      classId,
      subjectId,
      title,
      description,
      quizType = 'MCQ',
      durationMinutes = 30,
      deadline,
      allowLateSubmission = false,
      questions,
    } = req.body;

    if (!classId || !subjectId || !title || !deadline || !Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Class, Subject, Title, Deadline, and at least one question are required.',
      });
      return;
    }

    // Verify Class exists
    const classDoc = await Class.findById(classId);
    if (!classDoc || !classDoc.isActive) {
      res.status(400).json({ success: false, message: 'Selected Class not found or inactive.' });
      return;
    }

    // Verify Subject exists
    const subjectDoc = await Subject.findById(subjectId);
    if (!subjectDoc || !subjectDoc.isActive) {
      res.status(400).json({ success: false, message: 'Selected Subject not found or inactive.' });
      return;
    }

    const teacherId = req.admin.id;

    // Security Check: If user is TEACHER, verify they are assigned to this Class + Subject
    if (req.admin.role === 'TEACHER') {
      const isAssigned = await TeacherAssignment.exists({
        teacherId,
        classId,
        subjectId,
        isActive: true,
      });

      if (!isAssigned) {
        res.status(403).json({
          success: false,
          message: `Access denied: You are not assigned to teach ${subjectDoc.name} in ${classDoc.name}.`,
        });
        return;
      }
    }

    // AUTOMATIC CR & ASSISTANT RESOLUTION: Derived directly from the Class in DB. Never trust client IDs.
    const resolvedCrId = classDoc.crId || undefined;
    const resolvedAssistantId = classDoc.assistantId || undefined;

    // Validate Questions and compute totalMarks
    let calculatedTotalMarks = 0;
    const formattedQuestions: IQuizQuestion[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText || !q.questionText.trim()) {
        res.status(400).json({ success: false, message: `Question ${i + 1} is missing question text.` });
        return;
      }

      const qType = q.questionType === 'Written' ? 'Written' : 'MCQ';
      const qMarks = Number(q.marks) > 0 ? Number(q.marks) : 1;
      calculatedTotalMarks += qMarks;

      if (qType === 'MCQ') {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          res.status(400).json({ success: false, message: `MCQ Question ${i + 1} must have at least 2 options.` });
          return;
        }
        const correctIndex = Number(q.correctOptionIndex);
        if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= q.options.length) {
          res.status(400).json({ success: false, message: `MCQ Question ${i + 1} has an invalid correct option index.` });
          return;
        }

        formattedQuestions.push({
          questionId: q.questionId || crypto.randomUUID(),
          questionType: 'MCQ',
          questionText: q.questionText.trim(),
          options: q.options.map((opt: string) => String(opt).trim()),
          correctOptionIndex: correctIndex,
          marks: qMarks,
        });
      } else {
        formattedQuestions.push({
          questionId: q.questionId || crypto.randomUUID(),
          questionType: 'Written',
          questionText: q.questionText.trim(),
          marks: qMarks,
        });
      }
    }

    const quiz = await Quiz.create({
      title: title.trim(),
      description: description ? description.trim() : '',
      classId: classDoc._id,
      subjectId: subjectDoc._id,
      teacherId,
      crId: resolvedCrId,
      assistantId: resolvedAssistantId,
      quizType: quizType || (formattedQuestions.some(q => q.questionType === 'Written') && formattedQuestions.some(q => q.questionType === 'MCQ') ? 'Mixed' : formattedQuestions.some(q => q.questionType === 'Written') ? 'Written' : 'MCQ'),
      durationMinutes: Number(durationMinutes) > 0 ? Number(durationMinutes) : 30,
      deadline: new Date(deadline),
      allowLateSubmission: Boolean(allowLateSubmission),
      totalMarks: calculatedTotalMarks,
      questions: formattedQuestions,
      isActive: true,
      isPublished: true,
    });

    const populated = await Quiz.findById(quiz._id)
      .populate('classId', 'name semester section')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .populate('crId', 'name email')
      .populate('assistantId', 'name email');

    res.status(201).json({
      success: true,
      message: 'Quiz created successfully.',
      quiz: populated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create quiz.' });
  }
};

export const updateQuiz = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      res.status(404).json({ success: false, message: 'Quiz not found.' });
      return;
    }
    if (req.admin?.role !== 'TEACHER' || !(await canTeacherManageQuiz(quiz, req.admin.id))) {
      res.status(403).json({ success: false, message: 'Only the assigned teacher can edit this quiz.' });
      return;
    }

    const { title, description, durationMinutes, deadline, allowLateSubmission, questions } = req.body;
    if (!title?.trim() || !deadline || !Array.isArray(questions) || !questions.length) {
      res.status(400).json({ success: false, message: 'Title, deadline, and at least one question are required.' });
      return;
    }
    if (!Number.isFinite(Number(durationMinutes)) || Number(durationMinutes) < 5 || Number(durationMinutes) > 180
      || !Number.isFinite(new Date(deadline).getTime())) {
      res.status(400).json({ success: false, message: 'Enter a valid duration and deadline.' });
      return;
    }

    const submissions = await QuizSubmission.countDocuments({ quizId: quiz._id });
    const formattedQuestions: IQuizQuestion[] = [];
    for (const [index, question] of questions.entries()) {
      const questionType = question.questionType === 'Written' ? 'Written' : question.questionType === 'MCQ' ? 'MCQ' : null;
      const marks = Number(question.marks);
      if (!questionType || !question.questionText?.trim() || !Number.isFinite(marks) || marks < 1 || marks > 50) {
        res.status(400).json({ success: false, message: `Question ${index + 1} has invalid text, type, or marks.` });
        return;
      }
      const questionId = String(question.questionId || '');
      if (!questionId) {
        res.status(400).json({ success: false, message: `Question ${index + 1} is missing its ID.` });
        return;
      }
      if (questionType === 'MCQ') {
        const correctOptionIndex = Number(question.correctOptionIndex);
        if (!Array.isArray(question.options) || question.options.length < 2
          || question.options.some((option: string) => !String(option).trim())
          || !Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex >= question.options.length) {
          res.status(400).json({ success: false, message: `MCQ Question ${index + 1} has invalid options or correct answer.` });
          return;
        }
        formattedQuestions.push({
          questionId,
          questionType,
          questionText: question.questionText.trim(),
          options: question.options.map((option: string) => String(option).trim()),
          correctOptionIndex,
          marks,
        });
      } else {
        formattedQuestions.push({ questionId, questionType, questionText: question.questionText.trim(), marks });
      }
    }

    if (submissions > 0) {
      const currentStructure = quiz.questions.map(({ questionId, questionType, marks }) => ({ questionId, questionType, marks }));
      const nextStructure = formattedQuestions.map(({ questionId, questionType, marks }) => ({ questionId, questionType, marks }));
      if (JSON.stringify(currentStructure) !== JSON.stringify(nextStructure)) {
        res.status(400).json({ success: false, message: 'Questions, question types, marks, and order cannot change after students submit.' });
        return;
      }
      if (formattedQuestions.some((question) => question.questionType === 'MCQ'
        && quiz.questions.find((current) => current.questionId === question.questionId)?.correctOptionIndex !== question.correctOptionIndex)) {
        res.status(400).json({ success: false, message: 'Correct answers cannot change after students submit.' });
        return;
      }
    }

    quiz.title = title.trim();
    quiz.description = String(description || '').trim();
    quiz.durationMinutes = Number(durationMinutes);
    quiz.deadline = new Date(deadline);
    quiz.allowLateSubmission = Boolean(allowLateSubmission);
    quiz.questions = formattedQuestions as typeof quiz.questions;
    quiz.totalMarks = formattedQuestions.reduce((total, question) => total + question.marks, 0);
    quiz.quizType = formattedQuestions.some((question) => question.questionType === 'Written')
      ? formattedQuestions.some((question) => question.questionType === 'MCQ') ? 'Mixed' : 'Written'
      : 'MCQ';
    await quiz.save();

    res.status(200).json({ success: true, message: 'Quiz updated successfully.', quiz });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update quiz.' });
  }
};

/**
 * 2. GET ALL QUIZZES (Scoped by role: Student -> own class; Teacher -> assigned class/subjects; CR -> own class)
 */
export const getQuizzes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: any = { isActive: true };

    if (req.student) {
      // Student: Must belong to a class and only view quizzes for their class
      if (!req.student.classId) {
        res.status(200).json({ success: true, count: 0, quizzes: [] });
        return;
      }
      filter.classId = req.student.classId;

      const quizzes = await Quiz.find(filter)
        .populate('subjectId', 'name code')
        .populate('classId', 'name semester section')
        .populate('teacherId', 'name')
        .sort({ deadline: 1 })
        .lean();

      // Check student's submission status for each quiz
      const quizIds = quizzes.map((q) => q._id);
      const studentSubmissions = await QuizSubmission.find({
        quizId: { $in: quizIds },
        studentId: req.student.id,
      }).lean();

      const submissionMap = new Map(studentSubmissions.map((s) => [s.quizId.toString(), s]));
      const [studentAttempts, lateRequests] = await Promise.all([
        QuizAttempt.find({ quizId: { $in: quizIds }, studentId: req.student.id }).select('quizId status').lean(),
        LateRequest.find({ quizId: { $in: quizIds }, studentId: req.student.id, requestType: 'Quiz' })
          .select('quizId status')
          .sort({ requestedAt: -1 })
          .lean(),
      ]);
      const attemptMap = new Map(studentAttempts.map((attempt) => [attempt.quizId.toString(), attempt.status]));
      const lateRequestMap = new Map<string, string>();
      const lateRequestCountMap = new Map<string, number>();
      lateRequests.forEach((request) => {
        const quizId = request.quizId?.toString();
        if (quizId) {
          lateRequestCountMap.set(quizId, (lateRequestCountMap.get(quizId) || 0) + 1);
          if (!lateRequestMap.has(quizId)) lateRequestMap.set(quizId, request.status);
        }
      });

      const sanitized = quizzes.map((q) => {
        const sub = submissionMap.get(q._id.toString());
        return {
          ...sanitizeQuizForStudent(q),
          myAttemptStatus: attemptMap.get(q._id.toString()) || null,
          myLateRequestStatus: lateRequestMap.get(q._id.toString()) || null,
          myLateRequestCount: lateRequestCountMap.get(q._id.toString()) || 0,
          mySubmission: sub
            ? {
                submissionId: sub.submissionId,
                ...(q.resultsPublished
                  ? {
                      mcqScore: sub.mcqScore,
                      writtenScore: sub.writtenScore,
                      totalScore: sub.totalScore,
                      isGraded: sub.isGraded,
                    }
                  : {}),
                submittedAt: sub.submittedAt,
                isLate: sub.isLate,
                status: sub.status,
              }
            : null,
        };
      });

      res.status(200).json({ success: true, count: sanitized.length, quizzes: sanitized });
      return;
    }

    // Staff Users
    if (req.admin) {
      if (['CR', 'CR_ASSISTANT'].includes(req.admin.role) && req.admin.assignedClassId) {
        filter.classId = req.admin.assignedClassId;
      } else if (req.admin.role === 'TEACHER') {
        filter.teacherId = req.admin.id;
      }

      const quizzes = await Quiz.find(filter)
        .populate('classId', 'name semester section')
        .populate('subjectId', 'name code')
        .populate('teacherId', 'name email')
        .populate('crId', 'name email')
        .populate('assistantId', 'name email')
        .sort({ createdAt: -1 })
        .lean();

      // Count submissions for each quiz
      const quizIds = quizzes.map((q) => q._id);
      const subCounts = await QuizSubmission.aggregate([
        { $match: { quizId: { $in: quizIds } } },
        { $group: { _id: '$quizId', count: { $sum: 1 } } },
      ]);
      const subCountMap = new Map(subCounts.map((sc) => [sc._id.toString(), sc.count]));

      const result = quizzes.map((q) => ({
        ...(req.admin?.role === 'TEACHER' ? q : sanitizeQuizForStudent(q)),
        submissionCount: subCountMap.get(q._id.toString()) || 0,
      }));

      res.status(200).json({ success: true, count: result.length, quizzes: result });
      return;
    }

    res.status(401).json({ success: false, message: 'Authentication required.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch quizzes.' });
  }
};

/**
 * 3. GET SINGLE QUIZ BY ID
 */
export const getQuizById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findById(id)
      .populate('classId', 'name semester section')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .populate('crId', 'name email')
      .populate('assistantId', 'name email');

    if (!quiz || !quiz.isActive) {
      res.status(404).json({ success: false, message: 'Quiz not found.' });
      return;
    }

    // If Student: verify student belongs to this quiz's class and strip correct answers
    if (req.student) {
      if (!req.student.classId || req.student.classId !== quiz.classId._id.toString()) {
        res.status(403).json({ success: false, message: 'Access denied: You can only take quizzes for your own class.' });
        return;
      }

      const mySubmission = await QuizSubmission.findOne({
        quizId: quiz._id,
        studentId: req.student.id,
      }).lean();
      const attempt = await QuizAttempt.findOne({ quizId: quiz._id, studentId: req.student.id });
      if (!attempt || attempt.status !== 'in_progress') {
        res.status(403).json({ success: false, message: 'Start or request approval to resume this quiz.' });
        return;
      }

      res.status(200).json({
        success: true,
        quiz: sanitizeQuizForStudent(quiz),
        resultsPublished: quiz.resultsPublished,
        mySubmission: mySubmission
          ? {
              submissionId: mySubmission.submissionId,
              ...(quiz.resultsPublished
                ? {
                    mcqScore: mySubmission.mcqScore,
                    writtenScore: mySubmission.writtenScore,
                    totalScore: mySubmission.totalScore,
                    isGraded: mySubmission.isGraded,
                  }
                : {}),
              submittedAt: mySubmission.submittedAt,
              status: mySubmission.status,
            }
          : null,
      });
      return;
    }

    // If Teacher: verify teacher is creator or assigned
    if (req.admin?.role === 'TEACHER') {
      if (quiz.teacherId._id.toString() !== req.admin.id) {
        const isAssigned = await TeacherAssignment.exists({
          teacherId: req.admin.id,
          classId: quiz.classId._id,
          subjectId: quiz.subjectId._id,
          isActive: true,
        });
        if (!isAssigned) {
          res.status(403).json({ success: false, message: 'Access denied to this quiz.' });
          return;
        }
      }
    }

    // If CR or CR Assistant: verify belongs to this class
    if (['CR', 'CR_ASSISTANT'].includes(req.admin?.role || '') && req.admin?.assignedClassId) {
      if (req.admin.assignedClassId !== quiz.classId._id.toString()) {
        res.status(403).json({ success: false, message: 'Access denied: CR can only view quizzes for their own class.' });
        return;
      }
    }

    res.status(200).json({
      success: true,
      quiz: req.admin?.role === 'TEACHER' ? quiz : sanitizeQuizForStudent(quiz),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch quiz details.' });
  }
};

export const startQuiz = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Student authentication required.' });
      return;
    }
    const quiz = await Quiz.findById(req.params.id)
      .populate('classId', 'name semester section')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name');
    if (!quiz || !quiz.isActive) {
      res.status(404).json({ success: false, message: 'Quiz not found.' });
      return;
    }
    if (!req.student.classId || req.student.classId !== (quiz.classId as any)._id.toString()) {
      res.status(403).json({ success: false, message: 'You can only take quizzes for your own class.' });
      return;
    }
    if (await QuizSubmission.exists({ quizId: quiz._id, studentId: req.student.id })) {
      res.status(400).json({ success: false, message: 'You have already submitted this quiz.' });
      return;
    }

    const lateRequest = await LateRequest.findOne({
      quizId: quiz._id,
      studentId: req.student.id,
      requestType: 'Quiz',
      status: 'Approved',
    });
    if (new Date() > quiz.deadline && !quiz.allowLateSubmission && !lateRequest) {
      res.status(403).json({ success: false, message: 'The deadline passed. Request access from your CR or teacher.' });
      return;
    }

    let attempt = await QuizAttempt.findOne({ quizId: quiz._id, studentId: req.student.id });
    if (attempt) {
      if (attempt.status === 'in_progress') {
        res.status(200).json({ success: true, quiz: sanitizeQuizForStudent(quiz) });
        return;
      }
      if (attempt.status === 'locked' || attempt.status === 'submitted') {
        res.status(attempt.status === 'locked' ? 423 : 400).json({
          success: false,
          message: attempt.status === 'locked'
            ? 'This quiz is locked. Request your CR or teacher to unblock it.'
            : 'This quiz attempt has already been submitted.',
        });
        return;
      }
      attempt.status = 'in_progress';
      attempt.unlockedAt = undefined;
      attempt.startedAt = new Date();
      await attempt.save();
    } else {
      attempt = await QuizAttempt.create({
        quizId: quiz._id,
        studentId: req.student.id,
        classId: (quiz.classId as any)._id,
        status: 'in_progress',
        startedAt: new Date(),
      });
    }

    res.status(200).json({ success: true, quiz: sanitizeQuizForStudent(quiz) });
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(423).json({ success: false, message: 'This quiz attempt is locked. Request your CR or teacher to unblock it.' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to start quiz.' });
  }
};

export const interruptQuizAttempt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Student authentication required.' });
      return;
    }
    const quiz = await Quiz.findById(req.params.id).select('classId');
    if (!quiz || quiz.classId.toString() !== req.student.classId) {
      res.status(403).json({ success: false, message: 'You can only lock your own class quiz attempt.' });
      return;
    }
    const attempt = await QuizAttempt.findOneAndUpdate(
      { quizId: quiz._id, studentId: req.student.id, status: 'in_progress' },
      { $set: { status: 'locked', lockedAt: new Date() } },
      { new: true }
    );
    res.status(200).json({ success: true, locked: Boolean(attempt) });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to lock interrupted quiz.' });
  }
};

export const unlockQuizAttempt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz || !req.admin) {
      res.status(404).json({ success: false, message: 'Quiz not found.' });
      return;
    }
    if (req.admin.role === 'TEACHER') {
      const assigned = quiz.teacherId.toString() === req.admin.id || await TeacherAssignment.exists({
        teacherId: req.admin.id,
        classId: quiz.classId,
        subjectId: quiz.subjectId,
        isActive: true,
      });
      if (!assigned) {
        res.status(403).json({ success: false, message: 'You are not assigned to manage this quiz.' });
        return;
      }
    } else if (['CR', 'CR_ASSISTANT'].includes(req.admin.role)) {
      if (req.admin.assignedClassId !== quiz.classId.toString()) {
        res.status(403).json({ success: false, message: 'You can only manage quizzes for your assigned class.' });
        return;
      }
    } else if (req.admin.role !== 'SUPER_ADMIN') {
      res.status(403).json({ success: false, message: 'Not authorized to unblock quiz attempts.' });
      return;
    }

    const attempt = await QuizAttempt.findOneAndUpdate(
      { quizId: quiz._id, studentId: req.params.studentId, status: 'locked' },
      { $set: { status: 'unlocked', unlockedAt: new Date() }, $unset: { lockedAt: 1 } },
      { new: true }
    );
    if (!attempt) {
      res.status(404).json({ success: false, message: 'No locked attempt found for this student.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Quiz attempt unblocked. Student can resume it now.' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to unblock quiz attempt.' });
  }
};

/**
 * 4. STUDENT SUBMIT QUIZ ANSWERS (Auto-grades MCQ, generates DOCX for Written, validates deadline)
 */
export const submitQuiz = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Student authentication required.' });
      return;
    }

    const { id } = req.params;
    const { answers } = req.body;

    if (!Array.isArray(answers)) {
      res.status(400).json({ success: false, message: 'Answers array is required.' });
      return;
    }

    const quiz = await Quiz.findById(id)
      .populate('classId', 'name semester section')
      .populate('subjectId', 'name code');

    if (!quiz || !quiz.isActive) {
      res.status(404).json({ success: false, message: 'Quiz not found.' });
      return;
    }

    // Security Check: Class Membership
    if (!req.student.classId || req.student.classId !== (quiz.classId as any)._id.toString()) {
      res.status(403).json({ success: false, message: 'Access denied: You can only submit quizzes for your own class.' });
      return;
    }

    const attempt = await QuizAttempt.findOne({
      quizId: quiz._id,
      studentId: req.student.id,
      status: 'in_progress',
    });
    if (!attempt) {
      res.status(423).json({ success: false, message: 'This quiz attempt is locked. Request your CR or teacher to unblock it.' });
      return;
    }

    // Prevent duplicate submission
    const existingSubmission = await QuizSubmission.findOne({
      quizId: quiz._id,
      studentId: req.student.id,
    });
    if (existingSubmission) {
      res.status(400).json({ success: false, message: 'You have already submitted this quiz.' });
      return;
    }

    // Deadline and Late Request Check
    const now = new Date();
    const isPastDeadline = now > new Date(quiz.deadline);
    let isLateApproved = false;

    if (isPastDeadline) {
      const lateReq = await LateRequest.findOne({
        quizId: quiz._id,
        studentId: req.student.id,
        requestType: 'Quiz',
        status: 'Approved',
      });
      isLateApproved = Boolean(lateReq);

      if (!quiz.allowLateSubmission && !isLateApproved) {
        res.status(400).json({
          success: false,
          message: 'This quiz deadline has passed. Please submit a late request to the CR.',
        });
        return;
      }
    }

    const studentSubmissionId = generateSubmissionId((quiz.subjectId as any)?.code || 'QUIZ');
    const submissionStatus = isPastDeadline
      ? isLateApproved
        ? 'Submitted Late — CR Approved'
        : 'Late'
      : 'Submitted';


    // Map answers and Auto-grade MCQ questions on server side
    const questionMap = new Map(quiz.questions.map((q) => [q.questionId, q]));
    let mcqScore = 0;
    let writtenQuestionsCount = 0;
    const processedAnswers: any[] = [];
    const docxQuestions: any[] = [];

    let qNumber = 1;
    for (const q of quiz.questions) {
      const studentAns = answers.find((a: any) => a.questionId === q.questionId);
      const qType = q.questionType;

      if (qType === 'MCQ') {
        const selectedOption = studentAns?.selectedOptionIndex !== undefined ? Number(studentAns.selectedOptionIndex) : -1;
        const isCorrect = selectedOption === q.correctOptionIndex;
        const marksAwarded = isCorrect ? q.marks : 0;
        mcqScore += marksAwarded;

        const optionText = selectedOption >= 0 && q.options && q.options[selectedOption]
          ? `${String.fromCharCode(65 + selectedOption)}. ${q.options[selectedOption]}`
          : '[No Option Selected]';

        processedAnswers.push({
          questionId: q.questionId,
          questionType: 'MCQ',
          selectedOptionIndex: selectedOption,
          isCorrect,
          marksAwarded,
        });

        docxQuestions.push({
          questionNumber: qNumber++,
          questionText: q.questionText,
          questionType: 'MCQ',
          marks: q.marks,
          studentAnswer: optionText,
        });
      } else {
        writtenQuestionsCount++;
        const writtenText = studentAns?.writtenAnswerText ? String(studentAns.writtenAnswerText).trim() : '';

        processedAnswers.push({
          questionId: q.questionId,
          questionType: 'Written',
          writtenAnswerText: writtenText,
          marksAwarded: 0,
        });

        docxQuestions.push({
          questionNumber: qNumber++,
          questionText: q.questionText,
          questionType: 'Written',
          marks: q.marks,
          studentAnswer: writtenText,
        });
      }
    }

    const isGraded = writtenQuestionsCount === 0; // Pure MCQ quizzes are automatically 100% graded
    const totalScore = mcqScore;

    const submission = await QuizSubmission.create({
      submissionId: studentSubmissionId,
      quizId: quiz._id,
      studentId: req.student.id,
      classId: (quiz.classId as any)._id,
      subjectId: (quiz.subjectId as any)._id,
      studentName: req.student.name,
      rollNumber: req.student.rollNumber,
      answers: processedAnswers,
      mcqScore,
      writtenScore: 0,
      totalScore,
      isGraded,
      submittedAt: now,
      isLate: isPastDeadline,
      status: submissionStatus,
    });
    attempt.status = 'submitted';
    await attempt.save();

    res.status(201).json({
      success: true,
      message: 'Quiz submitted successfully.',
      submission: {
        submissionId: submission.submissionId,
        ...(quiz.resultsPublished && submission.isGraded
          ? {
              mcqScore: submission.mcqScore,
              writtenScore: submission.writtenScore,
              totalScore: submission.totalScore,
              isGraded: submission.isGraded,
            }
          : {}),
        submittedAt: submission.submittedAt,
        status: submission.status,
      },
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(400).json({ success: false, message: 'You have already submitted this quiz.' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to submit quiz.' });
  }
};

/**
 * 5. GET ALL SUBMISSIONS FOR A QUIZ (Teacher / CR / Admin)
 */
export const getQuizSubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findById(id)
      .populate('classId', 'name semester section')
      .populate('subjectId', 'name code');

    if (!quiz) {
      res.status(404).json({ success: false, message: 'Quiz not found.' });
      return;
    }

    // Security Check:
    if (req.admin?.role === 'TEACHER') {
      if (quiz.teacherId.toString() !== req.admin.id) {
        const isAssigned = await TeacherAssignment.exists({
          teacherId: req.admin.id,
          classId: (quiz.classId as any)._id,
          subjectId: (quiz.subjectId as any)._id,
          isActive: true,
        });
        if (!isAssigned) {
          res.status(403).json({ success: false, message: 'Access denied: You are not assigned to this quiz.' });
          return;
        }
      }
    }

    if (['CR', 'CR_ASSISTANT'].includes(req.admin?.role || '') && req.admin?.assignedClassId) {
      if (req.admin.assignedClassId !== (quiz.classId as any)._id.toString()) {
        res.status(403).json({ success: false, message: 'Access denied: CR / Assistant can only view their own class.' });
        return;
      }
    }

    const submissions = await QuizSubmission.find({ quizId: id })
      .select('_id submissionId quizId studentId classId subjectId studentName rollNumber mcqScore writtenScore totalScore isGraded submittedAt isLate status createdAt updatedAt')
      .sort({ rollNumber: 1 })
      .lean();
    const visibleSubmissions = submissions.map((submission) => ({
          _id: submission._id,
          submissionId: submission.submissionId,
          quizId: submission.quizId,
          studentId: submission.studentId,
          classId: submission.classId,
          subjectId: submission.subjectId,
          studentName: submission.studentName,
          rollNumber: submission.rollNumber,
          answers: [],
          ...(req.admin?.role === 'TEACHER' ? {
            mcqScore: submission.mcqScore,
            writtenScore: submission.writtenScore,
            totalScore: submission.totalScore,
            isGraded: submission.isGraded,
          } : {}),
          submittedAt: submission.submittedAt,
          isLate: submission.isLate,
          status: submission.status,
          createdAt: submission.createdAt,
          updatedAt: submission.updatedAt,
        }));

    res.status(200).json({
      success: true,
      quiz: {
        id: quiz._id,
        title: quiz.title,
        quizType: quiz.quizType,
        totalMarks: quiz.totalMarks,
        class: quiz.classId,
        subject: quiz.subjectId,
      },
      count: submissions.length,
      submissions: visibleSubmissions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch quiz submissions.' });
  }
};

export const getQuizSubmissionForGrading = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const submission = await QuizSubmission.findById(req.params.submissionId).lean();
    if (!submission) {
      res.status(404).json({ success: false, message: 'Quiz submission not found.' });
      return;
    }
    const quiz = await Quiz.findById(submission.quizId).select('teacherId classId subjectId');
    if (!quiz) {
      res.status(404).json({ success: false, message: 'Quiz not found.' });
      return;
    }
    if (req.admin?.role !== 'TEACHER' || !(await canTeacherManageQuiz(quiz, req.admin.id))) {
      res.status(403).json({ success: false, message: 'Only the assigned teacher can grade this submission.' });
      return;
    }
    res.status(200).json({ success: true, submission });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load quiz submission for grading.' });
  }
};

export const updateQuizResultsPublished = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (typeof req.body.resultsPublished !== 'boolean') {
      res.status(400).json({ success: false, message: 'resultsPublished must be a boolean.' });
      return;
    }
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      res.status(404).json({ success: false, message: 'Quiz not found.' });
      return;
    }
    if (req.admin?.role !== 'TEACHER' || !(await canTeacherManageQuiz(quiz, req.admin.id))) {
      res.status(403).json({ success: false, message: 'Only the assigned teacher can publish quiz results.' });
      return;
    }
    quiz.resultsPublished = req.body.resultsPublished;
    await quiz.save();
    res.status(200).json({
      success: true,
      message: quiz.resultsPublished ? 'Quiz results declared to students.' : 'Quiz results hidden from students.',
      resultsPublished: quiz.resultsPublished,
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update quiz result visibility.' });
  }
};

export const downloadQuizSubmissionsPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('classId', 'name semester section')
      .populate('subjectId', 'name code');
    if (!quiz) {
      res.status(404).json({ success: false, message: 'Quiz not found.' });
      return;
    }
    if (req.admin?.role !== 'TEACHER' || !(await canTeacherManageQuiz(quiz, req.admin.id))) {
      res.status(403).json({ success: false, message: 'Only the assigned teacher can export quiz submissions.' });
      return;
    }
    const submissions = await QuizSubmission.find({ quizId: quiz._id }).sort({ rollNumber: 1 }).lean();
    if (!submissions.length) {
      res.status(404).json({ success: false, message: 'There are no quiz submissions to export.' });
      return;
    }

    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 48;
    const maxWidth = pageWidth - margin * 2;
    const safePdfText = (value: unknown) => String(value ?? '')
      .replace(/[^\x20-\x7E]/g, '?')
      .replace(/[ \t]+/g, ' ')
      .trim();
    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;
    const newPage = () => {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    };
    const drawWrapped = (value: unknown, font = regular, size = 10, color = rgb(0.12, 0.16, 0.23)) => {
      const text = safePdfText(value) || ' ';
      const lines: string[] = [];
      let line = '';
      for (const word of text.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) lines.push(line);
      for (const textLine of lines) {
        if (y < margin + size) newPage();
        page.drawText(textLine, { x: margin, y, size, font, color });
        y -= size + 5;
      }
    };

    for (const [studentIndex, submission] of submissions.entries()) {
      if (studentIndex > 0) newPage();
      drawWrapped(`${submission.studentName} (${submission.rollNumber})`, bold, 16, rgb(0.1, 0.2, 0.48));
      drawWrapped(`Quiz: ${quiz.title} | Submission ID: ${submission.submissionId}`, regular, 10);
      drawWrapped(`Class: ${(quiz.classId as any)?.name || ''} | Subject: ${(quiz.subjectId as any)?.name || ''} (${(quiz.subjectId as any)?.code || ''})`, regular, 10);
      drawWrapped(`Submitted: ${new Date(submission.submittedAt).toLocaleString()} | Score: ${submission.totalScore}/${quiz.totalMarks} | Status: ${submission.isGraded ? 'Graded' : 'Pending grading'}`, bold, 10);
      y -= 10;

      const questionMap = new Map(quiz.questions.map((question) => [question.questionId, question]));
      for (const [answerIndex, answer] of submission.answers.entries()) {
        const question = questionMap.get(answer.questionId);
        const answerText = answer.questionType === 'MCQ'
          ? question?.options?.[answer.selectedOptionIndex ?? -1] || '[No answer]'
          : answer.writtenAnswerText || '[No answer]';
        drawWrapped(`Question ${answerIndex + 1}: ${question?.questionText || ''}`, bold, 11);
        drawWrapped(`Answer: ${answerText}`, regular, 10);
        drawWrapped(`Marks: ${answer.marksAwarded || 0}/${question?.marks || 0}${answer.teacherFeedback ? ` | Feedback: ${answer.teacherFeedback}` : ''}`, regular, 9, rgb(0.32, 0.35, 0.4));
        y -= 8;
      }
    }

    const pdfBytes = await pdf.save();
    const filename = `${safePdfText(quiz.title).replace(/[^a-zA-Z0-9_-]/g, '_')}_Quiz_Submissions.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.status(200).send(Buffer.from(pdfBytes));
  } catch {
    res.status(500).json({ success: false, message: 'Failed to generate quiz submissions PDF.' });
  }
};

export const downloadQuizSubmissionsCsv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const quiz = await Quiz.findById(req.params.id).populate('subjectId', 'name code');
    if (!quiz) {
      res.status(404).json({ success: false, message: 'Quiz not found.' });
      return;
    }
    if (req.admin?.role !== 'TEACHER' || !(await canTeacherManageQuiz(quiz, req.admin.id))) {
      res.status(403).json({ success: false, message: 'Only the assigned teacher can export quiz grades.' });
      return;
    }
    const submissions = await QuizSubmission.find({ quizId: quiz._id }).sort({ rollNumber: 1 }).lean();
    const subject = quiz.subjectId as any;
    const writtenQuestions = quiz.questions.filter((question) => question.questionType === 'Written');
    const headers = [
      'Submission ID', 'Student Name', 'Roll Number', 'Subject', 'Quiz', 'MCQ Marks',
      ...writtenQuestions.map((question) => `Question ${question.questionId} Marks`),
      'Written Marks', 'Total Marks', 'Maximum Marks', 'Grading Status',
    ];
    const columnName = (column: number): string => {
      let name = '';
      let value = column;
      while (value > 0) {
        value -= 1;
        name = String.fromCharCode(65 + (value % 26)) + name;
        value = Math.floor(value / 26);
      }
      return name;
    };
    const rows = submissions.map((submission, index) => {
      const rowNumber = index + 2;
      const writtenEndColumn = 6 + writtenQuestions.length;
      const writtenFormula = writtenQuestions.length
        ? `=SUM(G${rowNumber}:${columnName(writtenEndColumn)}${rowNumber})`
        : '=0';
      const totalFormula = `=F${rowNumber}+${columnName(writtenEndColumn + 1)}${rowNumber}`;
      const values = [
        submission.submissionId,
        submission.studentName,
        submission.rollNumber,
        `${subject?.name || 'Subject'} (${subject?.code || ''})`,
        quiz.title,
        submission.mcqScore,
        ...writtenQuestions.map((question) =>
          submission.answers.find((answer) => answer.questionId === question.questionId)?.marksAwarded || 0
        ),
        writtenFormula,
        totalFormula,
        quiz.totalMarks,
        submission.isGraded ? 'Graded' : 'Pending grading',
      ];
      return values.map((value) => typeof value === 'string' && value.startsWith('=')
        ? `"${value}"`
        : sanitizeCsvField(value)).join(',');
    });
    const csvContent = [headers.map(sanitizeCsvField).join(','), ...rows].join('\n');
    const cleanTitle = quiz.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}_Quiz_Grades.csv"`);
    res.status(200).send(`\uFEFF${csvContent}`);
  } catch {
    res.status(500).json({ success: false, message: 'Failed to export quiz grades CSV.' });
  }
};

export const downloadQuizGradesExcel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const quiz = await Quiz.findById(req.params.id).populate('subjectId', 'name code');
    if (!quiz) {
      res.status(404).json({ success: false, message: 'Quiz not found.' });
      return;
    }
    if (req.admin?.role !== 'TEACHER' || !(await canTeacherManageQuiz(quiz, req.admin.id))) {
      res.status(403).json({ success: false, message: 'Only the assigned teacher can export quiz grades.' });
      return;
    }

    const submissions = await QuizSubmission.find({ quizId: quiz._id }).sort({ rollNumber: 1 }).lean();
    const subject = quiz.subjectId as any;
    const writtenQuestions = quiz.questions.filter((question) => question.questionType === 'Written');
    const headers = [
      'Submission ID', 'Student Name', 'Roll Number', 'Subject', 'Quiz', 'MCQ Marks',
      ...writtenQuestions.map((question) => `Question ${question.questionId} Marks`),
      'Written Marks', 'Total Marks', 'Maximum Marks', 'Grading Status',
    ];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Grades');
    sheet.addRow(headers);
    submissions.forEach((submission, index) => {
      const rowNumber = index + 2;
      const writtenEndColumn = 6 + writtenQuestions.length;
      const writtenMarks = writtenQuestions.map((question) =>
        submission.answers.find((answer) => answer.questionId === question.questionId)?.marksAwarded || 0
      );
      sheet.addRow([
        submission.submissionId,
        submission.studentName,
        submission.rollNumber,
        `${subject?.name || 'Subject'} (${subject?.code || ''})`,
        quiz.title,
        submission.mcqScore,
        ...writtenMarks,
        { formula: writtenQuestions.length ? `SUM(G${rowNumber}:${sheet.getColumn(writtenEndColumn).letter}${rowNumber})` : '0' },
        { formula: `F${rowNumber}+${sheet.getColumn(writtenEndColumn + 1).letter}${rowNumber}` },
        quiz.totalMarks,
        submission.isGraded ? 'Graded' : 'Pending grading',
      ]);
    });
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(headers.length).letter}1` };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    sheet.columns.forEach((column, index) => {
      column.width = Math.min(Math.max(headers[index].length + 3, 14), 32);
    });

    const filename = `${quiz.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Quiz_Grades.xlsx`;
    const file = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(Buffer.from(file));
  } catch {
    res.status(500).json({ success: false, message: 'Failed to export quiz grades Excel file.' });
  }
};

const parseCsvRows = (content: string, delimiter: ',' | ';'): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < content.length; i += 1) {
    const character = content[i];
    if (quoted) {
      if (character === '"' && content[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && content[i + 1] === '\n') i += 1;
      row.push(field);
      while (row.length && !row[row.length - 1].trim()) row.pop();
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  row.push(field);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  return rows;
};

export const uploadQuizGradesCsv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      res.status(404).json({ success: false, message: 'Quiz not found.' });
      return;
    }
    if (req.admin?.role !== 'TEACHER' || !(await canTeacherManageQuiz(quiz, req.admin.id))) {
      res.status(403).json({ success: false, message: 'Only the assigned teacher can upload quiz grades.' });
      return;
    }

    const writtenQuestions = quiz.questions.filter((question) => question.questionType === 'Written');
    if (!writtenQuestions.length) {
      res.status(400).json({ success: false, message: 'This quiz has no written questions to grade.' });
      return;
    }
    const isExcel = Buffer.isBuffer(req.body);
    const contentSize = isExcel ? req.body.length : typeof req.body === 'string' ? Buffer.byteLength(req.body, 'utf8') : 0;
    if ((!isExcel && (typeof req.body !== 'string' || !req.body.trim())) || contentSize > 5 * 1024 * 1024) {
      res.status(400).json({ success: false, message: 'Upload a non-empty Excel or CSV file smaller than 5 MB.' });
      return;
    }

    let rows: string[][];
    try {
      if (isExcel) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.body);
        const sheet = workbook.worksheets[0];
        if (!sheet || sheet.rowCount > 5001 || sheet.columnCount > 256) {
          res.status(400).json({ success: false, message: 'Excel file must contain one grades sheet with at most 5,000 rows.' });
          return;
        }
        rows = [];
        sheet.eachRow({ includeEmpty: false }, (excelRow) => {
          const row = Array.from({ length: sheet.columnCount }, (_, index) => {
            const value = excelRow.getCell(index + 1).value;
            if (typeof value === 'string' || typeof value === 'number') return String(value);
            if (value && typeof value === 'object' && 'richText' in value) {
              return value.richText.map((part) => part.text).join('');
            }
            if (value && typeof value === 'object' && 'result' in value) {
              return String(value.result ?? '');
            }
            return '';
          });
          if (row.some((cell) => cell.trim() !== '')) rows.push(row);
        });
      } else {
        const csvContent = req.body.replace(/^\uFEFF/, '');
        const firstLine = csvContent.split(/\r?\n/, 1)[0] || '';
        const delimiter: ',' | ';' = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
        rows = parseCsvRows(csvContent, delimiter);
      }
    } catch (error) {
      res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Invalid Excel or CSV file.' });
      return;
    }
    rows = rows.map((row) => {
      while (row.length && !row[row.length - 1].trim()) row.pop();
      return row;
    });
    const normalizeHeader = (header: string) => header.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const headers = rows[0]?.map(normalizeHeader);
    const requiredQuestionHeaders = writtenQuestions.map((question) => normalizeHeader(`Question ${question.questionId} Marks`));
    const hasQuestionMarks = requiredQuestionHeaders.every((header) => headers?.includes(header));
    const hasAggregateMarks = headers?.includes('writtenmarks') || headers?.includes('writtenscore');
    if (!headers || (!headers.includes('submissionid') && !headers.includes('rollnumber')) || (!hasQuestionMarks && !hasAggregateMarks)) {
      res.status(400).json({ success: false, message: 'Include Submission ID or Roll Number and Written Marks (or each question marks column).' });
      return;
    }
    const headerIndex = new Map(headers.map((header, index) => [header, index]));
    const submissionIdColumn = headerIndex.get('submissionid');
    const rollNumberColumn = headerIndex.get('rollnumber');
    const aggregateMarksColumn = headerIndex.get('writtenmarks') ?? headerIndex.get('writtenscore');
    const questionColumns = new Map(writtenQuestions.map((question) => [
      question.questionId,
      headerIndex.get(normalizeHeader(`Question ${question.questionId} Marks`)),
    ]));

    const submissions = await QuizSubmission.find({ quizId: quiz._id }).lean();
    const submissionMap = new Map(submissions.map((submission) => [submission.submissionId, submission]));
    const rollNumberMap = new Map(submissions.map((submission) => [submission.rollNumber.trim().toLowerCase(), submission]));
    const csvRows = rows.slice(1);
    if (csvRows.length !== submissions.length) {
      res.status(400).json({ success: false, message: 'File must contain exactly one row for every quiz submission.' });
      return;
    }

    const grades = new Map<string, Map<string, number>>();
    for (const [index, row] of csvRows.entries()) {
      const submissionId = submissionIdColumn !== undefined ? row[submissionIdColumn]?.trim() : '';
      const rollNumber = rollNumberColumn !== undefined ? row[rollNumberColumn]?.trim().toLowerCase() : '';
      const submission = (submissionId && submissionMap.get(submissionId))
        || (rollNumber && rollNumberMap.get(rollNumber));
      if (!submission || grades.has(submission.submissionId)) {
        res.status(400).json({ success: false, message: `Invalid or duplicate submission ID on row ${index + 2}.` });
        return;
      }

      const questionGrades = new Map<string, number>();
      for (const question of writtenQuestions) {
        const column = questionColumns.get(question.questionId);
        const rawMarks = column === undefined ? '' : row[column]?.trim();
        const marks = rawMarks === '' ? 0 : Number(rawMarks);
        if (column !== undefined && (!Number.isFinite(marks) || marks < 0 || marks > question.marks)) {
          res.status(400).json({
            success: false,
            message: `Invalid marks for ${question.questionId} on row ${index + 2}; enter 0 to ${question.marks}.`,
          });
          return;
        }
        if (column !== undefined) questionGrades.set(question.questionId, marks);
      }
      const questionMarksTotal = [...questionGrades.values()].reduce((sum, marks) => sum + marks, 0);
      const rawAggregate = aggregateMarksColumn === undefined ? '' : row[aggregateMarksColumn]?.trim();
      if (aggregateMarksColumn !== undefined && (!hasQuestionMarks || (questionMarksTotal === 0 && Number(rawAggregate) > 0))) {
        const aggregate = Number(rawAggregate);
        const maximumWrittenMarks = writtenQuestions.reduce((total, question) => total + question.marks, 0);
        if (!Number.isFinite(aggregate) || aggregate < 0 || aggregate > maximumWrittenMarks) {
          res.status(400).json({ success: false, message: `Invalid written marks on row ${index + 2}; enter 0 to ${maximumWrittenMarks}.` });
          return;
        }
        let remaining = aggregate;
        writtenQuestions.forEach((question) => {
          const assigned = Math.min(remaining, question.marks);
          questionGrades.set(question.questionId, assigned);
          remaining -= assigned;
        });
      }
      grades.set(submission.submissionId, questionGrades);
    }
    if (grades.size !== submissions.length) {
      res.status(400).json({ success: false, message: 'File must include every quiz submission.' });
      return;
    }

    const operations = submissions.map((submission) => {
      const questionGrades = grades.get(submission.submissionId)!;
      let writtenTotal = 0;
      const answers = submission.answers.map((answer) => {
        if (answer.questionType === 'Written') {
          const marksAwarded = questionGrades.get(answer.questionId) ?? 0;
          writtenTotal += marksAwarded;
          return { ...answer, marksAwarded };
        }
        return answer;
      });
      return {
        updateOne: {
          filter: { _id: submission._id, quizId: quiz._id },
          update: { $set: { answers, writtenScore: writtenTotal, totalScore: submission.mcqScore + writtenTotal, isGraded: true } },
        },
      };
    });
    const result = await QuizSubmission.bulkWrite(operations);

    res.status(200).json({
      success: true,
      message: `Grades saved for ${result.matchedCount} of ${submissions.length} submissions.`,
      updatedCount: result.matchedCount,
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to upload quiz grades CSV.' });
  }
};

/**
 * 6. GRADE WRITTEN QUIZ SUBMISSION (Teacher / Super Admin)
 */
export const gradeQuizSubmission = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { submissionId } = req.params;
    const { gradedAnswers } = req.body; // Array of { questionId, marksAwarded, teacherFeedback }

    if (!Array.isArray(gradedAnswers)) {
      res.status(400).json({ success: false, message: 'gradedAnswers array is required.' });
      return;
    }

    const submission = await QuizSubmission.findById(submissionId);
    if (!submission) {
      res.status(404).json({ success: false, message: 'Quiz submission not found.' });
      return;
    }

    const quiz = await Quiz.findById(submission.quizId);
    if (!quiz) {
      res.status(404).json({ success: false, message: 'Quiz not found.' });
      return;
    }

    // Teacher authorization check
    if (req.admin?.role === 'TEACHER') {
      if (quiz.teacherId.toString() !== req.admin.id) {
        const isAssigned = await TeacherAssignment.exists({
          teacherId: req.admin.id,
          classId: quiz.classId,
          subjectId: quiz.subjectId,
          isActive: true,
        });
        if (!isAssigned) {
          res.status(403).json({ success: false, message: 'Access denied: You are not assigned to grade this quiz.' });
          return;
        }
      }
    }

    const writtenQuestions = new Map(quiz.questions
      .filter((question) => question.questionType === 'Written')
      .map((question) => [question.questionId, question]));
    const gradeMap = new Map<string, { marksAwarded: number; teacherFeedback?: string }>();
    for (const grade of gradedAnswers) {
      const question = writtenQuestions.get(grade.questionId);
      const marks = Number(grade.marksAwarded);
      if (!question || !Number.isFinite(marks) || marks < 0 || marks > question.marks || gradeMap.has(grade.questionId)) {
        res.status(400).json({ success: false, message: 'Grades must contain valid marks for written questions only.' });
        return;
      }
      gradeMap.set(grade.questionId, { marksAwarded: marks, teacherFeedback: grade.teacherFeedback });
    }
    let writtenTotal = 0;

    submission.answers.forEach((ans) => {
      if (ans.questionType === 'Written') {
        const gradeInfo = gradeMap.get(ans.questionId);
        if (gradeInfo) {
          ans.marksAwarded = gradeInfo.marksAwarded;
          ans.teacherFeedback = String(gradeInfo.teacherFeedback || '').trim();
        }
        writtenTotal += ans.marksAwarded || 0;
      }
    });

    submission.writtenScore = writtenTotal;
    submission.totalScore = submission.mcqScore + writtenTotal;
    submission.isGraded = true;
    await submission.save();

    res.status(200).json({
      success: true,
      message: 'Quiz submission graded successfully.',
      submission,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to grade submission.' });
  }
};

/**
 * 7. DOWNLOAD / GENERATE SUBMISSION DOCX
 */
export const downloadQuizSubmissionDocx = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rawSubmissionId = req.params.submissionId;
    const submissionId = Array.isArray(rawSubmissionId) ? rawSubmissionId[0] : String(rawSubmissionId);

    let submission: any = null;
    if (mongoose.Types.ObjectId.isValid(submissionId)) {
      submission = await QuizSubmission.findById(submissionId);
    }
    if (!submission) {
      submission = await QuizSubmission.findOne({ submissionId });
    }


    if (!submission) {
      res.status(404).json({ success: false, message: 'Quiz submission not found.' });
      return;
    }

    const quiz = await Quiz.findById(submission.quizId);
    const classDoc = await Class.findById(submission.classId);
    const subjectDoc = await Subject.findById(submission.subjectId);

    if (!quiz || !classDoc || !subjectDoc) {
      res.status(404).json({ success: false, message: 'Quiz or Class details not found.' });
      return;
    }

    // Security Authorization check:
    if (req.student) {
      if (submission.studentId.toString() !== req.student.id) {
        res.status(403).json({ success: false, message: 'Access denied: You can only view your own submission.' });
        return;
      }
    } else if (['CR', 'CR_ASSISTANT'].includes(req.admin?.role || '')) {
      if (req.admin?.assignedClassId && req.admin.assignedClassId !== classDoc._id.toString()) {
        res.status(403).json({ success: false, message: 'Access denied: CR / Assistant can only view their own class.' });
        return;
      }
    } else if (req.admin?.role === 'TEACHER') {
      const isAssigned = await TeacherAssignment.exists({
        teacherId: req.admin.id,
        classId: classDoc._id,
        subjectId: subjectDoc._id,
        isActive: true,
      });
      if (!isAssigned && quiz.teacherId.toString() !== req.admin.id) {
        res.status(403).json({ success: false, message: 'Access denied to this submission.' });
        return;
      }
    }

    // Generate formatted DOCX
    const questionsMap = new Map(quiz.questions.map((q) => [q.questionId, q]));
    let qNumber = 1;
    const docxQuestions = submission.answers.map((ans: any) => {
      const q = questionsMap.get(ans.questionId);
      let studentAns = ans.writtenAnswerText || '';
      if (ans.questionType === 'MCQ') {
        const optIndex = ans.selectedOptionIndex;
        if (optIndex !== undefined && optIndex >= 0 && q?.options && q.options[optIndex]) {
          studentAns = `${String.fromCharCode(65 + optIndex)}. ${q.options[optIndex]}`;
        } else {
          studentAns = '[No Option Selected]';
        }
      }

      return {
        questionNumber: qNumber++,
        questionText: q?.questionText || `Question (${ans.questionType})`,
        questionType: ans.questionType,
        marks: q?.marks || 1,
        studentAnswer: studentAns,
      };
    });

    const docxBuffer = await generateQuizSubmissionDocx({
      studentName: submission.studentName,
      rollNumber: submission.rollNumber,
      semester: classDoc.semester,
      section: classDoc.section,
      className: classDoc.name,
      subjectName: subjectDoc.name,
      subjectCode: subjectDoc.code,
      quizTitle: quiz.title,
      quizId: quiz._id.toString(),
      submissionId: submission.submissionId,
      submittedAt: submission.submittedAt,
      questions: docxQuestions,
    });

    const cleanFileName = `${submission.rollNumber}_${submission.studentName}_${subjectDoc.code}_${quiz.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}"; filename*=UTF-8''${encodeURIComponent(cleanFileName)}`);
    res.setHeader('Content-Length', docxBuffer.length);
    res.status(200).send(docxBuffer);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate submission DOCX.' });
  }
};

/**
 * 8. DELETE QUIZ (Teacher creator or Admin)
 */
export const deleteQuiz = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findById(id);
    if (!quiz) {
      res.status(404).json({ success: false, message: 'Quiz not found.' });
      return;
    }

    if (req.admin?.role === 'TEACHER' && quiz.teacherId.toString() !== req.admin.id) {
      res.status(403).json({ success: false, message: 'You can only delete quizzes created by you.' });
      return;
    }

    await Promise.all([
      QuizSubmission.deleteMany({ quizId: id }),
      LateRequest.deleteMany({ quizId: id }),
      Quiz.findByIdAndDelete(id),
    ]);

    res.status(200).json({ success: true, message: 'Quiz and all its submissions deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete quiz.' });
  }
};
