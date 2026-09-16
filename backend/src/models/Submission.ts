import mongoose, { Schema, Document } from 'mongoose';

export interface ISubmission extends Document {
  submissionId: string;
  studentId: mongoose.Types.ObjectId;
  assignmentId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  studentName: string;
  rollNumber: string;
  email: string;

  // Cloudinary
  cloudinaryPublicId: string;
  cloudinarySecureUrl: string;
  cloudinaryResourceType: string;
  cloudinaryFormat: string;

  // File Metadata
  originalFileName: string;
  fileSize: number; // in Bytes
  fileType: string;

  // Submission Status
  submittedAt: Date;
  isLate: boolean;
  status: 'Submitted' | 'Late' | 'Submitted Late — CR Approved';
  emailStatus: 'Sent' | 'Failed';

  createdAt: Date;
  updatedAt: Date;
}

const SubmissionSchema: Schema = new Schema(
  {
    submissionId: { type: String, required: true, unique: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    studentName: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },

    cloudinaryPublicId: { type: String, required: true },
    cloudinarySecureUrl: { type: String, required: true },
    cloudinaryResourceType: { type: String, default: 'auto' },
    cloudinaryFormat: { type: String, default: '' },

    originalFileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    fileType: { type: String, required: true },

    submittedAt: { type: Date, required: true },
    isLate: { type: Boolean, default: false },
    status: { type: String, enum: ['Submitted', 'Late', 'Submitted Late — CR Approved'], default: 'Submitted' },
    emailStatus: { type: String, enum: ['Sent', 'Failed'], default: 'Sent' },
  },
  { timestamps: true }
);

// Prevent duplicate submissions for the same assignment and roll number
SubmissionSchema.index({ assignmentId: 1, rollNumber: 1 }, { unique: true });

export default mongoose.model<ISubmission>('Submission', SubmissionSchema);
