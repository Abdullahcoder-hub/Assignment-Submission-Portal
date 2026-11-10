import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, KeyRound, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, Send } from 'lucide-react';
import api from '../api/axios';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { getPasswordRequirementStatus } from '../utils/passwordRequirements';

export const StudentRegister: React.FC = () => {
  const { studentRegister } = useAuth();

  const [name, setName] = useState<string>('');
  const [rollNumber, setRollNumber] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [joinCode, setJoinCode] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [canResendVerification, setCanResendVerification] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

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
    setRollNumber(clean);
    setErrorMsg(null);
    if (clean.length === 7) {
      checkRollAvailability(clean);
    } else {
      setRollCheckState(null);
    }
  };

  const passwordRequirements = getPasswordRequirementStatus(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setCanResendVerification(false);
    setResendMsg(null);

    const cleanRoll = rollNumber.trim();
    if (!/^\d{7}$/.test(cleanRoll)) {
      setErrorMsg('Roll number must be exactly 7 digits (e.g. 2260000).');
      return;
    }

    if (rollCheckState?.exists) {
      setErrorMsg(rollCheckState.message || `Roll number ${cleanRoll} is already registered.`);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (!passwordRequirements.every((requirement) => requirement.isMet)) {
      setErrorMsg('Password does not meet all security requirements.');
      return;
    }

    setIsSubmitting(true);

    const res = await studentRegister({
      name: name.trim(),
      rollNumber: cleanRoll,
      email: email.trim(),
      password,
      confirmPassword,
      joinCode: joinCode.trim(),
    });

    setIsSubmitting(false);

    if (res.success) {
      setSuccessMsg(res.message || 'Registration successful! Check your email for verification.');
      setCanResendVerification(true);
    } else {
      setErrorMsg(res.message || 'Registration failed.');
      setCanResendVerification(Boolean(res.canResend));
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setResendMsg('Please enter your email address to resend verification.');
      return;
    }

    setIsResending(true);
    setResendMsg(null);
    try {
      const response = await api.post('/auth/student/resend-verification', { email: email.trim() });
      setResendMsg(response.data.message || 'A new verification link has been sent. Please check your inbox.');
    } catch (error: any) {
      setResendMsg(error.response?.data?.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-[90vh] flex items-center justify-center py-10 px-4 sm:px-6 relative overflow-x-clip">
      {/* Subtle warm ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#D6A84F]/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-[480px] w-full bg-[#FFFDF7] rounded-2xl shadow-xl shadow-[#0B1F3A]/5 border border-[#E3DCCF] p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-[#0B1F3A]/5 border border-[#D6A84F]/30 text-[#D6A84F] flex items-center justify-center shadow-inner">
            <User className="w-7 h-7 stroke-[2.2]" />
          </div>
          <h2 className="text-2xl font-bold text-[#0B1F3A] tracking-tight">Student Registration</h2>
          <p className="text-sm text-[#687386]">Join your class using the Class Join Code provided by your CR.</p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-50/80 border border-red-200 rounded-xl flex items-center gap-2.5 text-red-700 text-xs sm:text-sm font-medium">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {canResendVerification && !successMsg && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={isResending}
              className="w-full h-11 bg-[#0B1F3A] hover:bg-[#18385D] disabled:bg-[#0B1F3A]/40 text-[#FFFDF7] font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition"
            >
              {isResending ? <Loader2 className="w-4 h-4 animate-spin text-[#D6A84F]" /> : <Send className="w-4 h-4" />}
              {isResending ? 'Sending...' : 'Resend Verification Email'}
            </button>
            {resendMsg && <p role="status" className="text-center text-xs font-semibold text-[#0B1F3A]">{resendMsg}</p>}
          </div>
        )}

        {successMsg ? (
          <div className="p-6 bg-[#F5F0E6] border border-[#D6A84F]/40 rounded-2xl text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-[#23845b] mx-auto" />
            <h3 className="text-lg font-bold text-[#0B1F3A]">Registration Successful!</h3>
            <p className="text-sm text-[#172B45]">{successMsg}</p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isResending}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#FFFDF7] hover:bg-[#EDE5D6] border border-[#E3DCCF] text-[#172B45] font-semibold text-xs rounded-xl shadow-xs transition"
              >
                {isResending ? <Loader2 className="w-4 h-4 animate-spin text-[#D6A84F]" /> : <Send className="w-4 h-4" />}
                {isResending ? 'Sending...' : 'Didn’t get the email? Resend'}
              </button>
              {resendMsg && <p role="status" className="text-xs font-semibold text-[#0B1F3A]">{resendMsg}</p>}
              <Link
                to="/student/login"
                className="inline-block px-6 py-2.5 bg-[#0B1F3A] hover:bg-[#18385D] text-[#FFFDF7] font-semibold text-xs rounded-xl shadow-md transition"
              >
                Go to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Section 1: Class Information */}
            <div className="p-3.5 bg-[#F5F0E6]/60 border border-[#E3DCCF] rounded-xl space-y-1.5">
              <label htmlFor="register-join-code" className="block text-xs font-semibold uppercase tracking-wider text-[#0B1F3A]">
                Class Join Code <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <KeyRound className="w-5 h-5 text-[#D6A84F] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="register-join-code"
                  type="text"
                  placeholder="e.g. CLASS-2026-PORTAL"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  required
                  className="w-full h-12 pl-11 pr-4 bg-white border border-[#E3DCCF] rounded-xl focus:ring-2 focus:ring-[#D6A84F]/25 focus:border-[#D6A84F] font-mono text-sm font-bold uppercase text-[#0B1F3A] tracking-wider transition"
                />
              </div>
            </div>

            {/* Section 2: Student Information */}
            <div className="space-y-3.5 pt-1">
              {/* Full Name */}
              <div>
                <label htmlFor="register-name" className="block text-xs font-semibold uppercase tracking-wider text-[#172B45] mb-1.5">Full Name</label>
                <input
                  id="register-name"
                  type="text"
                  placeholder="e.g. Abdullah Waqar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full h-12 px-4 bg-white border border-[#E3DCCF] rounded-xl text-[#172B45] placeholder:text-[#687386]/60 text-sm focus:ring-2 focus:ring-[#D6A84F]/25 focus:border-[#D6A84F] transition"
                />
              </div>

              {/* Roll Number */}
              <div>
                <label htmlFor="register-roll-number" className="block text-xs font-semibold uppercase tracking-wider text-[#172B45] mb-1.5">
                  Roll Number <span className="text-[#687386] font-normal normal-case">(7 digits, e.g. 2260000)</span>
                </label>
                <div className="relative">
                  <input
                    id="register-roll-number"
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    placeholder="e.g. 2260000"
                    value={rollNumber}
                    onChange={(e) => handleRollChange(e.target.value)}
                    required
                    className={`w-full h-12 pl-4 pr-11 bg-white border rounded-xl text-sm font-mono tracking-wider transition ${
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
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 text-[#D6A84F] animate-spin" />
                    </div>
                  )}
                  {rollCheckState && !rollCheckState.loading && rollCheckState.exists && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    </div>
                  )}
                  {rollCheckState && !rollCheckState.loading && rollCheckState.isAvailable && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                  )}
                </div>

                {/* Instant Roll Status Feedback */}
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
                {!rollCheckState && rollNumber.length > 0 && rollNumber.length < 7 && (
                  <p className="text-[11px] text-[#687386] mt-1">
                    {7 - rollNumber.length} more digit{7 - rollNumber.length > 1 ? 's' : ''} needed
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="register-email" className="block text-xs font-semibold uppercase tracking-wider text-[#172B45] mb-1.5">Email Address</label>
                <input
                  id="register-email"
                  type="email"
                  placeholder="student@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-12 px-4 bg-white border border-[#E3DCCF] rounded-xl text-[#172B45] placeholder:text-[#687386]/60 text-sm focus:ring-2 focus:ring-[#D6A84F]/25 focus:border-[#D6A84F] transition"
                />
              </div>
            </div>

            {/* Section 3: Password & Security */}
            <div className="space-y-3.5 pt-1">
              {/* Password */}
              <div>
                <label htmlFor="register-password" className="block text-xs font-semibold uppercase tracking-wider text-[#172B45] mb-1.5">Password</label>
                <div className="relative">
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full h-12 pl-4 pr-11 bg-white border border-[#E3DCCF] rounded-xl text-[#172B45] placeholder:text-[#687386]/60 text-sm focus:ring-2 focus:ring-[#D6A84F]/25 focus:border-[#D6A84F] transition"
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

              {/* Confirm Password */}
              <div>
                <label htmlFor="register-confirm-password" className="block text-xs font-semibold uppercase tracking-wider text-[#172B45] mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    id="register-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full h-12 pl-4 pr-11 bg-white border border-[#E3DCCF] rounded-xl text-[#172B45] placeholder:text-[#687386]/60 text-sm focus:ring-2 focus:ring-[#D6A84F]/25 focus:border-[#D6A84F] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center text-[#687386] hover:text-[#172B45] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D6A84F]/40 transition"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <PasswordRequirements password={password} />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || rollCheckState?.loading || rollCheckState?.exists}
              className="w-full h-12 bg-[#0B1F3A] hover:bg-[#18385D] active:bg-[#102744] disabled:bg-[#0B1F3A]/50 disabled:cursor-not-allowed text-[#FFFDF7] font-semibold text-sm rounded-xl shadow-md hover:shadow-lg transition duration-200 flex items-center justify-center gap-2 pt-1 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#D6A84F]" />
                  Creating Account...
                </>
              ) : (
                'Register Account'
              )}
            </button>
          </form>
        )}

        <div className="text-center text-xs text-[#687386] pt-1 space-y-2">
          <div>
            Already have an account?{' '}
            <Link to="/student/login" className="font-semibold text-[#0B1F3A] hover:text-[#C49A3A] transition underline-offset-2 hover:underline">
              Log in here
            </Link>
          </div>
          <div>
            Teacher or CR?{' '}
            <Link to="/staff/register" className="font-semibold text-[#0B1F3A] hover:text-[#C49A3A] transition underline-offset-2 hover:underline">
              Register for a staff account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
