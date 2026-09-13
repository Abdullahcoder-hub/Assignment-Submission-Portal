import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Subject, Assignment, Submission, StudentUser, SubmissionReceipt } from '../types';
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
  RefreshCw,
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const student = user as StudentUser;

  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit');

  // Subjects & Assignments
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(true);
  const [loadingAssignments, setLoadingAssignments] = useState<boolean>(false);

  // Student's Own Submissions History
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Form State (Identity pre-populated on backend via JWT token!)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  // UI State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Fetch Subjects & My Profile Submissions
  const fetchStudentData = async () => {
    try {
      setLoadingSubjects(true);
      const resSubjects = await api.get('/subjects');
      if (resSubjects.data.success) {
        setSubjects(resSubjects.data.subjects);
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

  useEffect(() => {
    fetchStudentData();
  }, []);

  // Fetch assignments when subject changes
  useEffect(() => {
    if (!selectedSubjectId) {
      setAssignments([]);
      setSelectedAssignmentId('');
      setSelectedAssignment(null);
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

  useEffect(() => {
    if (!selectedAssignmentId) {
      setSelectedAssignment(null);
      return;
    }
    const found = assignments.find((a) => a._id === selectedAssignmentId);
    setSelectedAssignment(found || null);
  }, [selectedAssignmentId, assignments]);

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

  // Submit Handler
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
        fetchStudentData(); // Refresh history
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

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
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
            <p className="text-sm text-slate-400 mt-0.5">
              Roll Number: <span className="font-mono font-bold text-white">{student?.rollNumber}</span> &bull; Email:{' '}
              <span className="text-slate-300">{student?.email}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('submit')}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 ${
              activeTab === 'submit' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" /> Submit Assignment
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
                  {receipt.isLate ? (
                    <span className="px-2.5 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full">
                      LATE
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full">
                      ON TIME
                    </span>
                  )}
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
                {subjects.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
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
                    {ass.title} (Due: {formatDate(ass.deadline)})
                  </option>
                ))}
              </select>
            </div>

            {/* Assignment Details Card */}
            {selectedAssignment && (
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-2 text-sm text-blue-900">
                <div className="flex items-center justify-between font-semibold border-b border-blue-200/80 pb-2">
                  <span>{selectedAssignment.title}</span>
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
                </div>

                {new Date() > new Date(selectedAssignment.deadline) && (
                  <div className="mt-2 p-2.5 bg-amber-100 border border-amber-300 rounded-lg flex items-center gap-2 text-xs font-semibold text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>The deadline has passed. Your submission will be marked as LATE.</span>
                  </div>
                )}
              </div>
            )}

            {/* File Upload Box */}
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
          </form>
        </div>
      )}

      {/* TAB 2: MY SUBMISSION HISTORY */}
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

          <div className="overflow-x-auto">
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
                        {sub.isLate ? (
                          <span className="px-2.5 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full">
                            LATE
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full">
                            ON TIME
                          </span>
                        )}
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
        </div>
      )}
    </div>
  );
};
