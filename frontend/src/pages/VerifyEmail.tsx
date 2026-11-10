import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get('token') || sessionStorage.getItem('portalVerifyToken'));

  const [loading, setLoading] = useState<boolean>(true);
  const [success, setSuccess] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [loginPath, setLoginPath] = useState('/student/login');

  const [resendEmail, setResendEmail] = useState<string>('');
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const handleResend = async () => {
    if (!resendEmail.trim()) return;
    setIsResending(true);
    setResendMsg(null);
    try {
      const res = await api.post('/auth/resend-verification', { email: resendEmail.trim() });
      setResendMsg(res.data.message);
    } catch (err: any) {
      setResendMsg(err.response?.data?.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    sessionStorage.removeItem('portalVerifyToken');
    const verify = async () => {
      if (!token) {
        setLoading(false);
        setMessage('Missing verification token.');
        return;
      }

      try {
        const res = await api.post('/auth/verify-email', { token });
        setSuccess(res.data.success);
        setMessage(res.data.message || 'Email verified successfully!');
        if (res.data.role === 'TEACHER' || res.data.role === 'CR' || res.data.role === 'SUPER_ADMIN') {
          setLoginPath('/admin/login');
        }
      } catch (err: any) {
        setSuccess(false);
        setMessage(err.response?.data?.message || 'Verification link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4 sm:px-6 relative overflow-x-clip">
      {/* Subtle warm ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#D6A84F]/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-[416px] w-full bg-[#FFFDF7] rounded-2xl shadow-xl shadow-[#0B1F3A]/5 border border-[#E3DCCF] p-6 sm:p-8 text-center space-y-6">
        {loading ? (
          <div className="space-y-3 py-6">
            <Loader2 className="w-12 h-12 text-[#D6A84F] animate-spin mx-auto" />
            <h3 className="text-lg font-bold text-[#0B1F3A]">Verifying Email Address...</h3>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <CheckCircle2 className="w-14 h-14 text-[#23845b] mx-auto" />
            <h2 className="text-2xl font-bold text-[#0B1F3A] tracking-tight">Email Verified!</h2>
            <p className="text-sm text-[#687386]">{message}</p>
            <Link
              to={loginPath}
              className="inline-flex items-center justify-center w-full h-12 bg-[#0B1F3A] hover:bg-[#18385D] text-[#FFFDF7] font-semibold text-sm rounded-xl shadow-md transition"
            >
              {loginPath === '/admin/login' ? 'Proceed to Staff Login' : 'Proceed to Student Login'}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <AlertCircle className="w-14 h-14 text-red-500 mx-auto" />
            <h2 className="text-2xl font-bold text-[#0B1F3A] tracking-tight">Verification Failed</h2>
            <p className="text-sm text-[#687386]">{message}</p>

            <div className="pt-4 border-t border-[#E3DCCF] space-y-3 text-left">
              <label htmlFor="verify-resend-email" className="block text-xs text-[#687386] font-medium">Need a new verification link? Enter your account email address below:</label>
              <div className="flex gap-2">
                <input
                  id="verify-resend-email"
                  type="email"
                  placeholder="you@example.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="min-w-0 flex-1 h-11 px-3 bg-white border border-[#E3DCCF] focus:border-[#D6A84F] focus:ring-2 focus:ring-[#D6A84F]/25 rounded-xl text-xs text-[#172B45] placeholder:text-[#687386]/60 transition"
                />
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending}
                  className="shrink-0 h-11 px-4 bg-[#0B1F3A] hover:bg-[#18385D] text-[#FFFDF7] font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isResending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D6A84F]" /> : 'Resend'}
                </button>
              </div>
              {resendMsg && <p className="text-xs font-semibold text-[#0B1F3A]">{resendMsg}</p>}
            </div>

            <div className="pt-2">
              <Link
                to="/student/login"
                className="inline-block px-6 py-2.5 bg-[#F5F0E6] hover:bg-[#EDE5D6] text-[#172B45] font-semibold text-xs rounded-xl transition"
              >
                Back to Login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
