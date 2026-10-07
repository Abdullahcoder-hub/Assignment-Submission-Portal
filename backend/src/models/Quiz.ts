import mongoose, { Schema, Document } from 'mongoose';

export type QuizType = 'MCQ' | 'Written' | 'Mixed';

export interface IQuizQuestion {
  questionId: string;
  questionType: 'MCQ' | 'Written';
  questionText: string;
  options?: string[]; // for MCQ
  correctOptionIndex?: number; // for MCQ (0-indexed) - ONLY accessible on server / teacher view
  marks: number;
}

export interface IQuiz extends Document {
  title: string;
  description?: string;
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  crId?: mongoose.Types.ObjectId;
  assistantId?: mongoose.Types.ObjectId;
  quizType: QuizType;
  durationMinutes?: number;
  deadline: Date;
  allowLateSubmission: boolean;
  totalMarks: number;
  questions: IQuizQuestion[];
  isActive: boolean;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QuizQuestionSchema = new Schema(
  {
    questionId: { type: String, required: true },
    questionType: { type: String, enum: ['MCQ', 'Written'], required: true },
    questionText: { type: String, required: true, trim: true },
    options: { type: [String], default: [] },
    correctOptionIndex: { type: Number },
    marks: { type: Number, required: true, default: 1 },
  },
  { _id: false }
);

const QuizSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    crId: { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
    assistantId: { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
    quizType: { type: String, enum: ['MCQ', 'Written', 'Mixed'], default: 'MCQ' },
    durationMinutes: { type: Number, default: 30 },
    deadline: { type: Date, required: true },
    allowLateSubmission: { type: Boolean, default: false },
    totalMarks: { type: Number, required: true, default: 10 },
    questions: { type: [QuizQuestionSchema], required: true },
    isActive: { type: Boolean, default: true },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

QuizSchema.index({ classId: 1, subjectId: 1, isActive: 1 });
QuizSchema.index({ teacherId: 1, createdAt: -1 });

export default mongoose.model<IQuiz>('Quiz', QuizSchema);
