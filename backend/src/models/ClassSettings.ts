import mongoose, { Schema, Document } from 'mongoose';

export interface IClassSettings extends Document {
  joinCode: string;
  isJoinCodeActive: boolean;
  updatedAt: Date;
}

const ClassSettingsSchema: Schema = new Schema(
  {
    joinCode: { type: String, required: true, uppercase: true, trim: true },
    isJoinCodeActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IClassSettings>('ClassSettings', ClassSettingsSchema);
