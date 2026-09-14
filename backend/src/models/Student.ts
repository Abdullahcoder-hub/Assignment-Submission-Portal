import mongoose, { Schema, Document } from 'mongoose';

export interface IStudent extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  rollNumber: string;
  googleId?: string;
  isEmailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  role: 'STUDENT';
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    rollNumber: { type: String, required: true, unique: true, trim: true },
    googleId: { type: String, default: '' },
    isEmailVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationTokenExpires: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    role: { type: String, enum: ['STUDENT'], default: 'STUDENT' },
  },
  { timestamps: true }
);

export default mongoose.model<IStudent>('Student', StudentSchema);
