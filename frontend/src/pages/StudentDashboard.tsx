import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { openSubmissionFile } from '../api/axios';
import { Subject, Assignment, Submission, StudentUser, SubmissionReceipt, Group, LateRequest, CRApplication, Class } from '../types';
import { useAuth } from '../context/AuthContext';
import { StudentQuizSection } from '../components/StudentQuizSection';
import { PasswordInput } from '../components/PasswordInput';
import { PasswordRequirements } from '../components/PasswordRequirements';
import {
  User,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Send,
  Loader2,
  AlertTriangle,
  History,
  Trash2,
  Users,
  UserPlus,
  Repeat,
  Plus,
  Check,
  Crown,
  KeyRound,
  Edit2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user, replaceToken, switchToStaffPortal, logout } = useAuth();
  const navigate = useNavigate();
  const student = user as StudentUser;

  const validTabs = ['submit', 'quizzes', 'groups', 'history', 'security', 'cr-application'] as const;
  type TabType = typeof validTabs[number];

  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab') as TabType;
    if (tabFromUrl !== 'cr-application' && validTabs.includes(tabFromUrl)) return tabFromUrl;
    const savedTab = localStorage.getItem('student_active_tab') as TabType;
    if (savedTab !== 'cr-application' && validTabs.includes(savedTab)) return savedTab;
    return 'submit';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const isSidebarCollapsed = sidebarCollapsed && !mobileSidebarOpen;

  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    localStorage.setItem('student_active_tab', tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState(null, '', url.toString());
  };

  const handleTabChange = (tab: TabType) => {
    setReceipt(null);
    setActiveTab(tab);
  };

  // Subjects & Assignments with instant cache rehydration
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    try {
      const cached = sessionStorage.getItem('portal_cached_subjects');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(() => {
    try {
      return !sessionStorage.getItem('portal_cached_subjects');
    } catch {
      return true;
    }
  });
  const [loadingAssignments, setLoadingAssignments] = useState<boolean>(false);

  // Student's Own Submissions History with instant cache rehydration
  const [mySubmissions, setMySubmissions] = useState<Submission[]>(() => {
    try {
      const cached = sessionStorage.getItem('portal_cached_my_submissions');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loadingHistory, setLoadingHistory] = useState<boolean>(() => {
    try {
      return !sessionStorage.getItem('portal_cached_my_submissions');
    } catch {
      return false;
    }
  });

  // Form State
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    try {
      return sessionStorage.getItem('portal_selected_subject_id') || '';
    } catch {
      return '';
    }
  });
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  // UI & Late Request State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const [lateReqStatus, setLateReqStatus] = useState<LateRequest | null>(null);
  const [loadingLateStatus, setLoadingLateStatus] = useState<boolean>(false);
  const [lateReason, setLateReason] = useState<string>('');
  const [submittingLateReq, setSubmittingLateReq] = useState<boolean>(false);
  const [lateReqSuccessMsg, setLateReqSuccessMsg] = useState<string | null>(null);

  // Group Registration State
  const [groupSubjectId, setGroupSubjectId] = useState<string>('');
  const [groupAssignmentId, setGroupAssignmentId] = useState<string>('');
  const [groupAssignments, setGroupAssignments] = useState<Assignment[]>(() => {
    try {
      const cached = sessionStorage.getItem('portal_cached_group_assignments');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [myGroup, setMyGroup] = useState<Group | null>(null);
  const [loadingMyGroup, setLoadingMyGroup] = useState<boolean>(false);

  const [groupMode, setGroupMode] = useState<'create' | 'continue'>('create');
  const [groupName, setGroupName] = useState<string>('');
  const [groupNameLoading, setGroupNameLoading] = useState<boolean>(false);
  const [extraMembers, setExtraMembers] = useState<{ name: string; rollNumber: string }[]>([
    { name: '', rollNumber: '' },
  ]);
  const [leaderIndex, setLeaderIndex] = useState<number>(0); // 0 is self
  const [previousGroups, setPreviousGroups] = useState<Group[]>([]);
  const [loadingPrevGroups, setLoadingPrevGroups] = useState<boolean>(false);
  const [groupSubmitting, setGroupSubmitting] = useState<boolean>(false);
  const [groupMsg, setGroupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [groupLateRequest, setGroupLateRequest] = useState<LateRequest | null>(null);
  const [groupLateReason, setGroupLateReason] = useState<string>('');
  const [submittingGroupLateRequest, setSubmittingGroupLateRequest] = useState<boolean>(false);

  // Group Edit Modal State
  const [groupEditModalOpen, setGroupEditModalOpen] = useState<boolean>(false);
  const [editGroupName, setEditGroupName] = useState<string>('');
  const [editMembers, setEditMembers] = useState<{ name: string; rollNumber: string }[]>([
    { name: '', rollNumber: '' },
  ]);
  const [editLeaderIndex, setEditLeaderIndex] = useState<number>(0);
  const [editingGroupSaving, setEditingGroupSaving] = useState<boolean>(false);
  const [groupEditError, setGroupEditError] = useState<string | null>(null);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [changingPass, setChangingPass] = useState<boolean>(false);
  const [deletingAccount, setDeletingAccount] = useState<boolean>(false);
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deadlineTick, setDeadlineTick] = useState(() => Date.now());
  const [uploadGroup, setUploadGroup] = useState<Group | null>(null);
  const [selectedSubmissionMemberId, setSelectedSubmissionMemberId] = useState<string>(student.id);
  const [selectedSubmissionMemberIds, setSelectedSubmissionMemberIds] = useState<string[]>([student.id]);
  const [receiptMembers, setReceiptMembers] = useState<string[]>([]);
  const [loadingUploadGroup, setLoadingUploadGroup] = useState<boolean>(false);

  // CR Application State
  const [crAppStatus, setCRAppStatus] = useState<CRApplication | null>(null);
  const [crAppLoading, setCRAppLoading] = useState(false);
  const [crAppClasses, setCRAppClasses] = useState<Class[]>([]);
  const [crAppClassId, setCRAppClassId] = useState('');
  const [crAppRoleType, setCRAppRoleType] = useState<'CR' | 'CR_ASSISTANT'>('CR');
  const [crAppReason, setCRAppReason] = useState('');
  const [crAppSubmitting, setCRAppSubmitting] = useState(false);
  const [crAppMsg, setCRAppMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setDeadlineTick(Date.now()), 10000);
    return () => window.clearInterval(timer);
  }, []);

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

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);
    if (!currentPassword || !newPassword) {
      setPassMsg({ type: 'error', text: 'Please fill in all password fields.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    try {
      setChangingPass(true);
      const res = await api.post('/auth/student/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (res.data.success) {
        if (res.data.token) replaceToken(res.data.token);
        setPassMsg({ type: 'success', text: res.data.message });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPassMsg({ type: 'error', text: err.response?.data?.message || 'Failed to change password.' });
    } finally {
      setChangingPass(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Delete your account permanently? Your submissions, quiz data, group membership, and linked CR access will also be deleted. Other group members will remain. This cannot be undone.'
    );
    if (!confirmed) return;

    try {
      setDeletingAccount(true);
      await api.delete('/auth/student/me');
      Object.keys(sessionStorage)
        .filter((key) => key.startsWith('portal_cached_'))
        .forEach((key) => sessionStorage.removeItem(key));
      logout();
      navigate('/student/login', { replace: true });
    } catch (error: any) {
      window.alert(error.response?.data?.message || 'Failed to delete your account.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const getDeadlineCountdown = (deadlineStr: string) => {
    const diff = new Date(deadlineStr).getTime() - deadlineTick;
    if (diff <= 0) {
      return { text: '⌛ Deadline Passed', color: 'bg-red-100 text-red-800 border-red-300 font-bold' };
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return {
        text: `⏳ Due in ${days}d ${remainingHours}h ${mins}m`,
        color: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold',
      };
    }
    return {
      text: `⏳ Due in ${hours}h ${mins}m (Ending Soon!)`,
      color: 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold animate-pulse',
    };
  };

  // Fetch Subjects & Profile Data concurrently
  const fetchStudentData = async () => {
    const fetchSubjectsPromise = async () => {
      try {
        setLoadingSubjects(true);
        const res = await api.get('/subjects');
        if (res.data.success) {
          setSubjects(res.data.subjects);
          try {
            sessionStorage.setItem('portal_cached_subjects', JSON.stringify(res.data.subjects));
          } catch {}
        }
      } catch (err) {
        console.error('Failed to load subjects:', err);
      } finally {
        setLoadingSubjects(false);
      }
    };

    const fetchAssignmentsPromise = async () => {
      try {
        const res = await api.get('/assignments');
        if (res.data.success) {
          const groupList = res.data.assignments.filter((assignment: Assignment) => assignment.submissionType === 'Group');
          setGroupAssignments(groupList);
          try {
            sessionStorage.setItem('portal_cached_group_assignments', JSON.stringify(groupList));
          } catch {}
        }
      } catch (err) {
        console.error('Failed to load group assignments:', err);
      }
    };

    const fetchProfilePromise = async () => {
      try {
        setLoadingHistory(!sessionStorage.getItem('portal_cached_my_submissions'));
        const res = await api.get('/auth/student/me');
        if (res.data.success) {
          setMySubmissions(res.data.submissions);
          try {
            sessionStorage.setItem('portal_cached_my_submissions', JSON.stringify(res.data.submissions));
          } catch {}
        }
      } catch (err) {
        console.error('Failed to load profile submissions:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    await Promise.allSettled([fetchSubjectsPromise(), fetchAssignmentsPromise(), fetchProfilePromise()]);
  };

  const refreshSubmissionHistory = async () => {
    try {
      setLoadingHistory(!sessionStorage.getItem('portal_cached_my_submissions'));
      const res = await api.get('/auth/student/me');
      if (res.data.success) {
        setMySubmissions(res.data.submissions);
        try {
          sessionStorage.setItem('portal_cached_my_submissions', JSON.stringify(res.data.submissions));
        } catch {}
      }
    } catch (err) {
      setErrorMsg('Failed to refresh submission history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, []);

  useEffect(() => {
    if (activeTab === 'history' && !receipt) {
      refreshSubmissionHistory();
    }
  }, [activeTab, receipt]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    const timer = window.setInterval(async () => {
      try {
        const res = await api.get('/auth/student/me');
        if (res.data.success) setMySubmissions(res.data.submissions || []);
      } catch (error) {
        console.error('Failed to refresh late submission access.', error);
      }
    }, 10000);
    return () => window.clearInterval(timer);
  }, [activeTab]);

  const fetchCRAppData = async () => {
    try {
      setCRAppLoading(true);
      const [statusRes, classesRes] = await Promise.allSettled([
        api.get('/cr-applications/my-status'),
        api.get('/classes'),
      ]);
      if (statusRes.status === 'fulfilled' && statusRes.value.data.success) {
        setCRAppStatus(statusRes.value.data.application || null);
      }
      if (classesRes.status === 'fulfilled' && classesRes.value.data.success) {
        setCRAppClasses(classesRes.value.data.classes || []);
      }
    } catch {
      // silent
    } finally {
      setCRAppLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'cr-application') {
      fetchCRAppData();
    }
  }, [activeTab]);

  const handleCRAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCRAppMsg(null);
    if (!crAppClassId) {
      setCRAppMsg({ type: 'error', text: 'Please select a class.' });
      return;
    }
    try {
      setCRAppSubmitting(true);
      const res = await api.post('/cr-applications/apply', {
        classId: crAppClassId,
        roleType: crAppRoleType,
        reason: crAppReason.trim() || undefined,
      });
      if (res.data.success) {
        setCRAppMsg({ type: 'success', text: res.data.message });
        await fetchCRAppData();
      }
    } catch (err: any) {
      setCRAppMsg({ type: 'error', text: err.response?.data?.message || 'Failed to submit application.' });
    } finally {
      setCRAppSubmitting(false);
    }
  };



  // Fetch assignments when subject changes with instant cache rehydration
  useEffect(() => {
    if (!selectedSubjectId) {
      setAssignments([]);
      setSelectedAssignmentId('');
      setSelectedAssignment(null);
      setLateReqStatus(null);
      return;
    }

    try {
      const cached = sessionStorage.getItem(`portal_cached_assigns_${selectedSubjectId}`);
      if (cached) {
        setAssignments(JSON.parse(cached));
      }
    } catch {}

    const fetchAssignments = async () => {
      try {
        setLoadingAssignments(() => {
          try {
            return !sessionStorage.getItem(`portal_cached_assigns_${selectedSubjectId}`);
          } catch {
            return true;
          }
        });
        const res = await api.get(`/assignments?subjectId=${selectedSubjectId}`);
        if (res.data.success) {
          setAssignments(res.data.assignments);
          try {
            sessionStorage.setItem(`portal_cached_assigns_${selectedSubjectId}`, JSON.stringify(res.data.assignments));
          } catch {}
        }
      } catch (err) {
        console.error('Failed to load assignments:', err);
      } finally {
        setLoadingAssignments(false);
      }
    };

    fetchAssignments();
  }, [selectedSubjectId]);

  const groupSubjects = subjects.filter((subject) =>
    groupAssignments.some((assignment) => {
      const assignmentSubjectId = typeof assignment.subjectId === 'string'
        ? assignment.subjectId
        : assignment.subjectId._id;
      return assignmentSubjectId === subject._id;
    })
  );

  const selectedGroupAssignments = groupAssignments.filter((assignment) => {
    const assignmentSubjectId = typeof assignment.subjectId === 'string'
      ? assignment.subjectId
      : assignment.subjectId._id;
    return assignmentSubjectId === groupSubjectId;
  });
  const selectedGroupAssignmentIds = selectedGroupAssignments.map((assignment) => assignment._id).join(',');
  const selectedGroupAssignment = selectedGroupAssignments.find((assignment) => assignment._id === groupAssignmentId);
  const selectedGroupSubject = subjects.find((subject) => subject._id === groupSubjectId);
  const maxGroupMembers = selectedGroupAssignments.find((assignment) => assignment._id === groupAssignmentId)?.maxGroupSize || 4;

  useEffect(() => {
    if (!selectedAssignmentId) {
      setSelectedAssignment(null);
      setLateReqStatus(null);
      setUploadGroup(null);
      setSelectedSubmissionMemberId(student.id);
      setSelectedSubmissionMemberIds([student.id]);
      return;
    }
    const found = assignments.find((a) => a._id === selectedAssignmentId);
    setSelectedAssignment(found || null);
    setSelectedSubmissionMemberId(student.id);
    setSelectedSubmissionMemberIds([student.id]);
    setUploadGroup(null);

    // Check late request status if past deadline
    if (found) {
      const isPast = new Date() > new Date(found.deadline);
      if (!isPast) {
        setLateReqStatus(null);
      }
    }
  }, [selectedAssignmentId, assignments, student.id]);

  useEffect(() => {
    if (!selectedAssignment || selectedAssignment.submissionType !== 'Group' || !selectedSubjectId) {
      setUploadGroup(null);
      setLoadingUploadGroup(false);
      return;
    }

    let active = true;
    const fetchUploadGroup = async () => {
      setLoadingUploadGroup(true);
      try {
        const res = await api.get(`/groups/my-group/${selectedSubjectId}?assignmentId=${selectedAssignment._id}`);
        if (!active) return;
        const group: Group | null = res.data.group || null;
        setUploadGroup(group);
        const ownIndex = group?.members.findIndex((member) =>
          member.studentId === student.id || member.rollNumber.toLowerCase() === student.rollNumber.toLowerCase()
        ) ?? -1;
        const alreadySubmitted = group?.submittedMembers?.some(
          (submission) => submission.rollNumber.toLowerCase() === student.rollNumber.toLowerCase()
        );
        if (ownIndex >= 0 && !alreadySubmitted) {
          setSelectedSubmissionMemberIds([student.id]);
        } else {
          setSelectedSubmissionMemberIds([]);
        }
      } catch (err: any) {
        if (active) setErrorMsg(err.response?.data?.message || 'Unable to load your assignment group.');
      } finally {
        if (active) setLoadingUploadGroup(false);
      }
    };

    void fetchUploadGroup();
    return () => {
      active = false;
    };
  }, [selectedAssignment, selectedSubjectId, student.id, student.rollNumber]);

  const fetchLateRequestStatus = async (assignmentId: string, studentId: string = student.id) => {
    try {
      setLoadingLateStatus(true);
      const params = new URLSearchParams({ assignmentId, studentId });
      const res = await api.get(`/late-requests/my-status?${params.toString()}`);
      if (res.data.success) {
        setLateReqStatus(res.data.request);
      }
    } catch (err) {
      console.error('Failed to fetch late request status:', err);
    } finally {
      setLoadingLateStatus(false);
    }
  };

  useEffect(() => {
    if (!selectedAssignment || Date.now() <= new Date(selectedAssignment.deadline).getTime()) return;
    void fetchLateRequestStatus(selectedAssignment._id, selectedSubmissionMemberId);
  }, [selectedAssignment?._id, selectedAssignment?.deadline, selectedSubmissionMemberId]);

  useEffect(() => {
    if (!selectedAssignment || Date.now() <= new Date(selectedAssignment.deadline).getTime()) return;
    if (lateReqStatus?.status === 'Approved' || lateReqStatus?.status === 'Rejected') return;

    const interval = window.setInterval(() => {
      void fetchLateRequestStatus(selectedAssignment._id, selectedSubmissionMemberId);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [selectedAssignment?._id, selectedAssignment?.deadline, selectedSubmissionMemberId, lateReqStatus?.status]);

  useEffect(() => {
    const hasLateApproval = Boolean(
      (lateReqStatus?.status === 'Approved'
        && lateReqStatus.decidedAt
        && Date.now() < new Date(lateReqStatus.decidedAt).getTime() + 5 * 60 * 1000)
      || mySubmissions.some((submission) =>
        submission.lateSubmissionApprovedAt
        && Date.now() < new Date(submission.lateSubmissionApprovedAt).getTime() + 5 * 60 * 1000
      )
    );
    if (!hasLateApproval) return;

    const timer = window.setInterval(() => setDeadlineTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [lateReqStatus?.status, mySubmissions]);

  const handleCreateLateRequest = async () => {
    if (!selectedSubjectId || !selectedAssignmentId) return;

    try {
      setSubmittingLateReq(true);
      setLateReqSuccessMsg(null);
      setErrorMsg(null);
      const res = await api.post('/late-requests', {
        subjectId: selectedSubjectId,
        assignmentId: selectedAssignmentId,
        reason: lateReason,
      });

      if (res.data.success) {
        setLateReqSuccessMsg(res.data.message);
        setLateReqStatus(res.data.request);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit late request.');
    } finally {
      setSubmittingLateReq(false);
    }
  };

  // Group Registration Handlers
  useEffect(() => {
    const assignmentBelongsToSubject = selectedGroupAssignments.some(
      (assignment) => assignment._id === groupAssignmentId
    );
    if (!groupSubjectId || !groupAssignmentId || !assignmentBelongsToSubject) {
      setMyGroup(null);
      setLoadingMyGroup(false);
      return;
    }

    setExtraMembers(
      Array.from({ length: maxGroupMembers - 1 }, () => ({ name: '', rollNumber: '' }))
    );
    setLeaderIndex(0);
    setGroupName('');

    const fetchGroupData = async () => {
      try {
        setLoadingMyGroup(true);
        setGroupMsg(null);
        const res = await api.get(`/groups/my-group/${groupSubjectId}?assignmentId=${groupAssignmentId}`);
        if (res.data.success) {
          setMyGroup(res.data.group);
          if (!res.data.group) {
            fetchNextGroupNumber(groupSubjectId, groupAssignmentId);
          }
        }
      } catch (err) {
        console.error('Failed to fetch group info:', err);
      } finally {
        setLoadingMyGroup(false);
        setLoadingPrevGroups(false);
      }
    };

    const fetchNextGroupNumber = async (subId: string, assId: string) => {
      try {
        setGroupNameLoading(true);
        const res = await api.get(`/groups/next-number?subjectId=${subId}&assignmentId=${assId}`);
        if (res.data.success && res.data.suggestedGroupName) {
          setGroupName(res.data.suggestedGroupName);
        } else {
          setGroupName('');
          setGroupMsg({ type: 'error', text: 'Could not determine the next group number. Please refresh and try again.' });
        }
      } catch (err) {
        setGroupName('');
        setGroupMsg({ type: 'error', text: 'Could not load the next group number. Please refresh and try again.' });
      } finally {
        setGroupNameLoading(false);
      }
    };

    fetchGroupData();
  }, [groupSubjectId, groupAssignmentId, selectedGroupAssignmentIds]);

  useEffect(() => {
    if (!groupSubjectId) return;
    const fetchPreviousGroups = async () => {
      try {
        setLoadingPrevGroups(true);
        const res = await api.get('/groups/my-previous-groups');
        if (res.data.success) setPreviousGroups(res.data.groups);
      } catch (err) {
        console.error('Failed to fetch previous groups:', err);
      } finally {
        setLoadingPrevGroups(false);
      }
    };
    fetchPreviousGroups();
  }, [groupSubjectId]);

  useEffect(() => {
    if (selectedGroupAssignments.length === 0) {
      setGroupAssignmentId('');
    } else if (!selectedGroupAssignments.some((assignment) => assignment._id === groupAssignmentId)) {
      setGroupAssignmentId(selectedGroupAssignments[0]._id);
    }
  }, [selectedGroupAssignmentIds, groupAssignmentId]);

  useEffect(() => {
    if (!groupAssignmentId) {
      setGroupLateRequest(null);
      return;
    }
    const fetchGroupLateRequest = async () => {
      try {
        const res = await api.get(`/late-requests/my-status?assignmentId=${groupAssignmentId}&requestType=GroupRegistration`);
        if (res.data.success) setGroupLateRequest(res.data.request);
      } catch (err) {
        console.error('Failed to fetch group late request status:', err);
      }
    };
    fetchGroupLateRequest();
    // Refresh every 30 seconds to check for approval
    const interval = setInterval(fetchGroupLateRequest, 30000);
    return () => clearInterval(interval);
  }, [groupAssignmentId]);

  const handleCreateGroupLateRequest = async () => {
    if (!groupSubjectId || !groupAssignmentId) return;
    try {
      setSubmittingGroupLateRequest(true);
      const res = await api.post('/late-requests', {
        subjectId: groupSubjectId,
        assignmentId: groupAssignmentId,
        requestType: 'GroupRegistration',
        reason: groupLateReason,
      });
      if (res.data.success) {
        setGroupLateRequest(res.data.request);
        setGroupMsg({ type: 'success', text: res.data.message });
      }
    } catch (err: any) {
      setGroupMsg({
        type: 'error',
        text: err.response?.data?.message || `Failed to submit late group ${myGroup ? 'edit' : 'registration'} request.`,
      });
    } finally {
      setSubmittingGroupLateRequest(false);
    }
  };

  useEffect(() => {
    if (!groupSubjectId) return;
    setExtraMembers((currentMembers) => {
      if (currentMembers.length === maxGroupMembers - 1) return currentMembers;
      return Array.from({ length: maxGroupMembers - 1 }, (_, index) => currentMembers[index] || { name: '', rollNumber: '' });
    });
  }, [groupSubjectId, groupAssignmentId, maxGroupMembers]);

  const handleAddExtraMember = () => {
    if (extraMembers.length < maxGroupMembers - 1) {
      setExtraMembers([...extraMembers, { name: '', rollNumber: '' }]);
    }
  };

  const handleRemoveExtraMember = (index: number) => {
    const updated = extraMembers.filter((_, i) => i !== index);
    setExtraMembers(updated);
    if (leaderIndex >= updated.length + 1) {
      setLeaderIndex(0);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGroupMsg(null);

    if (!groupSubjectId) {
      setGroupMsg({ type: 'error', text: 'Please select a subject.' });
      return;
    }

    if (!groupAssignmentId) {
      setGroupMsg({ type: 'error', text: 'Please select a group assignment.' });
      return;
    }

    const membersPayload = [
      { name: student?.name, rollNumber: student?.rollNumber },
      ...extraMembers.filter((m) => m.rollNumber.trim()),
    ];

    const seenRolls = new Set<string>();
    for (const member of membersPayload) {
      const roll = member.rollNumber ? member.rollNumber.trim() : '';
      if (roll) {
        if (!/^\d{7}$/.test(roll)) {
          setGroupMsg({
            type: 'error',
            text: `Roll number '${roll}' is invalid. Roll number must be exactly 7 digits (e.g. 2260000).`,
          });
          return;
        }
        const upperRoll = roll.toUpperCase();
        if (seenRolls.has(upperRoll)) {
          setGroupMsg({
            type: 'error',
            text: `Roll number '${roll}' cannot be used more than once in the same group.`,
          });
          return;
        }
        seenRolls.add(upperRoll);
      }
    }

    const leaderRoll = leaderIndex === 0 ? student?.rollNumber : extraMembers[leaderIndex - 1]?.rollNumber?.trim();

    try {
      setGroupSubmitting(true);
      const res = await api.post('/groups', {
        subjectId: groupSubjectId,
        assignmentId: groupAssignmentId || undefined,
        members: membersPayload,
        leaderRollNumber: leaderRoll,
      });

      if (res.data.success) {
        setGroupMsg({ type: 'success', text: res.data.message });
        setMyGroup(res.data.group);
        setGroupName(res.data.group.groupName);
      }
    } catch (err: any) {
      setGroupMsg({ type: 'error', text: err.response?.data?.message || 'Failed to create group.' });
    } finally {
      setGroupSubmitting(false);
    }
  };

  const handleContinueGroup = async (prevGroup: Group) => {
    if (!groupSubjectId) {
      setGroupMsg({ type: 'error', text: 'Please select a subject.' });
      return;
    }

    try {
      setGroupSubmitting(true);
      setGroupMsg(null);
      const res = await api.post('/groups/continue', {
        previousGroupId: prevGroup._id,
        newSubjectId: groupSubjectId,
        newAssignmentId: groupAssignmentId,
      });

      if (res.data.success) {
        setGroupMsg({ type: 'success', text: res.data.message });
        setMyGroup(res.data.group);
      }
    } catch (err: any) {
      setGroupMsg({ type: 'error', text: err.response?.data?.message || 'Failed to continue group.' });
    } finally {
      setGroupSubmitting(false);
    }
  };

  const handleOpenEditGroup = () => {
    if (!myGroup) return;
    const groupDeadline = selectedGroupAssignment?.groupDeadline || selectedGroupAssignment?.deadline;
    const lateEditNeedsApproval = Boolean(
      groupDeadline &&
      new Date(groupDeadline).getTime() < deadlineTick &&
      !selectedGroupAssignment?.allowLateGroupRegistration
    );
    if (lateEditNeedsApproval && groupLateRequest?.status !== 'Approved') {
      setGroupMsg({
        type: 'error',
        text: `First send a late group ${myGroup ? 'edit' : 'registration'} request and wait for CR approval.`,
      });
      return;
    }
    setEditGroupName(myGroup.groupName);
    setEditMembers(myGroup.members.map((m) => ({ name: m.name, rollNumber: m.rollNumber })));
    const leaderIdx = myGroup.members.findIndex(
      (m) => m.rollNumber.toLowerCase() === myGroup.leader.rollNumber.toLowerCase()
    );
    setEditLeaderIndex(leaderIdx >= 0 ? leaderIdx : 0);
    setGroupEditError(null);
    setGroupEditModalOpen(true);
  };

  const handleSaveGroupEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myGroup) return;
    setGroupMsg(null);
    setGroupEditError(null);

    const validMembers = editMembers.filter((m) => m.rollNumber.trim() !== '');
    if (validMembers.length === 0) {
      setGroupEditError('Group must have at least 1 member.');
      return;
    }

    const seen = new Set<string>();
    for (const m of validMembers) {
      const r = m.rollNumber.trim();
      if (!/^\d{7}$/.test(r)) {
        setGroupEditError(`Roll number '${r}' is invalid. Roll number must be exactly 7 digits (e.g. 2260000).`);
        return;
      }
      const upperR = r.toUpperCase();
      if (seen.has(upperR)) {
        setGroupEditError(`Roll number '${r}' cannot be used more than once.`);
        return;
      }
      seen.add(upperR);
    }

    const leaderRoll = validMembers[editLeaderIndex]?.rollNumber || validMembers[0]?.rollNumber;

    try {
      setEditingGroupSaving(true);
      const res = await api.put(`/groups/${myGroup._id}`, {
        groupName: editGroupName.trim(),
        leaderRollNumber: leaderRoll,
        members: validMembers,
      });

      if (res.data.success) {
        setMyGroup(res.data.group);
        setGroupMsg({ type: 'success', text: 'Group members updated successfully!' });
        setGroupEditModalOpen(false);
      }
    } catch (err: any) {
      setGroupEditError(err.response?.data?.message || 'Failed to update group.');
    } finally {
      setEditingGroupSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMsg(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setErrorMsg(null);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteSubmission = async (submissionId: string) => {
    if (!window.confirm('Uploaded the wrong file? Delete this submission to upload the correct file.')) return;
    try {
      setDeletingId(submissionId);
      const res = await api.delete(`/submissions/student/${submissionId}`);
      if (res.data.success) {
        setReceipt(null);
        setReceiptMembers([]);
        setSelectedFile(null);
        await fetchStudentData();
        setActiveTab('submit');
        setErrorMsg(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete submission.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedSubjectId) {
      setErrorMsg('Please select a subject.');
      return;
    }

    if (!selectedAssignmentId) {
      setErrorMsg('Please select an assignment.');
      return;
    }

    if (!selectedFile) {
      setErrorMsg('Please select your assignment file.');
      return;
    }

    const isGroupSubmission = selectedAssignment?.submissionType === 'Group';
    const submissionMemberIds = isGroupSubmission
      ? selectedSubmissionMemberIds
      : [student.id];
    if (isGroupSubmission && submissionMemberIds.length === 0) {
      setErrorMsg('Select at least one group member who has not submitted yet.');
      return;
    }

    if (selectedAssignment) {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase() || '';
      const allowed = selectedAssignment.allowedFileTypes.map((t) => t.replace('.', '').toLowerCase());
      if (!allowed.includes(ext)) {
        setErrorMsg(`Only ${allowed.map((a) => a.toUpperCase()).join(', ')} files are allowed.`);
        return;
      }

      const maxSizeMB = selectedAssignment.maxFileSize || 10;
      if (selectedFile.size > maxSizeMB * 1024 * 1024) {
        setErrorMsg(`File size exceeds the ${maxSizeMB} MB limit.`);
        return;
      }
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      if (isGroupSubmission && isPastDeadline) {
        const lateRequests = await Promise.all(submissionMemberIds.map(async (memberId) => {
          const params = new URLSearchParams({ assignmentId: selectedAssignmentId, studentId: memberId });
          const response = await api.get(`/late-requests/my-status?${params.toString()}`);
          const request = response.data.request as LateRequest | null;
          const expiresAt = request?.decidedAt ? new Date(request.decidedAt).getTime() + 5 * 60 * 1000 : 0;
          return { memberId, request, approved: request?.status === 'Approved' && Date.now() < expiresAt };
        }));
        const deniedMembers = lateRequests
          .filter((entry) => !entry.approved)
          .map((entry) => uploadGroup?.members.find((member) =>
            (member.studentId || (member.rollNumber.toLowerCase() === student.rollNumber.toLowerCase() ? student.id : '')) === entry.memberId
          )?.name || 'A selected member');
        if (deniedMembers.length > 0) {
          setErrorMsg(`Late upload approval is required for: ${deniedMembers.join(', ')}.`);
          return;
        }
      }

      const membersToSubmit = isGroupSubmission
        ? (uploadGroup?.members || []).flatMap((member, index) => {
            const memberId = member.studentId
              || (member.rollNumber.toLowerCase() === student.rollNumber.toLowerCase() ? student.id : '');
            return submissionMemberIds.includes(memberId) ? [{ member, memberId, sequenceNumber: index + 1 }] : [];
          })
        : [{ member: null, memberId: student.id, sequenceNumber: undefined }];
      const submittedReceipts: SubmissionReceipt[] = [];
      const submissionErrors: string[] = [];

      for (const [targetIndex, target] of membersToSubmit.entries()) {
        const formData = new FormData();
        formData.append('subjectId', selectedSubjectId);
        formData.append('assignmentId', selectedAssignmentId);
        formData.append('file', selectedFile);
        if (isGroupSubmission) {
          formData.append('sequenceNumber', String(target.sequenceNumber));
          if (target.memberId !== student.id) {
            formData.append('submissionForStudentId', target.memberId);
          }
        }

        try {
          const res = await api.post('/submissions', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const currentUploadProgress = progressEvent.loaded / progressEvent.total;
                setUploadProgress(Math.round(((targetIndex + currentUploadProgress) / membersToSubmit.length) * 100));
              }
            },
          });
          if (res.data.success) {
            const receipt = res.data.submission as SubmissionReceipt;
            submittedReceipts.push(receipt);
            if (isGroupSubmission) {
              setUploadGroup((current) => {
                if (!current) return current;
                const submittedMember = {
                  studentName: receipt.studentName,
                  rollNumber: receipt.rollNumber,
                  sequenceNumber: target.sequenceNumber,
                  submittedAt: receipt.submittedAt,
                };
                const submittedMembers = current.submittedMembers || [];
                return {
                  ...current,
                  submittedMembers: [
                    ...submittedMembers.filter(
                      (submission) => submission.rollNumber.toLowerCase() !== receipt.rollNumber.toLowerCase()
                    ),
                    submittedMember,
                  ],
                };
              });
            }
          } else {
            submissionErrors.push(`${target.member?.name || student.name}: ${res.data.message || 'Submission failed.'}`);
          }
        } catch (err: any) {
          submissionErrors.push(`${target.member?.name || student.name}: ${err.response?.data?.message || 'Submission failed.'}`);
        }
      }
      setUploadProgress(100);

      if (submittedReceipts.length > 0) {
        await refreshSubmissionHistory();
        if (isGroupSubmission && selectedAssignment) {
          try {
            const groupRes = await api.get(`/groups/my-group/${selectedSubjectId}?assignmentId=${selectedAssignment._id}`);
            const fetchedGroup: Group | null = groupRes.data.group || null;
            const updatedGroup = fetchedGroup && uploadGroup
              ? {
                  ...fetchedGroup,
                  submittedMembers: [
                    ...(fetchedGroup.submittedMembers || []).filter(
                      (submission) => !submittedReceipts.some(
                        (receipt) => receipt.rollNumber.toLowerCase() === submission.rollNumber.toLowerCase()
                      )
                    ),
                    ...submittedReceipts.map((receipt) => ({
                      studentName: receipt.studentName,
                      rollNumber: receipt.rollNumber,
                      sequenceNumber: membersToSubmit.find(
                        (target) => target.member?.rollNumber.toLowerCase() === receipt.rollNumber.toLowerCase()
                      )?.sequenceNumber,
                      submittedAt: receipt.submittedAt,
                    })),
                  ],
                }
              : fetchedGroup;
            setUploadGroup(updatedGroup);
            const remainingMemberIds = (updatedGroup?.members || []).flatMap((member) => {
              const memberId = member.studentId
                || (member.rollNumber.toLowerCase() === student.rollNumber.toLowerCase() ? student.id : '');
              const hasSubmitted = updatedGroup?.submittedMembers?.some(
                (submission) => submission.rollNumber.toLowerCase() === member.rollNumber.toLowerCase()
              );
              return submissionMemberIds.includes(memberId) && !hasSubmitted ? [memberId] : [];
            });
            setSelectedSubmissionMemberIds(remainingMemberIds);
            setSelectedSubmissionMemberId(remainingMemberIds[0] || student.id);
          } catch {
            setErrorMsg('Submissions succeeded, but group upload status could not refresh. Reload to see updated members.');
          }
        }
      }
      if (submissionErrors.length > 0) {
        setErrorMsg(
          submittedReceipts.length > 0
            ? `Submitted for ${submittedReceipts.length} member(s). Some submissions failed: ${submissionErrors.join(' ')}`
            : submissionErrors.join(' ')
        );
      } else if (submittedReceipts.length === 0) {
        setErrorMsg('No submissions were completed.');
      } else {
        setReceipt(submittedReceipts[submittedReceipts.length - 1]);
        setReceiptMembers(submittedReceipts.map((submission) => submission.studentName));
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Something went wrong on the server.');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const isPastDeadline = selectedAssignment ? new Date() > new Date(selectedAssignment.deadline) : false;
  const lateApprovalExpiresAt = lateReqStatus?.decidedAt
    ? new Date(lateReqStatus.decidedAt).getTime() + 5 * 60 * 1000
    : 0;
  const hasActiveLateApproval = lateReqStatus?.status === 'Approved'
    && deadlineTick < lateApprovalExpiresAt;
  const canSubmitNow = !isPastDeadline || hasActiveLateApproval;
  const canSubmitForSelection = canSubmitNow
    && (selectedAssignment?.submissionType !== 'Group'
      || (!loadingUploadGroup && !!uploadGroup && selectedSubmissionMemberIds.length > 0));
  const canReuploadSubmission = (submission: Submission): boolean => {
    const assignment = typeof submission.assignmentId === 'object' ? submission.assignmentId : null;
    if (!assignment?.deadline) return false;
    if (deadlineTick <= new Date(assignment.deadline).getTime()) return true;
    if (!submission.lateSubmissionApprovedAt) return false;
    return deadlineTick < new Date(submission.lateSubmissionApprovedAt).getTime() + 5 * 60 * 1000;
  };
  const reuploadWindowSeconds = (submission: Submission): number => {
    if (!submission.lateSubmissionApprovedAt) return 0;
    return Math.max(0, Math.ceil(
      (new Date(submission.lateSubmissionApprovedAt).getTime() + 5 * 60 * 1000 - deadlineTick) / 1000
    ));
  };

  return (
    <div className="student-dashboard min-h-[90vh] flex flex-col md:flex-row bg-transparent min-w-0 relative">
      {/* FLOATING PROMINENT ERROR NOTIFICATION (NEVER REQUIRE SCROLLING) */}
      {(errorMsg || (groupMsg && groupMsg.type === 'error') || (passMsg && passMsg.type === 'error')) && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[92%] bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border border-red-400">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
            <AlertCircle className="w-5 h-5 text-white shrink-0" />
            <span>{errorMsg || groupMsg?.text || passMsg?.text}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              if (groupMsg?.type === 'error') setGroupMsg(null);
              if (passMsg?.type === 'error') setPassMsg(null);
            }}
            className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-lg transition shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        className={`fixed left-3 top-3 md:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#D6A84F]/40 bg-[#D6A84F] text-[#0B1F3A] shadow-sm ${mobileSidebarOpen ? 'z-30' : 'z-[60]'}`}
        aria-label="Open student navigation"
        aria-expanded={mobileSidebarOpen}
        aria-controls="student-dashboard-navigation"
      >
        <Menu className="h-5 w-5" />
      </button>
      {mobileSidebarOpen && (
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-x-0 top-16 bottom-0 z-40 bg-slate-950/45 md:hidden"
          aria-label="Close student navigation"
        />
      )}
      <aside
          id="student-dashboard-navigation"
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
          <div className="flex min-h-[4.5rem] items-center justify-between gap-3 p-5 border-b border-white/10">
            {!isSidebarCollapsed && <div className="min-w-0"><h2 className="text-xs uppercase tracking-wider text-blue-400 font-bold">Student Portal</h2><p className="text-sm font-semibold text-white mt-1">Learning Suite</p></div>}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
              aria-label="Close student navigation"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              className="hidden md:block p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition ml-auto"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
          <nav
            onClickCapture={() => setMobileSidebarOpen(false)}
            className={`p-3 grid gap-1.5 ${
            isSidebarCollapsed ? 'grid-cols-3 sm:grid-cols-6 md:grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-1'
          }`}>
            {([
              ['submit', 'Submit Assignment', Upload],
              ['quizzes', 'Quizzes', FileText],
              ['groups', 'Groups', Users],
              ['history', `Submissions (${mySubmissions.length})`, History],
              ['security', 'Security', KeyRound],
              ['cr-application', 'CR Application', Crown],
            ] as const).map(([tab, label, Icon]) => (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabChange(tab)}
                title={isSidebarCollapsed ? label : undefined}
                className={`min-h-11 w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-start'} gap-3 px-3 py-3 text-xs sm:text-sm font-semibold rounded-xl transition ${
                  activeTab === tab
                    ? 'bg-[#D6A84F] text-[#0B1F3A] shadow-lg shadow-amber-900/15'
                    : 'hover:bg-white/10 text-slate-200 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && <span>{label}</span>}
              </button>
            ))}
          </nav>
      </aside>
      <main className="flex-1 min-w-0 w-full p-4 sm:p-6 lg:p-8 max-w-7xl space-y-6">

      {/* PROFILE SUMMARY HEADER */}
      <div className="glass-panel text-slate-900 rounded-3xl p-5 sm:p-6 shadow-xl flex items-center justify-between gap-4 border border-slate-200 relative overflow-hidden">
        <div className="flex items-center gap-4 min-w-0">
          <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-2xl shrink-0">
            <User className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-extrabold truncate tracking-tight">{student?.name}</h1>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold rounded-full shrink-0">
                Verified Student
              </span>
              {student?.staffRole && (
                <a
                  href="/admin/dashboard"
                  onClick={async (event) => {
                    event.preventDefault();
                    const result = await switchToStaffPortal();
                    if (result.success) navigate('/admin/dashboard');
                    else setErrorMsg(result.message || 'Could not open the staff portal.');
                  }}
                  className="px-2.5 py-0.5 bg-blue-100 text-blue-800 border border-blue-300 text-xs font-bold rounded-full shrink-0 hover:bg-blue-200 transition flex items-center gap-1"
                >
                  <Crown className="w-3 h-3 text-amber-600" />
                  {student.staffRole === 'CR_ASSISTANT' ? 'CR Assistant' : 'Class CR'} Portal &rarr;
                </a>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-700 mt-1 break-words">
              Roll Number: <span className="font-mono font-bold text-slate-900">{student?.rollNumber}</span>
              <span className="hidden sm:inline"> &bull; Email: <span className="text-slate-700">{student?.email}</span></span>
            </p>
          </div>
        </div>
      </div>

      {/* SUBMISSION RECEIPT VIEW */}
      {receipt && (
        <div className="glass-panel rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden">
          <div className="bg-emerald-600 p-6 text-white text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2" />
            <h2 className="text-2xl font-bold">
              {receiptMembers.length > 1 ? '✓ Group Assignment Submitted Successfully' : '✓ Assignment Submitted Successfully'}
            </h2>
            <p className="text-emerald-100 text-xs mt-1">Receipt ID: {receipt.submissionId}</p>
            {receiptMembers.length > 1 && (
              <p className="text-emerald-100 text-xs mt-1">
                Submitted for: {receiptMembers.join(', ')}
              </p>
            )}
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {errorMsg && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                {errorMsg}
              </p>
            )}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex justify-between border-b pb-2 text-sm">
                <span className="text-slate-500 font-medium">Submission ID</span>
                <span className="font-mono font-bold text-slate-800">{receipt.submissionId}</span>
              </div>
              <div className="flex justify-between border-b pb-2 text-sm">
                <span className="text-slate-500 font-medium">Subject</span>
                <span className="font-semibold text-slate-800">{receipt.subjectName}</span>
              </div>
              <div className="flex justify-between border-b pb-2 text-sm">
                <span className="text-slate-500 font-medium">Assignment</span>
                <span className="font-semibold text-slate-800">{receipt.assignmentTitle}</span>
              </div>
              <div className="flex justify-between border-b pb-2 text-sm items-center">
                <span className="text-slate-500 font-medium">Uploaded File</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-blue-600 truncate max-w-[160px] sm:max-w-[220px]">{receipt.originalFileName}</span>
                  {(receipt.cloudinarySecureUrl || receipt.id || receipt._id || receipt.submissionId) && (
                    <button
                      type="button"
                      onClick={() => void openSubmissionFile(receipt.id || receipt._id || receipt.submissionId).catch((err: any) => alert(err?.message || 'Unable to open this submission file.'))}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 transition flex items-center gap-1 shrink-0"
                      title="View submitted file in new tab"
                    >
                      <Eye className="w-3.5 h-3.5" /> View File
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-between border-b pb-2 text-sm">
                <span className="text-slate-500 font-medium">Submitted At</span>
                <span className="font-medium text-slate-800">{receipt.submittedAt}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Status</span>
                <span>
                  <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full">
                    {receipt.status}
                  </span>
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setReceipt(null);
                setReceiptMembers([]);
                setErrorMsg(null);
              }}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow"
            >
              Submit Another Assignment
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: SUBMIT ASSIGNMENT FORM */}
      {!receipt && activeTab === 'submit' && (
        <div className="glass-panel rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden">
          <div className="bg-slate-900/90 backdrop-blur-md p-6 text-white border-b border-white/10">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-400" /> New Assignment Submission
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Your identity (<strong>{student?.name}</strong>, Roll #<strong>{student?.rollNumber}</strong>) is automatically verified via your student account.
            </p>
          </div>

          {errorMsg && (
            <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {/* Subject Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Select Subject <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                disabled={loadingSubjects || isSubmitting}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold"
              >
                <option value="">-- Select Subject --</option>
                {subjects.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
              {subjects.length === 0 && (
                <p className="text-xs text-amber-700 font-semibold mt-2">
                  No subjects are currently available.
                </p>
              )}
            </div>

            {/* Assignment Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Select Assignment <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedAssignmentId}
                onChange={(e) => setSelectedAssignmentId(e.target.value)}
                disabled={!selectedSubjectId || loadingAssignments || isSubmitting}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold"
              >
                <option value="">
                  {!selectedSubjectId
                    ? '-- Select a Subject First --'
                    : loadingAssignments
                    ? 'Loading assignments...'
                    : assignments.length === 0
                    ? 'No active assignments'
                    : '-- Select Assignment --'}
                </option>
                {assignments.map((ass) => (
                  <option key={ass._id} value={ass._id}>
                    {ass.title} ({ass.submissionType === 'Individual' ? 'Individual' : 'Group Assignment'}) - {getDeadlineCountdown(ass.deadline).text.replace('⏳ ', '')}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignment Details & Late Check */}
            {selectedAssignment && (
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-2 text-sm text-blue-900">
                <div className="flex items-center justify-between font-semibold border-b border-blue-200/80 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span>{selectedAssignment.title}</span>
                    {selectedAssignment.submissionType === 'Individual' ? (
                      <span className="px-2.5 py-0.5 text-xs font-bold bg-slate-200 text-slate-800 rounded-md border border-slate-300">
                        👤 Individual Assignment
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 rounded-md border border-blue-200">
                        👥 Group Assignment (Max {selectedAssignment.maxGroupSize || 4} members)
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-blue-700 bg-white px-2.5 py-1 rounded-md border border-blue-200">
                    Due: {formatDate(selectedAssignment.deadline)}
                  </span>
                </div>
                <div className={`inline-flex px-2.5 py-1 rounded-md border text-xs ${getDeadlineCountdown(selectedAssignment.deadline).color}`}>
                  {getDeadlineCountdown(selectedAssignment.deadline).text}
                </div>
                {selectedAssignment.description && (
                  <p className="text-xs text-slate-600">{selectedAssignment.description}</p>
                )}
                <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-700 pt-1">
                  <div>
                    Allowed Types:{' '}
                    <span className="font-bold text-blue-700">
                      {selectedAssignment.allowedFileTypes.join(', ').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    Max Size:{' '}
                    <span className="font-bold text-blue-700">{selectedAssignment.maxFileSize} MB</span>
                  </div>
                  <div>
                    Submission Mode:{' '}
                    <span className="font-bold text-blue-700">
                      {selectedAssignment.submissionType === 'Individual' ? 'Solo (Individual)' : `Group (Up to ${selectedAssignment.maxGroupSize || 4} members)`}
                    </span>
                  </div>
                </div>

                {/* DEADLINE PASSED NOTICE */}
                {isPastDeadline && (
                  <div className="mt-3 p-4 rounded-xl border space-y-3">
                    {loadingLateStatus ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Checking late request status...
                      </div>
                    ) : lateReqStatus?.status === 'Approved' && hasActiveLateApproval ? (
                      <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-lg flex items-center gap-2 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Approved for {selectedSubmissionMemberId === student.id ? 'you' : uploadGroup?.members.find((member) => member.studentId === selectedSubmissionMemberId)?.name || 'the selected member'}. Upload within 5 minutes; {Math.max(0, Math.ceil((lateApprovalExpiresAt - deadlineTick) / 1000))} seconds remain.</span>
                      </div>
                    ) : lateReqStatus?.status === 'Pending' ? (
                      <div className="p-3 bg-amber-100 border border-amber-300 rounded-lg flex items-center gap-2 text-xs font-bold text-amber-800">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{selectedSubmissionMemberId === student.id ? 'Your' : "The selected member's"} Late Submission Request is pending CR/Admin approval.</span>
                      </div>
                    ) : (
                      <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            {lateReqStatus?.status === 'Rejected'
                              ? 'Your previous request was rejected.'
                              : lateReqStatus?.status === 'Approved'
                                ? 'The 5-minute approval window expired.'
                                : 'The deadline has passed. Late access requires individual CR/Admin approval.'}
                          </span>
                        </div>
                        {lateReqSuccessMsg && (
                          <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold">{lateReqSuccessMsg}</div>
                        )}
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-slate-700">Reason for late request:</label>
                          <textarea
                            value={lateReason}
                            onChange={(e) => setLateReason(e.target.value)}
                            placeholder="Explain why you could not submit on time..."
                            rows={2}
                            className="w-full p-2.5 bg-white border border-amber-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
                          />
                          <button
                            type="button"
                            onClick={handleCreateLateRequest}
                            disabled={submittingLateReq || selectedSubmissionMemberId !== student.id}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-2"
                          >
                            {submittingLateReq ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            {selectedSubmissionMemberId !== student.id
                              ? 'Selected member must request access'
                              : lateReqStatus ? 'Request a new 5-minute access window' : 'Send Late Request to CR'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {isPastDeadline && !canSubmitNow && (
              <p className="px-6 pb-6 text-center text-sm font-semibold text-slate-500">
                View only: upload is available before the deadline or during your 5-minute approved window.
              </p>
            )}

            {/* File Upload Box (Only enabled if canSubmitNow) */}
            {selectedAssignment?.submissionType === 'Group' && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Uploading for group member <span className="text-red-500">*</span>
                </label>
                {loadingUploadGroup ? (
                  <p className="text-xs text-slate-600">Loading your group members...</p>
                ) : uploadGroup ? (
                  <>
                    <p className="text-xs text-slate-600">
                      Select everyone included in this file. Each selected member gets a submission record using their group sequence.
                    </p>
                    <div className="space-y-2">
                      {uploadGroup.members.map((member, index) => {
                        const isCurrentStudent = member.rollNumber.toLowerCase() === student.rollNumber.toLowerCase();
                        const memberId = member.studentId || (isCurrentStudent ? student.id : '');
                        const alreadySubmitted = uploadGroup.submittedMembers?.some(
                          (submission) => submission.rollNumber.toLowerCase() === member.rollNumber.toLowerCase()
                        ) || false;
                        const checked = Boolean(memberId && selectedSubmissionMemberIds.includes(memberId));
                        return (
                          <label
                            key={member.rollNumber}
                            className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                              alreadySubmitted ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
                            } ${!memberId || alreadySubmitted ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isSubmitting || alreadySubmitted || !memberId}
                              onChange={(event) => {
                                if (event.target.checked) {
                                  setSelectedSubmissionMemberIds((current) => [...new Set([...current, memberId])]);
                                  setSelectedSubmissionMemberId(memberId);
                                } else {
                                  setSelectedSubmissionMemberIds((current) => {
                                    const next = current.filter((id) => id !== memberId);
                                    if (selectedSubmissionMemberId === memberId) {
                                      setSelectedSubmissionMemberId(next[0] || student.id);
                                    }
                                    return next;
                                  });
                                }
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
                              {member.name} ({member.rollNumber})
                              {isCurrentStudent ? ' — You' : ''}
                              <span className="ml-2 text-xs font-medium text-slate-500">Sequence {index + 1}</span>
                            </span>
                            <span className={`shrink-0 text-xs font-bold ${alreadySubmitted ? 'text-emerald-700' : memberId ? 'text-blue-700' : 'text-amber-700'}`}>
                              {alreadySubmitted
                                ? 'File uploaded'
                                : memberId
                                ? 'Not submitted'
                                : 'Account not linked'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {isPastDeadline && selectedSubmissionMemberId !== student.id && (
                      <p className="text-xs font-semibold text-amber-800">
                        After the deadline, each member must request access from their own account and receive approval before their file can be submitted.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs font-semibold text-amber-800">
                    No group is registered for this assignment. Register or join a group before uploading.
                  </p>
                )}
              </div>
            )}

            {canSubmitForSelection && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Assignment File <span className="text-red-500">*</span>
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  data-dragging={isDragging}
                  data-has-file={Boolean(selectedFile)}
                  className={`file-drop-zone border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : selectedFile
                      ? 'border-emerald-400 bg-emerald-50/40'
                      : 'border-slate-300 bg-slate-50 hover:bg-slate-100/70'
                  }`}
                >
                  <input
                    type="file"
                    id="student-file-upload"
                    onChange={handleFileChange}
                    disabled={isSubmitting}
                    accept={selectedAssignment
                      ? selectedAssignment.allowedFileTypes.map((type) => `.${type.replace(/^\./, '')}`).join(',')
                      : '.pdf,.doc,.docx,.ppt,.pptx,.zip'}
                    aria-label="Choose assignment file"
                    className="hidden"
                  />
                  <label htmlFor="student-file-upload" className="cursor-pointer block">
                    {selectedFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="w-10 h-10 text-emerald-600" />
                        <p className="max-w-full break-all text-sm font-semibold text-slate-800">{selectedFile.name}</p>
                        <p className="text-xs text-slate-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                        <span className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800">Change file</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-10 h-10 text-slate-400" />
                        <p className="text-sm font-semibold text-slate-700">
                          Drag & drop assignment file, or
                        </p>
                        <span className="rounded-lg bg-[#0B1F3A] px-4 py-2 text-xs font-bold text-white">Browse files</span>
                        <p className="text-xs text-slate-500">
                          Allowed:{' '}
                          {selectedAssignment
                            ? selectedAssignment.allowedFileTypes.join(', ').toUpperCase()
                            : 'PDF, DOC, DOCX, PPT, PPTX, ZIP'}{' '}
                          (Max: {selectedAssignment ? selectedAssignment.maxFileSize : 10} MB)
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            )}

            {isSubmitting && (
              <div role="status" aria-live="polite" className="space-y-2">
                <div className="flex justify-between gap-3 text-xs font-semibold text-slate-600">
                  <span>{uploadProgress === 100 ? 'Finishing submission...' : 'Uploading assignment...'}</span>
                  {uploadProgress !== null && <span>{uploadProgress}%</span>}
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-slate-200"
                  role="progressbar"
                  aria-label="Assignment upload progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={uploadProgress ?? 0}
                >
                  <div
                    className="h-full rounded-full bg-[#D6A84F] transition-[width] duration-200"
                    style={{ width: `${uploadProgress ?? 0}%` }}
                  />
                </div>
              </div>
            )}

            {canSubmitForSelection && (
              <button
                type="submit"
                disabled={isSubmitting || (selectedAssignment?.submissionType === 'Group' && selectedSubmissionMemberIds.length === 0)}
                className="w-full min-h-12 py-3.5 border border-[#D6A84F] bg-[#0B1F3A] hover:bg-[#102744] disabled:bg-slate-400 text-white font-bold text-base rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Uploading & Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    {selectedAssignment?.submissionType === 'Group' && selectedSubmissionMemberIds.length > 1
                      ? `Submit for ${selectedSubmissionMemberIds.length} Students`
                      : 'Submit Assignment'}
                  </>
                )}
              </button>
            )}
          </form>
        </div>
      )}

      {/* TAB 2: SUBJECT-WISE GROUP REGISTRATION */}
      {!receipt && activeTab === 'groups' && (
        <div className="glass-panel rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden">
          <div className="bg-slate-900/90 backdrop-blur-md p-6 text-white border-b border-white/10">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" /> Subject-wise Group Registration
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Create a new group or continue an existing group from previous subjects. Group registration is separate from file submission.
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Subject Select */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Select Subject <span className="text-red-500">*</span>
              </label>
              <select
                value={groupSubjectId}
                onChange={(e) => setGroupSubjectId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold"
              >
                <option value="">-- Select Subject for Group Registration --</option>
                {groupSubjects.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
            </div>

            {groupSubjectId && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Assignment <span className="text-red-500">*</span>
                </label>
                <select
                  value={groupAssignmentId}
                  onChange={(e) => setGroupAssignmentId(e.target.value)}
                  disabled={selectedGroupAssignments.length === 0}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold"
                >
                  <option value="">-- Select Assignment --</option>
                  {selectedGroupAssignments.map((assignment) => (
                    <option key={assignment._id} value={assignment._id}>
                      {assignment.title} (Max {assignment.maxGroupSize || 4} members)
                    </option>
                  ))}
                </select>
                {selectedGroupAssignments.length === 0 && (
                  <p className="text-xs text-amber-700 font-semibold mt-2">No active group assignment is available for this subject.</p>
                )}
              </div>
            )}

            {/* Group Registration Deadline Status Banner */}
            {selectedGroupAssignment && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Group Formation Deadline</span>
                  <p className="text-sm font-bold text-slate-800">
                    {formatDate(selectedGroupAssignment.groupDeadline || selectedGroupAssignment.deadline)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      getDeadlineCountdown(selectedGroupAssignment.groupDeadline || selectedGroupAssignment.deadline).color
                    }`}
                  >
                    {getDeadlineCountdown(selectedGroupAssignment.groupDeadline || selectedGroupAssignment.deadline).text}
                  </span>
                  {selectedGroupAssignment.allowLateGroupRegistration && (
                    <span className="px-2.5 py-1 text-[11px] font-bold bg-blue-100 text-blue-800 rounded-full border border-blue-200">
                      Late Registration Allowed
                    </span>
                  )}
                </div>
              </div>
            )}

            {selectedGroupAssignment &&
              new Date(selectedGroupAssignment.groupDeadline || selectedGroupAssignment.deadline).getTime() < deadlineTick &&
              !selectedGroupAssignment.allowLateGroupRegistration && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-3">
                  <p className="text-sm font-bold text-amber-900">
                    {myGroup
                      ? 'Group edit deadline has passed. Send a request to your CR to allow late group editing.'
                      : 'Group registration deadline has passed. Send a request to your CR to allow late registration.'}
                  </p>
                  {groupLateRequest?.status === 'Approved' ? (
                    <p className="text-xs font-bold text-emerald-800">
                      {myGroup ? 'Late group editing approved. You can edit the group now.' : 'Late group registration approved. You can register the group now.'}
                    </p>
                  ) : groupLateRequest?.status === 'Pending' ? (
                    <p className="text-xs font-bold text-amber-800">
                      Your late group {myGroup ? 'edit' : 'registration'} request is pending CR approval.
                    </p>
                  ) : groupLateRequest?.status === 'Rejected' ? (
                    <p className="text-xs font-bold text-red-800">
                      Your late group {myGroup ? 'edit' : 'registration'} request was rejected by your CR. You can submit another request.
                    </p>
                  ) : null}
                  {groupLateRequest?.status !== 'Pending' && groupLateRequest?.status !== 'Approved' && (
                    <>
                      <textarea
                        value={groupLateReason}
                        onChange={(e) => setGroupLateReason(e.target.value)}
                        placeholder={`Explain why late group ${myGroup ? 'editing' : 'registration'} is needed...`}
                        rows={2}
                        className="w-full p-2.5 bg-white border border-amber-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleCreateGroupLateRequest}
                        disabled={submittingGroupLateRequest}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-bold text-xs rounded-lg flex items-center gap-2"
                      >
                        {submittingGroupLateRequest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Request Late Group {myGroup ? 'Edit' : 'Registration'}
                      </button>
                    </>
                  )}
                </div>
              )}

            {groupMsg && (
              <div
                className={`p-4 rounded-xl border text-sm flex items-center gap-2 ${
                  groupMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                    : 'bg-red-50 border-red-300 text-red-800 font-semibold'
                }`}
              >
                {groupMsg.type === 'success' ? <Check className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
                <span>{groupMsg.text}</span>
              </div>
            )}

            {/* If Student Already Has a Group for this Subject */}
            {groupSubjectId && loadingMyGroup && (
              <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> Checking group status...
              </div>
            )}

            {groupSubjectId && !loadingMyGroup && myGroup && (
              <div className="bg-emerald-50/60 border border-emerald-300 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-emerald-200 pb-3 gap-3">
                  <div>
                    <span className="text-xs text-emerald-700 uppercase font-bold tracking-wider">Registered Group</span>
                    <h3 className="text-xl font-extrabold text-slate-900">{myGroup.groupName}</h3>
                    <p className="text-xs text-emerald-800 font-semibold mt-1">
                      {selectedGroupSubject?.name} ({selectedGroupSubject?.code}) / {selectedGroupAssignment?.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-emerald-600 text-white font-bold text-xs rounded-full">
                      {myGroup.members.length} Member(s)
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenEditGroup}
                      disabled={Boolean(
                        selectedGroupAssignment &&
                        new Date(selectedGroupAssignment.groupDeadline || selectedGroupAssignment.deadline).getTime() < deadlineTick &&
                        !selectedGroupAssignment.allowLateGroupRegistration &&
                        groupLateRequest?.status !== 'Approved'
                      )}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      {selectedGroupAssignment &&
                      new Date(selectedGroupAssignment.groupDeadline || selectedGroupAssignment.deadline).getTime() < deadlineTick &&
                      !selectedGroupAssignment.allowLateGroupRegistration &&
                      groupLateRequest?.status !== 'Approved'
                        ? 'CR Approval Required'
                        : 'Edit Group Members'}
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Group Members</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {myGroup.members.map((m, idx) => {
                      const isLeader = m.rollNumber.toLowerCase() === myGroup.leader.rollNumber.toLowerCase();
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border flex items-center justify-between ${
                            isLeader ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'
                          }`}
                        >
                          <div>
                            <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                              {m.name}
                              {isLeader && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-amber-500 text-white font-bold text-[10px] rounded-md">
                                  <Crown className="w-3 h-3" /> LEADER
                                </span>
                              )}
                            </p>
                            <p className="text-xs font-mono text-slate-500">Roll: {m.rollNumber}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* If Student NOT in group for this subject, show Registration Options */}
            {groupSubjectId && !loadingMyGroup && !myGroup && (
              <div className="space-y-6">
                {selectedGroupAssignment &&
                  new Date(selectedGroupAssignment.groupDeadline || selectedGroupAssignment.deadline).getTime() < deadlineTick &&
                  !selectedGroupAssignment.allowLateGroupRegistration &&
                  groupLateRequest?.status !== 'Approved' && (
                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs font-bold flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                      <span>
                        Group registration deadline has passed. Group creation is locked. Please contact your CR for approval to register late.
                      </span>
                    </div>
                  )}
                {selectedGroupAssignment &&
                  new Date(selectedGroupAssignment.groupDeadline || selectedGroupAssignment.deadline).getTime() < deadlineTick &&
                  !selectedGroupAssignment.allowLateGroupRegistration &&
                  groupLateRequest?.status === 'Approved' && (
                    <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>
                        Late group registration approved! You can now create your group below.
                      </span>
                    </div>
                  )}

                {/* Mode Selector Toggle */}
                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setGroupMode('create')}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 ${
                      groupMode === 'create' ? 'bg-white text-blue-600 shadow' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <UserPlus className="w-4 h-4" /> Create New Group
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupMode('continue')}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 ${
                      groupMode === 'continue' ? 'bg-white text-blue-600 shadow' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Repeat className="w-4 h-4" /> Continue Existing Group ({previousGroups.length})
                  </button>
                </div>

                {/* CREATE NEW GROUP FORM */}
                {groupMode === 'create' && (
                  <form onSubmit={handleCreateGroup} className="space-y-6 bg-slate-50/70 p-6 rounded-2xl border border-slate-200">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Group Name <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          {groupNameLoading ? 'Finding next group number...' : 'Auto-Assigned Next Group Number'}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={groupName}
                        readOnly
                        placeholder={groupNameLoading ? 'Loading...' : 'Next group number unavailable'}
                        className="w-full px-4 py-3 bg-slate-100 border border-slate-300 rounded-xl font-semibold text-slate-800 cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Group Members
                        </label>
                        <button
                          type="button"
                          onClick={handleAddExtraMember}
                          disabled={extraMembers.length >= maxGroupMembers - 1}
                          className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-lg transition flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Member
                        </button>
                      </div>

                      {/* Self Member (Index 0) */}
                      <div className="p-3 bg-white border border-blue-200 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{student?.name} (You)</p>
                          <p className="text-xs font-mono text-slate-500">Roll: {student?.rollNumber}</p>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="group-leader"
                            checked={leaderIndex === 0}
                            onChange={() => setLeaderIndex(0)}
                            className="text-amber-500 focus:ring-amber-400"
                          />
                          <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                            <Crown className="w-3.5 h-3.5" /> Leader
                          </span>
                        </label>
                      </div>

                      {/* Additional Members with separate Name and Roll Number fields */}
                      {extraMembers.map((m, idx) => (
                        <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
                          <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 sm:hidden">
                              Member Name
                            </label>
                            <input
                              type="text"
                              value={m.name}
                              onChange={(e) => {
                                const updated = [...extraMembers];
                                updated[idx].name = e.target.value;
                                setExtraMembers(updated);
                              }}
                              placeholder={`Member ${idx + 2} Name (e.g., Ali Khan)`}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                            />
                          </div>

                          <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 sm:hidden">
                              Roll Number (7 digits)
                            </label>
                            <input
                              type="text"
                              maxLength={7}
                              value={m.rollNumber}
                              onChange={(e) => {
                                const updated = [...extraMembers];
                                updated[idx].rollNumber = e.target.value.replace(/\D/g, '');
                                setExtraMembers(updated);
                              }}
                              placeholder={`Member ${idx + 2} Roll (e.g., 2260000)`}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-semibold tracking-wider"
                            />
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0">
                            <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                              <input
                                type="radio"
                                name="group-leader"
                                checked={leaderIndex === idx + 1}
                                onChange={() => setLeaderIndex(idx + 1)}
                                className="text-amber-500 focus:ring-amber-400"
                              />
                              <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                                <Crown className="w-3.5 h-3.5" /> Leader
                              </span>
                            </label>

                            <button
                              type="button"
                              onClick={() => handleRemoveExtraMember(idx)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition"
                              title="Remove Member"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={
                        groupSubmitting || groupNameLoading || !groupName ||
                        (selectedGroupAssignment &&
                          new Date(selectedGroupAssignment.groupDeadline || selectedGroupAssignment.deadline).getTime() < deadlineTick &&
                          !selectedGroupAssignment.allowLateGroupRegistration &&
                          groupLateRequest?.status !== 'Approved')
                      }
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold rounded-xl shadow transition flex items-center justify-center gap-2"
                    >
                      {groupSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      Register Group for Subject
                    </button>
                  </form>
                )}

                {/* CONTINUE EXISTING GROUP FORM */}
                {groupMode === 'continue' && (
                  <div className="space-y-4">
                    {loadingPrevGroups ? (
                      <div className="flex items-center justify-center py-6 text-slate-500 gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Loading previous groups...
                      </div>
                    ) : previousGroups.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                        No previous group history found. Please create a new group above.
                      </div>
                    ) : (
                      previousGroups.map((prev, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                        >
                          <div>
                            <h4 className="font-extrabold text-slate-900 text-base">{prev.groupName}</h4>
                            <p className="text-xs text-slate-500 mt-1">
                              Leader: <span className="font-bold text-slate-700">{prev.leader.name}</span> ({prev.leader.rollNumber})
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {prev.members.map((m, mIdx) => (
                                <span key={mIdx} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 text-[11px] rounded-md font-medium">
                                  {m.name} ({m.rollNumber})
                                </span>
                              ))}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleContinueGroup(prev)}
                            disabled={
                              groupSubmitting ||
                              (selectedGroupAssignment &&
                                new Date(selectedGroupAssignment.groupDeadline || selectedGroupAssignment.deadline).getTime() < deadlineTick &&
                                !selectedGroupAssignment.allowLateGroupRegistration &&
                                groupLateRequest?.status !== 'Approved')
                            }
                            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-2 shrink-0"
                          >
                            {groupSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat className="w-4 h-4" />}
                            Continue Group in Selected Subject
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MY SUBMISSION HISTORY */}
      {!receipt && activeTab === 'history' && (
        <div className="glass-panel rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden">
          <div className="bg-slate-900/90 backdrop-blur-md p-6 text-white border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" /> My Submission History
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              Only displaying submissions for {student?.name}
            </span>
          </div>

          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold text-xs uppercase">
                  <th className="p-4">Submission ID</th>
                  <th className="p-4">Subject</th>
                  <th className="p-4">Assignment</th>
                  <th className="p-4">File Name</th>
                  <th className="p-4">Submitted At</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10">
                      <div className="flex items-center justify-center gap-2 text-slate-500">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                        <span>Loading your submission history...</span>
                      </div>
                    </td>
                  </tr>
                ) : mySubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      You have not submitted any assignments yet.
                    </td>
                  </tr>
                ) : (
                  mySubmissions.map((sub) => (
                    <tr key={sub._id} className="hover:bg-slate-50/80">
                      <td className="p-4 font-mono text-xs font-bold text-slate-700">{sub.submissionId}</td>
                      <td className="p-4 font-bold text-slate-900">
                        {(sub.subjectId as any)?.name || 'Subject'}
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-slate-800">{(sub.assignmentId as any)?.title || 'Assignment'}</span>
                        {sub.groupName && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-md border border-blue-200 align-middle">
                            👥 {sub.groupName}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-xs font-medium text-blue-600 max-w-[180px] truncate" title={sub.originalFileName}>
                        {sub.originalFileName}
                      </td>
                      <td className="p-4 text-xs text-slate-500">{formatDate(sub.submittedAt)}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                          sub.isLate
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                            ✓ Verified
                          </span>
                          {sub.cloudinarySecureUrl && (
                            <button
                              type="button"
                              onClick={() => void openSubmissionFile(sub._id).catch(() => window.alert('Unable to open this submission file.'))}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-md border border-blue-200 transition flex items-center gap-1"
                              title="Open file in new tab"
                            >
                              <Eye className="w-3 h-3" />
                              View File
                            </button>
                          )}
                          {canReuploadSubmission(sub) ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteSubmission(sub._id)}
                              disabled={deletingId === sub._id}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-md border border-red-200 transition flex items-center gap-1"
                              title="Wrong file uploaded? Delete and re-upload."
                            >
                              {deletingId === sub._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                              Delete & Re-upload
                              {deadlineTick > new Date((sub.assignmentId as Assignment).deadline).getTime() && ` (${reuploadWindowSeconds(sub)}s)`}
                            </button>
                          ) : <span className="text-xs text-slate-500">View only · deadline passed</span>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden divide-y divide-slate-100">
            {loadingHistory ? (
              <div className="p-8 text-center text-sm text-slate-500">Loading your submission history...</div>
            ) : mySubmissions.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">You have not submitted any assignments yet.</div>
            ) : (
              mySubmissions.map((sub) => (
                <article key={sub._id} className="p-4 space-y-2">
                  <div className="flex justify-between gap-2">
                    <p className="font-mono text-xs font-bold text-slate-700 break-all">{sub.submissionId}</p>
                    <span className={`shrink-0 px-2 py-1 text-[10px] font-bold rounded-full ${
                      sub.isLate ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                    }`}>{sub.status}</span>
                  </div>
                  <p className="font-bold text-slate-900 break-words">{(sub.subjectId as any)?.name || 'Subject'}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800 break-words">{(sub.assignmentId as any)?.title || 'Assignment'}</p>
                    {sub.groupName && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-md border border-blue-200">
                        👥 {sub.groupName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-blue-600 break-words">File: {sub.originalFileName}</p>
                  <p className="text-[11px] text-slate-500">Submitted: {formatDate(sub.submittedAt)}</p>
                  <div className="flex gap-2">
                    {sub.cloudinarySecureUrl && (
                      <button
                        type="button"
                        onClick={() => void openSubmissionFile(sub._id).catch(() => window.alert('Unable to open this submission file.'))}
                        className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> View File
                      </button>
                    )}
                    {canReuploadSubmission(sub) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSubmission(sub._id)}
                        disabled={deletingId === sub._id}
                        className="flex-1 py-2 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-200"
                      >
                        {deletingId === sub._id ? 'Deleting...' : 'Delete & Re-upload'}
                        {deadlineTick > new Date((sub.assignmentId as Assignment).deadline).getTime()
                          ? ` (${reuploadWindowSeconds(sub)}s)`
                          : ''}
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: ACCOUNT SECURITY & CHANGE PASSWORD */}
      {!receipt && activeTab === 'security' && (
        <div className="glass-panel rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden max-w-2xl mx-auto">
          <div className="bg-slate-900/90 backdrop-blur-md p-6 text-white border-b border-white/10">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-400" /> Account Security & Change Password
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Update your account password. Make sure to choose a strong password.
            </p>
          </div>

          <form onSubmit={handleChangePasswordSubmit} className="p-6 sm:p-8 space-y-6">
            {passMsg && (
              <div
                className={`p-4 rounded-xl border text-sm flex items-center gap-2 ${
                  passMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                    : 'bg-red-50 border-red-300 text-red-800 font-semibold'
                }`}
              >
                {passMsg.type === 'success' ? (
                  <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <span>{passMsg.text}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Current Password <span className="text-red-500">*</span>
              </label>
              <PasswordInput
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                New Password <span className="text-red-500">*</span>
              </label>
              <PasswordInput
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold text-sm"
              />
              <PasswordRequirements password={newPassword} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <PasswordInput
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={changingPass}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-base rounded-xl shadow-lg transition flex items-center justify-center gap-2"
            >
              {changingPass ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Updating Password...
                </>
              ) : (
                <>
                  <KeyRound className="w-5 h-5" /> Update Password
                </>
              )}
            </button>
          </form>
          <div className="p-6 sm:p-8 pt-0">
            <div className="border-t border-red-200 dark:border-red-900/50 pt-6">
              <h3 className="text-sm font-bold text-red-700 dark:text-red-400">Delete account</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                Permanently delete your account and personal records. Other students' records will not be deleted.
              </p>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold text-sm rounded-xl shadow transition flex items-center justify-center gap-2"
              >
                {deletingAccount ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Deleting Account...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" /> Delete My Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUIZZES TAB */}
      {activeTab === 'quizzes' && (
        <StudentQuizSection
          studentClassId={typeof student?.classId === 'object' ? student.classId?._id : student?.classId}
          studentName={student?.name || ''}
          rollNumber={student?.rollNumber || ''}
        />
      )}

      {/* CR APPLICATION TAB */}
      {activeTab === 'cr-application' && (
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200/80 dark:border-white/10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
                  <Crown className="w-6 h-6 text-blue-600" />
                  Class Representative & Assistant Application
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Apply to become your class representative or CR assistant. Super Admin approval is required.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchCRAppData}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                <Loader2 className={`w-3.5 h-3.5 ${crAppLoading ? 'animate-spin' : 'hidden'}`} />
                Refresh Status
              </button>
            </div>

            {/* Current Application Status Card */}
            {crAppLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                <p className="text-xs text-slate-500 mt-2 font-medium">Checking application status...</p>
              </div>
            ) : crAppStatus ? (
              <div className="space-y-5">
                <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs uppercase font-bold text-slate-400">Current Application</span>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                        {crAppStatus.roleType === 'CR_ASSISTANT' ? 'CR Assistant Position' : 'Class Representative (CR) Position'}
                      </h3>
                    </div>
                    <div>
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                          crAppStatus.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : crAppStatus.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800 border-red-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        {crAppStatus.status === 'APPROVED' && '✓ Approved'}
                        {crAppStatus.status === 'REJECTED' && '✕ Rejected'}
                        {crAppStatus.status === 'PENDING' && '⏳ Under Review (Pending)'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2 border-t border-slate-200 dark:border-white/10">
                    <div>
                      <span className="text-slate-400 font-medium">Class:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {(crAppStatus.classId as any)?.name
                          ? `${(crAppStatus.classId as any).name} (Sec: ${(crAppStatus.classId as any).section || 'A'}, Sem: ${(crAppStatus.classId as any).semester || '1'})`
                          : 'Class Assigned'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Applied On:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {new Date(crAppStatus.appliedAt).toLocaleString()}
                      </p>
                    </div>
                    {crAppStatus.reason && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-400 font-medium">Your Reason/Note:</span>
                        <p className="text-slate-700 dark:text-slate-300 mt-0.5 italic">"{crAppStatus.reason}"</p>
                      </div>
                    )}
                    {crAppStatus.status === 'REJECTED' && crAppStatus.rejectionReason && (
                      <div className="sm:col-span-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-800">
                        <span className="font-bold">Super Admin Feedback:</span>
                        <p className="mt-0.5">{crAppStatus.rejectionReason}</p>
                      </div>
                    )}
                  </div>

                  {crAppStatus.status === 'APPROVED' && (
                    <div className="pt-3 border-t border-emerald-200">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-emerald-900">
                            🎉 Your application was approved!
                          </p>
                          <p className="text-[11px] text-emerald-700 mt-0.5">
                            You now have access to staff management features. Sign in with your student credentials on the staff login portal.
                          </p>
                        </div>
                        <a
                          href="/admin/dashboard"
                          onClick={async (event) => {
                            event.preventDefault();
                            const result = await switchToStaffPortal();
                            if (result.success) navigate('/admin/dashboard');
                            else setErrorMsg(result.message || 'Could not open the staff portal.');
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shrink-0 shadow"
                        >
                          Go to Staff Portal &rarr;
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {crAppStatus.status === 'REJECTED' && (
                  <p className="text-xs text-slate-500 text-center">
                    You can submit a new application below if you would like to apply again.
                  </p>
                )}
              </div>
            ) : null}

            {/* Application Form — shown if no active application or if previous was rejected */}
            {(!crAppStatus || crAppStatus.status === 'REJECTED') && !crAppLoading && (
              <form onSubmit={handleCRAppSubmit} className="space-y-5 pt-2">
                <div className="border-t border-slate-200 dark:border-white/10 pt-6">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                    {crAppStatus ? 'Submit a New Application' : 'New CR / Assistant Application'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Fill out the form below to apply. Note that each class can only have one active CR and one active Assistant.
                  </p>
                </div>

                {crAppMsg && (
                  <div
                    className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                      crAppMsg.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-red-50 text-red-800 border-red-200'
                    }`}
                  >
                    {crAppMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span>{crAppMsg.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Position Applying For <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={crAppRoleType}
                      onChange={(e) => setCRAppRoleType(e.target.value as 'CR' | 'CR_ASSISTANT')}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="CR">Class Representative (CR)</option>
                      <option value="CR_ASSISTANT">CR Assistant</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Select Your Class <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={crAppClassId}
                      onChange={(e) => setCRAppClassId(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Choose Class --</option>
                      {crAppClasses.map((cls) => (
                        <option key={cls._id} value={cls._id}>
                          {cls.name} (Section: {cls.section}, Sem: {cls.semester})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Reason / Statement (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Briefly state why you want to become CR/Assistant or any relevant experience..."
                    value={crAppReason}
                    onChange={(e) => setCRAppReason(e.target.value)}
                    maxLength={500}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1 text-right">{crAppReason.length}/500</p>
                </div>

                <button
                  type="submit"
                  disabled={crAppSubmitting}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                  {crAppSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Submitting Application...
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4" /> Submit CR Application
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* EDIT GROUP MEMBERS MODAL */}
      {groupEditModalOpen && myGroup && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200/80 dark:border-white/10 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Edit Group {editGroupName}</h3>
                <p className="text-xs text-slate-500">Update member names, roll numbers, or group leader.</p>
              </div>
              <button
                type="button"
                onClick={() => setGroupEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveGroupEdit} className="space-y-4">
              {groupEditError && (
                <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-red-800 text-xs font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{groupEditError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Members (Max {selectedGroupAssignment?.maxGroupSize || myGroup.maxGroupSize || 4})
                  </label>
                  {editMembers.length < (selectedGroupAssignment?.maxGroupSize || myGroup.maxGroupSize || 4) && (
                    <button
                      type="button"
                      onClick={() => setEditMembers([...editMembers, { name: '', rollNumber: '' }])}
                      className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" /> Add Member
                    </button>
                  )}
                </div>
                {editMembers.map((m, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={m.name}
                        onChange={(e) => {
                          const updated = [...editMembers];
                          updated[idx].name = e.target.value;
                          setEditMembers(updated);
                        }}
                        placeholder={`Member ${idx + 1} Name`}
                        className="flex-1 px-3 py-2 border rounded-lg text-xs font-semibold min-w-0"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editMembers.filter((_, i) => i !== idx);
                          setEditMembers(updated);
                          if (editLeaderIndex >= updated.length) setEditLeaderIndex(0);
                        }}
                        className="text-red-500 hover:text-red-700 p-2 shrink-0"
                        disabled={editMembers.length <= 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={7}
                        value={m.rollNumber}
                        onChange={(e) => {
                          const updated = [...editMembers];
                          updated[idx].rollNumber = e.target.value.replace(/\D/g, '');
                          setEditMembers(updated);
                        }}
                        placeholder="Roll (e.g. 2260000)"
                        className="flex-1 px-3 py-2 border rounded-lg text-xs font-mono font-semibold tracking-wider min-w-0"
                        required
                      />
                      <label className="flex items-center gap-1 cursor-pointer shrink-0 bg-white px-3 py-2 border rounded-lg hover:bg-slate-50 transition">
                        <input
                          type="radio"
                          name="edit-leader"
                          checked={editLeaderIndex === idx}
                          onChange={() => setEditLeaderIndex(idx)}
                          className="sr-only"
                        />
                        <span className={`text-xs font-bold flex items-center gap-1 ${editLeaderIndex === idx ? 'text-amber-700' : 'text-slate-500'}`}>
                          <Crown className="w-3 h-3" /> {editLeaderIndex === idx ? 'Leader' : 'Set Leader'}
                        </span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setGroupEditModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editingGroupSaving}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow flex items-center justify-center gap-1.5"
                >
                  {editingGroupSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Save Group
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
