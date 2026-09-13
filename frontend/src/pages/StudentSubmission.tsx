import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Subject, Assignment, SubmissionReceipt } from '../types';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Send,
  Loader2,
  BookOpen,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

export const StudentSubmission: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(true);
  const [loadingAssignments, setLoadingAssignments] = useState<boolean>(false);

  // Form State
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [studentName, setStudentName] = useState<string>('');
  const [rollNumber, setRollNumber] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Selected assignment metadata
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Load active subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoadingSubjects(true);
        const res = await api.get('/subjects');
        if (res.data.success) {
          setSubjects(res.data.subjects);
        }
      } catch (err) {
        setErrorMsg('Failed to load subjects. Please refresh the page.');
      } finally {
        setLoadingSubjects(false);
      }
    };

    fetchSubjects();
  }, []);

  // Fetch active assignments when subject changes
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
        setErrorMsg('Failed to load assignments for selected subject.');
      } finally {
        setLoadingAssignments(false);
      }
    };

    fetchAssignments();
  }, [selectedSubjectId]);

  // Update selected assignment metadata when assignment ID changes
  useEffect(() => {
    if (!selectedAssignmentId) {
      setSelectedAssignment(null);
      return;
    }

    const found = assignments.find((a) => a._id === selectedAssignmentId);
    setSelectedAssignment(found || null);
  }, [selectedAssignmentId, assignments]);

  // Handle File Selection
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

  // Frontend Validation
  const validateForm = (): boolean => {
    setErrorMsg(null);

    if (!selectedSubjectId) {
      setErrorMsg('Please select a subject.');
      return false;
    }

    if (!selectedAssignmentId) {
      setErrorMsg('Please select an assignment.');
      return false;
    }

    if (!studentName.trim()) {
      setErrorMsg('Please enter your full name.');
      return false;
    }

    if (!rollNumber.trim()) {
      setErrorMsg('Please enter your roll number.');
      return false;
    }

    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return false;
    }

    if (!selectedFile) {
      setErrorMsg('Please select your assignment file.');
      return false;
    }

    if (selectedAssignment) {
      // Validate File Type
      const ext = selectedFile.name.split('.').pop()?.toLowerCase() || '';
      const allowed = selectedAssignment.allowedFileTypes.map((t) => t.replace('.', '').toLowerCase());
      if (!allowed.includes(ext)) {
        setErrorMsg(`Only ${allowed.map((a) => a.toUpperCase()).join(', ')} files are allowed.`);
        return false;
      }

      // Validate File Size
      const maxSizeMB = selectedAssignment.maxFileSize || 10;
      const maxBytes = maxSizeMB * 1024 * 1024;
      if (selectedFile.size > maxBytes) {
        setErrorMsg(`File size exceeds the ${maxSizeMB} MB limit.`);
        return false;
      }
    }

    return true;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('subjectId', selectedSubjectId);
      formData.append('assignmentId', selectedAssignmentId);
      formData.append('studentName', studentName.trim());
      formData.append('rollNumber', rollNumber.trim());
      formData.append('email', email.trim());
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const res = await api.post('/submissions', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success) {
        setReceipt(res.data.submission);
      } else {
        setErrorMsg(res.data.message || 'Failed to submit assignment.');
      }
    } catch (err: any) {
      const serverMessage = err.response?.data?.message || 'Something went wrong on the server. Please try again.';
      setErrorMsg(serverMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setReceipt(null);
    setSelectedFile(null);
    setErrorMsg(null);
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

  // SUCCESS RECEIPT VIEW
  if (receipt) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-emerald-600 p-6 text-white text-center">
            <div className="inline-flex p-3 bg-white/20 rounded-full mb-3">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold">✓ Assignment Submitted Successfully</h2>
            <p className="text-emerald-100 text-sm mt-1">Receipt ID: {receipt.submissionId}</p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex justify-between border-b border-slate-200 pb-2 text-sm">
                <span className="text-slate-500 font-medium">Submission ID</span>
                <span className="font-mono font-bold text-slate-800">{receipt.submissionId}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2 text-sm">
                <span className="text-slate-500 font-medium">Student Name</span>
                <span className="font-semibold text-slate-800">{receipt.studentName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2 text-sm">
                <span className="text-slate-500 font-medium">Roll Number</span>
                <span className="font-semibold text-slate-800">{receipt.rollNumber}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2 text-sm">
                <span className="text-slate-500 font-medium">Subject</span>
                <span className="font-semibold text-slate-800">
                  {receipt.subjectName} ({receipt.subjectCode})
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2 text-sm">
                <span className="text-slate-500 font-medium">Assignment</span>
                <span className="font-semibold text-slate-800">{receipt.assignmentTitle}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2 text-sm">
                <span className="text-slate-500 font-medium">File Name</span>
                <span className="font-medium text-blue-600 truncate max-w-[200px]">{receipt.originalFileName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2 text-sm">
                <span className="text-slate-500 font-medium">Submitted At</span>
                <span className="font-medium text-slate-800">{receipt.submittedAt}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Submission Status</span>
                <span>
                  {receipt.isLate ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                      LATE
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                      ON TIME
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div
              className={`p-4 rounded-xl text-sm flex items-start gap-3 border ${
                receipt.emailStatus === 'Sent'
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <Send className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                {receipt.emailStatus === 'Sent' ? (
                  <p>Confirmation email sent to <strong>{receipt.email}</strong>.</p>
                ) : (
                  <p>Assignment submitted successfully. However, the confirmation email could not be sent to {receipt.email}.</p>
                )}
              </div>
            </div>

            <button
              onClick={resetForm}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-blue-500/25 transition duration-200"
            >
              Submit Another Assignment
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STUDENT SUBMISSION FORM VIEW
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 p-6 sm:p-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-7 h-7 text-blue-400" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Assignment Submission Portal</h1>
          </div>
          <p className="text-slate-400 text-sm sm:text-base">
            Submit your class coursework securely. File and submission receipts are stored directly in the official class portal.
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="font-medium">{errorMsg}</div>
          </div>
        )}

        {/* Submission Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {/* Subject Dropdown */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Subject <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={loadingSubjects || isSubmitting}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-slate-800 font-medium disabled:opacity-60"
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
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Assignment <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedAssignmentId}
              onChange={(e) => setSelectedAssignmentId(e.target.value)}
              disabled={!selectedSubjectId || loadingAssignments || isSubmitting}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-slate-800 font-medium disabled:opacity-60"
            >
              <option value="">
                {!selectedSubjectId
                  ? '-- Select a Subject First --'
                  : loadingAssignments
                  ? 'Loading assignments...'
                  : assignments.length === 0
                  ? 'No active assignments for this subject'
                  : '-- Select Assignment --'}
              </option>
              {assignments.map((ass) => (
                <option key={ass._id} value={ass._id}>
                  {ass.title} (Deadline: {formatDate(ass.deadline)})
                </option>
              ))}
            </select>
          </div>

          {/* Assignment Details Card */}
          {selectedAssignment && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-2 text-sm text-blue-900">
              <div className="flex items-center justify-between font-semibold border-b border-blue-200/80 pb-2">
                <span>{selectedAssignment.title}</span>
                <span className="flex items-center gap-1.5 text-xs text-blue-700 bg-white px-2.5 py-1 rounded-md border border-blue-200">
                  <Calendar className="w-3.5 h-3.5" />
                  Due: {formatDate(selectedAssignment.deadline)}
                </span>
              </div>
              {selectedAssignment.description && (
                <p className="text-xs text-slate-600">{selectedAssignment.description}</p>
              )}
              <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-700 pt-1">
                <div>
                  Allowed Formats:{' '}
                  <span className="font-bold text-blue-700">
                    {selectedAssignment.allowedFileTypes.map((t) => t.toUpperCase()).join(', ')}
                  </span>
                </div>
                <div>
                  Max Size:{' '}
                  <span className="font-bold text-blue-700">{selectedAssignment.maxFileSize} MB</span>
                </div>
                <div>
                  Late Submissions:{' '}
                  <span
                    className={`font-bold ${
                      selectedAssignment.allowLateSubmission ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {selectedAssignment.allowLateSubmission ? 'Allowed' : 'Not Allowed'}
                  </span>
                </div>
              </div>

              {/* Deadline Check Warning */}
              {new Date() > new Date(selectedAssignment.deadline) && (
                <div className="mt-2 p-2.5 bg-amber-100 border border-amber-300 rounded-lg flex items-center gap-2 text-xs font-semibold text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>The deadline for this assignment has passed. Your submission will be marked as LATE.</span>
                </div>
              )}
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Abdullah Waqar"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-slate-800"
            />
          </div>

          {/* Roll Number */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Roll Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 21"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-slate-800 font-mono"
            />
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              placeholder="e.g. student@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-slate-800"
            />
            <p className="text-xs text-slate-500 mt-1">Confirmation receipt will be sent to this email.</p>
          </div>

          {/* File Upload Drop Zone */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
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
                id="file-upload"
                onChange={handleFileChange}
                disabled={isSubmitting}
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer block">
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-10 h-10 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-slate-800 text-sm truncate max-w-xs">{selectedFile.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 hover:underline mt-1">
                      Click to change file
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-10 h-10 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-700">
                      Drag & drop your assignment file here, or{' '}
                      <span className="text-blue-600 underline">browse</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Allowed formats:{' '}
                      {selectedAssignment
                        ? selectedAssignment.allowedFileTypes.map((t) => t.toUpperCase()).join(', ')
                        : 'PDF, DOC, DOCX, PPT, PPTX, ZIP'}{' '}
                      (Max: {selectedAssignment ? selectedAssignment.maxFileSize : 10} MB)
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-base rounded-xl shadow-lg hover:shadow-blue-500/25 transition duration-200 flex items-center justify-center gap-2"
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
    </div>
  );
};
