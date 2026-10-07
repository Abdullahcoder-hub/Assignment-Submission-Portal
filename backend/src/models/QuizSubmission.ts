import mongoose, { Schema, Document } from 'mongoose';

export interface IQuizSubmissionAnswer {
  questionId: string;
  questionType: 'MCQ' | 'Written';
  selectedOptionIndex?: number;
  writtenAnswerText?: string;
  isCorrect?: boolean;
  marksAwarded?: number;
  teacherFeedback?: string;
}

export interface IQuizSubmission extends Document {
  submissionId: string;
  quizId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  studentName: string;
  rollNumber: string;
  answers: IQuizSubmissionAnswer[];
  mcqScore: number;
  writtenScore: number;
  totalScore: number;
  isGraded: boolean;
  submittedAt: Date;
  isLate: boolean;
  status: 'Submitted' | 'Late' | 'Submitted Late — CR Approved';
  docxPublicId?: string;
  docxSecureUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuizAnswerSchema = new Schema(
  {
    questionId: { type: String, required: true },
    questionType: { type: String, enum: ['MCQ', 'Written'], required: true },
    selectedOptionIndex: { type: Number },
    writtenAnswerText: { type: String, default: '' },
    isCorrect: { type: Boolean },
    marksAwarded: { type: Number, default: 0 },
    teacherFeedback: { type: String, default: '' },
  },
  { _id: false }
);

const QuizSubmissionSchema: Schema = new Schema(
  {
    submissionId: { type: String, required: true, unique: true, index: true },
    quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    studentName: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, trim: true },
    answers: { type: [QuizAnswerSchema], required: true },
    mcqScore: { type: Number, default: 0 },
    writtenScore: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    isGraded: { type: Boolean, default: false },
    submittedAt: { type: Date, required: true },
    isLate: { type: Boolean, default: false },
    status: { type: String, enum: ['Submitted', 'Late', 'Submitted Late — CR Approved'], default: 'Submitted' },
    docxPublicId: { type: String },
    docxSecureUrl: { type: String },
  },
  { timestamps: true }
);

// Prevent duplicate submission by same student for same quiz
QuizSubmissionSchema.index({ quizId: 1, studentId: 1 }, { unique: true });
QuizSubmissionSchema.index({ quizId: 1, rollNumber: 1 });
QuizSubmissionSchema.index({ classId: 1, subjectId: 1 });

export default mongoose.model<IQuizSubmission>('QuizSubmission', QuizSubmissionSchema);
