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
  status: 'Submitted' | 'Late';
  emailStatus: 'Sent' | 'Failed';
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
