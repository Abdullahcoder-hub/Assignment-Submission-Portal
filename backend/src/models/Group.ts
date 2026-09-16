import mongoose, { Schema, Document } from 'mongoose';

export interface IGroupMember {
  studentId?: mongoose.Types.ObjectId;
  name: string;
  rollNumber: string;
  email?: string;
}

export interface IGroup extends Document {
  groupName: string;
  subjectId: mongoose.Types.ObjectId;
  assignmentId?: mongoose.Types.ObjectId;
  leader: IGroupMember;
  members: IGroupMember[];
  maxGroupSize: number;
  createdAt: Date;
  updatedAt: Date;
}

const MemberSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: false },
    name: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, trim: true },
    email: { type: String, default: '', lowercase: true, trim: true },
  },
  { _id: false }
);

const GroupSchema: Schema = new Schema(
  {
    groupName: { type: String, required: true, trim: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', index: true },
    leader: { type: MemberSchema, required: true },
    members: { type: [MemberSchema], required: true },
    maxGroupSize: { type: Number, default: 4 },
  },
  { timestamps: true }
);

// Prevent a student roll number from belonging to two groups for the same subject
GroupSchema.index({ subjectId: 1, 'members.rollNumber': 1 }, { unique: true });

export default mongoose.model<IGroup>('Group', GroupSchema);
