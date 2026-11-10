import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Mail, Loader2, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.post('/auth/forgot-password', { email: email.trim() });
      setSuccessMsg(res.data.message || 'Reset instructions sent to your email.');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to process password reset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4 sm:px-6 relative overflow-x-clip">
      {/* Subtle warm ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#D6A84F]/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-[416px] w-full bg-[#FFFDF7] rounded-2xl shadow-xl shadow-[#0B1F3A]/5 border border-[#E3DCCF] p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-[#0B1F3A]/5 border border-[#D6A84F]/30 text-[#D6A84F] flex items-center justify-center shadow-inner">
            <KeyRound className="w-7 h-7 stroke-[2.2]" />
          </div>
          <h2 className="text-2xl font-bold text-[#0B1F3A] tracking-tight">Forgot Password</h2>
          <p className="text-sm text-[#687386]">Enter your account email to receive password reset instructions.</p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-50/80 border border-red-200 rounded-xl flex items-center gap-2.5 text-red-700 text-xs sm:text-sm font-medium">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg ? (
          <div className="p-6 bg-[#F5F0E6] border border-[#D6A84F]/40 rounded-2xl text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-[#23845b] mx-auto" />
            <p className="text-sm text-[#172B45] font-medium">{successMsg}</p>
            <Link
              to="/student/login"
              className="inline-block px-6 py-2.5 bg-[#0B1F3A] hover:bg-[#18385D] text-[#FFFDF7] font-semibold text-xs rounded-xl shadow-md transition"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="forgot-email" className="block text-xs font-semibold uppercase tracking-wider text-[#172B45] mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-5 h-5 text-[#687386] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="forgot-email"
                  type="email"
                  placeholder="student@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-12 pl-11 pr-4 bg-white border border-[#E3DCCF] rounded-xl text-[#172B45] placeholder:text-[#687386]/60 text-sm focus:ring-2 focus:ring-[#D6A84F]/25 focus:border-[#D6A84F] transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-[#0B1F3A] hover:bg-[#18385D] active:bg-[#102744] disabled:bg-[#0B1F3A]/50 text-[#FFFDF7] font-semibold text-sm rounded-xl shadow-md hover:shadow-lg transition duration-200 flex items-center justify-center gap-2 cursor-pointer pt-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#D6A84F]" />
                  Sending Request...
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>
        )}

        <div className="text-center text-xs text-[#687386] pt-1">
          Remembered your password?{' '}
          <Link to="/student/login" className="font-semibold text-[#0B1F3A] hover:text-[#C49A3A] transition underline-offset-2 hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
};
