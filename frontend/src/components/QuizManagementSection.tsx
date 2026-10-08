import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Quiz, QuizQuestion, QuizSubmission, Class, Subject, TeacherAssignment, AdminUser, LateRequest } from '../types';
import {
  FileCheck,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Download,
  Upload,
  Calendar,
  Clock,
  BookOpen,
  Users,
  Search,
  Loader2,
  ShieldCheck,
  HelpCircle,
  Eye,
  Check,
  X,
  FileText,
} from 'lucide-react';

export const QuizManagementSection: React.FC<{ userRole?: string }> = ({ userRole = 'TEACHER' }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizRequests, setQuizRequests] = useState<LateRequest[]>([]);
  const [myAssignments, setMyAssignments] = useState<TeacherAssignment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Create Quiz Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [quizTitle, setQuizTitle] = useState<string>('');
  const [quizDescription, setQuizDescription] = useState<string>('');
  const [quizType, setQuizType] = useState<'MCQ' | 'Written' | 'Mixed'>('MCQ');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [deadline, setDeadline] = useState<string>('');
  const [allowLateSubmission, setAllowLateSubmission] = useState<boolean>(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([
    {
      questionId: 'q-1',
      questionType: 'MCQ',
      questionText: '',
      options: ['', '', '', ''],
      correctOptionIndex: 0,
      marks: 1,
    },
  ]);
  const [formError, setFormError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Submissions & Grading Drawer/Modal State
  const [selectedQuizForSubmissions, setSelectedQuizForSubmissions] = useState<Quiz | null>(null);
  const [quizSubmissions, setQuizSubmissions] = useState<QuizSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState<boolean>(false);
  const [loadingGradingSubmissionId, setLoadingGradingSubmissionId] = useState<string | null>(null);
  const [updatingResults, setUpdatingResults] = useState<boolean>(false);
  const [uploadingGrades, setUploadingGrades] = useState<boolean>(false);
  const [uploadedGradesFile, setUploadedGradesFile] = useState<string | null>(null);
  const [loadingQuizRequests, setLoadingQuizRequests] = useState<boolean>(true);

  // Grading Modal State
  const [gradingSubmission, setGradingSubmission] = useState<QuizSubmission | null>(null);
  const [gradedMarks, setGradedMarks] = useState<Record<string, number>>({});
  const [gradedFeedback, setGradedFeedback] = useState<Record<string, string>>({});
  const [savingGrade, setSavingGrade] = useState<boolean>(false);

  const fetchQuizRequests = async () => {
    setLoadingQuizRequests(true);
    try {
      const response = await api.get('/late-requests?requestType=Quiz');
      if (response.data.success) setQuizRequests(response.data.requests || []);
    } catch {
      setFeedback({ success: false, message: 'Failed to load quiz access requests.' });
    } finally {
      setLoadingQuizRequests(false);
    }
  };

  const fetchData = async () => {
    void fetchQuizRequests();
    setLoading(true);
    const results = await Promise.allSettled([
        api.get('/quizzes'),
        api.get('/teacher-assignments/my-classes'),
        api.get('/classes'),
        api.get('/subjects'),
    ]);
    const [resQuizzes, resMyClasses, resClasses, resSubjects] = results;
    if (resQuizzes.status === 'fulfilled' && resQuizzes.value.data.success) setQuizzes(resQuizzes.value.data.quizzes || []);
    if (resMyClasses.status === 'fulfilled' && resMyClasses.value.data.success) setMyAssignments(resMyClasses.value.data.assignments || []);
    if (resClasses.status === 'fulfilled' && resClasses.value.data.success) setClasses(resClasses.value.data.classes || []);
    if (resSubjects.status === 'fulfilled' && resSubjects.value.data.success) setSubjects(resSubjects.value.data.subjects || []);
    if (results.some((result) => result.status === 'rejected')) {
      setFeedback({ success: false, message: 'Some quiz management data failed to load.' });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreateModal = () => {
    if (userRole !== 'TEACHER') return;
    setEditingQuizId(null);
    // Default to first assigned class and subject
    const defaultAssignment = myAssignments[0];
    const defaultClassId = defaultAssignment ? (typeof defaultAssignment.classId === 'object' ? (defaultAssignment.classId as any)._id : defaultAssignment.classId) : (classes[0]?._id || '');
    const defaultSubjectId = defaultAssignment ? (typeof defaultAssignment.subjectId === 'object' ? (defaultAssignment.subjectId as any)._id : defaultAssignment.subjectId) : (subjects[0]?._id || '');

    setSelectedClassId(defaultClassId);
    setSelectedSubjectId(defaultSubjectId);
    setQuizTitle('');
    setQuizDescription('');
    setQuizType('MCQ');
    setDurationMinutes(30);
    // default deadline: tomorrow 23:59
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const localIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setDeadline(localIso);
    setAllowLateSubmission(false);
    setQuestions([
      {
        questionId: 'q-1',
        questionType: 'MCQ',
        questionText: '',
        options: ['', '', '', ''],
        correctOptionIndex: 0,
        marks: 1,
      },
    ]);
    setFormError('');
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (quiz: Quiz) => {
    const classId = typeof quiz.classId === 'string' ? quiz.classId : quiz.classId._id;
    const subjectId = typeof quiz.subjectId === 'string' ? quiz.subjectId : quiz.subjectId._id;
    setEditingQuizId(quiz._id);
    setSelectedClassId(classId);
    setSelectedSubjectId(subjectId);
    setQuizTitle(quiz.title);
    setQuizDescription(quiz.description || '');
    setQuizType(quiz.quizType);
    setDurationMinutes(quiz.durationMinutes || 30);
    const quizDeadline = new Date(quiz.deadline);
    setDeadline(new Date(quizDeadline.getTime() - quizDeadline.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    setAllowLateSubmission(quiz.allowLateSubmission);
    setQuestions(quiz.questions.map((question) => ({ ...question, options: question.options ? [...question.options] : undefined })));
    setFormError('');
    setShowCreateModal(true);
  };

  const handleQuizRequestDecision = async (requestId: string, decision: 'Approved' | 'Rejected') => {
    try {
      await api.patch(`/late-requests/${requestId}/decision`, { decision });
      setFeedback({ success: true, message: `Quiz access request ${decision.toLowerCase()}.` });
      await fetchQuizRequests();
    } catch (err: any) {
      setFeedback({ success: false, message: err.response?.data?.message || 'Failed to update quiz access request.' });
    }
  };

  const handleGrantFourthAttempt = async (request: LateRequest) => {
    const quizId = typeof request.quizId === 'object' && request.quizId ? request.quizId._id : request.quizId;
    if (!quizId || !request.studentId) return;
    try {
      await api.patch(`/quizzes/${quizId}/attempts/${request.studentId}/unlock`);
      setFeedback({ success: true, message: 'Fourth quiz attempt allowed. The student can resume the quiz.' });
      await fetchQuizRequests();
    } catch (err: any) {
      setFeedback({ success: false, message: err.response?.data?.message || 'Failed to allow a fourth attempt.' });
    }
  };

  const handleToggleResults = async () => {
    if (!selectedQuizForSubmissions) return;
    try {
      setUpdatingResults(true);
      const resultsPublished = !selectedQuizForSubmissions.resultsPublished;
      const res = await api.patch(`/quizzes/${selectedQuizForSubmissions._id}/results`, { resultsPublished });
      if (res.data.success) {
        setSelectedQuizForSubmissions({ ...selectedQuizForSubmissions, resultsPublished });
        setQuizzes((current) => current.map((quiz) => quiz._id === selectedQuizForSubmissions._id
          ? { ...quiz, resultsPublished }
          : quiz));
        setFeedback({ success: true, message: res.data.message });
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.response?.data?.message || 'Failed to update result visibility.' });
    } finally {
      setUpdatingResults(false);
    }
  };

  const handleDownloadQuizPdf = async () => {
    if (!selectedQuizForSubmissions) return;
    try {
      const response = await api.get(`/quizzes/${selectedQuizForSubmissions._id}/submissions/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedQuizForSubmissions.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Quiz_Submissions.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      setFeedback({ success: false, message: err.response?.data?.message || 'Failed to download the quiz PDF.' });
    }
  };

  const handleDownloadGradesCsv = async () => {
    if (!selectedQuizForSubmissions) return;
    try {
      const response = await api.get(`/quizzes/${selectedQuizForSubmissions._id}/submissions/csv`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedQuizForSubmissions.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Quiz_Grades.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      setFeedback({ success: false, message: err.response?.data?.message || 'Failed to download the grades CSV.' });
    }
  };

  const handleDownloadGradesExcel = async () => {
    if (!selectedQuizForSubmissions) return;
    try {
      const response = await api.get(`/quizzes/${selectedQuizForSubmissions._id}/submissions/grades-excel`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedQuizForSubmissions.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Quiz_Grades.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      setFeedback({ success: false, message: err.response?.data?.message || 'Failed to download the Excel grades file.' });
    }
  };

  const handleUploadGradesFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedQuizForSubmissions) return;
    const isExcel = file.name.toLowerCase().endsWith('.xlsx');
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    if (!isExcel && !isCsv) {
      setFeedback({ success: false, message: 'Select an Excel (.xlsx) or Excel-compatible (.csv) grades file.' });
      return;
    }

    setUploadingGrades(true);
    try {
      const response = await api.post(
        `/quizzes/${selectedQuizForSubmissions._id}/submissions/grades-${isExcel ? 'excel' : 'csv'}`,
        isExcel ? await file.arrayBuffer() : await file.text(),
        { headers: { 'Content-Type': isExcel ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv' } },
      );
      setFeedback({ success: true, message: response.data.message || 'Grades uploaded successfully.' });
      setUploadedGradesFile(file.name);
      await handleViewSubmissions(selectedQuizForSubmissions);
    } catch (err: any) {
      setFeedback({ success: false, message: err.response?.data?.message || 'File rejected. Use the downloaded grades template.' });
    } finally {
      setUploadingGrades(false);
    }
  };

  const handleAddQuestion = (type: 'MCQ' | 'Written') => {
    const newQ: QuizQuestion = {
      questionId: `q-${Date.now()}`,
      questionType: type,
      questionText: '',
      marks: type === 'Written' ? 5 : 1,
      options: type === 'MCQ' ? ['', '', '', ''] : undefined,
      correctOptionIndex: type === 'MCQ' ? 0 : undefined,
    };
    setQuestions([...questions, newQ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleQuestionTextChange = (idx: number, text: string) => {
    const updated = [...questions];
    updated[idx].questionText = text;
    setQuestions(updated);
  };

  const handleOptionTextChange = (qIdx: number, optIdx: number, text: string) => {
    const updated = [...questions];
    if (updated[qIdx].options) {
      updated[qIdx].options![optIdx] = text;
      setQuestions(updated);
    }
  };

  const handleCorrectOptionChange = (qIdx: number, optIdx: number) => {
    const updated = [...questions];
    updated[qIdx].correctOptionIndex = optIdx;
    setQuestions(updated);
  };

  const handleMarksChange = (idx: number, marks: number) => {
    const updated = [...questions];
    updated[idx].marks = Math.max(1, marks);
    setQuestions(updated);
  };

  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedClassId || !selectedSubjectId || !quizTitle.trim() || !deadline) {
      setFormError('Please fill in Class, Subject, Title, and Deadline.');
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) {
        setFormError(`Question ${i + 1} is missing its question text.`);
        return;
      }
      if (q.questionType === 'MCQ') {
        if (!q.options || q.options.some((opt) => !opt.trim())) {
          setFormError(`All MCQ options in Question ${i + 1} must be filled out.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        title: quizTitle,
        description: quizDescription,
        quizType,
        durationMinutes,
        deadline,
        allowLateSubmission,
        questions,
      };
      const res = editingQuizId
        ? await api.put(`/quizzes/${editingQuizId}`, payload)
        : await api.post('/quizzes', payload);

      if (res.data.success) {
        setFeedback({ success: true, message: editingQuizId ? 'Quiz updated successfully.' : 'Quiz created successfully.' });
        setShowCreateModal(false);
        setEditingQuizId(null);
        fetchData();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create quiz.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuiz = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete quiz "${title}" and all its submissions?`)) return;
    try {
      const res = await api.delete(`/quizzes/${id}`);
      if (res.data.success) {
        setFeedback({ success: true, message: 'Quiz deleted successfully.' });
        fetchData();
        if (selectedQuizForSubmissions?._id === id) {
          setSelectedQuizForSubmissions(null);
        }
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.response?.data?.message || 'Failed to delete quiz.' });
    }
  };

  const handleViewSubmissions = async (quiz: Quiz) => {
    setSelectedQuizForSubmissions(quiz);
    setLoadingSubmissions(true);
    try {
      const res = await api.get(`/quizzes/${quiz._id}/submissions`);
      if (res.data.success) {
        setQuizSubmissions(res.data.submissions || []);
      }
    } catch (err: any) {
      setFeedback({ success: false, message: 'Failed to fetch quiz submissions.' });
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleOpenGradeModal = async (sub: QuizSubmission) => {
    setLoadingGradingSubmissionId(sub._id);
    try {
      const response = await api.get(`/quizzes/submissions/${sub._id}/grade`);
      const detailedSubmission = response.data.submission as QuizSubmission;
      const initialMarks: Record<string, number> = {};
      const initialFeedback: Record<string, string> = {};
      detailedSubmission.answers.forEach((answer) => {
        if (answer.questionType === 'Written') {
          initialMarks[answer.questionId] = answer.marksAwarded || 0;
          initialFeedback[answer.questionId] = answer.teacherFeedback || '';
        }
      });
      setGradedMarks(initialMarks);
      setGradedFeedback(initialFeedback);
      setGradingSubmission(detailedSubmission);
    } catch (err: any) {
      setFeedback({ success: false, message: err.response?.data?.message || 'Failed to load submission for grading.' });
    } finally {
      setLoadingGradingSubmissionId(null);
    }
  };

  const handleSaveGrades = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission) return;

    setSavingGrade(true);
    try {
      const payload = Object.keys(gradedMarks).map((qId) => ({
        questionId: qId,
        marksAwarded: Number(gradedMarks[qId]) || 0,
        teacherFeedback: gradedFeedback[qId] || '',
      }));

      const res = await api.put(`/quizzes/submissions/${gradingSubmission._id}/grade`, {
        gradedAnswers: payload,
      });

      if (res.data.success) {
        setFeedback({ success: true, message: 'Submission graded successfully!' });
        setGradingSubmission(null);
        // refresh submissions
        if (selectedQuizForSubmissions) {
          handleViewSubmissions(selectedQuizForSubmissions);
        }
      }
    } catch (err: any) {
      setFeedback({ success: false, message: 'Failed to save grades.' });
    } finally {
      setSavingGrade(false);
    }
  };

  const filteredQuizzes = quizzes.filter((q) => {
    const subjectName = typeof q.subjectId === 'object' && q.subjectId ? (q.subjectId as any).name : '';
    const className = typeof q.classId === 'object' && q.classId ? (q.classId as any).name : '';
    return (
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      subjectName.toLowerCase().includes(search.toLowerCase()) ||
      className.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-indigo-600" />
            Quiz & Examination Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Create MCQ, Written, and Mixed quizzes. Automatic CR resolution assigns the class CR to each quiz.
          </p>
        </div>

        {userRole === 'TEACHER' && (
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Create New Quiz
          </button>
        )}
      </div>

      {(userRole === 'TEACHER' || quizRequests.some((request) => request.status === 'Pending' || request.requestCount === 3)) && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 space-y-3">
          <h3 className="font-bold text-slate-900">Quiz Access Requests</h3>
          {loadingQuizRequests ? (
            <p className="text-sm text-slate-500">Loading quiz access requests...</p>
          ) : quizRequests.filter((request) => request.status === 'Pending' || request.requestCount === 3).length === 0 ? (
            <p className="text-sm text-slate-500">No pending quiz access requests.</p>
          ) : quizRequests.filter((request) => request.status === 'Pending' || request.requestCount === 3).map((request) => {
            const quiz = request.quizId && typeof request.quizId === 'object' ? request.quizId as Quiz : null;
            const requestClass = request.classId && typeof request.classId === 'object' ? request.classId as Class : null;
            return (
              <div key={request._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-white p-3 border border-amber-100">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-slate-900">{request.studentName} ({request.rollNumber}) · {quiz?.title || 'Quiz'}</p>
                  <p className="text-xs text-slate-600">{requestClass?.name || 'Class'} · {request.reason} · {request.requestCount || 0}/3 requests · {request.status}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {request.status === 'Pending' && <>
                    <button onClick={() => handleQuizRequestDecision(request._id, 'Approved')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold">Approve / Unblock</button>
                    <button onClick={() => handleQuizRequestDecision(request._id, 'Rejected')} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold">Reject</button>
                  </>}
                  {request.status !== 'Pending' && request.requestCount === 3 && request.attemptStatus === 'locked' && (
                    <button onClick={() => handleGrantFourthAttempt(request)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold">Allow 4th Attempt</button>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between ${
            feedback.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.success ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 text-xs font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search quizzes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Quizzes Grid */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm text-slate-500 mt-2">Loading quizzes...</p>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8">
          <FileCheck className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-semibold text-slate-800 mt-3">No Quizzes Found</h3>
          <p className="text-sm text-slate-500 mt-1">Click "Create New Quiz" to compose questions for your assigned classes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredQuizzes.map((q) => {
            const classDoc = q.classId as Class;
            const subjectDoc = q.subjectId as Subject;
            const crDoc = q.crId as AdminUser;
            const teacherDoc = q.teacherId as AdminUser;

            return (
              <div
                key={q._id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                        {classDoc?.name || 'Class'}
                      </span>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {subjectDoc?.name || 'Subject'}
                      </span>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                        {q.quizType}
                      </span>
                    </div>

                    {userRole === 'TEACHER' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(q)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Edit quiz"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuiz(q._id, q.title)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete quiz"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mt-3 line-clamp-1">{q.title}</h3>
                  {q.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{q.description}</p>}

                  {/* Metadata */}
                  <div className="mt-4 space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        Duration:
                      </span>
                      <span className="font-semibold text-slate-800">{q.durationMinutes || 30} mins</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-amber-500" />
                        Deadline:
                      </span>
                      <span className="font-semibold text-slate-800">
                        {new Date(q.deadline).toLocaleDateString()} {new Date(q.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                        Questions & Marks:
                      </span>
                      <span className="font-semibold text-slate-800">
                        {q.questions?.length || 0} Questions ({q.totalMarks} Marks)
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                        Assigned CR:
                      </span>
                      <span className="font-medium text-slate-800 truncate max-w-[130px]">
                        {crDoc?.name || 'Auto Assigned'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span>{q.submissionCount || 0} Submissions</span>
                  </div>

                  <button
                    onClick={() => handleViewSubmissions(q)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Submissions
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submissions & Grading Drawer / Modal */}
      {selectedQuizForSubmissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Quiz Submissions</span>
                <h3 className="font-bold text-slate-900 text-base sm:text-lg">{selectedQuizForSubmissions.title}</h3>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {userRole === 'TEACHER' && (
                  <>
                    <button onClick={handleDownloadQuizPdf} className="px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg">
                      <Download className="inline w-3.5 h-3.5 mr-1" /> Download All as PDF
                    </button>
                    <button onClick={handleDownloadGradesExcel} className="px-3 py-2 bg-slate-600 text-white text-xs font-bold rounded-lg">
                      <Download className="inline w-3.5 h-3.5 mr-1" /> Download Grades File
                    </button>
                    {selectedQuizForSubmissions.questions?.some((question) => question.questionType === 'Written') && (
                      <label className={`inline-flex items-center gap-1 px-3 py-2 ${uploadingGrades ? 'bg-emerald-400' : 'bg-emerald-600 hover:bg-emerald-700'} text-white text-xs font-bold rounded-lg cursor-pointer`}>
                        <Upload className="inline w-3.5 h-3.5 mr-1" />
                        {uploadingGrades ? 'Uploading...' : uploadedGradesFile ? 'File Uploaded' : 'Upload Marked File'}
                        <input
                          type="file"
                          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                          className="hidden"
                          disabled={uploadingGrades}
                          onChange={handleUploadGradesFile}
                        />
                      </label>
                    )}
                      {uploadedGradesFile && !uploadingGrades && (
                        <span className="max-w-32 truncate text-[11px] text-emerald-700" title={uploadedGradesFile}>
                          {uploadedGradesFile}
                        </span>
                      )}
                    <button onClick={handleToggleResults} disabled={updatingResults} className="px-3 py-2 bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg">
                      {updatingResults ? 'Saving...' : selectedQuizForSubmissions.resultsPublished ? 'Hide Results' : 'Declare Results'}
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedQuizForSubmissions(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {loadingSubmissions ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                  <p className="text-sm text-slate-500 mt-2">Loading submissions...</p>
                </div>
              ) : quizSubmissions.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p className="text-sm">No student submissions received for this quiz yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Roll Number</th>
                        <th className="px-4 py-3">Student Name</th>
                        {userRole === 'TEACHER' && <>
                          <th className="px-4 py-3">MCQ Score</th>
                          <th className="px-4 py-3">Written Score</th>
                          <th className="px-4 py-3">Total Marks</th>
                          <th className="px-4 py-3">Grading</th>
                        </>}
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {quizSubmissions.map((sub) => (
                        <tr key={sub._id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">{sub.rollNumber}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{sub.studentName}</td>
                          {userRole === 'TEACHER' && <>
                            <td className="px-4 py-3 text-indigo-600 font-semibold">{sub.mcqScore}</td>
                            <td className="px-4 py-3 text-purple-600 font-semibold">{sub.writtenScore}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">{sub.totalScore} / {selectedQuizForSubmissions.totalMarks}</td>
                            <td className="px-4 py-3">
                              {sub.isGraded
                                ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100"><Check className="w-3 h-3" /> Graded</span>
                                : <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">Pending Grading</span>}
                            </td>
                          </>}
                          <td className="px-4 py-3 text-right space-x-2">
                            {userRole === 'TEACHER' && selectedQuizForSubmissions.quizType !== 'MCQ' && (
                              <button
                                onClick={() => handleOpenGradeModal(sub)}
                                disabled={loadingGradingSubmissionId === sub._id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition"
                              >
                                {loadingGradingSubmissionId === sub._id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Edit2 className="w-3.5 h-3.5" />}
                                {loadingGradingSubmissionId === sub._id ? 'Loading' : 'Grade'}
                              </button>
                            )}

                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Written Grading Modal */}
      {gradingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900">
                  Grade Submission - {gradingSubmission.studentName} ({gradingSubmission.rollNumber})
                </h3>
                <p className="text-xs text-slate-500">Auto MCQ Score: {gradingSubmission.mcqScore} Marks</p>
              </div>
              <button onClick={() => setGradingSubmission(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGrades} className="p-5 overflow-y-auto flex-1 space-y-4">
              {gradingSubmission.answers
                .filter((a) => a.questionType === 'Written')
                .map((ans, idx) => (
                  <div key={ans.questionId} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <span className="text-xs font-bold text-indigo-700">Written Question {idx + 1}</span>
                    <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-800 whitespace-pre-wrap">
                      <strong className="block text-slate-500 text-xs mb-1">Student's Answer:</strong>
                      {ans.writtenAnswerText || '[No Answer Submitted]'}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Marks Awarded</label>
                        <input
                          type="number"
                          min="0"
                          max={selectedQuizForSubmissions?.questions.find((question) => question.questionId === ans.questionId)?.marks || 0}
                          value={gradedMarks[ans.questionId] ?? ans.marksAwarded ?? 0}
                          onChange={(e) =>
                            setGradedMarks({
                              ...gradedMarks,
                              [ans.questionId]: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Teacher Feedback (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Well explained"
                          value={gradedFeedback[ans.questionId] ?? ans.teacherFeedback ?? ''}
                          onChange={(e) =>
                            setGradedFeedback({
                              ...gradedFeedback,
                              [ans.questionId]: e.target.value,
                            })
                          }
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setGradingSubmission(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingGrade}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {savingGrade && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Grades
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Quiz Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-lg">{editingQuizId ? 'Edit Quiz' : 'Create New Quiz'}</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuiz} className="p-5 overflow-y-auto flex-1 space-y-5">
              {formError && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">{formError}</div>}

              {/* Class & Subject Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Class</label>
                  <select
                    required
                    disabled={Boolean(editingQuizId)}
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Select Class --</option>
                    {classes.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} (Semester: {c.semester}, Section: {c.section})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                  <select
                    required
                    disabled={Boolean(editingQuizId)}
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Select Subject --</option>
                    {subjects.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quiz Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Midterm Quiz: Polymorphism & Inheritance"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quiz Type</label>
                  <select
                    value={quizType}
                    onChange={(e: any) => setQuizType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="MCQ">Multiple Choice (MCQ)</option>
                    <option value="Written">Written Questions</option>
                    <option value="Mixed">Mixed (MCQ + Written)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Submission Deadline</label>
                  <input
                    type="datetime-local"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Questions Section */}
              <fieldset disabled={Boolean(editingQuizId && (quizzes.find((quiz) => quiz._id === editingQuizId)?.submissionCount || 0) > 0)} className="space-y-4 pt-4 border-t border-slate-100">
                {editingQuizId && (quizzes.find((quiz) => quiz._id === editingQuizId)?.submissionCount || 0) > 0 && (
                  <p className="text-xs text-amber-700">Questions are locked because students have submitted; edit quiz details only.</p>
                )}
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-indigo-600" />
                    Questions ({questions.length})
                  </h4>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddQuestion('MCQ')}
                      className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition"
                    >
                      + Add MCQ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestion('Written')}
                      className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl transition"
                    >
                      + Add Written
                    </button>
                  </div>
                </div>

                {questions.map((q, qIdx) => (
                  <div key={q.questionId} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                        Question {qIdx + 1} ({q.questionType})
                      </span>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-slate-500">Marks:</span>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={q.marks}
                            onChange={(e) => handleMarksChange(qIdx, Number(e.target.value))}
                            className="w-14 px-2 py-0.5 bg-white border border-slate-200 rounded text-center font-bold"
                          />
                        </div>

                        {questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(qIdx)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <textarea
                      required
                      rows={2}
                      placeholder={`Enter question text for Question ${qIdx + 1}...`}
                      value={q.questionText}
                      onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    {q.questionType === 'MCQ' && q.options && (
                      <div className="space-y-2 pt-1">
                        <span className="text-xs font-semibold text-slate-600 block">
                          Options & Correct Answer:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              className={`flex items-center gap-2 p-2 rounded-xl border transition ${
                                q.correctOptionIndex === optIdx
                                  ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`correct-${q.questionId}`}
                                checked={q.correctOptionIndex === optIdx}
                                onChange={() => handleCorrectOptionChange(qIdx, optIdx)}
                                className="text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-xs font-bold text-slate-500">
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <input
                                type="text"
                                required
                                placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                                value={opt}
                                onChange={(e) => handleOptionTextChange(qIdx, optIdx, e.target.value)}
                                className="w-full px-2 py-1 bg-transparent text-xs focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </fieldset>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingQuizId ? 'Save Changes' : 'Publish Quiz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
