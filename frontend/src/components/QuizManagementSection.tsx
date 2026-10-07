import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Quiz, QuizQuestion, QuizSubmission, Class, Subject, TeacherAssignment, AdminUser } from '../types';
import {
  FileCheck,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Download,
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
  const [myAssignments, setMyAssignments] = useState<TeacherAssignment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Create Quiz Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
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

  // Grading Modal State
  const [gradingSubmission, setGradingSubmission] = useState<QuizSubmission | null>(null);
  const [gradedMarks, setGradedMarks] = useState<Record<string, number>>({});
  const [gradedFeedback, setGradedFeedback] = useState<Record<string, string>>({});
  const [savingGrade, setSavingGrade] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resQuizzes, resMyClasses, resClasses, resSubjects] = await Promise.all([
        api.get('/quizzes'),
        api.get('/teacher-assignments/my-classes'),
        api.get('/classes'),
        api.get('/subjects'),
      ]);

      if (resQuizzes.data.success) setQuizzes(resQuizzes.data.quizzes || []);
      if (resMyClasses.data.success) setMyAssignments(resMyClasses.data.assignments || []);
      if (resClasses.data.success) setClasses(resClasses.data.classes || []);
      if (resSubjects.data.success) setSubjects(resSubjects.data.subjects || []);
    } catch (err) {
      setFeedback({ success: false, message: 'Failed to load quizzes.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreateModal = () => {
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
      const res = await api.post('/quizzes', {
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        title: quizTitle,
        description: quizDescription,
        quizType,
        durationMinutes,
        deadline,
        allowLateSubmission,
        questions,
      });

      if (res.data.success) {
        setFeedback({ success: true, message: 'Quiz created successfully.' });
        setShowCreateModal(false);
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

  const handleOpenGradeModal = (sub: QuizSubmission) => {
    setGradingSubmission(sub);
    const initialMarks: Record<string, number> = {};
    const initialFeedback: Record<string, string> = {};

    sub.answers.forEach((ans) => {
      if (ans.questionType === 'Written') {
        initialMarks[ans.questionId] = ans.marksAwarded || 0;
        initialFeedback[ans.questionId] = ans.teacherFeedback || '';
      }
    });

    setGradedMarks(initialMarks);
    setGradedFeedback(initialFeedback);
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

  const handleDownloadDocx = async (submissionId: string, rollNumber: string) => {
    try {
      const res = await api.get(`/quizzes/submission/${submissionId}/docx`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${rollNumber}_Quiz_Submission.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to download submission DOCX.');
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

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Create New Quiz
        </button>
      </div>

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

                    <button
                      onClick={() => handleDeleteQuiz(q._id, q.title)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete quiz"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
              <button
                onClick={() => setSelectedQuizForSubmissions(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg"
              >
                ✕
              </button>
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
                        <th className="px-4 py-3">MCQ Score</th>
                        <th className="px-4 py-3">Written Score</th>
                        <th className="px-4 py-3">Total Marks</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {quizSubmissions.map((sub) => (
                        <tr key={sub._id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">{sub.rollNumber}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{sub.studentName}</td>
                          <td className="px-4 py-3 text-indigo-600 font-semibold">{sub.mcqScore}</td>
                          <td className="px-4 py-3 text-purple-600 font-semibold">{sub.writtenScore}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">
                            {sub.totalScore} / {selectedQuizForSubmissions.totalMarks}
                          </td>
                          <td className="px-4 py-3">
                            {sub.isGraded ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                <Check className="w-3 h-3" /> Graded
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                                Pending Grading
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            {selectedQuizForSubmissions.quizType !== 'MCQ' && (
                              <button
                                onClick={() => handleOpenGradeModal(sub)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Grade
                              </button>
                            )}

                            <button
                              onClick={() => handleDownloadDocx(sub._id, sub.rollNumber)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                              title="Download Submission DOCX"
                            >
                              <Download className="w-3.5 h-3.5" />
                              DOCX
                            </button>
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
                          max="20"
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
              <h3 className="font-bold text-slate-900 text-lg">Create New Quiz</h3>
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
              <div className="space-y-4 pt-4 border-t border-slate-100">
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
              </div>

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
                  Publish Quiz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
