import mongoose, { Schema, Document } from 'mongoose';

export type StaffRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'CR' | 'CR_ASSISTANT';

export interface IAdmin extends Document {
  name: string;
  email: string;
  passwordHash: string;
  tokenVersion: number;
  role: StaffRole;
  assignedClassId?: mongoose.Types.ObjectId;
  studentId?: mongoose.Types.ObjectId;
  isActive: boolean;
  isEmailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  approvalStatus: 'Pending' | 'Approved' | 'Rejected';
  approvalToken?: string;
  approvalTokenExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    tokenVersion: { type: Number, default: 0 },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'CR', 'CR_ASSISTANT'],
      default: 'TEACHER',
      index: true,
    },
    assignedClassId: { type: Schema.Types.ObjectId, ref: 'Class' },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: true },
    verificationToken: { type: String },
    verificationTokenExpires: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    approvalStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Approved',
    },
    approvalToken: { type: String },
    approvalTokenExpires: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<IAdmin>('Admin', AdminSchema);
