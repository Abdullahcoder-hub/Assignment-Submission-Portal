import mongoose, { Schema, Document } from 'mongoose';

export interface ISharedAssignment extends Document {
  assignmentId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  crId: mongoose.Types.ObjectId;
  note?: string;
  shareZip: boolean;
  shareCsv: boolean;
  sharedAt: Date;
  downloadCount: number;
  lastDownloadedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SharedAssignmentSchema: Schema = new Schema(
  {
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    crId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    note: { type: String, default: '', trim: true },
    shareZip: { type: Boolean, default: true },
    shareCsv: { type: Boolean, default: true },
    sharedAt: { type: Date, default: Date.now },
    downloadCount: { type: Number, default: 0 },
    lastDownloadedAt: { type: Date },
  },
  { timestamps: true }
);

// Unique compound index so sharing the same assignment with the same teacher updates or prevents duplicates
SharedAssignmentSchema.index({ assignmentId: 1, teacherId: 1 }, { unique: true });

export default mongoose.model<ISharedAssignment>('SharedAssignment', SharedAssignmentSchema);
