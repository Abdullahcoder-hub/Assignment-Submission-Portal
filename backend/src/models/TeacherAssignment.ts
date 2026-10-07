import mongoose, { Schema, Document } from 'mongoose';

export interface ITeacherAssignment extends Document {
  teacherId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherAssignmentSchema: Schema = new Schema(
  {
    teacherId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Enforce rule: Class + Subject = ONE ACTIVE TEACHER
TeacherAssignmentSchema.index({ classId: 1, subjectId: 1, isActive: 1 }, { unique: true });

export default mongoose.model<ITeacherAssignment>('TeacherAssignment', TeacherAssignmentSchema);
