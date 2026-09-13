import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState<boolean>(true);
  const [success, setSuccess] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');

  const [resendEmail, setResendEmail] = useState<string>('');
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const handleResend = async () => {
    if (!resendEmail.trim()) return;
    setIsResending(true);
    setResendMsg(null);
    try {
      const res = await api.post('/auth/student/resend-verification', { email: resendEmail.trim() });
      setResendMsg(res.data.message);
    } catch (err: any) {
      setResendMsg(err.response?.data?.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setLoading(false);
        setMessage('Missing verification token.');
        return;
      }

      try {
        const res = await api.get(`/auth/student/verify-email?token=${token}`);
        setSuccess(res.data.success);
        setMessage(res.data.message || 'Email verified successfully!');
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
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-6">
        {loading ? (
          <div className="space-y-3 py-6">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
            <h3 className="text-lg font-bold text-slate-800">Verifying Email Address...</h3>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
            <h2 className="text-2xl font-extrabold text-slate-900">Email Verified!</h2>
            <p className="text-sm text-slate-600">{message}</p>
            <Link
              to="/student/login"
              className="inline-block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow transition"
            >
              Proceed to Student Login
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <AlertCircle className="w-14 h-14 text-red-500 mx-auto" />
            <h2 className="text-2xl font-extrabold text-slate-900">Verification Failed</h2>
            <p className="text-sm text-slate-600">{message}</p>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <p className="text-xs text-slate-500 font-medium">Need a new verification link? Enter your email address below:</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="student@example.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-xl text-xs"
                />
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1"
                >
                  {isResending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Resend'}
                </button>
              </div>
              {resendMsg && <p className="text-xs font-semibold text-blue-700">{resendMsg}</p>}
            </div>

            <div className="pt-2">
              <Link
                to="/student/login"
                className="inline-block px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition"
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
