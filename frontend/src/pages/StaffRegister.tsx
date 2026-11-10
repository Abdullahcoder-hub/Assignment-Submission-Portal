import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, GraduationCap, Loader2, Mail, Send, ShieldCheck, User } from 'lucide-react';
import api from '../api/axios';
import { PasswordInput } from '../components/PasswordInput';
import { PasswordRequirements } from '../components/PasswordRequirements';

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
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 sm:px-6 relative overflow-x-clip">
      {/* Subtle warm ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#D6A84F]/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-[480px] w-full bg-[#FFFDF7] rounded-2xl shadow-xl shadow-[#0B1F3A]/5 border border-[#E3DCCF] p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-[#0B1F3A]/5 border border-[#D6A84F]/30 text-[#D6A84F] flex items-center justify-center shadow-inner">
            <GraduationCap className="w-7 h-7 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-bold text-[#0B1F3A] tracking-tight">
            {role === 'TEACHER' ? 'Teacher Registration' : role === 'CR' ? 'CR Registration' : 'CR Assistant Registration'}
          </h1>
          <p className="text-sm text-[#687386]">
            Verify your email. Super Admin approval is required before you can sign in.
            {role !== 'TEACHER' && ' Use the same email as your enrolled student account.'}
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50/80 border border-red-200 rounded-xl flex items-center gap-2.5 text-red-700 text-xs sm:text-sm font-medium">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {canResendVerification && !success && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={resendVerification}
              disabled={isResending}
              className="w-full h-11 bg-[#0B1F3A] hover:bg-[#18385D] disabled:bg-[#0B1F3A]/40 text-[#FFFDF7] font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition"
            >
              {isResending ? <Loader2 className="w-4 h-4 animate-spin text-[#D6A84F]" /> : <Send className="w-4 h-4" />}
              {isResending ? 'Sending...' : 'Resend Verification Email'}
            </button>
            {resendMessage && <p role="status" className="text-center text-xs font-semibold text-[#0B1F3A]">{resendMessage}</p>}
          </div>
        )}

        {success ? (
          <div className="p-6 bg-[#F5F0E6] border border-[#D6A84F]/40 rounded-2xl text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-[#23845b] mx-auto" />
            <p className="text-sm text-[#172B45]">{success}</p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={resendVerification}
                disabled={isResending}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#FFFDF7] hover:bg-[#EDE5D6] border border-[#E3DCCF] text-[#172B45] font-semibold text-xs rounded-xl shadow-xs transition"
              >
                {isResending ? <Loader2 className="w-4 h-4 animate-spin text-[#D6A84F]" /> : <Send className="w-4 h-4" />}
                {isResending ? 'Sending...' : "Didn't get the email? Resend"}
              </button>
              {resendMessage && <p role="status" className="text-xs font-semibold text-[#0B1F3A]">{resendMessage}</p>}
              <Link to="/admin/login" className="inline-block px-5 py-2.5 bg-[#0B1F3A] hover:bg-[#18385D] text-[#FFFDF7] font-semibold text-sm rounded-xl shadow-md transition">
                Go to Staff Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="staff-role" className="block text-xs font-semibold uppercase tracking-wider text-[#172B45] mb-1.5">Account type</label>
              <select
                id="staff-role"
                value={role}
                onChange={(event) => setRole(event.target.value as 'TEACHER' | 'CR' | 'CR_ASSISTANT')}
                className="w-full h-12 px-3 bg-white border border-[#E3DCCF] rounded-xl text-[#172B45] text-sm focus:ring-2 focus:ring-[#D6A84F]/25 focus:border-[#D6A84F] transition"
              >
                <option value="TEACHER">Teacher</option>
                <option value="CR">Class Representative (CR)</option>
                <option value="CR_ASSISTANT">CR Assistant</option>
              </select>
            </div>

            <div>
              <label htmlFor="staff-name" className="block text-xs font-semibold uppercase tracking-wider text-[#172B45] mb-1.5">Full name</label>
              <div className="relative">
                <User className="w-5 h-5 text-[#687386] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="staff-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={100}
                  className="w-full h-12 pl-11 pr-4 bg-white border border-[#E3DCCF] rounded-xl text-[#172B45] placeholder:text-[#687386]/60 text-sm focus:ring-2 focus:ring-[#D6A84F]/25 focus:border-[#D6A84F] transition"
                  placeholder="Your full name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="staff-email" className="block text-xs font-semibold uppercase tracking-wider text-[#172B45] mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="w-5 h-5 text-[#687386] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="staff-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="w-full h-12 pl-11 pr-4 bg-white border border-[#E3DCCF] rounded-xl text-[#172B45] placeholder:text-[#687386]/60 text-sm focus:ring-2 focus:ring-[#D6A84F]/25 focus:border-[#D6A84F] transition"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="staff-password" className="block text-xs font-semibold uppercase tracking-wider text-[#172B45] mb-1.5">Password</label>
              <PasswordInput
                id="staff-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                className="w-full h-12"
                autoComplete="new-password"
              />
              <PasswordRequirements password={password} />
            </div>

            <div>
              <label htmlFor="staff-confirm-password" className="block text-xs font-semibold uppercase tracking-wider text-[#172B45] mb-1.5">Confirm password</label>
              <PasswordInput
                id="staff-confirm-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                className="w-full h-12"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#0B1F3A] hover:bg-[#18385D] active:bg-[#102744] disabled:bg-[#0B1F3A]/50 text-[#FFFDF7] font-semibold text-sm rounded-xl shadow-md hover:shadow-lg transition duration-200 flex items-center justify-center gap-2 cursor-pointer pt-1"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-[#D6A84F]" /> : <ShieldCheck className="w-4 h-4 text-[#D6A84F]" />}
              {loading ? 'Submitting...' : 'Register for Approval'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-[#687386] pt-1">
          Already registered?{' '}
          <Link to="/admin/login" className="font-semibold text-[#0B1F3A] hover:text-[#C49A3A] transition underline-offset-2 hover:underline">
            Staff login
          </Link>
        </p>
      </div>
    </div>
  );
};
