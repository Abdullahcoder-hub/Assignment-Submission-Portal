import mongoose, { Schema, Document } from 'mongoose';

export interface IAdmin extends Document {
  name: string;
  email: string;
  passwordHash: string;
  tokenVersion: number;
  role: 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    tokenVersion: { type: Number, default: 0 },
    role: { type: String, enum: ['ADMIN'], default: 'ADMIN' },
  },
  { timestamps: true }
);

export default mongoose.model<IAdmin>('Admin', AdminSchema);
