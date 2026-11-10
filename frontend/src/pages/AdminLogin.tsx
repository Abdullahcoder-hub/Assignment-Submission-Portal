import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Lock, Mail, Loader2, AlertCircle, Eye, EyeOff, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

export const AdminLogin: React.FC = () => {
  const { adminLogin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setResendMessage(null);

    const result = await adminLogin(email, password);
    setIsSubmitting(false);

    if (result.success) {
      navigate('/admin/dashboard');
    } else {
      setErrorMsg(result.message || 'Incorrect email or password.');
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setResendMessage('Please enter your account email first.');
      return;
    }

    setIsResending(true);
    setResendMessage(null);
    try {
      const response = await api.post('/auth/resend-verification', { email: email.trim() });
      setResendMessage(response.data.message || 'A new verification link has been sent. It expires in 5 minutes.');
    } catch (error: any) {
      setResendMessage(error.response?.data?.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 sm:px-6 relative overflow-x-clip">
      {/* Subtle warm ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#D6A84F]/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-[416px] w-full bg-[#FFFDF7] rounded-2xl shadow-xl shadow-[#0B1F3A]/5 border border-[#E3DCCF] p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-[#0B1F3A]/5 border border-[#D6A84F]/30 text-[#D6A84F] flex items-center justify-center shadow-inner">
            <ShieldCheck className="w-7 h-7 stroke-[2.2]" />
          </div>
          <h2 className="text-2xl font-bold text-[#0B1F3A] tracking-tight">Staff & Super Admin Login</h2>
          <p className="text-sm text-[#687386]">Staff access is available after email verification and Super Admin approval.</p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-50/80 border border-red-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2.5 text-red-700 text-xs sm:text-sm font-medium">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            {errorMsg.toLowerCase().includes('verify your email') && (
              <div className="border-t border-red-200/80 pt-3 space-y-2">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isResending}
                  className="w-full h-10 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2"
                >
                  {isResending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {isResending ? 'Sending...' : 'Resend Verification Email'}
                </button>
                {resendMessage && <p role="status" className="text-xs font-semibold text-[#0B1F3A]">{resendMessage}</p>}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-semibold uppercase tracking-wider text-[#172B45] mb-1.5">Account Email</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-[#687386] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="admin-email"
                type="email"
                placeholder="admin@portal.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-12 pl-11 pr-4 bg-white border border-[#E3DCCF] rounded-xl focus:ring-2 focus:ring-[#D6A84F]/25 focus:border-[#D6A84F] transition text-[#172B45] placeholder:text-[#687386]/60 text-sm"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="admin-password" className="block text-xs font-semibold uppercase tracking-wider text-[#172B45]">Password</label>
              <Link to="/forgot-password" className="inline-flex min-h-8 items-center px-1 text-xs font-semibold text-[#0B1F3A] hover:text-[#C49A3A] transition">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-5 h-5 text-[#687386] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-12 pl-11 pr-11 bg-white border border-[#E3DCCF] rounded-xl focus:ring-2 focus:ring-[#D6A84F]/25 focus:border-[#D6A84F] transition text-[#172B45] placeholder:text-[#687386]/60 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center text-[#687386] hover:text-[#172B45] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D6A84F]/40 transition"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-[#0B1F3A] hover:bg-[#18385D] active:bg-[#102744] disabled:bg-[#0B1F3A]/50 text-[#FFFDF7] font-semibold text-sm rounded-xl shadow-md hover:shadow-lg transition duration-200 flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#D6A84F]" />
                Authenticating...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-[#687386] pt-1">
          Teacher or CR?{' '}
          <Link to="/staff/register" className="font-semibold text-[#0B1F3A] hover:text-[#C49A3A] transition underline-offset-2 hover:underline">
            Register for an account
          </Link>
        </p>
      </div>
    </div>
  );
};
