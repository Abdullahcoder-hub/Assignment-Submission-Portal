import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Mail, Loader2, AlertCircle, KeyRound, Eye, EyeOff, Send } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import api from '../api/axios';

export const StudentLogin: React.FC = () => {
  const { studentLogin, googleLoginStudent } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Resend Email State
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [isResending, setIsResending] = useState<boolean>(false);

  // Google Modal State if join code / roll # is required for first time Google login
  const [googleJoinModalOpen, setGoogleJoinModalOpen] = useState<boolean>(false);
  const [googleIdToken, setGoogleIdToken] = useState<string>('');
  const [googleRollNumber, setGoogleRollNumber] = useState<string>('');
  const [googleJoinCode, setGoogleJoinCode] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setResendStatus(null);

    const result = await studentLogin(email, password);
    setIsSubmitting(false);

    if (result.success) {
      navigate('/student/dashboard');
    } else {
      setErrorMsg(result.message || 'Login failed.');
    }
  };

  const handleResendEmail = async () => {
    if (!email.trim()) {
      setErrorMsg('Please enter your email address to resend verification.');
      return;
    }
    setIsResending(true);
    setResendStatus(null);
    try {
      const res = await api.post('/auth/student/resend-verification', { email: email.trim() });
      setResendStatus(res.data.message);
    } catch (err: any) {
      setResendStatus(err.response?.data?.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  // Real Google SSO Success Handler
  const handleGoogleSuccess = async (credentialResponse: any) => {
    const token = credentialResponse.credential;
    if (!token) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setGoogleIdToken(token);

    const res = await googleLoginStudent({ idToken: token });
    setIsSubmitting(false);

    if (res.success) {
      navigate('/student/dashboard');
    } else if (res.requiresJoinCode) {
      setGoogleJoinModalOpen(true);
    } else {
      setErrorMsg(res.message || 'Google authentication failed.');
    }
  };

  // Google SSO Dev Fallback Handler
  const handleGoogleClick = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    const mockIdToken = prompt(
      'Google Login (Dev Mode): Enter Google OAuth ID Token or press OK to simulate login with your email:',
      email || 'student@example.com'
    );

    if (!mockIdToken) {
      setIsSubmitting(false);
      return;
    }

    const fakeTokenPayload = btoa(JSON.stringify({ email: mockIdToken, name: 'Student User', sub: 'google_12345' }));
    setGoogleIdToken(fakeTokenPayload);

    const res = await googleLoginStudent({ idToken: fakeTokenPayload });
    setIsSubmitting(false);

    if (res.success) {
      navigate('/student/dashboard');
    } else if (res.requiresJoinCode) {
      setGoogleJoinModalOpen(true);
    } else {
      setErrorMsg(res.message || 'Google login failed.');
    }
  };

  const handleGoogleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const res = await googleLoginStudent({
      idToken: googleIdToken,
      rollNumber: googleRollNumber,
      joinCode: googleJoinCode,
    });

    setIsSubmitting(false);

    if (res.success) {
      setGoogleJoinModalOpen(false);
      navigate('/student/dashboard');
    } else {
      setErrorMsg(res.message || 'Google registration failed.');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-blue-600/10 text-blue-600 rounded-2xl mb-1">
            <User className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Student Portal Sign In</h2>
          <p className="text-sm text-slate-500">Log in to view assignments and submit your coursework.</p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
            <div className="flex items-center gap-3 text-red-700 text-sm font-medium">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            {errorMsg.toLowerCase().includes('verified') && (
              <div className="pt-2 border-t border-red-200 flex items-center justify-between">
                <span className="text-xs text-red-600">Didn't get the email?</span>
                <button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={isResending}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                >
                  {isResending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Resend Email
                </button>
              </div>
            )}
          </div>
        )}

        {resendStatus && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 font-semibold flex items-center justify-between">
            <span>{resendStatus}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                placeholder="student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-slate-800 text-sm"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-semibold text-slate-700">Password</label>
              <Link to="/forgot-password" className="text-xs font-semibold text-blue-600 hover:underline">
                Forgot Password?
              </Link>
            </div>
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
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-blue-500/25 transition duration-200 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400 uppercase">Or</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {/* Official Google OAuth Login Button */}
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setErrorMsg('Google login failed or popup was closed.')}
            theme="outline"
            shape="pill"
            size="large"
            width="100%"
          />
        </div>

        {/* Dev Mode Simulation Button Fallback */}
        {process.env.NODE_ENV !== 'production' && (
          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={isSubmitting}
            className="w-full py-2 border border-dashed border-slate-300 hover:bg-slate-50 text-slate-500 font-medium text-xs rounded-xl transition flex items-center justify-center gap-2"
          >
            Simulate Google Login (Dev Mode)
          </button>
        )}

        <div className="text-center text-xs text-slate-500 pt-2">
          Don't have a student account?{' '}
          <Link to="/register" className="font-bold text-blue-600 hover:underline">
            Register with Class Join Code
          </Link>
        </div>
      </div>

      {/* MODAL FOR FIRST TIME GOOGLE REGISTRATION JOIN CODE */}
      {googleJoinModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b pb-3">
              <KeyRound className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-bold text-slate-900">First-Time Google Registration</h3>
            </div>
            <p className="text-xs text-slate-600">
              Please enter your official Roll Number and the Class Join Code provided by your CR to complete registration.
            </p>

            <form onSubmit={handleGoogleJoinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Roll Number</label>
                <input
                  type="text"
                  placeholder="e.g. 21"
                  value={googleRollNumber}
                  onChange={(e) => setGoogleRollNumber(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-xl font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Class Join Code</label>
                <input
                  type="text"
                  placeholder="e.g. CLASS-2026-PORTAL"
                  value={googleJoinCode}
                  onChange={(e) => setGoogleJoinCode(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-xl font-mono text-sm uppercase"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGoogleJoinModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                >
                  Complete Setup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
