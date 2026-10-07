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
import { escapeRegex } from '../utils/fileValidation.js';

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
      lateRequests.forEach((request) => {
        const quizId = request.quizId?.toString();
        if (quizId && !lateRequestMap.has(quizId)) lateRequestMap.set(quizId, request.status);
      });

      const sanitized = quizzes.map((q) => {
        const sub = submissionMap.get(q._id.toString());
        return {
          ...sanitizeQuizForStudent(q),
          myAttemptStatus: attemptMap.get(q._id.toString()) || null,
          myLateRequestStatus: lateRequestMap.get(q._id.toString()) || null,
          mySubmission: sub
            ? {
                submissionId: sub.submissionId,
                totalScore: sub.totalScore,
                isGraded: sub.isGraded,
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
        ...q,
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
        mySubmission: mySubmission || null,
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

    res.status(200).json({ success: true, quiz });
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
        attempt.status = 'locked';
        attempt.lockedAt = new Date();
        await attempt.save();
        res.status(423).json({ success: false, message: 'This quiz was interrupted and is locked. Request your CR or teacher to unblock it.' });
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
        mcqScore: submission.mcqScore,
        totalScore: submission.totalScore,
        isGraded: submission.isGraded,
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
      .populate('studentId', 'name rollNumber email')
      .sort({ rollNumber: 1 })
      .lean();

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
      submissions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch quiz submissions.' });
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

    const gradeMap = new Map(gradedAnswers.map((g: any) => [g.questionId, g]));
    let writtenTotal = 0;

    submission.answers.forEach((ans) => {
      if (ans.questionType === 'Written') {
        const gradeInfo = gradeMap.get(ans.questionId);
        if (gradeInfo) {
          ans.marksAwarded = Number(gradeInfo.marksAwarded) || 0;
          if (gradeInfo.teacherFeedback) {
            ans.teacherFeedback = String(gradeInfo.teacherFeedback).trim();
          }
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
