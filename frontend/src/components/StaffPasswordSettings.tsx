import React, { useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export const StaffPasswordSettings: React.FC = () => {
  const { replaceToken } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      replaceToken(response.data.token);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ success: true, text: response.data.message });
    } catch (error: any) {
      setMessage({ success: false, text: error.response?.data?.message || 'Failed to change password.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Change Your Password</h2>
      <p className="mt-1 text-sm text-slate-500">Only you can change your staff account password.</p>
      {message && (
        <p className={`mt-4 rounded-xl p-3 text-sm ${message.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </p>
      )}
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Current password
          <input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          New password
          <input required type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Confirm new password
          <input required type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <button disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? 'Saving...' : 'Change Password'}
        </button>
      </form>
    </section>
  );
};
