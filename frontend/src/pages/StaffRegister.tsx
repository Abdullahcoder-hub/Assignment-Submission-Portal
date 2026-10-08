import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, GraduationCap, Loader2, Mail, Send, ShieldCheck, User } from 'lucide-react';
import api from '../api/axios';
import { PasswordInput } from '../components/PasswordInput';

export const StaffRegister: React.FC = () => {
  const [role, setRole] = useState<'TEACHER' | 'CR' | 'CR_ASSISTANT'>('TEACHER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [canResendVerification, setCanResendVerification] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setCanResendVerification(false);
    setResendMessage(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/staff/register', {
        name: name.trim(),
        email: email.trim(),
        role,
        password,
        confirmPassword,
      });
      setSuccess(response.data.message);
      setCanResendVerification(true);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Staff registration failed.');
      setCanResendVerification(requestError.response?.status === 502);
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    if (!email.trim()) {
      setResendMessage('Please enter your email address to resend verification.');
      return;
    }

    setIsResending(true);
    setResendMessage(null);
    try {
      const response = await api.post('/auth/resend-verification', { email: email.trim() });
      setResendMessage(response.data.message || 'A new verification link has been sent. Please check your inbox.');
    } catch (requestError: any) {
      setResendMessage(requestError.response?.data?.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4">
      <div className="max-w-md w-full glass-panel rounded-3xl shadow-2xl border border-slate-200/80 p-7 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {role === 'TEACHER' ? 'Teacher Registration' : role === 'CR' ? 'CR Registration' : 'CR Assistant Registration'}
          </h1>
          <p className="text-sm text-slate-500">
            Verify your email. Super Admin approval is required before you can sign in.
            {role !== 'TEACHER' && ' Use the same email as your enrolled student account.'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex gap-2 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {canResendVerification && !success && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={resendVerification}
              disabled={isResending}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
            >
              {isResending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isResending ? 'Sending...' : 'Resend Verification Email'}
            </button>
            {resendMessage && <p role="status" className="text-center text-xs font-semibold text-blue-700">{resendMessage}</p>}
          </div>
        )}

        {success ? (
          <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-4">
            <CheckCircle2 className="w-11 h-11 text-emerald-600 mx-auto" />
            <p className="text-sm text-emerald-900">{success}</p>
            <button
              type="button"
              onClick={resendVerification}
              disabled={isResending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-xs rounded-xl"
            >
              {isResending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isResending ? 'Sending...' : "Didn't get the email? Resend"}
            </button>
            {resendMessage && <p role="status" className="text-xs font-semibold text-blue-700">{resendMessage}</p>}
            <Link to="/admin/login" className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl">
              Go to Staff Login
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Account type</label>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as 'TEACHER' | 'CR' | 'CR_ASSISTANT')}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white"
              >
                <option value="TEACHER">Teacher</option>
                <option value="CR">Class Representative (CR)</option>
                <option value="CR_ASSISTANT">CR Assistant</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm" placeholder="Your full name" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm" placeholder="you@example.com" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
              <PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm" autoComplete="new-password" />
              <p className="text-[11px] text-slate-500 mt-1">Use at least 8 characters, including uppercase, lowercase, a number, and a symbol.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Confirm password</label>
              <PasswordInput value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm" autoComplete="new-password" />
            </div>

            <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {loading ? 'Submitting...' : 'Register for Approval'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-500">
          Already registered? <Link to="/admin/login" className="font-bold text-blue-600 hover:underline">Staff login</Link>
        </p>
      </div>
    </div>
  );
};
