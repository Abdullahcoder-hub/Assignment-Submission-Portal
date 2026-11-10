import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Mail, Loader2, AlertCircle, CheckCircle2, KeyRound, Eye, EyeOff, Send } from 'lucide-react';
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
  const [modalErrorMsg, setModalErrorMsg] = useState<string | null>(null);
  const [rollCheckState, setRollCheckState] = useState<{
    loading: boolean;
    checkedRoll: string;
    exists?: boolean;
    isAvailable?: boolean;
    error?: boolean;
    message?: string;
  } | null>(null);

  const checkRollAvailability = async (roll: string) => {
    if (roll.length !== 7) {
      setRollCheckState(null);
      return;
    }
    setRollCheckState({ loading: true, checkedRoll: roll });
    try {
      const res = await api.get('/auth/student/check-roll', { params: { rollNumber: roll } });
      if (res.data?.exists) {
        setRollCheckState({
          loading: false,
          checkedRoll: roll,
          exists: true,
          isAvailable: false,
          message: res.data.message || `Roll number ${roll} is already registered.`,
        });
      } else if (res.data?.available) {
        setRollCheckState({
          loading: false,
          checkedRoll: roll,
          exists: false,
          isAvailable: true,
          message: res.data.message || `Roll number ${roll} is available.`,
        });
      } else {
        setRollCheckState(null);
      }
    } catch (err: any) {
      setRollCheckState({
        loading: false,
        checkedRoll: roll,
        exists: false,
        isAvailable: false,
        error: true,
        message: err.response?.data?.message || 'Server check temporarily unavailable.',
      });
    }
  };

  const handleRollChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 7);
    setGoogleRollNumber(clean);
    setModalErrorMsg(null);
    if (clean.length === 7) {
      checkRollAvailability(clean);
    } else {
      setRollCheckState(null);
    }
  };

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
    setModalErrorMsg(null);
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
    setModalErrorMsg(null);

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
    setModalErrorMsg(null);

    const cleanRoll = googleRollNumber.trim();
    if (!/^\d{7}$/.test(cleanRoll)) {
      setModalErrorMsg('Roll number must be exactly 7 digits (e.g. 2260000).');
      return;
    }

    if (rollCheckState?.exists) {
      setModalErrorMsg(rollCheckState.message || `Roll number ${cleanRoll} is already registered.`);
      return;
    }

    setIsSubmitting(true);

    const res = await googleLoginStudent({
      idToken: googleIdToken,
      rollNumber: cleanRoll,
      joinCode: googleJoinCode.trim(),
    });

    setIsSubmitting(false);

    if (res.success) {
      setGoogleJoinModalOpen(false);
      navigate('/student/dashboard');
    } else {
      setModalErrorMsg(res.message || 'Google registration failed.');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 sm:px-6 relative overflow-x-clip">
      {/* Subtle warm ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#D6A84F]/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-[416px] w-full bg-[#FFFDF7] rounded-2xl shadow-xl shadow-[#0B1F3A]/5 border border-[#E3DCCF] p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-[#0B1F3A]/5 border border-[#D6A84F]/30 text-[#D6A84F] flex items-center justify-center shadow-inner">
            <User className="w-7 h-7 stroke-[2.2]" />
          </div>
          <h2 className="text-2xl font-bold text-[#0B1F3A] tracking-tight">Student Sign In</h2>
          <p className="text-sm text-[#687386]">Log in to view assignments and submit your coursework.</p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-50/80 border border-red-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2.5 text-red-700 text-xs sm:text-sm font-medium">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            {errorMsg.toLowerCase().includes('verified') && (
              <div className="pt-2 border-t border-red-200/80 flex items-center justify-between">
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
          <div className="p-3 bg-[#F5F0E6] border border-[#D6A84F]/40 rounded-xl text-xs text-[#0B1F3A] font-semibold flex items-center justify-between">
            <span>{resendStatus}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-wider text-[#172B45] mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-[#687386] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-email"
                type="email"
                placeholder="student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-12 pl-11 pr-4 bg-white border border-[#E3DCCF] rounded-xl focus:ring-2 focus:ring-[#D6A84F]/25 focus:border-[#D6A84F] transition text-[#172B45] placeholder:text-[#687386]/60 text-sm"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-wider text-[#172B45]">Password</label>
              <Link to="/forgot-password" className="inline-flex min-h-8 items-center px-1 text-xs font-semibold text-[#0B1F3A] hover:text-[#C49A3A] transition">
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-5 h-5 text-[#687386] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-password"
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
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-[#0B1F3A] hover:bg-[#18385D] active:bg-[#102744] disabled:bg-[#0B1F3A]/50 text-[#FFFDF7] font-semibold text-sm rounded-xl shadow-md hover:shadow-lg transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#D6A84F]" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-[#E3DCCF]"></div>
          <span className="flex-shrink mx-4 text-xs font-semibold text-[#687386] uppercase tracking-wider">Or</span>
          <div className="flex-grow border-t border-[#E3DCCF]"></div>
        </div>

        {/* Official Google OAuth Login Button */}
        <div className="flex justify-center w-full">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setErrorMsg('Google login failed or popup was closed.')}
            theme="outline"
            shape="pill"
            size="large"
            width="320"
          />
        </div>

        {/* Dev Mode Simulation Button Fallback */}
        {process.env.NODE_ENV !== 'production' && (
          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={isSubmitting}
            className="w-full h-10 border border-dashed border-[#E3DCCF] hover:bg-[#F5F0E6] text-[#687386] hover:text-[#172B45] font-medium text-xs rounded-xl transition flex items-center justify-center gap-2"
          >
            Simulate Google Login (Dev Mode)
          </button>
        )}

        <div className="text-center text-xs text-[#687386] pt-1">
          Don't have a student account?{' '}
          <Link to="/register" className="font-semibold text-[#0B1F3A] hover:text-[#C49A3A] transition underline-offset-2 hover:underline">
            Register with Class Join Code
          </Link>
        </div>
      </div>

      {/* MODAL FOR FIRST TIME GOOGLE REGISTRATION JOIN CODE */}
      {googleJoinModalOpen && (
        <div className="fixed inset-0 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#FFFDF7] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E3DCCF] space-y-4">
            <div className="flex items-center gap-3 border-b border-[#E3DCCF] pb-3">
              <div className="w-10 h-10 rounded-xl bg-[#0B1F3A]/5 border border-[#D6A84F]/30 text-[#D6A84F] flex items-center justify-center">
                <KeyRound className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h3 className="text-lg font-bold text-[#0B1F3A]">First-Time Google Registration</h3>
            </div>
            <p className="text-xs text-[#687386]">
              Please enter your official Roll Number and the Class Join Code provided by your CR to complete registration.
            </p>

            {modalErrorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-red-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{modalErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleGoogleJoinSubmit} className="space-y-4">
              <div>
                <label htmlFor="google-roll-number" className="block text-xs font-bold text-[#172B45] mb-1">
                  Roll Number <span className="text-[#687386] font-normal">(7 digits, e.g. 2260000)</span>
                </label>
                <div className="relative">
                  <input
                    id="google-roll-number"
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    placeholder="e.g. 2260000"
                    value={googleRollNumber}
                    onChange={(e) => handleRollChange(e.target.value)}
                    required
                    className={`w-full h-11 px-3 bg-white border rounded-xl font-mono text-sm tracking-wider transition ${
                      rollCheckState?.exists
                        ? 'border-red-500 bg-red-50/40 text-red-900 focus:ring-2 focus:ring-red-400'
                        : rollCheckState?.isAvailable
                        ? 'border-emerald-500 bg-emerald-50/40 text-emerald-900 focus:ring-2 focus:ring-emerald-400'
                        : rollCheckState?.error
                        ? 'border-amber-400 focus:ring-2 focus:ring-amber-400'
                        : 'border-[#E3DCCF] focus:ring-2 focus:ring-[#D6A84F]/25 focus:border-[#D6A84F]'
                    }`}
                  />
                  {rollCheckState?.loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 text-[#D6A84F] animate-spin" />
                    </div>
                  )}
                  {rollCheckState && !rollCheckState.loading && rollCheckState.exists && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    </div>
                  )}
                  {rollCheckState && !rollCheckState.loading && rollCheckState.isAvailable && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                  )}
                </div>

                {/* Instant Roll Status Indicator */}
                {rollCheckState?.loading && (
                  <p className="text-[11px] text-[#0B1F3A] mt-1 font-medium flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin text-[#D6A84F]" /> Checking roll number availability...
                  </p>
                )}
                {rollCheckState && !rollCheckState.loading && rollCheckState.exists && (
                  <div className="mt-1.5 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-1.5 text-xs text-red-700 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span>{rollCheckState.message}</span>
                  </div>
                )}
                {rollCheckState && !rollCheckState.loading && rollCheckState.isAvailable && (
                  <p className="text-[11px] text-emerald-600 mt-1 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> {rollCheckState.message}
                  </p>
                )}
                {rollCheckState && !rollCheckState.loading && rollCheckState.error && (
                  <p className="text-[11px] text-amber-600 mt-1 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" /> {rollCheckState.message}
                  </p>
                )}
                {!rollCheckState && googleRollNumber.length > 0 && googleRollNumber.length < 7 && (
                  <p className="text-[11px] text-[#687386] mt-1">
                    {7 - googleRollNumber.length} more digit{7 - googleRollNumber.length > 1 ? 's' : ''} needed
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="google-join-code" className="block text-xs font-bold text-[#172B45] mb-1">Class Join Code</label>
                <input
                  id="google-join-code"
                  type="text"
                  placeholder="e.g. CLASS-2026-PORTAL"
                  value={googleJoinCode}
                  onChange={(e) => setGoogleJoinCode(e.target.value)}
                  required
                  className="w-full h-11 px-3 bg-white border border-[#E3DCCF] focus:border-[#D6A84F] focus:ring-2 focus:ring-[#D6A84F]/25 rounded-xl font-mono text-sm uppercase text-[#172B45]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGoogleJoinModalOpen(false)}
                  className="h-10 px-4 text-xs font-semibold bg-[#F5F0E6] hover:bg-[#EDE5D6] text-[#172B45] rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || rollCheckState?.loading || rollCheckState?.exists}
                  className="h-10 px-4 text-xs font-semibold bg-[#0B1F3A] hover:bg-[#18385D] disabled:bg-[#0B1F3A]/40 disabled:cursor-not-allowed text-[#FFFDF7] rounded-xl transition flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D6A84F]" />}
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
