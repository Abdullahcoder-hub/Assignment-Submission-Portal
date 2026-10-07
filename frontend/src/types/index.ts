export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'CR' | 'CR_ASSISTANT' | 'STUDENT';

export interface Class {
  _id: string;
  name: string;
  semester: string;
  section: string;
  joinCode: string;
  isJoinCodeActive: boolean;
  crId?: (AdminUser & { _id?: string }) | string;
  assistantId?: (AdminUser & { _id?: string }) | string;
  studentCount?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  _id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherAssignment {
  _id: string;
  teacherId: AdminUser | string;
  classId: Class | string;
  subjectId: Subject | string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestion {
  questionId: string;
  questionType: 'MCQ' | 'Written';
  questionText: string;
  options?: string[];
  correctOptionIndex?: number;
  marks: number;
}

export interface Quiz {
  _id: string;
  title: string;
  description?: string;
  classId: Class | string;
  subjectId: Subject | string;
  teacherId: AdminUser | string;
  crId?: AdminUser | string;
  assistantId?: AdminUser | string;
  quizType: 'MCQ' | 'Written' | 'Mixed';
  durationMinutes?: number;
  deadline: string;
  allowLateSubmission: boolean;
  totalMarks: number;
  questions: QuizQuestion[];
  submissionCount?: number;
  myAttemptStatus?: 'in_progress' | 'locked' | 'unlocked' | 'submitted' | null;
  myLateRequestStatus?: 'Pending' | 'Approved' | 'Rejected' | null;
  mySubmission?: {
    submissionId: string;
    totalScore: number;
    isGraded: boolean;
    submittedAt: string;
    isLate: boolean;
    status: string;
  } | null;
  isActive: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuizSubmissionAnswer {
  questionId: string;
  questionType: 'MCQ' | 'Written';
  selectedOptionIndex?: number;
  writtenAnswerText?: string;
  isCorrect?: boolean;
  marksAwarded?: number;
  teacherFeedback?: string;
}

export interface QuizSubmission {
  _id: string;
  submissionId: string;
  quizId: Quiz | string;
  studentId: StudentUser | string;
  classId: Class | string;
  subjectId: Subject | string;
  studentName: string;
  rollNumber: string;
  answers: QuizSubmissionAnswer[];
  mcqScore: number;
  writtenScore: number;
  totalScore: number;
  isGraded: boolean;
  submittedAt: string;
  isLate: boolean;
  status: 'Submitted' | 'Late' | 'Submitted Late — CR Approved';
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  _id: string;
  subjectId: Subject | string;
  classId?: Class | string;
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
  classId?: Class | string;
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
  groupName?: string | null;
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
  requestType: 'Submission' | 'GroupRegistration' | 'Quiz';
  studentId: string;
  groupId?: Group | string;
  subjectId: Subject | string;
  classId?: Class | string;
  assignmentId?: Assignment | string;
  quizId?: Quiz | string;
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

export interface CRApplication {
  _id: string;
  studentId: StudentUser | string;
  classId: Class | string;
  roleType: 'CR' | 'CR_ASSISTANT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
  appliedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'CR' | 'CR_ASSISTANT';
  assignedClassId?: Class | string;
  teacherAssignments?: TeacherAssignment[];
  isActive?: boolean;
  isEmailVerified?: boolean;
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
}

export interface StudentUser {
  id: string;
  name: string;
  email: string;
  rollNumber: string;
  classId?: Class | string;
  class?: Class;
  isEmailVerified: boolean;
  role: 'STUDENT';
  staffRole?: 'CR' | 'CR_ASSISTANT' | null;
  staffId?: string;
}

export interface RegisteredStudent {
  _id: string;
  name: string;
  email: string;
  rollNumber: string;
  classId?: Class | string;
  isEmailVerified: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalSubjects: number;
  totalAssignments: number;
  totalSubmissions: number;
  todaysSubmissions: number;
  lateSubmissions: number;
  totalClasses?: number;
  totalTeachers?: number;
  totalQuizzes?: number;
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
  cloudinarySecureUrl?: string;
  submittedAt: string;
  isLate: boolean;
  status: string;
  emailStatus: string;
}

export interface SharedAssignment {
  _id: string;
  assignmentId: Assignment;
  subjectId: Subject;
  classId?: Class;
  teacherId?: AdminUser;
  crId?: AdminUser;
  note?: string;
  shareZip: boolean;
  shareCsv: boolean;
  sharedAt: string;
  downloadCount: number;
  lastDownloadedAt?: string;
  submissionsCount?: number;
  createdAt: string;
  updatedAt: string;
}
