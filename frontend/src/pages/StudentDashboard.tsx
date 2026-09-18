import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Subject, Assignment, Submission, StudentUser, SubmissionReceipt, Group, LateRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  User,
  BookOpen,
  FileCheck,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Send,
  Loader2,
  Calendar,
  AlertTriangle,
  History,
  ShieldCheck,
  Trash2,
  Users,
  UserPlus,
  Repeat,
  Plus,
  Check,
  X,
  Crown,
  KeyRound,
  Shield,
  Edit2,
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const student = user as StudentUser;

  const validTabs = ['submit', 'groups', 'history', 'security'] as const;
  type TabType = typeof validTabs[number];

  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab') as TabType;
    if (validTabs.includes(tabFromUrl)) return tabFromUrl;
    const savedTab = localStorage.getItem('student_active_tab') as TabType;
    if (validTabs.includes(savedTab)) return savedTab;
    return 'submit';
  });

  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    localStorage.setItem('student_active_tab', tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState(null, '', url.toString());
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

  // Student's Own Submissions History
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Form State
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  // UI & Late Request State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
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
  const [extraMembers, setExtraMembers] = useState<{ name: string; rollNumber: string }[]>([
    { name: '', rollNumber: '' },
  ]);
  const [leaderIndex, setLeaderIndex] = useState<number>(0); // 0 is self
  const [previousGroups, setPreviousGroups] = useState<Group[]>([]);
  const [loadingPrevGroups, setLoadingPrevGroups] = useState<boolean>(false);
  const [groupSubmitting, setGroupSubmitting] = useState<boolean>(false);
  const [groupMsg, setGroupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Group Edit Modal State
  const [groupEditModalOpen, setGroupEditModalOpen] = useState<boolean>(false);
  const [editGroupName, setEditGroupName] = useState<string>('');
  const [editMembers, setEditMembers] = useState<{ name: string; rollNumber: string }[]>([
    { name: '', rollNumber: '' },
  ]);
  const [editLeaderIndex, setEditLeaderIndex] = useState<number>(0);
  const [editingGroupSaving, setEditingGroupSaving] = useState<boolean>(false);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [changingPass, setChangingPass] = useState<boolean>(false);
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deadlineTick, setDeadlineTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setDeadlineTick(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

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
        setLoadingHistory(true);
        const res = await api.get('/auth/student/me');
        if (res.data.success) {
          setMySubmissions(res.data.submissions);
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
      setLoadingHistory(true);
      const resProfile = await api.get('/auth/student/me');
      if (resProfile.data.success) {
        setMySubmissions(resProfile.data.submissions);
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

  // Fetch assignments when subject changes
  useEffect(() => {
    if (!selectedSubjectId) {
      setAssignments([]);
      setSelectedAssignmentId('');
      setSelectedAssignment(null);
      setLateReqStatus(null);
      return;
    }

    const fetchAssignments = async () => {
      try {
        setLoadingAssignments(true);
        const res = await api.get(`/assignments?subjectId=${selectedSubjectId}`);
        if (res.data.success) {
          setAssignments(res.data.assignments);
        }
      } catch (err) {
        setErrorMsg('Failed to load assignments.');
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
      return;
    }
    const found = assignments.find((a) => a._id === selectedAssignmentId);
    setSelectedAssignment(found || null);

    // Check late request status if past deadline
    if (found) {
      const isPast = new Date() > new Date(found.deadline);
      if (isPast && !found.allowLateSubmission) {
        fetchLateRequestStatus(found._id);
      } else {
        setLateReqStatus(null);
      }
    }
  }, [selectedAssignmentId, assignments]);

  const fetchLateRequestStatus = async (assignmentId: string) => {
    try {
      setLoadingLateStatus(true);
      const res = await api.get(`/late-requests/my-status?assignmentId=${assignmentId}`);
      if (res.data.success) {
        setLateReqStatus(res.data.request);
      }
    } catch (err) {
      console.error('Failed to fetch late request status:', err);
    } finally {
      setLoadingLateStatus(false);
    }
  };

  const handleCreateLateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
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
        const res = await api.get(`/groups/next-number?subjectId=${subId}&assignmentId=${assId}`);
        if (res.data.success && res.data.suggestedGroupName) {
          setGroupName(res.data.suggestedGroupName);
        }
      } catch (err) {
        // Fallback default
        setGroupName('Group 1');
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

    if (!groupName.trim()) {
      setGroupMsg({ type: 'error', text: 'Please enter a group name.' });
      return;
    }

    const membersPayload = [
      { name: student?.name, rollNumber: student?.rollNumber },
      ...extraMembers.filter((m) => m.rollNumber.trim()),
    ];

    const seenRolls = new Set<string>();
    for (const member of membersPayload) {
      const roll = member.rollNumber.trim().toUpperCase();
      if (roll) {
        if (seenRolls.has(roll)) {
          setGroupMsg({
            type: 'error',
            text: `Roll number '${member.rollNumber.trim()}' cannot be used more than once in the same group.`,
          });
          return;
        }
        seenRolls.add(roll);
      }
    }

    const leaderRoll = leaderIndex === 0 ? student?.rollNumber : extraMembers[leaderIndex - 1]?.rollNumber?.trim();

    try {
      setGroupSubmitting(true);
      const res = await api.post('/groups', {
        groupName: groupName.trim(),
        subjectId: groupSubjectId,
        assignmentId: groupAssignmentId || undefined,
        members: membersPayload,
        leaderRollNumber: leaderRoll,
      });

      if (res.data.success) {
        setGroupMsg({ type: 'success', text: res.data.message });
        setMyGroup(res.data.group);
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
    setEditGroupName(myGroup.groupName);
    setEditMembers(myGroup.members.map((m) => ({ name: m.name, rollNumber: m.rollNumber })));
    const leaderIdx = myGroup.members.findIndex(
      (m) => m.rollNumber.toLowerCase() === myGroup.leader.rollNumber.toLowerCase()
    );
    setEditLeaderIndex(leaderIdx >= 0 ? leaderIdx : 0);
    setGroupEditModalOpen(true);
  };

  const handleSaveGroupEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myGroup) return;
    setGroupMsg(null);

    const validMembers = editMembers.filter((m) => m.rollNumber.trim() !== '');
    if (validMembers.length === 0) {
      setGroupMsg({ type: 'error', text: 'Group must have at least 1 member.' });
      return;
    }

    const seen = new Set<string>();
    for (const m of validMembers) {
      const r = m.rollNumber.trim().toUpperCase();
      if (seen.has(r)) {
        setGroupMsg({ type: 'error', text: `Roll number '${r}' cannot be used more than once.` });
        return;
      }
      seen.add(r);
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
      setGroupMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update group.' });
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

    try {
      const formData = new FormData();
      formData.append('subjectId', selectedSubjectId);
      formData.append('assignmentId', selectedAssignmentId);
      formData.append('file', selectedFile);

      const res = await api.post('/submissions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        setReceipt(res.data.submission);
        await refreshSubmissionHistory();
      } else {
        setErrorMsg(res.data.message || 'Failed to submit assignment.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Something went wrong on the server.');
    } finally {
      setIsSubmitting(false);
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
  const isLateBlocked = isPastDeadline && selectedAssignment && !selectedAssignment.allowLateSubmission;
  const canSubmitNow = !isLateBlocked || (lateReqStatus && lateReqStatus.status === 'Approved');

  return (
    <div className="student-dashboard w-full max-w-6xl mx-auto py-6 sm:py-8 px-3 sm:px-4 space-y-6 sm:space-y-8 min-w-0 relative">
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

      {/* PROFILE SUMMARY HEADER */}
      <div className="glass-panel-dark text-white rounded-3xl p-5 sm:p-6 shadow-2xl flex items-center justify-between gap-4 border border-white/10 relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-0" />
        <div className="flex items-center gap-4 min-w-0 relative z-10">
          <div className="p-3.5 bg-gradient-to-tr from-blue-600/30 to-indigo-600/30 border border-blue-400/30 text-blue-400 rounded-2xl shrink-0 shadow-inner">
            <User className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-extrabold truncate tracking-tight">{student?.name}</h1>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-full shrink-0">
                Verified Student
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 break-words">
              Roll Number: <span className="font-mono font-bold text-white">{student?.rollNumber}</span>
              <span className="hidden sm:inline"> &bull; Email: <span className="text-slate-300">{student?.email}</span></span>
            </p>
          </div>
        </div>
      </div>

      {/* DASHBOARD TAB NAVIGATION BAR */}
      <div className="glass-panel-dark p-1.5 rounded-2xl border border-white/10 shadow-xl grid grid-cols-1 sm:grid-cols-4 gap-1.5 backdrop-blur-xl">
        <button
          onClick={() => setActiveTab('submit')}
          className={`py-3 px-4 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'submit' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Upload className="w-4 h-4" /> Submit Assignment
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`py-3 px-4 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'groups' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" /> Group Registration
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`py-3 px-4 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'history' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <History className="w-4 h-4" /> My Submissions ({mySubmissions.length})
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`py-3 px-4 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'security' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <KeyRound className="w-4 h-4" /> Change Password
        </button>
      </div>

      {/* SUBMISSION RECEIPT VIEW */}
      {receipt && (
        <div className="glass-panel rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden">
          <div className="bg-emerald-600 p-6 text-white text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2" />
            <h2 className="text-2xl font-bold">✓ Assignment Submitted Successfully</h2>
            <p className="text-emerald-100 text-xs mt-1">Receipt ID: {receipt.submissionId}</p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
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
              <div className="flex justify-between border-b pb-2 text-sm">
                <span className="text-slate-500 font-medium">Uploaded File</span>
                <span className="font-medium text-blue-600 truncate max-w-[200px]">{receipt.originalFileName}</span>
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
              onClick={() => setReceipt(null)}
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
                      <span className="px-2.5 py-0.5 text-xs font-bold bg-purple-100 text-purple-800 rounded-md border border-purple-200">
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
                    <span className="font-bold text-purple-700">
                      {selectedAssignment.submissionType === 'Individual' ? 'Solo (Individual)' : `Group (Up to ${selectedAssignment.maxGroupSize || 4} members)`}
                    </span>
                  </div>
                </div>

                {/* DEADLINE PASSED NOTICE */}
                {isPastDeadline && (
                  <div className="mt-3 p-4 rounded-xl border space-y-3">
                    {selectedAssignment.allowLateSubmission ? (
                      <div className="p-3 bg-amber-100 border border-amber-300 rounded-lg flex items-center gap-2 text-xs font-semibold text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>The deadline has passed. Late submissions are enabled for this assignment.</span>
                      </div>
                    ) : (
                      <div>
                        {loadingLateStatus ? (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Checking late request status...
                          </div>
                        ) : lateReqStatus?.status === 'Approved' ? (
                          <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-lg flex items-center gap-2 text-xs font-bold text-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Late submission request has been APPROVED by your CR! You can submit your file now.</span>
                          </div>
                        ) : lateReqStatus?.status === 'Pending' ? (
                          <div className="p-3 bg-amber-100 border border-amber-300 rounded-lg flex items-center gap-2 text-xs font-bold text-amber-800">
                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Your Late Submission Request is PENDING approval by your CR.</span>
                          </div>
                        ) : lateReqStatus?.status === 'Rejected' ? (
                          <div className="p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-2 text-xs font-bold text-red-800">
                            <X className="w-4 h-4 text-red-600 shrink-0" />
                            <span>Your Late Submission Request was REJECTED by your CR.</span>
                          </div>
                        ) : (
                          <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>Submission deadline has passed. Late submissions require CR approval.</span>
                            </div>
                            {lateReqSuccessMsg && (
                              <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold">
                                {lateReqSuccessMsg}
                              </div>
                            )}
                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-slate-700">
                                Reason for late request:
                              </label>
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
                                disabled={submittingLateReq}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-2"
                              >
                                {submittingLateReq ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )}
                                Send Late Request to CR
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* File Upload Box (Only enabled if canSubmitNow) */}
            {canSubmitNow && (
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
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer ${
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
                    className="hidden"
                  />
                  <label htmlFor="student-file-upload" className="cursor-pointer block">
                    {selectedFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="w-10 h-10 text-emerald-600" />
                        <p className="font-semibold text-slate-800 text-sm truncate max-w-xs">{selectedFile.name}</p>
                        <p className="text-xs text-slate-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                        <span className="text-xs font-semibold text-blue-600 hover:underline">Click to change</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-10 h-10 text-slate-400" />
                        <p className="text-sm font-semibold text-slate-700">
                          Drag & drop assignment file, or <span className="text-blue-600 underline">browse</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          Allowed:{' '}
                          {selectedAssignment
                            ? selectedAssignment.allowedFileTypes.join(', ').toUpperCase()
                            : 'PDF, DOC, DOCX, PPT, ZIP'}{' '}
                          (Max: {selectedAssignment ? selectedAssignment.maxFileSize : 10} MB)
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            )}

            {canSubmitNow && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-base rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Uploading & Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Submit Assignment
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
                    <span className="px-2.5 py-1 text-[11px] font-bold bg-purple-100 text-purple-800 rounded-full border border-purple-200">
                      Late Registration Allowed
                    </span>
                  )}
                </div>
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
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit Group Members
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
                  !selectedGroupAssignment.allowLateGroupRegistration && (
                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs font-bold flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                      <span>
                        Group registration deadline has passed. Group creation is locked. Please contact your CR for approval to register late.
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
                          Auto-Assigned Next Group Number
                        </span>
                      </div>
                      <input
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="e.g., Group 1"
                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
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
                              Roll Number
                            </label>
                            <input
                              type="text"
                              value={m.rollNumber}
                              onChange={(e) => {
                                const updated = [...extraMembers];
                                updated[idx].rollNumber = e.target.value;
                                setExtraMembers(updated);
                              }}
                              placeholder={`Member ${idx + 2} Roll Number (e.g., 2021-CS-101)`}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-semibold"
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
                        groupSubmitting ||
                        (selectedGroupAssignment &&
                          new Date(selectedGroupAssignment.groupDeadline || selectedGroupAssignment.deadline).getTime() < deadlineTick &&
                          !selectedGroupAssignment.allowLateGroupRegistration)
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
                                !selectedGroupAssignment.allowLateGroupRegistration)
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
                  <th className="p-4 text-right">Receipt</th>
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
                      <td className="p-4 font-semibold text-slate-800">
                        {(sub.assignmentId as any)?.title || 'Assignment'}
                      </td>
                      <td className="p-4 text-xs font-medium text-blue-600 max-w-[180px] truncate">
                        {sub.originalFileName}
                      </td>
                      <td className="p-4 text-xs text-slate-500">{formatDate(sub.submittedAt)}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-full">
                          {sub.status}
                        </span>
                      </td>
                      <td className="p-4 text-right flex items-center justify-end gap-2">
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                          ✓ Verified
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubmission(sub._id)}
                          disabled={deletingId === sub._id}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-md border border-red-200 transition flex items-center gap-1"
                          title="Wrong file uploaded? Delete and re-upload."
                        >
                          {deletingId === sub._id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          Delete & Re-upload
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden divide-y divide-slate-100">
            {loadingHistory ? <div className="p-8 text-center text-sm text-slate-500">Loading your submission history...</div> : mySubmissions.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">You have not submitted any assignments yet.</div> : mySubmissions.map((sub) => (
              <article key={sub._id} className="p-4 space-y-2">
                <div className="flex justify-between gap-2"><p className="font-mono text-xs font-bold text-slate-700 break-all">{sub.submissionId}</p><span className="shrink-0 px-2 py-1 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-full">{sub.status}</span></div>
                <p className="font-bold text-slate-900 break-words">{(sub.subjectId as any)?.name || 'Subject'}</p>
                <p className="text-sm font-semibold text-slate-800 break-words">{(sub.assignmentId as any)?.title || 'Assignment'}</p>
                <p className="text-xs text-blue-600 break-words">File: {sub.originalFileName}</p>
                <p className="text-[11px] text-slate-500">Submitted: {formatDate(sub.submittedAt)}</p>
                <button type="button" onClick={() => handleDeleteSubmission(sub._id)} disabled={deletingId === sub._id} className="w-full py-2 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-200">{deletingId === sub._id ? 'Deleting...' : 'Delete & Re-upload'}</button>
              </article>
            ))}
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
              <input
                type="password"
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
              <input
                type="password"
                placeholder="Enter new password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
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
        </div>
      )}

      {/* EDIT GROUP MEMBERS MODAL */}
      {groupEditModalOpen && myGroup && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/80 dark:border-white/10 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Group Members</h3>
                <p className="text-xs text-slate-500">Update member names, roll numbers, or group leader.</p>
              </div>
              <button
                type="button"
                onClick={() => setGroupEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveGroupEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Group Name</label>
                <input
                  type="text"
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl font-bold text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Members (Max {selectedGroupAssignment?.maxGroupSize || myGroup.maxGroupSize || 4})
                  </label>
                  {editMembers.length < (selectedGroupAssignment?.maxGroupSize || myGroup.maxGroupSize || 4) && (
                    <button
                      type="button"
                      onClick={() => setEditMembers([...editMembers, { name: '', rollNumber: '' }])}
                      className="text-xs text-blue-600 font-bold hover:underline"
                    >
                      + Add Member
                    </button>
                  )}
                </div>

                {editMembers.map((m, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border rounded-xl space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2">
                    <input
                      type="text"
                      value={m.name}
                      onChange={(e) => {
                        const updated = [...editMembers];
                        updated[idx].name = e.target.value;
                        setEditMembers(updated);
                      }}
                      placeholder={`Member ${idx + 1} Name`}
                      className="flex-1 px-3 py-1.5 border rounded-lg text-xs font-semibold"
                      required
                    />
                    <input
                      type="text"
                      value={m.rollNumber}
                      onChange={(e) => {
                        const updated = [...editMembers];
                        updated[idx].rollNumber = e.target.value;
                        setEditMembers(updated);
                      }}
                      placeholder={`Roll Number`}
                      className="flex-1 px-3 py-1.5 border rounded-lg text-xs font-mono font-semibold"
                      required
                    />
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="edit-leader"
                          checked={editLeaderIndex === idx}
                          onChange={() => setEditLeaderIndex(idx)}
                        />
                        <span className="text-xs font-bold text-amber-700 flex items-center gap-0.5">
                          <Crown className="w-3 h-3" /> Leader
                        </span>
                      </label>
                      {editMembers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = editMembers.filter((_, i) => i !== idx);
                            setEditMembers(updated);
                            if (editLeaderIndex >= updated.length) setEditLeaderIndex(0);
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setGroupEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editingGroupSaving}
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow flex items-center gap-1.5"
                >
                  {editingGroupSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
