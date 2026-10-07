import mongoose, { Schema, Document } from 'mongoose';

export type CRApplicationType = 'CR' | 'CR_ASSISTANT';
export type CRApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ICRApplication extends Document {
  studentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  roleType: CRApplicationType;
  status: CRApplicationStatus;
  reason?: string;
  appliedAt: Date;
  decidedAt?: Date;
  decidedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CRApplicationSchema: Schema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    roleType: { type: String, enum: ['CR', 'CR_ASSISTANT'], default: 'CR', required: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    reason: { type: String, default: '', trim: true },
    appliedAt: { type: Date, default: Date.now },
    decidedAt: { type: Date },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    rejectionReason: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

// Prevent duplicate active or pending application for the same student + class + roleType
CRApplicationSchema.index({ studentId: 1, classId: 1, roleType: 1, status: 1 });

export default mongoose.model<ICRApplication>('CRApplication', CRApplicationSchema);
