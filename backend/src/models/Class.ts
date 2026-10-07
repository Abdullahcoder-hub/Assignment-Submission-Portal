import mongoose, { Schema, Document } from 'mongoose';

export interface IClass extends Document {
  name: string; // e.g. "5th A"
  semester: string; // e.g. "5th"
  section: string; // e.g. "A"
  joinCode: string;
  isJoinCodeActive: boolean;
  crId?: mongoose.Types.ObjectId;
  assistantId?: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ClassSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    semester: { type: String, required: true, trim: true },
    section: { type: String, required: true, uppercase: true, trim: true },
    joinCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    isJoinCodeActive: { type: Boolean, default: true },
    crId: { type: Schema.Types.ObjectId, ref: 'Admin' },
    assistantId: { type: Schema.Types.ObjectId, ref: 'Admin' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ClassSchema.index({ semester: 1, section: 1, isActive: 1 });

export default mongoose.model<IClass>('Class', ClassSchema);
