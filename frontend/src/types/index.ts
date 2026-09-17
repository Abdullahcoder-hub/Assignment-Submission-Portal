export interface Subject {
  _id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  _id: string;
  subjectId: Subject | string;
  title: string;
  description?: string;
  deadline: string;
  allowLateSubmission: boolean;
  allowedFileTypes: string[];
  maxFileSize: number; // MB
  maxGroupSize?: number;
  submissionType?: 'Individual' | 'Group';
  groupDeadline?: string;
  allowLateGroupRegistration?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  _id: string;
  submissionId: string;
  studentId?: string;
  assignmentId: Assignment | string;
  subjectId: Subject | string;
  studentName: string;
  rollNumber: string;
  email: string;
  cloudinaryPublicId: string;
  cloudinarySecureUrl: string;
  cloudinaryResourceType: string;
  cloudinaryFormat: string;
  originalFileName: string;
  fileSize: number;
  fileType: string;
  submittedAt: string;
  isLate: boolean;
  status: 'Submitted' | 'Late' | 'Submitted Late — CR Approved';
  emailStatus: 'Sent' | 'Failed';
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  studentId: string;
  name: string;
  rollNumber: string;
}

export interface Group {
  _id: string;
  groupName: string;
  subjectId: Subject | string;
  assignmentId?: Assignment | string;
  leader: GroupMember;
  members: GroupMember[];
  maxGroupSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface LateRequest {
  _id: string;
  studentId: string;
  groupId?: Group | string;
  subjectId: Subject | string;
  assignmentId: Assignment | string;
  studentName: string;
  rollNumber: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN';
}

export interface StudentUser {
  id: string;
  name: string;
  email: string;
  rollNumber: string;
  isEmailVerified: boolean;
  role: 'STUDENT';
}

export interface RegisteredStudent {
  _id: string;
  name: string;
  email: string;
  rollNumber: string;
  isEmailVerified: boolean;
  createdAt: string;
}

export type UserRole = 'ADMIN' | 'STUDENT';

export interface DashboardStats {
  totalSubjects: number;
  totalAssignments: number;
  totalSubmissions: number;
  todaysSubmissions: number;
  lateSubmissions: number;
}

export interface SubmissionReceipt {
  submissionId: string;
  studentName: string;
  rollNumber: string;
  email: string;
  subjectName: string;
  subjectCode: string;
  assignmentTitle: string;
  originalFileName: string;
  submittedAt: string;
  isLate: boolean;
  status: string;
  emailStatus: string;
}
