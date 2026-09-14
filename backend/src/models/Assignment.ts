import mongoose, { Schema, Document } from 'mongoose';

export interface IAssignment extends Document {
  subjectId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  deadline: Date;
  allowLateSubmission: boolean;
  allowedFileTypes: string[];
  maxFileSize: number; // in Megabytes (MB)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSchema: Schema = new Schema(
  {
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    deadline: { type: Date, required: true },
    allowLateSubmission: { type: Boolean, default: false },
    allowedFileTypes: {
      type: [String],
      default: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'zip'],
    },
    maxFileSize: { type: Number, default: 10 }, // Default 10 MB
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IAssignment>('Assignment', AssignmentSchema);
