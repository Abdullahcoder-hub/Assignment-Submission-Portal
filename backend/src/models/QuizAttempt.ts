import mongoose, { Schema, Document } from 'mongoose';

export type QuizAttemptStatus = 'in_progress' | 'locked' | 'unlocked' | 'submitted';

export interface IQuizAttempt extends Document {
  quizId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  status: QuizAttemptStatus;
  startedAt: Date;
  lockedAt?: Date;
  unlockedAt?: Date;
  updatedAt: Date;
}

const QuizAttemptSchema: Schema = new Schema(
  {
    quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    status: {
      type: String,
      enum: ['in_progress', 'locked', 'unlocked', 'submitted'],
      default: 'in_progress',
      index: true,
    },
    startedAt: { type: Date, default: Date.now },
    lockedAt: { type: Date },
    unlockedAt: { type: Date },
  },
  { timestamps: true }
);

QuizAttemptSchema.index({ quizId: 1, studentId: 1 }, { unique: true });

export default mongoose.model<IQuizAttempt>('QuizAttempt', QuizAttemptSchema);
