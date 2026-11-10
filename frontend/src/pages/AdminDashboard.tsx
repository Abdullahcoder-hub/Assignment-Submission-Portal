import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import api, { getApiErrorMessage, getDownloadErrorMessage } from '../api/axios';
import { Subject, Assignment, Submission, DashboardStats, Group, LateRequest, RegisteredStudent, Class } from '../types';
import { useAuth } from '../context/AuthContext';
import { ClassManagementSection } from '../components/ClassManagementSection';
import { TeacherAssignmentSection } from '../components/TeacherAssignmentSection';
import { StaffManagementSection } from '../components/StaffManagementSection';
import { QuizManagementSection } from '../components/QuizManagementSection';
import { CRApplicationsTab } from '../components/CRApplicationsTab';
import { TeacherSharedAssignmentsSection } from '../components/TeacherSharedAssignmentsSection';
import { ShareAssignmentModal } from '../components/ShareAssignmentModal';
import { StaffPasswordSettings } from '../components/StaffPasswordSettings';
import { createClientAssignmentExport } from '../utils/clientAssignmentExport';
import {
  LayoutDashboard,
  BookOpen,
  FileCheck,
  Inbox,
  Plus,
  Search,
  Download,
  FileSpreadsheet,
  Archive,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  FileText,
  KeyRound,
  Users,
  Check,
  X,
  Crown,
  UserCheck,
  UserX,
  GraduationCap,
  Shield,
  ShieldCheck,
  Share2,
  Menu,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { role } = useAuth();
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isTeacher = role === 'TEACHER';
  const isCR = role === 'CR';
  const isCRAssistant = role === 'CR_ASSISTANT';
  const isCROrAssistant = isCR || isCRAssistant;
  const canAccessTab = (tab: string) => {
    if (isSuperAdmin) return true;
    if (isCROrAssistant) {
      return ['dashboard', 'quizzes', 'subjects', 'assignments', 'submissions', 'groups', 'late-requests', 'students', 'settings', 'account'].includes(tab);
    }
    if (isTeacher) {
      return ['dashboard', 'quizzes', 'shared-assignments', 'subjects', 'assignments', 'submissions', 'groups', 'late-requests', 'account'].includes(tab);
    }
    return false;
  };

  const validTabs = [
    'dashboard',
    'classes',
    'teachers',
    'staff',
    'cr-applications',
    'quizzes',
    'shared-assignments',
    'subjects',
    'assignments',
    'submissions',
    'groups',
    'late-requests',
    'students',
    'settings',
    'account',
  ] as const;
  type TabType = typeof validTabs[number];


  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab') as TabType;
    if (validTabs.includes(tabFromUrl) && canAccessTab(tabFromUrl)) return tabFromUrl;
    const savedTab = localStorage.getItem('admin_active_tab') as TabType;
    const savedRole = localStorage.getItem('admin_active_tab_role');
    if (savedRole === role && validTabs.includes(savedTab) && canAccessTab(savedTab)) return savedTab;
    return 'dashboard';
  });

  const setActiveTab = (tab: TabType) => {
    if (!canAccessTab(tab)) {
      tab = 'dashboard';
    }
    setActiveTabState(tab);
    localStorage.setItem('admin_active_tab', tab);
    if (role) localStorage.setItem('admin_active_tab_role', role);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState(null, '', url.toString());
  };

  // Join Code state
  const [joinCode, setJoinCode] = useState<string>('');
  const [isJoinCodeActive, setIsJoinCodeActive] = useState<boolean>(true);
  const [joinCodeClass, setJoinCodeClass] = useState<Class | null>(null);
  const [sharingAssignment, setSharingAssignment] = useState<Assignment | null>(null);

  // Stats state with instant cache rehydration
  const [stats, setStats] = useState<DashboardStats | null>(() => {
    try {
      const cached = sessionStorage.getItem('admin_cached_stats');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>(() => {
    try {
      const cached = sessionStorage.getItem('admin_cached_recent_subs');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  // Subjects state with instant cache rehydration
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    try {
      const cached = sessionStorage.getItem('admin_cached_subjects');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [subjectModalOpen, setSubjectModalOpen] = useState<boolean>(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', description: '', crId: '', isActive: true });
  const [admins, setAdmins] = useState<any[]>([]);

  // Assignments state with instant cache rehydration
  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    try {
      const cached = sessionStorage.getItem('admin_cached_assignments');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [assignmentModalOpen, setAssignmentModalOpen] = useState<boolean>(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({
    subjectId: '',
    title: '',
    description: '',
    deadline: '',
    groupDeadline: '',
    allowLateSubmission: false,
    allowLateGroupRegistration: false,
    allowedFileTypes: 'pdf, doc, docx, ppt, pptx, zip',
    maxFileSize: 10,
    maxGroupSize: 4,
    minGroupSize: 1,
    submissionType: 'Group' as 'Individual' | 'Group',
    isActive: true,
  });

  // Submissions list state with instant cache rehydration
  const [submissions, setSubmissions] = useState<Submission[]>(() => {
    try {
      const cached = sessionStorage.getItem('admin_cached_submissions');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [assignmentSubmissionCounts, setAssignmentSubmissionCounts] = useState<{ assignmentId: string; submittedCount: number }[]>([]);
  const [loadingSubmissionSummary, setLoadingSubmissionSummary] = useState<boolean>(false);
  const [submissionSummaryLoaded, setSubmissionSummaryLoaded] = useState<boolean>(false);
  const [totalSubmissionsCount, setTotalSubmissionsCount] = useState<number>(0);
  const [exportingAssignmentId, setExportingAssignmentId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loadingSubmissions, setLoadingSubmissions] = useState<boolean>(() => {
    try {
      return !sessionStorage.getItem('admin_cached_submissions');
    } catch {
      return false;
    }
  });

  // Groups list state
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false);
  const [groupFilterSubject, setGroupFilterSubject] = useState<string>('');
  const [groupFilterAssignment, setGroupFilterAssignment] = useState<string>('');
  const [groupSearch, setGroupSearch] = useState<string>('');
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [adminGroupMembers, setAdminGroupMembers] = useState<{ name: string; rollNumber: string }[]>([]);
  const [adminGroupLeader, setAdminGroupLeader] = useState<string>('');
  const [adminGroupSaving, setAdminGroupSaving] = useState<boolean>(false);

  // Late Requests state
  const [lateRequests, setLateRequests] = useState<LateRequest[]>([]);
  const [loadingLateRequests, setLoadingLateRequests] = useState<boolean>(false);
  const [lateFilterSubject, setLateFilterSubject] = useState<string>('');
  const [lateFilterStatus, setLateFilterStatus] = useState<string>('');
  const [lateSearch, setLateSearch] = useState<string>('');
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');

  // Registered Students State
  const [registeredStudents, setRegisteredStudents] = useState<RegisteredStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [editingStudent, setEditingStudent] = useState<RegisteredStudent | null>(null);
  const [studentEditForm, setStudentEditForm] = useState({ name: '', rollNumber: '' });
  const [studentEditModalOpen, setStudentEditModalOpen] = useState<boolean>(false);
  const [resetPassStudentId, setResetPassStudentId] = useState<string | null>(null);

  // Defaulters State
  const [defaultersModalOpen, setDefaultersModalOpen] = useState<boolean>(false);
  const [selectedDefaulterAssignment, setSelectedDefaulterAssignment] = useState<Assignment | null>(null);
  const [defaultersList, setDefaultersList] = useState<any[]>([]);
  const [loadingDefaulters, setLoadingDefaulters] = useState<boolean>(false);

  // Filters state
  const [filterSubjectId, setFilterSubjectId] = useState<string>('');
  const [filterAssignmentId, setFilterAssignmentId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const isSidebarCollapsed = sidebarCollapsed && !mobileSidebarOpen;

  // Global notification banner
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // FETCH DASHBOARD STATS
  const fetchDashboardStats = async () => {
    try {
      const res = await api.get('/submissions/stats/dashboard');
      if (res.data.success) {
        setStats(res.data.stats);
        setRecentSubmissions(res.data.recentSubmissions);
        try {
          sessionStorage.setItem('admin_cached_stats', JSON.stringify(res.data.stats));
          sessionStorage.setItem('admin_cached_recent_subs', JSON.stringify(res.data.recentSubmissions));
        } catch {}
      }
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to load dashboard statistics.'));
    }
  };

  // FETCH SUBJECTS
  const fetchSubjects = async () => {
    try {
      const res = await api.get('/subjects?includeInactive=true');
      if (res.data.success) {
        setSubjects(res.data.subjects);
        try {
          sessionStorage.setItem('admin_cached_subjects', JSON.stringify(res.data.subjects));
        } catch {}
      }
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to fetch subjects list.'));
    }
  };

  // FETCH ASSIGNMENTS
  const fetchAssignments = async () => {
    try {
      const res = await api.get('/assignments');
      if (res.data.success) {
        setAssignments(res.data.assignments);
        try {
          sessionStorage.setItem('admin_cached_assignments', JSON.stringify(res.data.assignments));
        } catch {}
      }
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to fetch assignments list.'));
    }
  };

  // FETCH SUBMISSIONS
  const fetchSubmissions = async (page: number = 1) => {
    try {
      setLoadingSubmissions(!sessionStorage.getItem('admin_cached_submissions'));
      let query = `/submissions?page=${page}&limit=10`;
      if (filterAssignmentId) query += `&assignmentId=${filterAssignmentId}`;
      if (filterStatus) query += `&status=${filterStatus}`;

      const res = await api.get(query);
      if (res.data.success) {
        setSubmissions(res.data.submissions);
        setTotalSubmissionsCount(res.data.total);
        setCurrentPage(res.data.page);
        setTotalPages(res.data.pages);
        if (page === 1 && !filterAssignmentId && !filterStatus) {
          try {
            sessionStorage.setItem('admin_cached_submissions', JSON.stringify(res.data.submissions));
          } catch {}
        }
      }
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to fetch submissions.'));
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const fetchSubmissionSummary = async () => {
    setLoadingSubmissionSummary(true);
    setSubmissionSummaryLoaded(false);
    try {
      const res = await api.get('/submissions/summary');
      if (res.data.success) {
        setAssignmentSubmissionCounts(res.data.assignmentCounts || []);
        setSubmissionSummaryLoaded(true);
      } else {
        throw new Error('Failed to fetch submission summary.');
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404 && filterSubjectId) {
        try {
          const subjectAssignments = assignments.filter((assignment) => {
            const subjectId = typeof assignment.subjectId === 'string'
              ? assignment.subjectId
              : assignment.subjectId?._id;
            return subjectId === filterSubjectId;
          });
          const counts = await Promise.all(subjectAssignments.map(async (assignment) => {
            const response = await api.get(
              `/submissions?assignmentId=${encodeURIComponent(assignment._id)}&limit=1`,
            );
            if (!response.data.success || !Number.isFinite(response.data.total)) {
              throw new Error('The backend returned an invalid submission count.');
            }
            return {
              assignmentId: assignment._id,
              submittedCount: response.data.total,
            };
          }));
          setAssignmentSubmissionCounts((current) => [
            ...current.filter((entry) => !subjectAssignments.some(
              (assignment) => assignment._id === entry.assignmentId,
            )),
            ...counts,
          ]);
          setSubmissionSummaryLoaded(true);
        } catch (fallbackError) {
          showToast('error', getApiErrorMessage(fallbackError, 'Failed to fetch submission counts.'));
        }
      } else {
        showToast('error', getApiErrorMessage(err, 'Failed to fetch submission summary.'));
      }
    } finally {
      setLoadingSubmissionSummary(false);
    }
  };

  // FETCH GROUPS
  const fetchGroups = async () => {
    try {
      setLoadingGroups(true);
      let query = '/groups?';
      if (groupFilterSubject) query += `subjectId=${groupFilterSubject}&`;
      if (groupFilterAssignment) query += `assignmentId=${groupFilterAssignment}&`;
      if (groupFilterAssignment && groupSearch) query += `search=${encodeURIComponent(groupSearch.trim())}&`;
      const res = await api.get(query);
      if (res.data.success) {
        setGroups(res.data.groups);
      }
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to fetch groups list.'));
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!window.confirm(`Are you sure you want to delete group "${groupName}"?`)) return;
    try {
      const res = await api.delete(`/groups/${groupId}`);
      if (res.data.success) {
        showToast('success', res.data.message);
        fetchGroups();
      }
    } catch (err: any) {
      showToast('error', getApiErrorMessage(err, 'Failed to delete group.'));
    }
  };

  const openGroupEditor = (group: Group) => {
    setEditingGroup(group);
    setAdminGroupMembers(group.members.map((member) => ({ name: member.name, rollNumber: member.rollNumber })));
    setAdminGroupLeader(group.leader?.rollNumber || group.members[0]?.rollNumber || '');
  };

  const handleAdminGroupSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingGroup) return;
    try {
      setAdminGroupSaving(true);
      const res = await api.put(`/groups/${editingGroup._id}`, {
        groupName: editingGroup.groupName,
        leaderRollNumber: adminGroupLeader,
        members: adminGroupMembers.filter((member) => member.rollNumber.trim()),
      });
      if (res.data.success) {
        showToast('success', res.data.message);
        setEditingGroup(null);
        fetchGroups();
      }
    } catch (err: any) {
      showToast('error', getApiErrorMessage(err, 'Failed to update group.'));
    } finally {
      setAdminGroupSaving(false);
    }
  };

  // FETCH LATE REQUESTS
  const fetchLateRequests = async () => {
    try {
      setLoadingLateRequests(true);
      let query = '/late-requests?';
      if (lateFilterSubject) query += `subjectId=${lateFilterSubject}&`;
      if (lateFilterStatus) query += `status=${lateFilterStatus}&`;
      if (lateSearch) query += `search=${encodeURIComponent(lateSearch.trim())}&`;
      const res = await api.get(query);
      if (res.data.success) {
        setLateRequests(res.data.requests);
      }
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to fetch late submission requests.'));
    } finally {
      setLoadingLateRequests(false);
    }
  };

  const handleLateDecision = async (id: string, decision: 'Approved' | 'Rejected', rejectionReason?: string) => {
    try {
      const payload: any = { decision };
      if (decision === 'Rejected' && rejectionReason) {
        payload.rejectionReason = rejectionReason;
      }
      const res = await api.patch(`/late-requests/${id}/decision`, payload);
      if (res.data.success) {
        showToast('success', res.data.message);
        fetchLateRequests();
      }
    } catch (err: any) {
      showToast('error', getApiErrorMessage(err, 'Failed to update decision.'));
    }
  };

  const handleGrantFourthQuizAttempt = async (request: LateRequest) => {
    const quizId = typeof request.quizId === 'object' && request.quizId ? request.quizId._id : request.quizId;
    if (!quizId) return;
    try {
      const res = await api.patch(`/quizzes/${quizId}/attempts/${request.studentId}/unlock`);
      if (res.data.success) {
        showToast('success', 'Fourth quiz attempt allowed. The student can resume the quiz.');
        fetchLateRequests();
      }
    } catch (err: any) {
      showToast('error', getApiErrorMessage(err, 'Failed to allow a fourth quiz attempt.'));
    }
  };

  // FETCH REGISTERED STUDENTS
  const fetchStudents = async () => {
    try {
      setLoadingStudents(true);
      let query = '/admin/students?';
      if (studentSearch) query += `search=${encodeURIComponent(studentSearch.trim())}&`;
      const res = await api.get(query);
      if (res.data.success) {
        setRegisteredStudents(res.data.students);
      }
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to fetch registered students list.'));
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    const cleanRoll = studentEditForm.rollNumber.trim();
    if (!/^\d{7}$/.test(cleanRoll)) {
      showToast('error', 'Roll number must be exactly 7 digits (e.g. 2260000).');
      return;
    }
    try {
      const res = await api.put(`/admin/students/${editingStudent._id}`, {
        name: studentEditForm.name.trim(),
        rollNumber: cleanRoll,
      });
      if (res.data.success) {
        showToast('success', res.data.message);
        setStudentEditModalOpen(false);
        fetchStudents();
      }
    } catch (err: any) {
      showToast('error', getApiErrorMessage(err, 'Failed to update student details.'));
    }
  };

  const handleResetStudentPassword = async (student: RegisteredStudent) => {
    setResetPassStudentId(student._id);
    try {
      const res = await api.patch(`/admin/students/${student._id}/reset-password`);
      if (res.data.success) {
        showToast('success', res.data.message);
      }
    } catch (err: any) {
      showToast('error', getApiErrorMessage(err, 'Failed to send password reset email.'));
    } finally {
      setResetPassStudentId(null);
    }
  };

  const handleDeleteStudent = async (studentId: string, studentName: string, rollNumber: string) => {
    if (!window.confirm(`Delete student account for "${studentName}" (${rollNumber})? This will also delete their submission records.`)) return;
    try {
      const res = await api.delete(`/admin/students/${studentId}`);
      if (res.data.success) {
        showToast('success', res.data.message);
        fetchStudents();
      }
    } catch (err: any) {
      showToast('error', getApiErrorMessage(err, 'Failed to delete student.'));
    }
  };

  // FETCH DEFAULTERS
  const fetchDefaulters = async (assignment: Assignment) => {
    try {
      setSelectedDefaulterAssignment(assignment);
      setDefaultersModalOpen(true);
      setLoadingDefaulters(true);
      const res = await api.get(`/submissions/defaulters/${assignment._id}`);
      if (res.data.success) {
        setDefaultersList(res.data.defaulters);
      }
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to fetch defaulters list.'));
    } finally {
      setLoadingDefaulters(false);
    }
  };

  const handleExportDefaultersCsv = async (assignmentId: string, title: string) => {
    try {
      showToast('success', `Exporting defaulters CSV for ${title}...`);
      const response = await api.get(`/submissions/defaulters/${assignmentId}/export-csv`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Defaulters_${title}_Unsubmitted.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to export defaulters CSV.'));
    }
  };

  const [customJoinInput, setCustomJoinInput] = useState<string>('');
  const [isEditingCode, setIsEditingCode] = useState<boolean>(false);

  const fetchJoinCode = async () => {
    try {
      const response = await api.get('/classes');
      const assignedClass = (response.data.classes || [])[0] as Class | undefined;
      if (!assignedClass) {
        setJoinCodeClass(null);
        showToast('error', 'No class is assigned to this CR account.');
        return;
      }
      setJoinCodeClass(assignedClass);
      setJoinCode(assignedClass.joinCode);
      setCustomJoinInput(assignedClass.joinCode);
      setIsJoinCodeActive(assignedClass.isJoinCodeActive);
    } catch (error: any) {
      showToast('error', getApiErrorMessage(error, 'Failed to fetch your class join code.'));
    }
  };

  const handleUpdateJoinCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customJoinInput.trim()) {
      showToast('error', 'Join code cannot be empty.');
      return;
    }
    try {
      if (!joinCodeClass) return;
      const res = await api.put(`/classes/${joinCodeClass._id}/join-code`, { joinCode: customJoinInput.trim() });
      if (res.data.success) {
        setJoinCode(res.data.joinCode);
        setCustomJoinInput(res.data.joinCode);
        setIsJoinCodeActive(true);
        setIsEditingCode(false);
        showToast('success', res.data.message);
      }
    } catch (err: any) {
      showToast('error', getApiErrorMessage(err, 'Failed to update join code.'));
    }
  };

  const handleRegenerateJoinCode = async () => {
    if (!window.confirm('Regenerate Class Join Code? Old code will stop working.')) return;
    try {
      if (!joinCodeClass) return;
      const res = await api.post(`/classes/${joinCodeClass._id}/regenerate-code`);
      if (res.data.success) {
        setJoinCode(res.data.joinCode);
        setCustomJoinInput(res.data.joinCode);
        setIsJoinCodeActive(res.data.isJoinCodeActive);
        showToast('success', res.data.message);
      }
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to regenerate join code.'));
    }
  };

  const handleToggleJoinCode = async () => {
    try {
      if (!joinCodeClass) return;
      const res = await api.post(`/classes/${joinCodeClass._id}/toggle-code`);
      if (res.data.success) {
        setIsJoinCodeActive(res.data.isJoinCodeActive);
        showToast('success', res.data.message);
      }
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to toggle join code.'));
    }
  };

  const refreshAdminData = async () => {
    await Promise.all([fetchDashboardStats(), fetchSubjects(), fetchAssignments()]);
  };

  const fetchAdmins = async () => {
    try {
      const res = await api.get('/admin/admins');
      if (res.data.success) {
        setAdmins(res.data.admins || []);
      }
    } catch (err) {
      console.error('Failed to fetch admins:', err);
    }
  };

  useEffect(() => {
    fetchSubjects();
    fetchAssignments();
    if (isSuperAdmin) fetchAdmins();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (activeTab === 'dashboard') fetchDashboardStats();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'settings' && isCROrAssistant) fetchJoinCode();
  }, [activeTab, isCROrAssistant]);

  useEffect(() => {
    if (activeTab === 'submissions') {
      fetchSubmissions(currentPage);
    } else if (activeTab === 'groups') {
      fetchGroups();
    } else if (activeTab === 'late-requests') {
      fetchLateRequests();
    } else if (activeTab === 'students') {
      fetchStudents();
    }
  }, [activeTab, currentPage, filterAssignmentId, filterStatus, groupFilterSubject, groupFilterAssignment, groupSearch, lateFilterSubject, lateFilterStatus, lateSearch, studentSearch]);

  useEffect(() => {
    if (activeTab === 'submissions' && filterSubjectId) fetchSubmissionSummary();
  }, [activeTab, filterSubjectId]);

  // SUBJECT MODAL SUBMIT
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSubject) {
        const res = await api.put(`/subjects/${editingSubject._id}`, subjectForm);
        if (res.data.success) {
          showToast('success', 'Subject updated successfully.');
          await refreshAdminData();
          setSubjectModalOpen(false);
        }
      } else {
        const res = await api.post('/subjects', subjectForm);
        if (res.data.success) {
          showToast('success', 'Subject created successfully.');
          await refreshAdminData();
          setSubjectModalOpen(false);
        }
      }
    } catch (err: any) {
      showToast('error', getApiErrorMessage(err, 'Failed to save subject.'));
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!window.confirm('Delete this subject permanently, including its assignments and submissions?')) return;
    try {
      const res = await api.delete(`/subjects/${id}`);
      if (res.data.success) {
        showToast('success', res.data.message);
        setFilterSubjectId('');
        setLateFilterSubject('');
        setGroupFilterSubject('');
        setGroupFilterAssignment('');
        await refreshAdminData();
      }
    } catch (err: any) {
      showToast('error', getApiErrorMessage(err, 'Failed to delete subject.'));
    }
  };

  // ASSIGNMENT MODAL SUBMIT
  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const allowedArray = assignmentForm.allowedFileTypes
        .split(',')
        .map((s) => s.trim().replace('.', '').toLowerCase())
        .filter(Boolean);

      const payload = {
        ...assignmentForm,
        deadline: new Date(assignmentForm.deadline).toISOString(),
        groupDeadline: assignmentForm.groupDeadline
          ? new Date(assignmentForm.groupDeadline).toISOString()
          : undefined,
        allowedFileTypes: allowedArray,
        maxFileSize: Number(assignmentForm.maxFileSize),
        maxGroupSize: Number(assignmentForm.maxGroupSize),
        minGroupSize: Number(assignmentForm.minGroupSize),
      };

      if (editingAssignment) {
        const res = await api.put(`/assignments/${editingAssignment._id}`, payload);
        if (res.data.success) {
          showToast('success', 'Assignment updated successfully.');
          await refreshAdminData();
          setAssignmentModalOpen(false);
        }
      } else {
        const res = await api.post('/assignments', payload);
        if (res.data.success) {
          showToast('success', 'Assignment created successfully.');
          await refreshAdminData();
          setAssignmentModalOpen(false);
        }
      }
    } catch (err: any) {
      showToast('error', getApiErrorMessage(err, 'Failed to save assignment.'));
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!window.confirm('Delete this assignment permanently, including its submissions? This action cannot be undone.')) return;
    try {
      const res = await api.delete(`/assignments/${id}`);
      if (res.data.success) {
        showToast('success', res.data.message);
        setFilterAssignmentId('');
        await refreshAdminData();
      }
    } catch (err: any) {
      showToast('error', getApiErrorMessage(err, 'Failed to delete assignment.'));
    }
  };

  // SINGLE FILE DOWNLOAD
  const handleDownloadSingle = async (submissionId: string, filename: string, cloudinaryUrl?: string) => {
    try {
      showToast('success', `Initiating file download...`);
      const response = await api.get(`/submissions/${submissionId}/download`, {
        responseType: 'blob',
      });
      const contentType = (response.headers['content-type'] as string) || 'application/octet-stream';
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (err) {
      if (cloudinaryUrl) {
        window.open(cloudinaryUrl, '_blank');
        showToast('success', 'Opening file directly in browser...');
      } else {
        showToast('error', getApiErrorMessage(err, 'Failed to download file.'));
      }
    }
  };

  // ZIP DOWNLOAD
  const handleDownloadZip = async (assignmentId: string) => {
    if (exportingAssignmentId) return;
    setExportingAssignmentId(assignmentId);
    try {
      showToast('success', 'Preparing submissions on this device. Please keep this page open.');
      await createClientAssignmentExport(assignmentId, (completed, total) => {
        showToast('success', `Processing PDF ${completed} of ${total} on this device...`);
      });
      showToast('success', 'Assignment PDFs ZIP downloaded successfully.');
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showToast('error', await getDownloadErrorMessage(err, 'Failed to download ZIP file.'));
    } finally {
      setExportingAssignmentId(null);
    }
  };

  // CSV EXPORT
  const handleExportCsv = async (assignmentId: string) => {
    try {
      showToast('success', 'Exporting CSV file...');
      const response = await api.get(`/assignments/${assignmentId}/submissions/export-csv`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Submissions_Export.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to export CSV.'));
    }
  };

  // GROUP CSV EXPORT
  const handleExportGroupsCsv = async () => {
    try {
      showToast('success', 'Exporting Groups CSV...');
      let urlStr = '/groups/export-csv';
      const params = new URLSearchParams();
      if (groupFilterSubject) params.set('subjectId', groupFilterSubject);
      if (groupFilterAssignment) params.set('assignmentId', groupFilterAssignment);
      if (params.toString()) urlStr += `?${params.toString()}`;
      const response = await api.get(urlStr, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Registered_Groups.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to export Groups CSV.'));
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const toLocalDateTimeInput = (date: Date) => {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
  };
  
  const assignmentStatus = (assignment: Assignment) => {
    if (!assignment.isActive) return 'Closed';
    if (new Date() > new Date(assignment.deadline)) return 'Deadline Passed';
    return 'Active';
  };

  const renderStatusBadge = (status: string) => {
    if (status === 'Active') {
      return <span className="px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full">Active</span>;
    }
    if (status === 'Deadline Passed') {
      return <span className="px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-800 rounded-full">Deadline Passed</span>;
    }
    return <span className="px-2.5 py-1 text-xs font-bold bg-slate-200 text-slate-600 rounded-full">Closed</span>;
  };

  useEffect(() => {
    const collapseOnOutsideClick = (event: PointerEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setSidebarCollapsed(true);
        setMobileSidebarOpen(false);
      }
    };
    document.addEventListener('pointerdown', collapseOnOutsideClick);
    return () => document.removeEventListener('pointerdown', collapseOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileSidebarOpen(false);
    };
    const closeOnDesktop = () => {
      if (window.innerWidth >= 768) setMobileSidebarOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnDesktop);
    };
  }, [mobileSidebarOpen]);

  return (
    <div className="admin-dashboard min-h-[90vh] flex flex-col md:flex-row bg-transparent min-w-0">
      {/* SIDEBAR */}
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        className={`fixed left-3 top-3 md:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#D6A84F]/40 bg-[#D6A84F] text-[#0B1F3A] shadow-sm ${mobileSidebarOpen ? 'z-30' : 'z-[60]'}`}
        aria-label="Open staff navigation"
        aria-expanded={mobileSidebarOpen}
        aria-controls="admin-dashboard-navigation"
      >
        <Menu className="h-5 w-5" />
      </button>
      {mobileSidebarOpen && (
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-x-0 top-16 bottom-0 z-40 bg-slate-950/45 md:hidden"
          aria-label="Close staff navigation"
        />
      )}
      <aside
        id="admin-dashboard-navigation"
        ref={sidebarRef}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') setSidebarCollapsed(false);
        }}
        onPointerLeave={() => setSidebarCollapsed(true)}
        data-collapsed={isSidebarCollapsed}
        className={`glass-panel-dark fixed left-0 top-16 bottom-0 z-[60] mt-0 h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] w-[min(80vw,300px)] max-w-[300px] overflow-y-auto border-r border-white/10 text-slate-300 backdrop-blur-xl transition-[width,transform] duration-300 ease-out md:sticky md:top-16 md:bottom-auto md:z-auto md:mt-0 md:h-[calc(100vh-4rem)] md:max-h-none md:max-w-none md:translate-x-0 md:overflow-y-visible ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${
          sidebarCollapsed ? 'md:w-16' : 'md:w-64'
        }`}
      >
        <div className={`min-h-[4.5rem] p-5 border-b border-white/10 flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isSidebarCollapsed && <div className="min-w-0"><h2 className="text-xs uppercase tracking-wider text-blue-400 font-bold">Staff Portal</h2><p className="text-sm font-semibold text-white mt-1">Management Suite</p></div>}
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="Close staff navigation"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            className="hidden md:block p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav
          onClickCapture={() => setMobileSidebarOpen(false)}
          className={`p-3 ${isSidebarCollapsed ? 'grid grid-cols-3 md:grid-cols-1 gap-1' : 'space-y-1'}`}
        >
          <button
            onClick={() => setActiveTab('dashboard')}
            title={isSidebarCollapsed ? 'Dashboard' : undefined}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
              activeTab === 'dashboard'
                ? 'bg-gradient-to-r from-blue-600 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'hover:bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>

          {isSuperAdmin && (
            <>
              <button
                onClick={() => setActiveTab('classes')}
                title={isSidebarCollapsed ? 'Classes & Sections' : undefined}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                  activeTab === 'classes'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'hover:bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <GraduationCap className="w-5 h-5" />
                Classes &amp; Sections
              </button>

              <button
                onClick={() => setActiveTab('teachers')}
                title={isSidebarCollapsed ? 'Teacher Assignments' : undefined}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                  activeTab === 'teachers'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'hover:bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
                Teacher Assignments
              </button>

              <button
                onClick={() => setActiveTab('staff')}
                title={isSidebarCollapsed ? 'Staff Management' : undefined}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                  activeTab === 'staff'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'hover:bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <Shield className="w-5 h-5" />
                Staff Management
              </button>

              <button
                onClick={() => setActiveTab('cr-applications')}
                title={isSidebarCollapsed ? 'CR Applications' : undefined}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                  activeTab === 'cr-applications'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'hover:bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <Crown className="w-5 h-5" />
                CR Applications
              </button>
            </>
          )}

          {!isSuperAdmin && (
            <button
              onClick={() => setActiveTab('quizzes')}
              title={isSidebarCollapsed ? 'Quizzes (MCQ & Written)' : undefined}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                activeTab === 'quizzes'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'hover:bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-5 h-5" />
              Quizzes (MCQ &amp; Written)
            </button>
          )}

          {isTeacher && (
            <button
              onClick={() => setActiveTab('shared-assignments')}
              title={isSidebarCollapsed ? 'Shared Assignments' : undefined}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                activeTab === 'shared-assignments'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'hover:bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Archive className="w-5 h-5" />
              Shared Assignments
            </button>
          )}

          {isCROrAssistant && (
            <>
              <button
                onClick={() => setActiveTab('subjects')}
                title={isSidebarCollapsed ? 'Subjects' : undefined}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                  activeTab === 'subjects'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'hover:bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-5 h-5" />
                Subjects ({subjects.length})
              </button>

              <button
                onClick={() => setActiveTab('assignments')}
                title={isSidebarCollapsed ? 'Assignments' : undefined}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                  activeTab === 'assignments'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'hover:bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <FileCheck className="w-5 h-5" />
                Assignments ({assignments.length})
              </button>

              <button
                onClick={() => setActiveTab('submissions')}
                title={isSidebarCollapsed ? 'Submissions' : undefined}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                  activeTab === 'submissions'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'hover:bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <Inbox className="w-5 h-5" />
                Submissions
              </button>

              <button
                onClick={() => setActiveTab('groups')}
                title={isSidebarCollapsed ? 'Group Registrations' : undefined}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                  activeTab === 'groups'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'hover:bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-5 h-5" />
                Group Registrations
              </button>

              <button
                onClick={() => setActiveTab('late-requests')}
                title={isSidebarCollapsed ? 'Late Requests' : undefined}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                  activeTab === 'late-requests'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'hover:bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-5 h-5" />
                Late Requests
              </button>

              <button
                onClick={() => setActiveTab('students')}
                title={isSidebarCollapsed ? 'Registered Students' : undefined}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                  activeTab === 'students'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'hover:bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <UserCheck className="w-5 h-5" />
                Registered Students
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                title={isSidebarCollapsed ? 'Class Join Code' : undefined}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                  activeTab === 'settings'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'hover:bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-5 h-5" />
                Class Join Code
              </button>
            </>
          )}

          {!isSuperAdmin && (
            <button
              onClick={() => setActiveTab('account')}
              title={isSidebarCollapsed ? 'My Password' : undefined}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                activeTab === 'account'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'hover:bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-5 h-5" />
              My Password
            </button>
          )}
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 min-w-0 w-full p-4 sm:p-6 lg:p-8 max-w-7xl">
        {/* Toast Notification */}
        {toastMessage && (
          <div
            className={`mb-6 p-4 rounded-2xl text-sm font-medium flex items-center gap-3 border shadow-lg backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30'
                : 'bg-red-500/10 text-red-800 border-red-500/30'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* 1. DASHBOARD OVERVIEW TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {isSuperAdmin ? (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Super Admin Control Center</h1>
                  <p className="text-slate-500 text-sm">
                    Manage classes, teacher subject assignments, staff approvals, and CR applications.
                  </p>
                </div>

                <div className="dashboard-stat-grid grid grid-cols-1 min-[375px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('classes')}
                    className="text-left glass-panel p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between cursor-pointer card-3d hover:border-blue-300 transition group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold uppercase text-slate-500 group-hover:text-blue-600 transition">Classes</span>
                      <div className="p-2 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white rounded-xl text-blue-600 transition shadow-sm">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs text-slate-500">Manage semesters &amp; sections</p>
                      <p className="text-sm font-bold text-blue-600 mt-1">Open Classes &rarr;</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('teachers')}
                    className="text-left glass-panel p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between cursor-pointer card-3d hover:border-blue-300 transition group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold uppercase text-slate-500 group-hover:text-blue-600 transition">Teacher Assignments</span>
                      <div className="p-2 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white rounded-xl text-blue-600 transition shadow-sm">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs text-slate-500">Link teachers to class + subject</p>
                      <p className="text-sm font-bold text-blue-600 mt-1">Assign Teachers &rarr;</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('staff')}
                    className="text-left glass-panel p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between cursor-pointer card-3d hover:border-blue-300 transition group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold uppercase text-slate-500 group-hover:text-blue-600 transition">Staff &amp; CR Accounts</span>
                      <div className="p-2 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white rounded-xl text-blue-600 transition shadow-sm">
                        <Shield className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs text-slate-500">Approve &amp; manage staff accounts</p>
                      <p className="text-sm font-bold text-blue-600 mt-1">Manage Staff &rarr;</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('cr-applications')}
                    className="text-left glass-panel p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between cursor-pointer card-3d hover:border-amber-300 transition group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold uppercase text-slate-500 group-hover:text-amber-600 transition">CR Requests</span>
                      <div className="p-2 bg-amber-50 group-hover:bg-amber-600 group-hover:text-white rounded-xl text-amber-600 transition shadow-sm">
                        <Crown className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs text-slate-500">Review student CR applications</p>
                      <p className="text-sm font-bold text-amber-600 mt-1">Review Requests &rarr;</p>
                    </div>
                  </button>
                </div>
              </div>
            ) : isTeacher ? (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Teacher Portal</h1>
                  <p className="text-slate-500 text-sm">
                    Manage quizzes and grading for your assigned subjects and classes.
                  </p>
                </div>

                <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Quiz &amp; Examination Management</h2>
                      <p className="text-xs text-slate-500">Create MCQs, Written quizzes, and grade student submissions.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('quizzes')}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition"
                  >
                    Go to Quizzes &rarr;
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Class CR Dashboard</h1>
                  <p className="text-slate-500 text-sm">Real-time statistics for class assignment submissions.</p>
                </div>

                {/* Stats Grid */}
                <div className="dashboard-stat-grid grid grid-cols-1 min-[375px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('subjects')}
                    className="text-left glass-panel p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between cursor-pointer card-3d hover:border-blue-300 transition group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold uppercase text-slate-500 group-hover:text-blue-600 transition">Subjects</span>
                      <div className="p-2 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white rounded-xl text-blue-600 transition shadow-sm">
                        <BookOpen className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2">
                      {stats ? stats.totalSubjects : 0}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('assignments')}
                    className="text-left glass-panel p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between cursor-pointer card-3d hover:border-blue-300 transition group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold uppercase text-slate-500 group-hover:text-blue-600 transition">Assignments</span>
                      <div className="p-2 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white rounded-xl text-blue-600 transition shadow-sm">
                        <FileCheck className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2">
                      {stats ? stats.totalAssignments : 0}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFilterStatus('');
                      setActiveTab('submissions');
                    }}
                    className="text-left glass-panel p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between cursor-pointer card-3d hover:border-emerald-300 transition group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold uppercase text-slate-500 group-hover:text-emerald-600 transition">Total Submissions</span>
                      <div className="p-2 bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white rounded-xl text-emerald-600 transition shadow-sm">
                        <Inbox className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2">
                      {stats ? stats.totalSubmissions : 0}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFilterStatus('');
                      setActiveTab('submissions');
                    }}
                    className="text-left glass-panel p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between cursor-pointer card-3d hover:border-amber-300 transition group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold uppercase text-slate-500 group-hover:text-amber-600 transition">Today</span>
                      <div className="p-2 bg-amber-50 group-hover:bg-amber-600 group-hover:text-white rounded-xl text-amber-600 transition shadow-sm">
                        <Calendar className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2">
                      {stats ? stats.todaysSubmissions : 0}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFilterStatus('Late');
                      setActiveTab('submissions');
                    }}
                    className="text-left glass-panel p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between cursor-pointer card-3d hover:border-red-300 transition group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold uppercase text-slate-500 group-hover:text-red-600 transition">Late Submissions</span>
                      <div className="p-2 bg-red-50 group-hover:bg-red-600 group-hover:text-white rounded-xl text-red-600 transition shadow-sm">
                        <Clock className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2">
                      {stats ? stats.lateSubmissions : 0}
                    </div>
                  </button>
                </div>

                {/* Recent Submissions Table */}
                <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">Recent Submissions</h3>
                    <button
                      onClick={() => setActiveTab('submissions')}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      View All Submissions &rarr;
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="hidden sm:table w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold text-xs uppercase">
                          <th className="p-3">Student</th>
                          <th className="p-3">Roll #</th>
                          <th className="p-3">Subject</th>
                          <th className="p-3">Assignment</th>
                          <th className="p-3">Submitted At</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recentSubmissions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-6 text-slate-400">
                              No recent submissions recorded yet.
                            </td>
                          </tr>
                        ) : (
                          recentSubmissions.map((sub) => (
                            <tr key={sub._id} className="hover:bg-slate-50/80">
                              <td className="p-3 font-semibold text-slate-900">{sub.studentName}</td>
                              <td className="p-3 font-mono font-medium text-slate-700">{sub.rollNumber}</td>
                              <td className="p-3 font-medium text-slate-700">
                                {(sub.subjectId as any)?.name || 'Subject'}
                              </td>
                              <td className="p-3 font-medium text-slate-700">
                                {(sub.assignmentId as any)?.title || 'Assignment'}
                              </td>
                              <td className="p-3 text-slate-500 text-xs">{formatDate(sub.submittedAt)}</td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-md">
                                  {sub.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    <div className="sm:hidden divide-y divide-slate-100">
                      {recentSubmissions.length === 0 ? (
                        <p className="py-6 text-center text-sm text-slate-400">No recent submissions recorded yet.</p>
                      ) : (
                        recentSubmissions.map((sub) => (
                          <div key={sub._id} className="p-3 space-y-1.5">
                            <div className="flex justify-between gap-2">
                              <p className="font-bold text-slate-900 break-words">{sub.studentName}</p>
                              <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-md">
                                {sub.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 break-words">
                              {sub.rollNumber} &bull; {(sub.subjectId as any)?.name || 'Subject'}
                            </p>
                            <p className="text-xs font-semibold text-slate-700 break-words">
                              {(sub.assignmentId as any)?.title || 'Assignment'}
                            </p>
                            <p className="text-[11px] text-slate-500">{formatDate(sub.submittedAt)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* CR APPLICATIONS TAB */}
        {activeTab === 'cr-applications' && isSuperAdmin && <CRApplicationsTab />}

        {/* 2. SUBJECTS TAB */}
        {activeTab === 'subjects' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Subject Management</h1>
                <p className="text-slate-500 text-sm">Configure subjects for student submissions.</p>
              </div>
              <button
                onClick={() => {
                  setEditingSubject(null);
                  setSubjectForm({ name: '', code: '', description: '', crId: '', isActive: true });
                  setSubjectModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow transition"
              >
                <Plus className="w-4 h-4" /> Add Subject
              </button>
            </div>

            <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-x-auto">
              <table className="hidden sm:table w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold text-xs uppercase">
                    <th className="p-4">Code</th>
                    <th className="p-4">Subject Name</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjects.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400">
                        No subjects created yet. Click 'Add Subject' to create one.
                      </td>
                    </tr>
                  ) : (
                    subjects.map((sub) => (
                      <tr key={sub._id} className="hover:bg-slate-50/80">
                        <td className="p-4 font-mono font-bold text-blue-700">{sub.code}</td>
                        <td className="p-4 font-bold text-slate-900">{sub.name}</td>
                        <td className="p-4 text-slate-500 text-xs max-w-xs truncate">
                          {sub.description || 'No description'}
                        </td>
                        <td className="p-4">
                          {sub.isActive ? (
                            <span className="px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full">
                              Active
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 text-xs font-bold bg-slate-200 text-slate-600 rounded-full">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingSubject(sub);
                              setSubjectForm({
                                name: sub.name,
                                code: sub.code,
                                description: sub.description || '',
                                crId: (sub as any).crId || '',
                                isActive: sub.isActive,
                              });
                              setSubjectModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSubject(sub._id)}
                            className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="divide-y divide-slate-100 sm:hidden">
                {subjects.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-400">No subjects created yet. Click 'Add Subject' to create one.</div>
                ) : (
                  subjects.map((sub) => (
                    <article key={sub._id} className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold text-blue-700">{sub.code}</p>
                        <h3 className="break-words font-bold text-slate-900">{sub.name}</h3>
                        <p className="mt-1 break-words text-xs text-slate-500">{sub.description || 'No description'}</p>
                        <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${sub.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                          {sub.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          aria-label={`Edit ${sub.name}`}
                          onClick={() => {
                            setEditingSubject(sub);
                            setSubjectForm({ name: sub.name, code: sub.code, description: sub.description || '', crId: (sub as any).crId || '', isActive: sub.isActive });
                            setSubjectModalOpen(true);
                          }}
                          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                        ><Edit2 className="h-4 w-4" /></button>
                        <button type="button" aria-label={`Delete ${sub.name}`} onClick={() => handleDeleteSubject(sub._id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. ASSIGNMENTS TAB */}
        {activeTab === 'assignments' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Assignment Management</h1>
                <p className="text-slate-500 text-sm">Create and configure class assignments and deadlines.</p>
              </div>
              <button
                onClick={() => {
                  setEditingAssignment(null);
                  setAssignmentForm({
                    subjectId: subjects[0]?._id || '',
                    title: '',
                    description: '',
                    deadline: toLocalDateTimeInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
                    groupDeadline: toLocalDateTimeInput(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)),
                    allowLateSubmission: false,
                    allowLateGroupRegistration: false,
                    allowedFileTypes: 'pdf, doc, docx, ppt, pptx, zip',
                    maxFileSize: 10,
                    maxGroupSize: 4,
                    minGroupSize: 1,
                    submissionType: 'Group',
                    isActive: true,
                  });
                  setAssignmentModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow transition"
              >
                <Plus className="w-4 h-4" /> Create Assignment
              </button>
            </div>

            <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-x-auto">
              <table className="assignment-table hidden sm:table w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold text-xs uppercase">
                    <th className="p-4">Subject</th>
                    <th className="p-4">Title</th>
                    <th className="p-4">Deadline</th>
                    <th className="p-4">Submission Mode</th>
                    <th className="p-4">Late Allowed</th>
                    <th className="p-4">Allowed Files</th>
                    <th className="p-4">Max Size</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-slate-400">
                        No assignments created yet. Click 'Create Assignment' to create one.
                      </td>
                    </tr>
                  ) : (
                    assignments.map((ass) => (
                      <tr key={ass._id} className="hover:bg-slate-50/80">
                        <td className="p-4 font-bold text-blue-700">
                          {(ass.subjectId as any)?.name || 'N/A'} ({(ass.subjectId as any)?.code || ''})
                        </td>
                        <td className="p-4 font-bold text-slate-900">{ass.title}</td>
                        <td className="p-4 text-xs font-semibold text-slate-700">{formatDate(ass.deadline)}</td>
                        <td className="p-4 text-xs">
                          {ass.submissionType === 'Individual' ? (
                            <span className="px-2 py-0.5 font-bold bg-slate-100 text-slate-700 rounded-md">
                              Individual Only
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 font-bold bg-blue-100 text-blue-800 rounded-md">
                              Group (Max {ass.maxGroupSize || 4})
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-xs">
                          {ass.allowLateSubmission ? (
                            <span className="font-bold text-emerald-700">Yes</span>
                          ) : (
                            <span className="font-bold text-red-700">No</span>
                          )}
                        </td>
                        <td className="p-4 text-xs font-mono font-medium text-slate-600">
                          {ass.allowedFileTypes.join(', ').toUpperCase()}
                        </td>
                        <td className="p-4 text-xs font-bold text-slate-700">{ass.maxFileSize} MB</td>
                        <td className="p-4">
                          {renderStatusBadge(assignmentStatus(ass))}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            title="Share Submissions with Teacher"
                            onClick={() => setSharingAssignment(ass)}
                            className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button
                            title="Download All as ZIP"
                            onClick={() => handleDownloadZip(ass._id)}
                            disabled={exportingAssignmentId !== null}
                            className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition disabled:cursor-wait disabled:opacity-50"
                          >
                            {exportingAssignmentId === ass._id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Download className="w-4 h-4" />}
                          </button>
                          <button
                            title="Export CSV"
                            onClick={() => handleExportCsv(ass._id)}
                            className="p-1.5 hover:bg-emerald-100 text-emerald-600 rounded-lg transition"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </button>
                          <button
                            title="View unsubmitted students"
                            onClick={() => fetchDefaulters(ass)}
                            className="p-1.5 hover:bg-amber-100 text-amber-700 rounded-lg transition"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingAssignment(ass);
                              setAssignmentForm({
                                subjectId: (ass.subjectId as any)?._id || (ass.subjectId as string),
                                title: ass.title,
                                description: ass.description || '',
                                deadline: toLocalDateTimeInput(new Date(ass.deadline)),
                                groupDeadline: ass.groupDeadline ? toLocalDateTimeInput(new Date(ass.groupDeadline)) : '',
                                allowLateSubmission: ass.allowLateSubmission,
                                allowLateGroupRegistration: ass.allowLateGroupRegistration || false,
                                allowedFileTypes: ass.allowedFileTypes.join(', '),
                                maxFileSize: ass.maxFileSize,
                                maxGroupSize: ass.maxGroupSize || 4,
                                minGroupSize: (ass as any).minGroupSize || 1,
                                submissionType: ass.submissionType || 'Group',
                                isActive: ass.isActive,
                              });
                              setAssignmentModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAssignment(ass._id)}
                            className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="divide-y divide-slate-100 sm:hidden">
                {assignments.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-400">No assignments created yet. Click 'Create Assignment' to create one.</div>
                ) : assignments.map((ass) => (
                  <article key={ass._id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-xs font-bold text-blue-700">{(ass.subjectId as any)?.name || 'N/A'} ({(ass.subjectId as any)?.code || ''})</p>
                        <h3 className="break-words font-bold text-slate-900">{ass.title}</h3>
                      </div>
                      {renderStatusBadge(assignmentStatus(ass))}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><span className="text-slate-500">Deadline</span><p className="font-semibold text-slate-700">{formatDate(ass.deadline)}</p></div>
                      <div><span className="text-slate-500">Mode</span><p className="font-semibold text-slate-700">{ass.submissionType === 'Individual' ? 'Individual' : `Group (${(ass as any).minGroupSize || 1}-${ass.maxGroupSize || 4})`}</p></div>
                      <div><span className="text-slate-500">Late access</span><p className="font-semibold text-slate-700">Individual approval required</p></div>
                      <div><span className="text-slate-500">Max file</span><p className="font-semibold text-slate-700">{ass.maxFileSize} MB</p></div>
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                      <button onClick={() => handleDownloadZip(ass._id)} disabled={exportingAssignmentId !== null} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-600 disabled:cursor-wait disabled:opacity-50">{exportingAssignmentId === ass._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}ZIP</button>
                      <button onClick={() => handleExportCsv(ass._id)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-600"><FileSpreadsheet className="h-4 w-4" />CSV</button>
                      <button onClick={() => fetchDefaulters(ass)} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-bold text-amber-700"><UserX className="h-4 w-4" />Defaulters</button>
                      <button onClick={() => {
                        setEditingAssignment(ass);
                        setAssignmentForm({
                          subjectId: (ass.subjectId as any)?._id || (ass.subjectId as string), title: ass.title, description: ass.description || '',
                          deadline: toLocalDateTimeInput(new Date(ass.deadline)), groupDeadline: ass.groupDeadline ? toLocalDateTimeInput(new Date(ass.groupDeadline)) : '',
                          allowLateSubmission: ass.allowLateSubmission, allowLateGroupRegistration: ass.allowLateGroupRegistration || false,
                          allowedFileTypes: ass.allowedFileTypes.join(', '), maxFileSize: ass.maxFileSize, maxGroupSize: ass.maxGroupSize || 4,
                          minGroupSize: (ass as any).minGroupSize || 1, submissionType: ass.submissionType || 'Group', isActive: ass.isActive,
                        });
                        setAssignmentModalOpen(true);
                      }} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-2 text-xs font-bold text-slate-600"><Edit2 className="h-4 w-4" />Edit</button>
                      <button onClick={() => handleDeleteAssignment(ass._id)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-2 text-xs font-bold text-red-600"><Trash2 className="h-4 w-4" />Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. SUBMISSIONS TAB */}
        {activeTab === 'submissions' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Student Submissions</h1>
                <p className="text-slate-500 text-sm">Browse, search, filter, and download student submissions.</p>
              </div>

              {/* Batch Action Buttons if assignment filtered */}
              {filterAssignmentId && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadZip(filterAssignmentId)}
                    disabled={exportingAssignmentId !== null}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition disabled:cursor-wait disabled:opacity-50"
                  >
                    {exportingAssignmentId === filterAssignmentId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {exportingAssignmentId === filterAssignmentId ? 'Preparing ZIP...' : 'Download All as ZIP'}
                  </button>
                  <button
                    onClick={() => handleExportCsv(filterAssignmentId)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Export CSV
                  </button>
                </div>
              )}
            </div>

            {!filterAssignmentId && (
              <div className="space-y-4">
                {filterSubjectId && (
                  <button
                    onClick={() => {
                      setFilterSubjectId('');
                      setCurrentPage(1);
                    }}
                    className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                  >
                    ← All Subjects
                  </button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(filterSubjectId
                    ? assignments.filter((assignment) => {
                        const subjectId = typeof assignment.subjectId === 'string' ? assignment.subjectId : assignment.subjectId?._id;
                        return subjectId === filterSubjectId;
                      })
                    : subjects.filter((subject) =>
                        assignments.some((assignment) => {
                          const subjectId = typeof assignment.subjectId === 'string' ? assignment.subjectId : assignment.subjectId?._id;
                          return subjectId === subject._id;
                        })
                      )
                  ).map((item) => {
                    if (filterSubjectId) {
                      const assignment = item as Assignment;
                      const count = assignmentSubmissionCounts.find((entry) => entry.assignmentId === assignment._id)?.submittedCount || 0;
                      return (
                        <button
                          key={assignment._id}
                          onClick={() => {
                            setFilterAssignmentId(assignment._id);
                            setCurrentPage(1);
                          }}
                          className="text-left bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition"
                        >
                          <span className="text-xs font-semibold text-slate-500">Assignment</span>
                          <h2 className="mt-1 font-bold text-slate-900">{assignment.title}</h2>
                          <p className="mt-3 text-sm font-semibold text-blue-700">
                            {loadingSubmissionSummary
                              ? 'Loading submission count...'
                              : submissionSummaryLoaded ? `${count} ${count === 1 ? 'student' : 'students'} submitted` : 'Count unavailable'}
                          </p>
                        </button>
                      );
                    }

                    const subject = item as Subject;
                    return (
                      <button
                        key={subject._id}
                        onClick={() => setFilterSubjectId(subject._id)}
                        className="text-left bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition"
                      >
                        <span className="text-xs font-semibold text-blue-700">{subject.code}</span>
                        <h2 className="mt-1 font-bold text-slate-900">{subject.name}</h2>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {filterAssignmentId && (
            <>
            <button
              onClick={() => {
                setFilterAssignmentId('');
                setCurrentPage(1);
              }}
              className="text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              ← Back to {subjects.find((subject) => subject._id === filterSubjectId)?.name || 'Assignments'}
            </button>
            {/* Submissions Table */}
            <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-x-auto">
              <table className="hidden sm:table w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold text-xs uppercase">
                    <th className="p-4">Submission ID</th>
                    <th className="p-4">Roll #</th>
                    <th className="p-4">Student Name</th>
                    <th className="p-4">Subject</th>
                    <th className="p-4">Quiz / Assignment</th>
                    <th className="p-4">File Name</th>
                    <th className="p-4">Submitted At</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingSubmissions ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10">
                        <div className="flex items-center justify-center gap-2 text-slate-500">
                          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                          <span>Loading submissions...</span>
                        </div>
                      </td>
                    </tr>
                  ) : submissions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-slate-400">
                        {filterStatus ? 'No submissions match this status.' : 'No submissions found for this assignment.'}
                      </td>
                    </tr>
                  ) : (
                    submissions.map((sub) => (
                      <tr key={sub._id} className="hover:bg-slate-50/80">
                        <td className="p-4 font-mono text-xs font-bold text-slate-700">{sub.submissionId}</td>
                        <td className="p-4 font-mono font-bold text-slate-900">{sub.rollNumber}</td>
                        <td className="p-4 font-semibold text-slate-900">{sub.studentName}</td>
                        <td className="p-4 text-xs font-medium text-slate-700">
                          {(sub.subjectId as any)?.code || 'N/A'}
                        </td>
                        <td className="p-4 text-xs font-medium text-slate-700">
                          {(sub.assignmentId as any)?.title || 'N/A'}
                        </td>
                        <td className="p-4 text-xs font-medium text-blue-600 max-w-[160px] truncate">
                          {sub.originalFileName}
                        </td>
                        <td className="p-4 text-xs text-slate-500">{formatDate(sub.submittedAt)}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-md">
                            {sub.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDownloadSingle(sub._id, sub.originalFileName, sub.cloudinarySecureUrl)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="sm:hidden divide-y divide-slate-100">
                {loadingSubmissions ? <div className="p-8 text-center text-sm text-slate-500">Loading submissions...</div> : submissions.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">No submissions match the selected filters.</div> : submissions.map((sub) => (
                  <article key={sub._id} className="p-4 space-y-2">
                    <div className="flex justify-between gap-2"><p className="font-mono text-xs font-bold text-slate-700 break-all">{sub.submissionId}</p><span className="shrink-0 px-2 py-1 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-md">{sub.status}</span></div>
                    <p className="font-bold text-slate-900 break-words">{sub.studentName}</p>
                    <p className="text-xs font-mono text-slate-600 break-all">Roll: {sub.rollNumber}</p>
                    <p className="text-xs text-slate-700 break-words">{(sub.subjectId as any)?.name || 'Subject'} · {(sub.assignmentId as any)?.title || 'Assignment'}</p>
                    <p className="text-xs text-blue-600 break-words">File: {sub.originalFileName}</p>
                    <p className="text-[11px] text-slate-500">Submitted: {formatDate(sub.submittedAt)}</p>
                    <button onClick={() => handleDownloadSingle(sub._id, sub.originalFileName, sub.cloudinarySecureUrl)} className="w-full inline-flex justify-center items-center gap-1 px-3 py-2 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg"><Download className="w-3.5 h-3.5" /> Download</button>
                  </article>
                ))}
              </div>

              {/* Pagination Controls */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Showing page {currentPage} of {totalPages} ({totalSubmissionsCount} total submissions)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            </>
            )}
          </div>
        )}

        {/* 5. GROUP REGISTRATIONS TAB */}
        {activeTab === 'groups' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Registered Student Groups</h1>
                <p className="text-slate-500 text-sm">View subject-wise registered groups and export CSV.</p>
              </div>

              {groupFilterAssignment && (
                <button
                  onClick={handleExportGroupsCsv}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow transition"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Export Groups CSV
                </button>
              )}
            </div>

            {!groupFilterSubject && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjects.filter((subject) => assignments.some((assignment) => {
                  const assignmentSubjectId = typeof assignment.subjectId === 'string'
                    ? assignment.subjectId
                    : assignment.subjectId?._id;
                  return assignmentSubjectId === subject._id;
                })).map((subject) => (
                  <button
                    key={subject._id}
                    onClick={() => {
                      setGroupFilterSubject(subject._id);
                      setGroupFilterAssignment('');
                      setGroupSearch('');
                    }}
                    className="text-left bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition"
                  >
                    <span className="text-xs font-semibold text-blue-700">{subject.code}</span>
                    <h2 className="mt-1 font-bold text-slate-900">{subject.name}</h2>
                  </button>
                ))}
              </div>
            )}

            {groupFilterSubject && !groupFilterAssignment && (
              <div className="space-y-4">
                <button
                  onClick={() => {
                    setGroupFilterSubject('');
                    setGroups([]);
                  }}
                  className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                >
                  ← All Subjects
                </button>
                {loadingGroups ? (
                  <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> Loading group counts...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assignments.filter((assignment) => {
                      const assignmentSubjectId = typeof assignment.subjectId === 'string'
                        ? assignment.subjectId
                        : assignment.subjectId?._id;
                      return assignmentSubjectId === groupFilterSubject;
                    }).map((assignment) => {
                      const count = groups.filter((group) => {
                        const assignmentId = typeof group.assignmentId === 'string'
                          ? group.assignmentId
                          : group.assignmentId?._id;
                        return assignmentId === assignment._id;
                      }).length;
                      return (
                        <button
                          key={assignment._id}
                          onClick={() => setGroupFilterAssignment(assignment._id)}
                          className="text-left bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition"
                        >
                          <span className="text-xs font-semibold text-slate-500">Assignment</span>
                          <h2 className="mt-1 font-bold text-slate-900">{assignment.title}</h2>
                          <p className="mt-3 text-sm font-semibold text-blue-700">
                            {count} {count === 1 ? 'group' : 'groups'} registered
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {groupFilterAssignment && (
              <div className="space-y-4">
                <button
                  onClick={() => {
                    setGroupFilterAssignment('');
                    setGroupSearch('');
                  }}
                  className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                >
                  ← Back to {subjects.find((subject) => subject._id === groupFilterSubject)?.name || 'Assignments'}
                </button>
                <div className="relative max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search group name or roll #"
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-hidden p-6">
                  {loadingGroups ? (
                    <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> Loading groups...
                    </div>
                  ) : groups.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm">
                      No student groups registered for this assignment.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groups.map((grp) => (
                    <div key={grp._id} className="p-5 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div>
                          <span className="text-xs font-bold text-blue-600 uppercase">
                            {(grp.subjectId as any)?.name || 'Subject'}
                          </span>
                          <h3 className="font-extrabold text-slate-900 text-base">{grp.groupName}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                            {grp.members.length} / {grp.maxGroupSize || 4} Members
                          </span>
                          <button
                            onClick={() => openGroupEditor(grp)}
                            className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition"
                            title="Edit Group"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(grp._id, grp.groupName)}
                            className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition"
                            title="Delete Group"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Group Leader</p>
                        <p className="text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                          <Crown className="w-4 h-4 text-amber-600" />
                          {grp.leader?.name} ({grp.leader?.rollNumber})
                        </p>

                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 pt-1">Members</p>
                        <p className="text-xs text-slate-600 break-words">Assignment: <span className="font-semibold">{(grp.assignmentId as any)?.title || 'N/A'}</span></p>
                        <div className="flex flex-wrap gap-1.5">
                          {grp.members.map((m, mIdx) => (
                            <span key={mIdx} className="px-2.5 py-1 bg-white border border-slate-200 text-slate-800 text-xs rounded-md font-medium">
                              {m.name} ({m.rollNumber})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 6. LATE REQUESTS TAB */}
        {activeTab === 'late-requests' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{isTeacher ? 'Quiz Access Requests' : 'Late Submission Requests'}</h1>
              <p className="text-slate-500 text-sm">
                {isTeacher ? 'Review and decide student requests to resume assigned quizzes.' : 'Review and decide late submission requests submitted by students/groups.'}
              </p>
            </div>

            {/* Filter Bar */}
            <div className="glass-panel p-4 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search student or roll #"
                  value={lateSearch}
                  onChange={(e) => setLateSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={lateFilterSubject}
                onChange={(e) => setLateFilterSubject(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                <option value="">All Subjects</option>
                {subjects.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>

              <select
                value={lateFilterStatus}
                onChange={(e) => setLateFilterStatus(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            {/* Table */}
            <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-x-auto">
              <table className="hidden sm:table w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold text-xs uppercase">
                    <th className="p-4">Student</th>
                    <th className="p-4">Roll #</th>
                    <th className="p-4">Subject</th>
                    <th className="p-4">Assignment</th>
                    <th className="p-4">Reason</th>
                    <th className="p-4">Requested At</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingLateRequests ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10">
                        <div className="flex items-center justify-center gap-2 text-slate-500">
                          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                          <span>Loading late submission requests...</span>
                        </div>
                      </td>
                    </tr>
                  ) : lateRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-400">
                        No late submission requests found.
                      </td>
                    </tr>
                  ) : (
                    lateRequests.map((req) => (
                      <tr key={req._id} className="hover:bg-slate-50/80">
                        <td className="p-4 font-bold text-slate-900">{req.studentName}</td>
                        <td className="p-4 font-mono font-bold text-slate-700">{req.rollNumber}</td>
                        <td className="p-4 text-xs font-semibold text-blue-700">
                          {(req.subjectId as any)?.code || 'N/A'}
                        </td>
                        <td className="p-4 text-xs font-semibold text-slate-800">
                          {(req.quizId as any)?.title || (req.assignmentId as any)?.title || 'N/A'}
                        </td>
                        <td className="p-4 text-xs text-slate-600 max-w-xs truncate">{req.reason}</td>
                        <td className="p-4 text-xs text-slate-500">{formatDate(req.requestedAt)}</td>
                        <td className="p-4">
                          {req.status === 'Approved' ? (
                            <span className="px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full">
                              Approved
                            </span>
                          ) : req.status === 'Rejected' ? (
                            <span className="px-2.5 py-1 text-xs font-bold bg-red-100 text-red-800 rounded-full">
                              Rejected
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-800 rounded-full">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => handleLateDecision(req._id, 'Approved')}
                            disabled={req.status !== 'Pending'}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold text-xs rounded-lg transition inline-flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> {req.requestType === 'GroupRegistration' ? 'Allow Group Registration' : req.requestType === 'Quiz' ? 'Allow Quiz Access' : 'Allow Submission'}
                          </button>
                          <button
                            onClick={() => { setRejectingRequestId(req._id); setRejectionReasonInput(''); }}
                            disabled={req.status !== 'Pending'}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold text-xs rounded-lg transition inline-flex items-center gap-1"
                          >
                            <X className="w-3 h-3" /> Reject
                          </button>
                          {req.requestType === 'Quiz' && req.requestCount === 3 && req.status !== 'Pending' && req.attemptStatus === 'locked' && (
                            <button onClick={() => handleGrantFourthQuizAttempt(req)} className="px-3 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-lg">
                              Allow 4th Attempt
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="sm:hidden divide-y divide-slate-100">
                {loadingLateRequests ? <div className="p-8 text-center text-sm text-slate-500">Loading late submission requests...</div> : lateRequests.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">No late submission requests found.</div> : lateRequests.map((req) => (
                  <article key={req._id} className="p-4 space-y-2">
                    <div className="flex justify-between gap-2"><p className="font-bold text-slate-900 break-words">{req.studentName}</p><span className={`shrink-0 px-2 py-1 text-[10px] font-bold rounded-full ${req.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : req.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{req.status}</span></div>
                    <p className="text-xs font-mono text-slate-600 break-all">Roll: {req.rollNumber}</p>
                    <p className="text-xs text-slate-700 break-words">{(req.subjectId as any)?.name || 'Subject'} · {(req.quizId as any)?.title || (req.assignmentId as any)?.title || 'Assignment'}</p>
                    <p className="text-xs text-slate-600 break-words">Reason: {req.reason || 'No reason provided'}</p>
                    <p className="text-[11px] text-slate-500">Requested: {formatDate(req.requestedAt)}</p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button onClick={() => handleLateDecision(req._id, 'Approved')} disabled={req.status !== 'Pending'} className="py-2 bg-emerald-600 disabled:bg-emerald-300 text-white text-xs font-bold rounded-lg">{req.requestType === 'GroupRegistration' ? 'Allow Group Registration' : req.requestType === 'Quiz' ? 'Allow Quiz Access' : 'Allow Submission'}</button>
                      <button onClick={() => { setRejectingRequestId(req._id); setRejectionReasonInput(''); }} disabled={req.status !== 'Pending'} className="py-2 bg-red-600 disabled:bg-red-300 text-white text-xs font-bold rounded-lg">Reject</button>
                      {req.requestType === 'Quiz' && req.requestCount === 3 && req.status !== 'Pending' && req.attemptStatus === 'locked' && <button onClick={() => handleGrantFourthQuizAttempt(req)} className="col-span-2 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg">Allow 4th Attempt</button>}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* Rejection Reason Modal */}
            {rejectingRequestId && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                  <h3 className="text-lg font-bold text-slate-900">Reject Late Request</h3>
                  <p className="text-sm text-slate-600">Please provide a reason for rejecting this request (optional):</p>
                  <textarea
                    value={rejectionReasonInput}
                    onChange={(e) => setRejectionReasonInput(e.target.value)}
                    placeholder="Enter rejection reason..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => { setRejectingRequestId(null); setRejectionReasonInput(''); }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (rejectingRequestId) {
                          handleLateDecision(rejectingRequestId, 'Rejected', rejectionReasonInput);
                          setRejectingRequestId(null);
                          setRejectionReasonInput('');
                        }
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition"
                    >
                      Reject Request
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div><h1 className="text-2xl font-bold text-slate-900">Registered Students</h1><p className="text-slate-500 text-sm">Manage student names, roll numbers and account access.</p></div>
              <input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Search name, roll or email" className="w-full sm:w-72 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm" />
            </div>
            <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-x-auto">
              <div className="space-y-3 p-3 sm:hidden">
                {loadingStudents ? (
                  <p className="p-8 text-center text-slate-500">Loading students...</p>
                ) : registeredStudents.length === 0 ? (
                  <p className="p-8 text-center text-slate-400">No registered students.</p>
                ) : registeredStudents.map((studentRecord) => (
                  <article key={studentRecord._id} className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                    <h2 className="font-semibold">{studentRecord.name}</h2>
                    <p className="mt-2 font-mono text-sm">Roll No: {studentRecord.rollNumber}</p>
                    <p className="break-all text-sm">Email: {studentRecord.email}</p>
                    <p className="text-xs text-slate-500">Joined: {formatDate(studentRecord.createdAt)}</p>
                    {(isSuperAdmin || isCROrAssistant) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStudent(studentRecord);
                            setStudentEditForm({ name: studentRecord.name, rollNumber: studentRecord.rollNumber });
                            setStudentEditModalOpen(true);
                          }}
                          className="min-h-10 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetStudentPassword(studentRecord)}
                          disabled={resetPassStudentId === studentRecord._id}
                          className="min-h-10 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700 disabled:opacity-50"
                        >
                          {resetPassStudentId === studentRecord._id ? 'Sending...' : 'Reset Password'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStudent(studentRecord._id, studentRecord.name, studentRecord.rollNumber)}
                          className="min-h-10 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
              <table className="hidden w-full min-w-[640px] text-left text-sm sm:table">
                <thead><tr className="bg-slate-50 text-xs uppercase text-slate-600"><th className="p-4">Name</th><th className="p-4">Roll No</th><th className="p-4">Email</th><th className="p-4">Joined</th>{(isSuperAdmin || isCROrAssistant) && <th className="p-4">Actions</th>}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingStudents ? <tr><td colSpan={(isSuperAdmin || isCROrAssistant) ? 5 : 4} className="p-8 text-center text-slate-500">Loading students...</td></tr> : registeredStudents.length === 0 ? <tr><td colSpan={(isSuperAdmin || isCROrAssistant) ? 5 : 4} className="p-8 text-center text-slate-400">No registered students.</td></tr> : registeredStudents.map((studentRecord) => (
                    <tr key={studentRecord._id}><td className="p-4 font-semibold">{studentRecord.name}</td><td className="p-4 font-mono">{studentRecord.rollNumber}</td><td className="p-4 break-all">{studentRecord.email}</td><td className="p-4 text-xs text-slate-500">{formatDate(studentRecord.createdAt)}</td>{(isSuperAdmin || isCROrAssistant) && <td className="p-4"><div className="flex flex-wrap gap-2"><button onClick={() => { setEditingStudent(studentRecord); setStudentEditForm({ name: studentRecord.name, rollNumber: studentRecord.rollNumber }); setStudentEditModalOpen(true); }} className="px-2.5 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg">Edit</button><button onClick={() => handleResetStudentPassword(studentRecord)} disabled={resetPassStudentId === studentRecord._id} className="px-2.5 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg disabled:opacity-50">{resetPassStudentId === studentRecord._id ? 'Sending...' : 'Reset Password'}</button><button onClick={() => handleDeleteStudent(studentRecord._id, studentRecord.name, studentRecord.rollNumber)} className="px-2.5 py-1.5 bg-red-50 text-red-700 text-xs font-bold rounded-lg">Delete</button></div></td>}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. SETTINGS TAB — CLASS JOIN CODE MANAGEMENT */}
        {activeTab === 'settings' && isCROrAssistant && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Class Access & Join Code Settings</h1>
              <p className="text-slate-500 text-sm">
                Control student self-registration access. Students require an active Class Join Code to register.
              </p>
            </div>

            <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl p-6 sm:p-8 space-y-6 max-w-2xl">
              {joinCodeClass && <p className="text-sm text-slate-500">Managing {joinCodeClass.name} only.</p>}
              {!joinCodeClass && <p className="text-sm text-amber-700">No assigned class was found for this account.</p>}
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Active Class Join Code</h3>
                  <p className="text-xs text-slate-500">Share this code with your class students to allow self-registration.</p>
                </div>
                <button
                  onClick={handleToggleJoinCode}
                  disabled={!joinCodeClass}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                    isJoinCodeActive
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : 'bg-red-100 text-red-800 hover:bg-red-200'
                  }`}
                >
                  {isJoinCodeActive ? 'Active (Registration Open)' : 'Disabled (Registration Blocked)'}
                </button>
              </div>

              {isEditingCode ? (
                <form onSubmit={handleUpdateJoinCode} className="bg-slate-50 border border-blue-200 rounded-2xl p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Set Custom Class Join Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MYCLASS2026"
                      value={customJoinInput}
                      onChange={(e) => setCustomJoinInput(e.target.value.toUpperCase())}
                      required
                      disabled={!joinCodeClass}
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl font-mono text-xl font-extrabold uppercase text-blue-700 tracking-wider focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingCode(false)}
                      className="px-4 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!joinCodeClass}
                      className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow"
                    >
                      Save Join Code
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase text-slate-400">Class Join Code</span>
                    <div className="text-3xl font-extrabold font-mono text-blue-700 tracking-wider mt-1">
                      {joinCode || 'Loading class code...'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!joinCodeClass}
                      onClick={() => {
                        setCustomJoinInput(joinCode);
                        setIsEditingCode(true);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit Code
                    </button>

                    <button
                      type="button"
                      disabled={!joinCodeClass}
                      onClick={() => {
                        navigator.clipboard.writeText(joinCode);
                        showToast('success', 'Class Join Code copied to clipboard!');
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition"
                    >
                      Copy Code
                    </button>

                    <button
                      type="button"
                      disabled={!joinCodeClass}
                      onClick={handleRegenerateJoinCode}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-slate-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Auto-Generate
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {activeTab === 'account' && <StaffPasswordSettings />}

        {/* CLASSES & SECTIONS TAB */}
        {activeTab === 'classes' && isSuperAdmin && <ClassManagementSection />}

        {/* TEACHER ASSIGNMENTS TAB */}
        {activeTab === 'teachers' && isSuperAdmin && <TeacherAssignmentSection />}

        {/* STAFF MANAGEMENT TAB */}
        {activeTab === 'staff' && isSuperAdmin && <StaffManagementSection />}

        {/* QUIZZES TAB */}
        {activeTab === 'quizzes' && <QuizManagementSection userRole={role || undefined} />}

        {/* SHARED ASSIGNMENTS TAB (TEACHER VIEW) */}
        {activeTab === 'shared-assignments' && <TeacherSharedAssignmentsSection />}

        {defaultersModalOpen && selectedDefaulterAssignment && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-panel rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-slate-200/80 dark:border-white/10 space-y-4">
              <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Unsubmitted Students</h3><p className="text-xs text-slate-500">{selectedDefaulterAssignment.title}</p></div><button onClick={() => setDefaultersModalOpen(false)} className="text-slate-500 text-xl">&times;</button></div>
              {loadingDefaulters ? <p className="py-8 text-center text-slate-500">Loading...</p> : defaultersList.length === 0 ? <p className="py-8 text-center text-emerald-700 font-semibold">No defaulters found.</p> : <div className="space-y-2">{defaultersList.map((studentRecord) => <div key={studentRecord._id} className="p-3 bg-slate-50/80 rounded-xl"><p className="font-semibold text-sm">{studentRecord.name}</p><p className="text-xs text-slate-600">{studentRecord.rollNumber} · {studentRecord.email}</p></div>)}</div>}
              <button onClick={() => handleExportDefaultersCsv(selectedDefaulterAssignment._id, selectedDefaulterAssignment.title)} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow">Export CSV</button>
            </div>
          </div>
        )}

        {studentEditModalOpen && editingStudent && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"><form onSubmit={handleSaveStudentEdit} className="glass-panel rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200/80 dark:border-white/10 shadow-2xl"><h3 className="font-bold text-slate-900">Edit Student</h3><input value={studentEditForm.name} onChange={(e) => setStudentEditForm({ ...studentEditForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" placeholder="Name" required /><input value={studentEditForm.rollNumber} maxLength={7} onChange={(e) => setStudentEditForm({ ...studentEditForm, rollNumber: e.target.value.replace(/\D/g, '') })} className="w-full px-3 py-2 border rounded-xl text-sm font-mono tracking-wider" placeholder="Roll number (7 digits, e.g. 2260000)" required /><div className="flex justify-end gap-2"><button type="button" onClick={() => setStudentEditModalOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold">Cancel</button><button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow">Save</button></div></form></div>
        )}

        {/* MODAL: ADD / EDIT SUBJECT */}
        {editingGroup && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
            <form onSubmit={handleAdminGroupSave} className="glass-panel rounded-3xl max-w-lg w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6 space-y-4 border border-slate-200/80 shadow-2xl">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit {editingGroup.groupName}</h3>
                <p className="text-xs text-slate-500">Update members or select a new group leader.</p>
              </div>
              <div className="space-y-2">
                {adminGroupMembers.map((member, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                    <input value={member.name} onChange={(e) => setAdminGroupMembers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: e.target.value } : item))} placeholder="Name" className="w-full min-w-0 px-3 py-2 border rounded-xl text-sm" />
                    <div className="flex min-w-0 gap-2">
                      <input value={member.rollNumber} onChange={(e) => setAdminGroupMembers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, rollNumber: e.target.value } : item))} placeholder="Roll number" className="w-full min-w-0 px-3 py-2 border rounded-xl text-sm font-mono" required />
                      <button type="button" onClick={() => setAdminGroupMembers((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="shrink-0 px-2 text-red-600" title="Remove member"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setAdminGroupMembers((current) => [...current, { name: '', rollNumber: '' }])} className="text-xs font-bold text-blue-700">+ Add member</button>
              <select value={adminGroupLeader} onChange={(e) => setAdminGroupLeader(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" required>
                <option value="">Select leader</option>
                {adminGroupMembers.filter((member) => member.rollNumber.trim()).map((member) => <option key={member.rollNumber} value={member.rollNumber}>{member.name || member.rollNumber} ({member.rollNumber})</option>)}
              </select>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button type="button" onClick={() => setEditingGroup(null)} className="w-full sm:w-auto px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-xl">Cancel</button>
                <button type="submit" disabled={adminGroupSaving} className="w-full sm:w-auto px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl">{adminGroupSaving ? 'Saving...' : 'Save Group'}</button>
              </div>
            </form>
          </div>
        )}

        {subjectModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-panel rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 dark:border-white/10 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingSubject ? 'Edit Subject' : 'Add New Subject'}
              </h3>
              <form onSubmit={handleSaveSubject} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subject Code</label>
                  <input
                    type="text"
                    placeholder="e.g. OOP"
                    value={subjectForm.code}
                    onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-xl font-mono text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subject Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Object Oriented Programming"
                    value={subjectForm.name}
                    onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                  <textarea
                    placeholder="Optional description"
                    value={subjectForm.description}
                    onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Class Representative (CR)</label>
                  <select
                    value={subjectForm.crId}
                    onChange={(e) => setSubjectForm({ ...subjectForm, crId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  >
                    <option value="">No CR Assigned (Uses Default Admin)</option>
                    {admins.map((admin) => (
                      <option key={admin._id} value={admin._id}>
                        {admin.name} ({admin.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="subjectActive"
                    checked={subjectForm.isActive}
                    onChange={(e) => setSubjectForm({ ...subjectForm, isActive: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <label htmlFor="subjectActive" className="text-xs font-bold text-slate-700">
                    Active Subject
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSubjectModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow"
                  >
                    Save Subject
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ADD / EDIT ASSIGNMENT */}
        {assignmentModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="glass-panel rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/80 dark:border-white/10 space-y-4 my-8">
              <h3 className="text-lg font-bold text-slate-900">
                {editingAssignment ? 'Edit Assignment' : 'Create Assignment'}
              </h3>
              <form onSubmit={handleSaveAssignment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
                  <select
                    value={assignmentForm.subjectId}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, subjectId: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-xl text-sm font-semibold"
                  >
                    <option value="">-- Select Subject --</option>
                    {subjects.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assignment Title</label>
                  <input
                    type="text"
                    placeholder="e.g. OOP Assignment 01"
                    value={assignmentForm.title}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-xl text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                  <textarea
                    placeholder="Assignment instructions..."
                    value={assignmentForm.description}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Deadline Date & Time</label>
                  <input
                    type="datetime-local"
                    value={assignmentForm.deadline}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, deadline: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-xl text-sm font-semibold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Submission Mode</label>
                    <select
                      value={assignmentForm.submissionType}
                      onChange={(e) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          submissionType: e.target.value as 'Individual' | 'Group',
                        })
                      }
                      className="w-full px-3 py-2 border rounded-xl text-xs font-bold bg-white"
                    >
                      <option value="Group">Group Submission</option>
                      <option value="Individual">Individual Submission Only</option>
                    </select>
                  </div>
                  {assignmentForm.submissionType === 'Group' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Min Group Limit
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={assignmentForm.minGroupSize}
                          onChange={(e) => setAssignmentForm({ ...assignmentForm, minGroupSize: Number(e.target.value) })}
                          className="w-full px-3 py-2 border rounded-xl text-xs font-bold"
                          placeholder="e.g. 1"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Max Group Limit
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={assignmentForm.maxGroupSize}
                          onChange={(e) => setAssignmentForm({ ...assignmentForm, maxGroupSize: Number(e.target.value) })}
                          className="w-full px-3 py-2 border rounded-xl text-xs font-bold"
                          placeholder="e.g. 4"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center text-xs text-slate-500 pt-5">
                      Single student submission only
                    </div>
                  )}
                </div>

                {assignmentForm.submissionType === 'Group' && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-blue-900 mb-1">
                        Group Registration Deadline
                      </label>
                      <input
                        type="datetime-local"
                        value={assignmentForm.groupDeadline}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, groupDeadline: e.target.value })}
                        className="w-full px-3 py-2 border border-blue-300 rounded-xl text-xs font-semibold bg-white"
                      />
                      <p className="text-[10px] text-blue-700 mt-0.5">
                        Students must form groups before this time (defaults to assignment deadline if empty).
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="allowLateGroup"
                        checked={assignmentForm.allowLateGroupRegistration}
                        onChange={(e) =>
                          setAssignmentForm({ ...assignmentForm, allowLateGroupRegistration: e.target.checked })
                        }
                        className="rounded text-blue-600"
                      />
                      <label htmlFor="allowLateGroup" className="text-xs font-bold text-blue-900">
                        Allow Late Group Registration after Group Deadline
                      </label>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Allowed File Types</label>
                    <input
                      type="text"
                      placeholder="pdf, doc, docx, ppt, zip"
                      value={assignmentForm.allowedFileTypes}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, allowedFileTypes: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Max File Size (MB)</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={assignmentForm.maxFileSize}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, maxFileSize: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <p className="text-xs text-slate-600">
                    Late upload or re-upload needs individual CR/Admin approval and is available to that student for 5 minutes.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="assignmentActive"
                      checked={assignmentForm.isActive}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, isActive: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <label htmlFor="assignmentActive" className="text-xs font-bold text-slate-700">
                      Active Assignment
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAssignmentModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                  >
                    Save Assignment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: SHARE ASSIGNMENT WITH TEACHER */}
        {sharingAssignment && (
          <ShareAssignmentModal
            assignment={sharingAssignment}
            onClose={() => setSharingAssignment(null)}
            onSuccess={() => showToast('success', 'Assignment submissions shared with teacher successfully!')}
          />
        )}
      </main>
    </div>
  );
};
