import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { TeacherAssignment, AdminUser, Class, Subject } from '../types';
import {
  GraduationCap,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Users,
  Search,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

export const TeacherAssignmentSection: React.FC<{ isSuperAdmin?: boolean }> = ({ isSuperAdmin = true }) => {
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [teachers, setTeachers] = useState<AdminUser[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resAssignments, resStaff, resClasses, resSubjects] = await Promise.all([
        api.get('/teacher-assignments'),
        api.get('/admin/staff?role=TEACHER'),
        api.get('/classes'),
        api.get('/subjects'),
      ]);

      if (resAssignments.data.success) setAssignments(resAssignments.data.assignments || []);
      if (resStaff.data.success) {
        setTeachers(
          (resStaff.data.staff || []).filter(
            (staff: AdminUser) =>
              staff.role === 'TEACHER' &&
              staff.isActive &&
              staff.approvalStatus === 'Approved'
          )
        );
      }
      if (resClasses.data.success) setClasses(resClasses.data.classes || []);
      if (resSubjects.data.success) setSubjects(resSubjects.data.subjects || []);
    } catch (err) {
      setFeedback({ success: false, message: 'Failed to load teacher assignment data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAssign = () => {
    setSelectedTeacherId(teachers[0]?.id || '');
    setSelectedClassId(classes[0]?._id || '');
    setSelectedSubjectId(subjects[0]?._id || '');
    setFormError('');
    setShowModal(true);
  };

  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);

    try {
      const res = await api.post('/teacher-assignments', {
        teacherId: selectedTeacherId,
        classId: selectedClassId,
        subjectId: selectedSubjectId,
      });

      if (res.data.success) {
        setFeedback({ success: true, message: res.data.message });
        setShowModal(false);
        fetchData();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to assign teacher.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this teacher assignment?')) return;
    try {
      const res = await api.delete(`/teacher-assignments/${id}`);
      if (res.data.success) {
        setFeedback({ success: true, message: 'Assignment removed successfully.' });
        fetchData();
      }
    } catch (err: any) {
      setFeedback({ success: false, message: 'Failed to remove assignment.' });
    }
  };

  const filtered = assignments.filter((a) => {
    const teacherName = typeof a.teacherId === 'object' && a.teacherId ? (a.teacherId as any).name : '';
    const className = typeof a.classId === 'object' && a.classId ? (a.classId as any).name : '';
    const subjectName = typeof a.subjectId === 'object' && a.subjectId ? (a.subjectId as any).name : '';
    return (
      teacherName.toLowerCase().includes(search.toLowerCase()) ||
      className.toLowerCase().includes(search.toLowerCase()) ||
      subjectName.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            Teacher Subject & Class Assignments
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Assign approved teachers to specific subjects within each class. Rule:{' '}
            <strong className="text-slate-800">Class + Subject = ONE ACTIVE TEACHER</strong>.
          </p>
        </div>

        {isSuperAdmin && teachers.length > 0 && (
          <button
            onClick={handleOpenAssign}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Assign Teacher
          </button>
        )}
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
            placeholder="Search by teacher, class, subject..."
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

      {/* Table of Assignments */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm text-slate-500 mt-2">Loading teacher assignments...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8">
          <GraduationCap className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-semibold text-slate-800 mt-3">No Teacher Assignments Found</h3>
          <p className="text-sm text-slate-500 mt-1">Assign your teachers to classes and subjects to enable them to create quizzes and grade.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3.5">Teacher</th>
                  <th className="px-4 py-3.5">Assigned Class</th>
                  <th className="px-4 py-3.5">Subject</th>
                  <th className="px-4 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((a) => {
                  const teacher = a.teacherId as AdminUser;
                  const classDoc = a.classId as Class;
                  const subjectDoc = a.subjectId as Subject;

                  return (
                    <tr key={a._id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                            {teacher?.name?.[0] || 'T'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{teacher?.name || 'N/A'}</p>
                            <p className="text-xs text-slate-500">{teacher?.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-semibold">
                          <Users className="w-3 h-3 text-blue-500" />
                          {classDoc?.name || 'N/A'} (Sec: {classDoc?.section})
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-semibold">
                          <BookOpen className="w-3 h-3 text-emerald-500" />
                          {subjectDoc?.name} ({subjectDoc?.code})
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleRemoveAssignment(a._id)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                            title="Remove assignment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assign Teacher Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">Assign Teacher to Class + Subject</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignTeacher} className="p-5 space-y-4">
              {formError && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">{formError}</div>}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Teacher</label>
                <select
                  required
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Teacher --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Class</label>
                <select
                  required
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Class --</option>
                  {classes.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} (Semester: {c.semester}, Section: {c.section})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Subject</label>
                <select
                  required
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Subject --</option>
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Assign Teacher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
