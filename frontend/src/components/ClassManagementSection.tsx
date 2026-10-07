import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Class, AdminUser } from '../types';
import {
  Users,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  Search,
  Loader2,
} from 'lucide-react';

export const ClassManagementSection: React.FC<{ isSuperAdmin?: boolean }> = ({ isSuperAdmin = true }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [staffUsers, setStaffUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [formSemester, setFormSemester] = useState<string>('5th');
  const [formSection, setFormSection] = useState<string>('A');
  const [formName, setFormName] = useState<string>('');
  const [formJoinCode, setFormJoinCode] = useState<string>('');
  const [formCrId, setFormCrId] = useState<string>('');
  const [formAssistantId, setFormAssistantId] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const [resClasses, resStaff] = await Promise.all([
        api.get('/classes'),
        api.get('/admin/staff'),
      ]);
      if (resClasses.data.success) {
        setClasses(resClasses.data.classes || []);
      }
      if (resStaff.data.success) {
        setStaffUsers(resStaff.data.staff || []);
      }
    } catch (err: any) {
      setFeedback({ success: false, message: 'Failed to load classes or staff.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleOpenCreate = () => {
    setEditingClass(null);
    setFormSemester('5th');
    setFormSection('A');
    setFormName('5th A');
    setFormJoinCode('');
    setFormCrId('');
    setFormAssistantId('');
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEdit = (c: Class) => {
    setEditingClass(c);
    setFormSemester(c.semester);
    setFormSection(c.section);
    setFormName(c.name);
    setFormJoinCode(c.joinCode);
    setFormCrId(typeof c.crId === 'object' && c.crId ? (c.crId as any)._id : (c.crId as string) || '');
    setFormAssistantId(typeof c.assistantId === 'object' && c.assistantId ? (c.assistantId as any)._id : (c.assistantId as string) || '');
    setFormError('');
    setShowModal(true);
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);

    try {
      if (editingClass) {
        const res = await api.put(`/classes/${editingClass._id}`, {
          semester: formSemester,
          section: formSection,
          name: formName || `${formSemester} ${formSection}`,
          joinCode: formJoinCode,
          crId: formCrId || null,
          assistantId: formAssistantId || null,
        });
        if (res.data.success) {
          setFeedback({ success: true, message: 'Class updated successfully.' });
          setShowModal(false);
          fetchClasses();
        }
      } else {
        const res = await api.post('/classes', {
          semester: formSemester,
          section: formSection,
          name: formName || `${formSemester} ${formSection}`,
          customJoinCode: formJoinCode || undefined,
          crId: formCrId || undefined,
          assistantId: formAssistantId || undefined,
        });
        if (res.data.success) {
          setFeedback({ success: true, message: 'Class created successfully.' });
          setShowModal(false);
          fetchClasses();
        }
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save class.');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateCode = async (classId: string) => {
    try {
      const res = await api.post(`/classes/${classId}/regenerate-code`);
      if (res.data.success) {
        setFeedback({ success: true, message: `New join code: ${res.data.joinCode}` });
        fetchClasses();
      }
    } catch (err: any) {
      setFeedback({ success: false, message: 'Failed to regenerate join code.' });
    }
  };

  const handleToggleJoinCode = async (classId: string) => {
    try {
      const res = await api.post(`/classes/${classId}/toggle-code`);
      if (res.data.success) {
        setFeedback({ success: true, message: res.data.message });
        fetchClasses();
      }
    } catch (err: any) {
      setFeedback({ success: false, message: 'Failed to toggle join code.' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getAccountId = (account?: AdminUser | string) =>
    typeof account === 'string'
      ? account
      : account && '_id' in account
        ? String(account._id)
        : account?.id;
  const crId = getAccountId(editingClass?.crId);
  const assistantId = getAccountId(editingClass?.assistantId);
  const crUsers = staffUsers.filter(
    (staff) =>
      staff.role === 'CR' &&
      staff.isActive !== false &&
      staff.approvalStatus === 'Approved' &&
      (!staff.assignedClassId || staff.id === crId)
  );
  const assistantUsers = staffUsers.filter(
    (staff) =>
      staff.role === 'CR_ASSISTANT' &&
      staff.isActive !== false &&
      staff.approvalStatus === 'Approved' &&
      (!staff.assignedClassId || staff.id === assistantId)
  );

  const filteredClasses = classes.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.semester.toLowerCase().includes(search.toLowerCase()) ||
      c.section.toLowerCase().includes(search.toLowerCase()) ||
      c.joinCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Class Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Configure semesters, sections, unique class join codes, and assigned Class Representatives (CRs).
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Create Class
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

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search classes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={fetchClasses}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Class Cards Grid */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-slate-500 mt-2">Loading classes...</p>
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8">
          <Users className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-semibold text-slate-800 mt-3">No Classes Found</h3>
          <p className="text-sm text-slate-500 mt-1">Create your first class (e.g. 5th A, 5th B) to start enrolling students.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClasses.map((c) => {
            const crName = typeof c.crId === 'object' && c.crId ? (c.crId as any).name : 'No CR Assigned';
            const assistantName = typeof c.assistantId === 'object' && c.assistantId ? (c.assistantId as any).name : 'No Assistant Assigned';
            return (
              <div
                key={c._id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                        {c.semester} Semester
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 mt-1">Section {c.section}</h3>
                      <p className="text-xs text-slate-500">{c.name}</p>
                    </div>

                    {isSuperAdmin && (
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Join Code Box */}
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Join Code</span>
                      <code className="text-sm font-mono font-bold text-blue-700">{c.joinCode}</code>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => copyToClipboard(c.joinCode)}
                        title="Copy Join Code"
                        className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg transition shadow-xs"
                      >
                        {copiedCode === c.joinCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleRegenerateCode(c._id)}
                        title="Regenerate Join Code"
                        className="p-1.5 text-slate-500 hover:text-blue-600 bg-white border border-slate-200 rounded-lg transition shadow-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* CR, Assistant & Student Stats */}
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                        Class CR:
                      </span>
                      <span className="font-semibold text-slate-800 truncate max-w-[140px]">{crName}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                        CR Assistant:
                      </span>
                      <span className="font-semibold text-slate-800 truncate max-w-[140px]">{assistantName}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        Enrolled Students:
                      </span>
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                        {c.studentCount || 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                      c.isJoinCodeActive ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.isJoinCodeActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    {c.isJoinCodeActive ? 'Join Code Active' : 'Join Code Disabled'}
                  </span>

                  <button
                    onClick={() => handleToggleJoinCode(c._id)}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium underline"
                  >
                    {c.isJoinCodeActive ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">{editingClass ? 'Edit Class' : 'Create New Class'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveClass} className="p-5 space-y-4">
              {formError && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">{formError}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5th"
                    value={formSemester}
                    onChange={(e) => {
                      setFormSemester(e.target.value);
                      if (!editingClass) setFormName(`${e.target.value} ${formSection}`);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A"
                    value={formSection}
                    onChange={(e) => {
                      setFormSection(e.target.value.toUpperCase());
                      if (!editingClass) setFormName(`${formSemester} ${e.target.value.toUpperCase()}`);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Class Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. 5th A"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Custom Join Code <span className="text-slate-400 font-normal">(Leave blank to auto-generate)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. CLASS-5THA"
                  value={formJoinCode}
                  onChange={(e) => setFormJoinCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Class Representative (CR)</label>
                <select
                  value={formCrId}
                  onChange={(e) => setFormCrId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- No CR Assigned (Assign Later) --</option>
                  {crUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role}) - {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assign CR Assistant</label>
                <select
                  value={formAssistantId}
                  onChange={(e) => setFormAssistantId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- No Assistant Assigned (Assign Later) --</option>
                  {assistantUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role}) - {u.email}
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
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingClass ? 'Save Changes' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
