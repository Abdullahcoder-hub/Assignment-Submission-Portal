import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { AdminUser, Class } from '../types';
import {
  ShieldCheck,
  Edit2,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  KeyRound,
  Users,
  Search,
  Loader2,
  GraduationCap,
  Check,
  X,
} from 'lucide-react';

export const StaffManagementSection: React.FC = () => {
  const [staff, setStaff] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingStaff, setEditingStaff] = useState<AdminUser | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const resStaff = await api.get('/admin/staff');

      if (resStaff.data.success) {
        setStaff((resStaff.data.staff || []).filter((account: AdminUser) => account.isActive !== false));
      }
    } catch (err) {
      setFeedback({ success: false, message: 'Failed to load staff accounts.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenEdit = (s: AdminUser) => {
    setEditingStaff(s);
    setFormName(s.name);
    setFormError('');
    setShowModal(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setFormError('');
    setSaving(true);

    try {
      const res = await api.put(`/admin/staff/${editingStaff.id}`, {
        name: formName,
      });

      if (res.data.success) {
        setFeedback({ success: true, message: 'Staff account updated successfully.' });
        setShowModal(false);
        fetchData();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save staff account.');
    } finally {
      setSaving(false);
    }
  };

  const handleApproval = async (staffId: string, status: 'Approved' | 'Rejected') => {
    try {
      const response = await api.patch(`/admin/staff/${staffId}/approval`, { status });
      setFeedback({ success: true, message: response.data.message });
      await fetchData();
    } catch (err: any) {
      setFeedback({ success: false, message: err.response?.data?.message || 'Failed to update approval.' });
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    const selectedStaff = staff.find((account) => account.id === id);
    const confirmation = selectedStaff && ['CR', 'CR_ASSISTANT'].includes(selectedStaff.role)
      ? `Remove CR staff access for "${name}"? Their student account and academic data will be kept.`
      : `Are you sure you want to delete the staff account for "${name}"?`;
    if (!window.confirm(confirmation)) return;
    try {
      const res = await api.delete(`/admin/staff/${id}`);
      if (res.data.success) {
        setFeedback({ success: true, message: res.data.message });
        fetchData();
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.response?.data?.message || 'Failed to delete staff account.' });
    }
  };

  const filtered = staff.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.role.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    if (role === 'TEACHER') {
      return <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold text-xs flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Teacher</span>;
    }
    if (role === 'CR_ASSISTANT') {
      return <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100 font-semibold text-xs flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> CR Assistant</span>;
    }
    return <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold text-xs flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Class CR</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            Staff & Teacher Accounts
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage active teacher, CR, and CR Assistant accounts. Review new CR applications in CR Applications.
          </p>
        </div>
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
            placeholder="Search staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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

      {/* Staff Table */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto" />
          <p className="text-sm text-slate-500 mt-2">Loading staff accounts...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8">
          <Users className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-semibold text-slate-800 mt-3">No Active Staff Accounts Found</h3>
          <p className="text-sm text-slate-500 mt-1">Active teacher and CR accounts appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3.5">Name & Email</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Account Status</th>
                  <th className="px-4 py-3.5">Assigned Class</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => {
                  const approvalStatus = s.approvalStatus || 'Approved';
                  const assignedClass = s.assignedClassId as Class | string | undefined;
                  const className = assignedClass && typeof assignedClass === 'object'
                    ? `${assignedClass.name} (Sec: ${assignedClass.section})`
                    : assignedClass
                      ? String(assignedClass)
                      : '';
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-900">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.email}</p>
                      </td>

                      <td className="px-4 py-3.5">{getRoleBadge(s.role)}</td>

                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            approvalStatus === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700'
                              : approvalStatus === 'Rejected'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-amber-50 text-amber-700'
                          }`}>
                            {approvalStatus}
                          </span>
                          <span className={`text-[11px] ${s.isEmailVerified === false ? 'text-amber-700' : 'text-slate-500'}`}>
                            {s.isEmailVerified === false ? 'Email not verified' : 'Email verified'}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-slate-600">{className || 'N/A'}</td>

                      <td className="px-4 py-3.5 text-right space-x-2">
                        {approvalStatus !== 'Approved' && (
                          <button
                            onClick={() => handleApproval(s.id, 'Approved')}
                            disabled={s.isEmailVerified === false}
                            className="inline-flex items-center gap-1 px-2 py-1 text-emerald-700 hover:bg-emerald-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                            title={
                              s.isEmailVerified === false
                                ? 'Wait for email verification'
                                : 'Approve account'
                            }
                          >
                            <Check className="w-4 h-4" /><span className="sr-only">Approve</span>
                          </button>
                        )}
                        {approvalStatus !== 'Rejected' && (
                          <button
                            onClick={() => handleApproval(s.id, 'Rejected')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Reject account"
                          >
                            <X className="w-4 h-4" /><span className="sr-only">Reject</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                          title="Edit staff account"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(s.id, s.name)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete staff account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">Edit Staff Account</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="p-5 space-y-4">
              {formError && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">{formError}</div>}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. John Doe"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
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
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
