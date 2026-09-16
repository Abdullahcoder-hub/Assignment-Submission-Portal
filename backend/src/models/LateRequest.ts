import mongoose, { Schema, Document } from 'mongoose';

export interface ILateRequest extends Document {
  studentId: mongoose.Types.ObjectId;
  groupId?: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  assignmentId: mongoose.Types.ObjectId;
  studentName: string;
  rollNumber: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  requestedAt: Date;
  decidedAt?: Date;
  decidedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LateRequestSchema: Schema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true, index: true },
    studentName: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, trim: true },
    reason: { type: String, default: 'Late submission request' },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending', index: true },
    requestedAt: { type: Date, default: Date.now },
    decidedAt: { type: Date },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

export default mongoose.model<ILateRequest>('LateRequest', LateRequestSchema);
