import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Quiz, QuizSubmission, Subject, Class } from '../types';
import {
  FileCheck,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle,
  Download,
  HelpCircle,
  Loader2,
  BookOpen,
  Send,
  Check,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

export const StudentQuizSection: React.FC<{ studentClassId?: string; studentName?: string; rollNumber?: string }> = ({
  studentClassId,
  studentName,
  rollNumber,
}) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Active Taking Quiz State
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, { selectedOptionIndex?: number; writtenAnswerText?: string }>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submissionReceipt, setSubmissionReceipt] = useState<any | null>(null);

  // Late Request Modal State
  const [lateModalQuiz, setLateModalQuiz] = useState<Quiz | null>(null);
  const [lateReason, setLateReason] = useState<string>('');
  const [submittingLate, setSubmittingLate] = useState<boolean>(false);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/quizzes');
      if (res.data.success) {
        setQuizzes(res.data.quizzes || []);
      }
    } catch (err) {
      setFeedback({ success: false, message: 'Failed to load quizzes for your class.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const handleStartQuiz = async (quiz: Quiz) => {
    try {
      const res = await api.get(`/quizzes/${quiz._id}`);
      if (res.data.success) {
        setActiveQuiz(res.data.quiz);
        setSubmissionReceipt(res.data.mySubmission || null);
        setStudentAnswers({});
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.response?.data?.message || 'Failed to open quiz.' });
    }
  };

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    setStudentAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        selectedOptionIndex: optionIndex,
      },
    }));
  };

  const handleWrittenTextChange = (questionId: string, text: string) => {
    setStudentAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        writtenAnswerText: text,
      },
    }));
  };

  const handleSubmitQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuiz) return;

    if (!window.confirm('Are you ready to submit your quiz answers? You cannot edit them after submitting.')) return;

    setSubmitting(true);
    try {
      const answersPayload = activeQuiz.questions.map((q) => ({
        questionId: q.questionId,
        selectedOptionIndex: studentAnswers[q.questionId]?.selectedOptionIndex,
        writtenAnswerText: studentAnswers[q.questionId]?.writtenAnswerText || '',
      }));

      const res = await api.post(`/quizzes/${activeQuiz._id}/submit`, {
        answers: answersPayload,
      });

      if (res.data.success) {
        setSubmissionReceipt(res.data.submission);
        setFeedback({ success: true, message: 'Quiz submitted successfully!' });
        fetchQuizzes();
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.response?.data?.message || 'Failed to submit quiz.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadDocx = async (submissionId: string) => {
    try {
      const res = await api.get(`/quizzes/submission/${submissionId}/docx`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${rollNumber || 'Student'}_Quiz_Receipt.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to download submission DOCX.');
    }
  };

  const handleSubmitLateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lateModalQuiz) return;

    setSubmittingLate(true);
    try {
      const res = await api.post('/late-requests', {
        quizId: lateModalQuiz._id,
        requestType: 'Quiz',
        reason: lateReason || 'Quiz deadline passed.',
      });

      if (res.data.success) {
        setFeedback({ success: true, message: res.data.message });
        setLateModalQuiz(null);
        setLateReason('');
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.response?.data?.message || 'Failed to submit late request.' });
    } finally {
      setSubmittingLate(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-indigo-600" />
            Class Quizzes & Examinations
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            View assigned quizzes for your class, take MCQs, submit written answers, and download official submission receipts.
          </p>
        </div>

        <button
          onClick={fetchQuizzes}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
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

      {/* Quizzes List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm text-slate-500 mt-2">Loading class quizzes...</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8">
          <FileCheck className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-semibold text-slate-800 mt-3">No Active Quizzes</h3>
          <p className="text-sm text-slate-500 mt-1">Your teachers haven't published any quizzes for your class yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {quizzes.map((q) => {
            const subjectDoc = q.subjectId as Subject;
            const classDoc = q.classId as Class;
            const isSubmitted = Boolean(q.mySubmission);
            const isPastDeadline = new Date() > new Date(q.deadline);

            return (
              <div
                key={q._id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                      {subjectDoc?.name || 'Subject'} ({subjectDoc?.code})
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                      {q.quizType}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mt-3">{q.title}</h3>
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
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100">
                  {isSubmitted ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                          <Check className="w-3.5 h-3.5" />
                          Submitted
                        </span>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Score: <strong>{q.mySubmission?.totalScore} / {q.totalMarks}</strong>
                        </p>
                      </div>

                      <button
                        onClick={() => handleDownloadDocx(q.mySubmission!.submissionId)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        DOCX
                      </button>
                    </div>
                  ) : isPastDeadline ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Deadline Passed
                      </span>
                      <button
                        onClick={() => setLateModalQuiz(q)}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-xl border border-amber-200 transition"
                      >
                        Request Late
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartQuiz(q)}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                    >
                      Start Quiz
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Taking Quiz Modal */}
      {activeQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Active Examination</span>
                <h3 className="font-bold text-slate-900 text-lg">{activeQuiz.title}</h3>
              </div>
              <button
                onClick={() => {
                  setActiveQuiz(null);
                  setSubmissionReceipt(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {submissionReceipt ? (
              /* Submission Result View */
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Quiz Submitted Successfully!</h3>
                <p className="text-sm text-slate-600">
                  Your answers have been recorded with Submission ID:{' '}
                  <code className="font-mono font-bold text-indigo-700">{submissionReceipt.submissionId}</code>
                </p>

                <div className="max-w-sm mx-auto p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Auto MCQ Score:</span>
                    <span className="font-bold text-slate-800">{submissionReceipt.mcqScore} Marks</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Awarded Score:</span>
                    <span className="font-bold text-indigo-700 text-sm">{submissionReceipt.totalScore} Marks</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Grading Status:</span>
                    <span className="font-semibold text-slate-800">
                      {submissionReceipt.isGraded ? 'Completed' : 'Pending Teacher Written Grading'}
                    </span>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-center gap-3">
                  <button
                    onClick={() => handleDownloadDocx(submissionReceipt.submissionId)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                  >
                    <Download className="w-4 h-4" />
                    Download Official DOCX Receipt
                  </button>
                  <button
                    onClick={() => {
                      setActiveQuiz(null);
                      setSubmissionReceipt(null);
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* Quiz Taking Form */
              <form onSubmit={handleSubmitQuiz} className="p-5 overflow-y-auto flex-1 space-y-6">
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Please answer all questions carefully before submitting. Once submitted, answers cannot be edited.</span>
                </div>

                {activeQuiz.questions.map((q, idx) => (
                  <div key={q.questionId} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-indigo-700">
                        Question {idx + 1} ({q.questionType} - {q.marks} Mark{q.marks > 1 ? 's' : ''})
                      </span>
                    </div>

                    <p className="text-sm font-medium text-slate-900">{q.questionText}</p>

                    {q.questionType === 'MCQ' && q.options && (
                      <div className="space-y-2 pt-2">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = studentAnswers[q.questionId]?.selectedOptionIndex === optIdx;
                          return (
                            <label
                              key={optIdx}
                              onClick={() => handleSelectOption(q.questionId, optIdx)}
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                                isSelected
                                  ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300 text-indigo-900 font-medium'
                                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q-${q.questionId}`}
                                checked={isSelected}
                                onChange={() => handleSelectOption(q.questionId, optIdx)}
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="text-xs font-bold text-slate-400">
                                {String.fromCharCode(65 + optIdx)}.
                              </span>
                              <span className="text-xs sm:text-sm">{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {q.questionType === 'Written' && (
                      <div className="pt-2">
                        <textarea
                          rows={4}
                          placeholder="Type your detailed answer here..."
                          value={studentAnswers[q.questionId]?.writtenAnswerText || ''}
                          onChange={(e) => handleWrittenTextChange(q.questionId, e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}
                  </div>
                ))}

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveQuiz(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Submit Quiz Answers
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Late Request Modal */}
      {lateModalQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">Request Late Quiz Submission</h3>
              <button onClick={() => setLateModalQuiz(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitLateRequest} className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                The deadline for <strong>{lateModalQuiz.title}</strong> has passed. Enter a valid reason to request late submission approval from your Class Representative (CR).
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Late Submission</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why you could not submit on time..."
                  value={lateReason}
                  onChange={(e) => setLateReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLateModalQuiz(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLate}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {submittingLate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
