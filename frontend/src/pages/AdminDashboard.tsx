import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Subject, Assignment, Submission, DashboardStats, Group, LateRequest, RegisteredStudent } from '../types';
import { useAuth } from '../context/AuthContext';
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
  Filter,
  Loader2,
  RefreshCw,
  LogOut,
  FileText,
  KeyRound,
  Settings,
  Users,
  Check,
  X,
  Crown,
  AlertTriangle,
  UserCheck,
  UserX,
  User,
  Copy,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { logout } = useAuth();
  const validTabs = ['dashboard', 'subjects', 'assignments', 'submissions', 'groups', 'late-requests', 'students', 'settings'] as const;
  type TabType = typeof validTabs[number];

  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab') as TabType;
    if (validTabs.includes(tabFromUrl)) return tabFromUrl;
    const savedTab = localStorage.getItem('admin_active_tab') as TabType;
    if (validTabs.includes(savedTab)) return savedTab;
    return 'dashboard';
  });

  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    localStorage.setItem('admin_active_tab', tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState(null, '', url.toString());
  };

  // Join Code state
  const [joinCode, setJoinCode] = useState<string>('');
  const [isJoinCodeActive, setIsJoinCodeActive] = useState<boolean>(true);

  // Stats state
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);

  // Subjects state with instant cache rehydration
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    try {
      const cached = sessionStorage.getItem('admin_cached_subjects');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(() => {
    try {
      return !sessionStorage.getItem('admin_cached_subjects');
    } catch {
      return false;
    }
  });
  const [subjectModalOpen, setSubjectModalOpen] = useState<boolean>(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', description: '', isActive: true });

  // Assignments state
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState<boolean>(false);
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
    submissionType: 'Group' as 'Individual' | 'Group',
    isActive: true,
  });

  // Submissions list state
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [totalSubmissionsCount, setTotalSubmissionsCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loadingSubmissions, setLoadingSubmissions] = useState<boolean>(false);

  // Groups list state
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false);
  const [groupFilterSubject, setGroupFilterSubject] = useState<string>('');
  const [groupFilterAssignment, setGroupFilterAssignment] = useState<string>('');
  const [groupSearch, setGroupSearch] = useState<string>('');

  // Late Requests state
  const [lateRequests, setLateRequests] = useState<LateRequest[]>([]);
  const [loadingLateRequests, setLoadingLateRequests] = useState<boolean>(false);
  const [lateFilterSubject, setLateFilterSubject] = useState<string>('');
  const [lateFilterStatus, setLateFilterStatus] = useState<string>('');
  const [lateSearch, setLateSearch] = useState<string>('');

  // Registered Students State
  const [registeredStudents, setRegisteredStudents] = useState<RegisteredStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [editingStudent, setEditingStudent] = useState<RegisteredStudent | null>(null);
  const [studentEditForm, setStudentEditForm] = useState({ name: '', rollNumber: '' });
  const [studentEditModalOpen, setStudentEditModalOpen] = useState<boolean>(false);
  const [resetPassStudent, setResetPassStudent] = useState<RegisteredStudent | null>(null);
  const [newStudentPassInput, setNewStudentPassInput] = useState<string>('123456');
  const [resetPassModalOpen, setResetPassModalOpen] = useState<boolean>(false);

  // Defaulters State
  const [defaultersModalOpen, setDefaultersModalOpen] = useState<boolean>(false);
  const [selectedDefaulterAssignment, setSelectedDefaulterAssignment] = useState<Assignment | null>(null);
  const [defaultersList, setDefaultersList] = useState<any[]>([]);
  const [loadingDefaulters, setLoadingDefaulters] = useState<boolean>(false);

  // Filters state
  const [filterSubjectId, setFilterSubjectId] = useState<string>('');
  const [filterAssignmentId, setFilterAssignmentId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Global notification banner
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // FETCH DASHBOARD STATS
  const fetchDashboardStats = async () => {
    try {
      setLoadingStats(true);
      const res = await api.get('/submissions/stats/dashboard');
      if (res.data.success) {
        setStats(res.data.stats);
        setRecentSubmissions(res.data.recentSubmissions);
      }
    } catch (err) {
      showToast('error', 'Failed to load dashboard statistics.');
    } finally {
      setLoadingStats(false);
    }
  };

  // FETCH SUBJECTS
  const fetchSubjects = async () => {
    try {
      setLoadingSubjects(true);
      const res = await api.get('/subjects?includeInactive=true');
      if (res.data.success) {
        setSubjects(res.data.subjects);
        try {
          sessionStorage.setItem('admin_cached_subjects', JSON.stringify(res.data.subjects));
        } catch {}
      }
    } catch (err) {
      showToast('error', 'Failed to fetch subjects list.');
    } finally {
      setLoadingSubjects(false);
    }
  };

  // FETCH ASSIGNMENTS
  const fetchAssignments = async () => {
    try {
      setLoadingAssignments(true);
      const res = await api.get('/assignments');
      if (res.data.success) {
        setAssignments(res.data.assignments);
      }
    } catch (err) {
      showToast('error', 'Failed to fetch assignments list.');
    } finally {
      setLoadingAssignments(false);
    }
  };

  // FETCH SUBMISSIONS
  const fetchSubmissions = async (page: number = 1) => {
    try {
      setLoadingSubmissions(true);
      let query = `/submissions?page=${page}&limit=10`;
      if (filterSubjectId) query += `&subjectId=${filterSubjectId}`;
      if (filterAssignmentId) query += `&assignmentId=${filterAssignmentId}`;
      if (filterStatus) query += `&status=${filterStatus}`;
      if (searchQuery) query += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const res = await api.get(query);
      if (res.data.success) {
        setSubmissions(res.data.submissions);
        setTotalSubmissionsCount(res.data.total);
        setCurrentPage(res.data.page);
        setTotalPages(res.data.pages);
      }
    } catch (err) {
      showToast('error', 'Failed to fetch submissions.');
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // FETCH GROUPS
  const fetchGroups = async () => {
    try {
      setLoadingGroups(true);
      let query = '/groups?';
      if (groupFilterSubject) query += `subjectId=${groupFilterSubject}&`;
      if (groupFilterAssignment) query += `assignmentId=${groupFilterAssignment}&`;
      if (groupSearch) query += `search=${encodeURIComponent(groupSearch.trim())}&`;
      const res = await api.get(query);
      if (res.data.success) {
        setGroups(res.data.groups);
      }
    } catch (err) {
      showToast('error', 'Failed to fetch groups list.');
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
      showToast('error', err.response?.data?.message || 'Failed to delete group.');
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
      showToast('error', 'Failed to fetch late submission requests.');
    } finally {
      setLoadingLateRequests(false);
    }
  };

  const handleLateDecision = async (id: string, decision: 'Approved' | 'Rejected') => {
    try {
      const res = await api.patch(`/late-requests/${id}/decision`, { decision });
      if (res.data.success) {
        showToast('success', res.data.message);
        fetchLateRequests();
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to update decision.');
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
      showToast('error', 'Failed to fetch registered students list.');
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      const res = await api.put(`/admin/students/${editingStudent._id}`, studentEditForm);
      if (res.data.success) {
        showToast('success', res.data.message);
        setStudentEditModalOpen(false);
        fetchStudents();
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to update student details.');
    }
  };

  const handleResetStudentPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassStudent || !newStudentPassInput.trim()) return;
    try {
      const res = await api.patch(`/admin/students/${resetPassStudent._id}/reset-password`, {
        newPassword: newStudentPassInput.trim(),
      });
      if (res.data.success) {
        showToast('success', res.data.message);
        setResetPassModalOpen(false);
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to reset password.');
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
      showToast('error', err.response?.data?.message || 'Failed to delete student.');
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
      showToast('error', 'Failed to fetch defaulters list.');
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
      showToast('error', 'Failed to export defaulters CSV.');
    }
  };

  const [customJoinInput, setCustomJoinInput] = useState<string>('');
  const [isEditingCode, setIsEditingCode] = useState<boolean>(false);

  const fetchJoinCode = async () => {
    try {
      const res = await api.get('/admin/settings/join-code');
      if (res.data.success) {
        setJoinCode(res.data.joinCode);
        setCustomJoinInput(res.data.joinCode);
        setIsJoinCodeActive(res.data.isJoinCodeActive);
      }
    } catch (err) {
      console.error('Failed to fetch class join code:', err);
    }
  };

  const handleUpdateJoinCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customJoinInput.trim()) {
      showToast('error', 'Join code cannot be empty.');
      return;
    }
    try {
      const res = await api.put('/admin/settings/join-code', { customCode: customJoinInput.trim() });
      if (res.data.success) {
        setJoinCode(res.data.joinCode);
        setCustomJoinInput(res.data.joinCode);
        setIsJoinCodeActive(true);
        setIsEditingCode(false);
        showToast('success', res.data.message);
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to update join code.');
    }
  };

  const handleRegenerateJoinCode = async () => {
    if (!window.confirm('Regenerate Class Join Code? Old code will stop working.')) return;
    try {
      const res = await api.post('/admin/settings/join-code/regenerate');
      if (res.data.success) {
        setJoinCode(res.data.joinCode);
        setCustomJoinInput(res.data.joinCode);
        setIsJoinCodeActive(res.data.isJoinCodeActive);
        showToast('success', res.data.message);
      }
    } catch (err) {
      showToast('error', 'Failed to regenerate join code.');
    }
  };

  const handleToggleJoinCode = async () => {
    try {
      const res = await api.patch('/admin/settings/join-code/toggle');
      if (res.data.success) {
        setIsJoinCodeActive(res.data.isJoinCodeActive);
        showToast('success', res.data.message);
      }
    } catch (err) {
      showToast('error', 'Failed to toggle join code.');
    }
  };

  const refreshAdminData = async () => {
    await Promise.all([fetchDashboardStats(), fetchSubjects(), fetchAssignments()]);
  };

  useEffect(() => {
    fetchDashboardStats();
    fetchSubjects();
    fetchAssignments();
    fetchJoinCode();
  }, []);

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
  }, [activeTab, currentPage, filterSubjectId, filterAssignmentId, filterStatus, groupFilterSubject, groupFilterAssignment, groupSearch, lateFilterSubject, lateFilterStatus, lateSearch, studentSearch]);

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
      showToast('error', err.response?.data?.message || 'Failed to save subject.');
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
      showToast('error', err.response?.data?.message || 'Failed to delete subject.');
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
        allowedFileTypes: allowedArray,
        maxFileSize: Number(assignmentForm.maxFileSize),
        maxGroupSize: Number(assignmentForm.maxGroupSize),
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
      showToast('error', err.response?.data?.message || 'Failed to save assignment.');
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
      showToast('error', err.response?.data?.message || 'Failed to delete assignment.');
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
        showToast('error', 'Failed to download file.');
      }
    }
  };

  // ZIP DOWNLOAD
  const handleDownloadZip = async (assignmentId: string) => {
    try {
      showToast('success', 'Generating ZIP archive of all submissions... Please wait.');
      const response = await api.get(`/assignments/${assignmentId}/submissions/download-zip`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Assignment_Submissions.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (err: any) {
      showToast('error', 'Failed to download ZIP file.');
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
      showToast('error', 'Failed to export CSV.');
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
      showToast('error', 'Failed to export Groups CSV.');
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

  return (
    <div className="admin-dashboard min-h-[90vh] flex flex-col md:flex-row bg-transparent min-w-0">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 glass-panel-dark text-slate-300 shrink-0 border-r border-white/10 backdrop-blur-xl">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xs uppercase tracking-wider text-blue-400 font-bold">CR Admin Portal</h2>
          <p className="text-sm font-semibold text-white mt-1">Management Suite</p>
        </div>

        <nav className="p-4 space-y-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
              activeTab === 'dashboard'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                : 'hover:bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab('subjects')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
              activeTab === 'subjects'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                : 'hover:bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            Subjects ({subjects.length})
          </button>

          <button
            onClick={() => setActiveTab('assignments')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
              activeTab === 'assignments'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                : 'hover:bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <FileCheck className="w-5 h-5" />
            Assignments ({assignments.length})
          </button>

          <button
            onClick={() => setActiveTab('submissions')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
              activeTab === 'submissions'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                : 'hover:bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <Inbox className="w-5 h-5" />
            Submissions
          </button>

          <button
            onClick={() => setActiveTab('groups')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
              activeTab === 'groups'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                : 'hover:bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-5 h-5" />
            Group Registrations
          </button>

          <button
            onClick={() => setActiveTab('late-requests')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
              activeTab === 'late-requests'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                : 'hover:bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-5 h-5" />
            Late Requests
          </button>

          <button
            onClick={() => setActiveTab('students')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
              activeTab === 'students'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                : 'hover:bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-5 h-5" />
            Registered Students
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
              activeTab === 'settings'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                : 'hover:bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-5 h-5" />
            Class Join Code
          </button>
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
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h1>
              <p className="text-slate-500 text-sm">Real-time statistics for class assignment submissions.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
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
                className="text-left glass-panel p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between cursor-pointer card-3d hover:border-indigo-300 transition group"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold uppercase text-slate-500 group-hover:text-indigo-600 transition">Assignments</span>
                  <div className="p-2 bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white rounded-xl text-indigo-600 transition shadow-sm">
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
                  View All Submissions →
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
                        <td colSpan={6} className="text-center py-6 text-slate-400 text-sm">
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
                  {recentSubmissions.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No recent submissions recorded yet.</p> : recentSubmissions.map((sub) => (
                    <div key={sub._id} className="p-3 space-y-1.5">
                      <div className="flex justify-between gap-2"><p className="font-bold text-slate-900 break-words">{sub.studentName}</p><span className="shrink-0 px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-md">{sub.status}</span></div>
                      <p className="text-xs text-slate-600 break-words">{sub.rollNumber} · {(sub.subjectId as any)?.name || 'Subject'}</p>
                      <p className="text-xs font-semibold text-slate-700 break-words">{(sub.assignmentId as any)?.title || 'Assignment'}</p>
                      <p className="text-[11px] text-slate-500">{formatDate(sub.submittedAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

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
                  setSubjectForm({ name: '', code: '', description: '', isActive: true });
                  setSubjectModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow transition"
              >
                <Plus className="w-4 h-4" /> Add Subject
              </button>
            </div>

            <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
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

              <div className="assignment-cards sm:hidden divide-y divide-slate-100">
                {assignments.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-400">No assignments created yet.</div>
                ) : (
                  assignments.map((ass) => (
                    <article key={ass._id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-blue-700 break-words">
                            {(ass.subjectId as any)?.name || 'N/A'} ({(ass.subjectId as any)?.code || ''})
                          </p>
                          <h3 className="font-bold text-slate-900 break-words">{ass.title}</h3>
                        </div>
                        {renderStatusBadge(assignmentStatus(ass))}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <div><span className="text-slate-500">Deadline</span><p className="font-semibold text-slate-700 break-words">{formatDate(ass.deadline)}</p></div>
                        <div><span className="text-slate-500">Mode</span><p className="font-semibold text-slate-700">{ass.submissionType === 'Individual' ? 'Individual' : `Group (${ass.maxGroupSize || 4} max)`}</p></div>
                        <div><span className="text-slate-500">Late allowed</span><p className={`font-bold ${ass.allowLateSubmission ? 'text-emerald-700' : 'text-red-700'}`}>{ass.allowLateSubmission ? 'Yes' : 'No'}</p></div>
                        <div><span className="text-slate-500">Max file</span><p className="font-semibold text-slate-700">{ass.maxFileSize} MB</p></div>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2 text-xs">
                        <span className="text-slate-500">Status</span>
                        {renderStatusBadge(assignmentStatus(ass))}
                      </div>
                      <p className="text-xs text-slate-600 break-words"><span className="text-slate-500">Files:</span> {ass.allowedFileTypes.join(', ').toUpperCase()}</p>
                      <div className="border-t border-slate-200 pt-2">
                        <p className="text-xs text-slate-500 mb-2">Actions</p>
                        <div className="flex flex-wrap gap-2">
                        <button title="Download All as ZIP" onClick={() => handleDownloadZip(ass._id)} className="inline-flex items-center gap-1.5 px-2.5 py-2 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg"><Download className="w-4 h-4" /> ZIP</button>
                        <button title="Export CSV" onClick={() => handleExportCsv(ass._id)} className="inline-flex items-center gap-1.5 px-2.5 py-2 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-lg"><FileSpreadsheet className="w-4 h-4" /> CSV</button>
                        <button title="View unsubmitted students" onClick={() => fetchDefaulters(ass)} className="inline-flex items-center gap-1.5 px-2.5 py-2 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg"><UserX className="w-4 h-4" /> Defaulters</button>
                        <button title="Edit assignment" onClick={() => {
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
                            submissionType: ass.submissionType || 'Group',
                            isActive: ass.isActive,
                          });
                          setAssignmentModalOpen(true);
                        }} className="inline-flex items-center gap-1.5 px-2.5 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg"><Edit2 className="w-4 h-4" /> Edit</button>
                        <button title="Delete assignment" onClick={() => handleDeleteAssignment(ass._id)} className="inline-flex items-center gap-1.5 px-2.5 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg"><Trash2 className="w-4 h-4" /> Delete</button>
                        </div>
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
                            <span className="px-2 py-0.5 font-bold bg-purple-100 text-purple-800 rounded-md">
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
                            title="Download All as ZIP"
                            onClick={() => handleDownloadZip(ass._id)}
                            className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition"
                          >
                            <Download className="w-4 h-4" />
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
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition"
                  >
                    <Download className="w-4 h-4" /> Download All as ZIP
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

            {/* Filter Bar */}
            <div className="glass-panel p-4 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name or roll #"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchSubmissions(1)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={filterSubjectId}
                onChange={(e) => {
                  setFilterSubjectId(e.target.value);
                  setFilterAssignmentId('');
                  setCurrentPage(1);
                }}
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
                value={filterAssignmentId}
                onChange={(e) => {
                  setFilterAssignmentId(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                <option value="">All Assignments</option>
                {assignments
                  .filter((a) => !filterSubjectId || (a.subjectId as any)?._id === filterSubjectId || a.subjectId === filterSubjectId)
                  .map((ass) => (
                    <option key={ass._id} value={ass._id}>
                      {ass.title}
                    </option>
                  ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                <option value="">All Statuses</option>
                <option value="Submitted">On Time</option>
                <option value="Late">Late</option>
                <option value="Submitted Late — CR Approved">Submitted Late — CR Approved</option>
              </select>
            </div>

            {/* Submissions Table */}
            <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-x-auto">
              <table className="hidden sm:table w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold text-xs uppercase">
                    <th className="p-4">Submission ID</th>
                    <th className="p-4">Roll #</th>
                    <th className="p-4">Student Name</th>
                    <th className="p-4">Subject</th>
                    <th className="p-4">Assignment</th>
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
                        No submissions match the selected filters.
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

              <button
                onClick={handleExportGroupsCsv}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow transition"
              >
                <FileSpreadsheet className="w-4 h-4" /> Export Groups CSV
              </button>
            </div>

            {/* Filter bar */}
            <div className="glass-panel p-4 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search group name or roll #"
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={groupFilterSubject}
                onChange={(e) => {
                  setGroupFilterSubject(e.target.value);
                  setGroupFilterAssignment('');
                }}
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
                value={groupFilterAssignment}
                onChange={(e) => setGroupFilterAssignment(e.target.value)}
                disabled={!groupFilterSubject}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">
                  {groupFilterSubject ? 'All Active Assignments' : 'Select Subject First'}
                </option>
                {assignments
                  .filter((assignment) => {
                    const assignmentSubjectId = typeof assignment.subjectId === 'string'
                      ? assignment.subjectId
                      : assignment.subjectId._id;
                    return assignmentSubjectId === groupFilterSubject && assignment.isActive;
                  })
                  .map((assignment) => (
                    <option key={assignment._id} value={assignment._id}>
                      {assignment.title}
                    </option>
                  ))}
              </select>
            </div>

            {/* Groups Grid / Cards */}
            <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-hidden p-6">
              {loadingGroups ? (
                <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> Loading groups...
                </div>
              ) : groups.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  No student groups registered yet.
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

        {/* 6. LATE REQUESTS TAB */}
        {activeTab === 'late-requests' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Late Submission Requests</h1>
              <p className="text-slate-500 text-sm">Review and decide late submission requests submitted by students/groups.</p>
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
                          {(req.assignmentId as any)?.title || 'N/A'}
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
                            disabled={req.status === 'Approved'}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold text-xs rounded-lg transition inline-flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Allow Submission
                          </button>
                          <button
                            onClick={() => handleLateDecision(req._id, 'Rejected')}
                            disabled={req.status === 'Rejected'}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold text-xs rounded-lg transition inline-flex items-center gap-1"
                          >
                            <X className="w-3 h-3" /> Reject
                          </button>
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
                    <p className="text-xs text-slate-700 break-words">{(req.subjectId as any)?.name || 'Subject'} · {(req.assignmentId as any)?.title || 'Assignment'}</p>
                    <p className="text-xs text-slate-600 break-words">Reason: {req.reason || 'No reason provided'}</p>
                    <p className="text-[11px] text-slate-500">Requested: {formatDate(req.requestedAt)}</p>
                    <div className="grid grid-cols-2 gap-2 pt-1"><button onClick={() => handleLateDecision(req._id, 'Approved')} disabled={req.status === 'Approved'} className="py-2 bg-emerald-600 disabled:bg-emerald-300 text-white text-xs font-bold rounded-lg">Allow Submission</button><button onClick={() => handleLateDecision(req._id, 'Rejected')} disabled={req.status === 'Rejected'} className="py-2 bg-red-600 disabled:bg-red-300 text-white text-xs font-bold rounded-lg">Reject</button></div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div><h1 className="text-2xl font-bold text-slate-900">Registered Students</h1><p className="text-slate-500 text-sm">Manage student names, roll numbers and account access.</p></div>
              <input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Search name, roll or email" className="w-full sm:w-72 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm" />
            </div>
            <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead><tr className="bg-slate-50 text-xs uppercase text-slate-600"><th className="p-4">Name</th><th className="p-4">Roll No</th><th className="p-4">Email</th><th className="p-4">Joined</th><th className="p-4">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingStudents ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading students...</td></tr> : registeredStudents.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-400">No registered students.</td></tr> : registeredStudents.map((studentRecord) => (
                    <tr key={studentRecord._id}><td className="p-4 font-semibold">{studentRecord.name}</td><td className="p-4 font-mono">{studentRecord.rollNumber}</td><td className="p-4 break-all">{studentRecord.email}</td><td className="p-4 text-xs text-slate-500">{formatDate(studentRecord.createdAt)}</td><td className="p-4"><div className="flex flex-wrap gap-2"><button onClick={() => { setEditingStudent(studentRecord); setStudentEditForm({ name: studentRecord.name, rollNumber: studentRecord.rollNumber }); setStudentEditModalOpen(true); }} className="px-2.5 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg">Edit</button><button onClick={() => { setResetPassStudent(studentRecord); setResetPassModalOpen(true); }} className="px-2.5 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg">Reset Password</button><button onClick={() => handleDeleteStudent(studentRecord._id, studentRecord.name, studentRecord.rollNumber)} className="px-2.5 py-1.5 bg-red-50 text-red-700 text-xs font-bold rounded-lg">Delete</button></div></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. SETTINGS TAB — CLASS JOIN CODE MANAGEMENT */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Class Access & Join Code Settings</h1>
              <p className="text-slate-500 text-sm">
                Control student self-registration access. Students require an active Class Join Code to register.
              </p>
            </div>

            <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl p-6 sm:p-8 space-y-6 max-w-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Active Class Join Code</h3>
                  <p className="text-xs text-slate-500">Share this code with your class students to allow self-registration.</p>
                </div>
                <button
                  onClick={handleToggleJoinCode}
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
                      Set Custom Class Join Code (Edited by CR)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MYCLASS2026"
                      value={customJoinInput}
                      onChange={(e) => setCustomJoinInput(e.target.value.toUpperCase())}
                      required
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
                      {joinCode || 'CLASS-2026-PORTAL'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
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
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"><form onSubmit={handleSaveStudentEdit} className="glass-panel rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200/80 dark:border-white/10 shadow-2xl"><h3 className="font-bold text-slate-900">Edit Student</h3><input value={studentEditForm.name} onChange={(e) => setStudentEditForm({ ...studentEditForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" placeholder="Name" required /><input value={studentEditForm.rollNumber} onChange={(e) => setStudentEditForm({ ...studentEditForm, rollNumber: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm font-mono" placeholder="Roll number" required /><div className="flex justify-end gap-2"><button type="button" onClick={() => setStudentEditModalOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold">Cancel</button><button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow">Save</button></div></form></div>
        )}

        {resetPassModalOpen && resetPassStudent && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"><form onSubmit={handleResetStudentPassword} className="glass-panel rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200/80 dark:border-white/10 shadow-2xl"><h3 className="font-bold text-slate-900">Reset Student Password</h3><input type="password" value={newStudentPassInput} onChange={(e) => setNewStudentPassInput(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" placeholder="New password" required /><div className="flex justify-end gap-2"><button type="button" onClick={() => setResetPassModalOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold">Cancel</button><button className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow">Reset Password</button></div></form></div>
        )}

        {/* MODAL: ADD / EDIT SUBJECT */}
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
                      <p className="text-[10px] text-slate-500 mt-0.5">Fewer members allowed, not more.</p>
                    </div>
                  ) : (
                    <div className="flex items-center text-xs text-slate-500 pt-5">
                      Single student submission only
                    </div>
                  )}
                </div>

                {assignmentForm.submissionType === 'Group' && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-purple-900 mb-1">
                        Group Registration Deadline
                      </label>
                      <input
                        type="datetime-local"
                        value={assignmentForm.groupDeadline}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, groupDeadline: e.target.value })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-xl text-xs font-semibold bg-white"
                      />
                      <p className="text-[10px] text-purple-700 mt-0.5">
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
                        className="rounded text-purple-600"
                      />
                      <label htmlFor="allowLateGroup" className="text-xs font-bold text-purple-900">
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
                      value={assignmentForm.maxFileSize}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, maxFileSize: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="allowLate"
                      checked={assignmentForm.allowLateSubmission}
                      onChange={(e) =>
                        setAssignmentForm({ ...assignmentForm, allowLateSubmission: e.target.checked })
                      }
                      className="rounded text-blue-600"
                    />
                    <label htmlFor="allowLate" className="text-xs font-bold text-slate-700">
                      Allow Late Submissions after Deadline
                    </label>
                  </div>
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
      </main>
    </div>
  );
};
