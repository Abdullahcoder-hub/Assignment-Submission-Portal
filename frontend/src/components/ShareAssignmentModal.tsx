import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Assignment, TeacherAssignment } from '../types';
import {
  X,
  Share2,
  Archive,
  FileSpreadsheet,
  MessageSquare,
  Loader2,
  CheckCircle2,
  AlertCircle,
  UserCheck,
} from 'lucide-react';

interface ShareAssignmentModalProps {
  assignment: Assignment;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ShareAssignmentModal: React.FC<ShareAssignmentModalProps> = ({
  assignment,
  onClose,
  onSuccess,
}) => {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [shareZip, setShareZip] = useState<boolean>(true);
  const [shareCsv, setShareCsv] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const subjectId = typeof assignment.subjectId === 'object' ? (assignment.subjectId as any)._id : assignment.subjectId;
  const subjectName = typeof assignment.subjectId === 'object' ? (assignment.subjectId as any).name : 'Subject';
  const subjectCode = typeof assignment.subjectId === 'object' ? (assignment.subjectId as any).code : '';

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        setLoading(true);
        // Try fetching teacher assignments for this subject
        const res = await api.get('/api/teacher-assignments', {
          params: { subjectId },
        });
        
        let teacherList: any[] = [];
        if (res.data?.success && Array.isArray(res.data.assignments) && res.data.assignments.length > 0) {
          teacherList = res.data.assignments
            .filter((ta: TeacherAssignment) => ta.isActive && typeof ta.teacherId === 'object')
            .map((ta: TeacherAssignment) => ta.teacherId);
        }

        // Fallback: If no direct subject assignment found, fetch all approved teachers
        if (teacherList.length === 0) {
          const staffRes = await api.get('/api/admin/staff');
          if (staffRes.data?.success) {
            teacherList = (staffRes.data.staff || []).filter(
              (s: any) => s.role === 'TEACHER' && s.approvalStatus === 'Approved' && s.isActive
            );
          }
        }

        // Remove duplicate teachers by id
        const uniqueTeachers = Array.from(new Map(teacherList.map((t) => [t._id || t.id, t])).values());
        setTeachers(uniqueTeachers);

        if (uniqueTeachers.length > 0) {
          setSelectedTeacherId(uniqueTeachers[0]._id || uniqueTeachers[0].id);
        }
      } catch (err: any) {
        setError('Failed to load eligible teachers.');
      } finally {
        setLoading(false);
      }
    };

    fetchTeachers();
  }, [subjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId) {
      setError('Please select a teacher to share submissions with.');
      return;
    }
    if (!shareZip && !shareCsv) {
      setError('Select at least one package option (ZIP or CSV).');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post('/shared-assignments/share', {
        assignmentId: assignment._id,
        teacherId: selectedTeacherId,
        shareZip,
        shareCsv,
        note: note.trim(),
      });

      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'Shared successfully!');
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to share assignment with teacher.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Share Submissions with Teacher</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {subjectCode ? `${subjectCode} - ` : ''}{assignment.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {successMsg}
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-xs text-slate-500">Loading assigned teachers...</p>
            </div>
          ) : teachers.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
              No approved teachers are registered in the system yet. Ask Super Admin to approve teacher accounts first.
            </div>
          ) : (
            <>
              {/* Select Teacher */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Subject Teacher
                </label>
                <div className="relative">
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {teachers.map((t) => (
                      <option key={t._id || t.id} value={t._id || t.id}>
                        {t.name} ({t.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Share Options */}
              <div className="space-y-2.5 pt-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Files to Include
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    shareZip
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={shareZip}
                      onChange={(e) => setShareZip(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <Archive className="w-4 h-4 text-blue-600" />
                      <span>Submissions ZIP</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    shareCsv
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-100'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={shareCsv}
                      onChange={(e) => setShareCsv(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Defaulters CSV</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Optional Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Note for Teacher (Optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Here are all submissions including late approved requests for review."
                  rows={3}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || teachers.length === 0}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Share with Teacher</span>
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
