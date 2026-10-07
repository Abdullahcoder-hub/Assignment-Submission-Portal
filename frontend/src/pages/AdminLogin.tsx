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
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Subtle background ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-md w-full glass-panel rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-gradient-to-tr from-blue-600/10 to-indigo-600/20 text-blue-600 rounded-2xl mb-1 shadow-inner border border-blue-500/20">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Staff & Super Admin Login</h2>
          <p className="text-sm text-slate-500">Staff access is available after email verification and Super Admin approval.</p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
            <div className="flex items-center gap-3 text-red-700 text-sm font-medium">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            {errorMsg.toLowerCase().includes('verify your email') && (
              <div className="border-t border-red-200 pt-3 space-y-2">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isResending}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-2"
                >
                  {isResending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {isResending ? 'Sending...' : 'Resend Verification Email'}
                </button>
                {resendMessage && <p role="status" className="text-xs font-semibold text-blue-700">{resendMessage}</p>}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Account Email</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                placeholder="admin@portal.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-slate-800 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-slate-800 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-blue-500/25 transition duration-200 flex items-center justify-center gap-2 mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
        <div className="flex items-center justify-between text-xs">
          <Link to="/forgot-password" className="font-semibold text-slate-500 hover:text-blue-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <p className="text-center text-xs text-slate-500">
          Teacher or CR? <Link to="/staff/register" className="font-bold text-blue-600 hover:underline">Register for an account</Link>
        </p>
      </div>
    </div>
  );
};
