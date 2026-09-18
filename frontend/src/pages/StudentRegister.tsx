import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Mail, KeyRound, Loader2, AlertCircle, CheckCircle2, Shield, Eye, EyeOff } from 'lucide-react';

export const StudentRegister: React.FC = () => {
  const { studentRegister, googleLoginStudent } = useAuth();
  const navigate = useNavigate();

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

  // Password rules checks
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNum = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (!hasLength || !hasUpper || !hasLower || !hasNum || !hasSpecial) {
      setErrorMsg('Password does not meet all security requirements.');
      return;
    }

    setIsSubmitting(true);

    const res = await studentRegister({
      name,
      rollNumber,
      email,
      password,
      confirmPassword,
      joinCode,
    });

    setIsSubmitting(false);

    if (res.success) {
      setSuccessMsg(res.message || 'Registration successful! Check your email for verification.');
    } else {
      setErrorMsg(res.message || 'Registration failed.');
    }
  };

  return (
    <div className="min-h-[90vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Subtle background ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-md w-full glass-panel rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-gradient-to-tr from-blue-600/10 to-indigo-600/20 text-blue-600 rounded-2xl mb-1 shadow-inner border border-blue-500/20">
            <User className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Student Account Registration</h2>
          <p className="text-sm text-slate-500">Join your class using the Class Join Code provided by your CR.</p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm font-medium">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg ? (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h3 className="text-lg font-bold text-emerald-900">Registration Successful!</h3>
            <p className="text-sm text-emerald-800">{successMsg}</p>
            <Link
              to="/student/login"
              className="inline-block px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition"
            >
              Go to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Class Join Code */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-blue-700 mb-1">
                Class Join Code <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <KeyRound className="w-5 h-5 text-blue-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. CLASS-2026-PORTAL"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-blue-50/50 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono text-sm font-bold uppercase text-blue-900"
                />
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Abdullah Waqar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>

            {/* Roll Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Roll Number</label>
              <input
                type="text"
                placeholder="e.g. 21"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                placeholder="student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Requirements Checklist */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1 text-slate-600">
              <p className="font-bold text-slate-700">Password Security Requirements:</p>
              <div className="grid grid-cols-2 gap-1 font-medium">
                <span className={hasLength ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                  {hasLength ? '✓' : '•'} Min 8 chars
                </span>
                <span className={hasUpper ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                  {hasUpper ? '✓' : '•'} Uppercase (A-Z)
                </span>
                <span className={hasLower ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                  {hasLower ? '✓' : '•'} Lowercase (a-z)
                </span>
                <span className={hasNum ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                  {hasNum ? '✓' : '•'} Number (0-9)
                </span>
                <span className={hasSpecial ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                  {hasSpecial ? '✓' : '•'} Special (!@#$)
                </span>
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
                  Creating Account...
                </>
              ) : (
                'Register Account'
              )}
            </button>
          </form>
        )}

        <div className="text-center text-xs text-slate-500 pt-2">
          Already have an account?{' '}
          <Link to="/student/login" className="font-bold text-blue-600 hover:underline">
            Log in here
          </Link>
        </div>
      </div>
    </div>
  );
};
