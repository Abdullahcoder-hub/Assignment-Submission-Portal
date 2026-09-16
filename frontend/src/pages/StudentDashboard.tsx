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
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const student = user as StudentUser;

  const [activeTab, setActiveTab] = useState<'submit' | 'groups' | 'history'>('submit');

  // Subjects & Assignments
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(true);
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
  const [groupAssignments, setGroupAssignments] = useState<Assignment[]>([]);
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

  // Fetch Subjects & Profile Data
  const fetchStudentData = async () => {
    try {
      setLoadingSubjects(true);
      const resSubjects = await api.get('/subjects');
      if (resSubjects.data.success) {
        setSubjects(resSubjects.data.subjects);
      }

      const resGroupAssignments = await api.get('/assignments');
      if (resGroupAssignments.data.success) {
        setGroupAssignments(
          resGroupAssignments.data.assignments.filter((assignment: Assignment) => assignment.submissionType === 'Group')
        );
      }

      setLoadingHistory(true);
      const resProfile = await api.get('/auth/student/me');
      if (resProfile.data.success) {
        setMySubmissions(resProfile.data.submissions);
      }
    } catch (err) {
      setErrorMsg('Failed to load student dashboard data.');
    } finally {
      setLoadingSubjects(false);
      setLoadingHistory(false);
    }
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
    if (!groupSubjectId) {
      setMyGroup(null);
      return;
    }

    setExtraMembers(
      Array.from({ length: maxGroupMembers - 1 }, () => ({ name: '', rollNumber: '' }))
    );
    setLeaderIndex(0);
    setGroupAssignmentId('');

    const fetchGroupData = async () => {
      try {
        setLoadingMyGroup(true);
        setGroupMsg(null);
        const res = await api.get(`/groups/my-group/${groupSubjectId}`);
        if (res.data.success) {
          setMyGroup(res.data.group);
        }

        // Fetch previous groups for "Continue Existing Group" option
        setLoadingPrevGroups(true);
        const prevRes = await api.get('/groups/my-previous-groups');
        if (prevRes.data.success) {
          setPreviousGroups(prevRes.data.groups);
        }
      } catch (err) {
        console.error('Failed to fetch group info:', err);
      } finally {
        setLoadingMyGroup(false);
        setLoadingPrevGroups(false);
      }
    };

    fetchGroupData();
  }, [groupSubjectId]);

  useEffect(() => {
    if (selectedGroupAssignments.length > 0 && !selectedGroupAssignments.some((assignment) => assignment._id === groupAssignmentId)) {
      setGroupAssignmentId(selectedGroupAssignments[0]._id);
    }
  }, [selectedGroupAssignments, groupAssignmentId]);

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

    const rollNumbers = membersPayload.map((member) => member.rollNumber.trim().toUpperCase());
    if (new Set(rollNumbers).size !== rollNumbers.length) {
      setGroupMsg({ type: 'error', text: 'Roll numbers must be unique. Member names may be the same.' });
      return;
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
        groupName: prevGroup.groupName,
        subjectId: groupSubjectId,
        assignmentId: groupAssignmentId || undefined,
        members: prevGroup.members,
        leader: prevGroup.leader,
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
    <div className="student-dashboard w-full max-w-6xl mx-auto py-6 sm:py-8 px-3 sm:px-4 space-y-6 sm:space-y-8 min-w-0">
      {/* PROFILE SUMMARY HEADER */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-2xl">
            <User className="w-10 h-10" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold">{student?.name}</h1>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-full">
                Verified Student
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5 break-words">
              Roll Number: <span className="font-mono font-bold text-white break-all">{student?.rollNumber}</span> &bull; Email:{' '}
              <span className="text-slate-300 break-all">{student?.email}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-1.5 bg-slate-800 p-1.5 rounded-xl border border-slate-700 w-full sm:flex sm:items-center sm:gap-2 sm:w-auto">
          <button
            onClick={() => setActiveTab('submit')}
            className={`w-full sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 ${
              activeTab === 'submit' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" /> Submit Assignment
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 ${
              activeTab === 'groups' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> Group Registration
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 ${
              activeTab === 'history' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" /> My Submissions ({mySubmissions.length})
          </button>
        </div>
      </div>

      {/* SUBMISSION RECEIPT VIEW */}
      {receipt && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
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
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-800 p-6 text-white border-b border-slate-700">
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
                {groupSubjects.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
              {groupSubjects.length === 0 && (
                <p className="text-xs text-amber-700 font-semibold mt-2">
                  No subject is currently enabled for group registration by the CR.
                </p>
              )}
              {groupSubjectId && (
                <p className="text-xs text-blue-700 font-semibold mt-2">
                  This subject allows up to {maxGroupMembers} group members. {extraMembers.length + 1} member boxes are ready.
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
                    {ass.title} ({ass.submissionType === 'Individual' ? 'Individual' : 'Group Assignment'}) - Due: {formatDate(ass.deadline)}
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
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-800 p-6 text-white border-b border-slate-700">
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
                {subjects.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
            </div>

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
                <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                  <div>
                    <span className="text-xs text-emerald-700 uppercase font-bold tracking-wider">Registered Group</span>
                    <h3 className="text-xl font-extrabold text-slate-900">{myGroup.groupName}</h3>
                  </div>
                  <span className="px-3 py-1 bg-emerald-600 text-white font-bold text-xs rounded-full">
                    {myGroup.members.length} Member(s)
                  </span>
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
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Group Assignment <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={groupAssignmentId}
                        onChange={(e) => setGroupAssignmentId(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                      >
                        <option value="">-- Select Group Assignment --</option>
                        {selectedGroupAssignments.map((assignment) => (
                          <option key={assignment._id} value={assignment._id}>
                            {assignment.title} (Up to {assignment.maxGroupSize || maxGroupMembers} members)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Group Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="e.g., Team Alpha"
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
                      disabled={groupSubmitting}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition flex items-center justify-center gap-2"
                    >
                      {groupSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
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
                            disabled={groupSubmitting}
                            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-2 shrink-0"
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
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-800 p-6 text-white border-b border-slate-700 flex items-center justify-between">
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
    </div>
  );
};
