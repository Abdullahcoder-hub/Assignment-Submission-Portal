import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, ShieldCheck, GraduationCap, UserCheck, User } from 'lucide-react';
import { StudentUser, AdminUser } from '../types';

export const Navbar: React.FC = () => {
  const { isAuthenticated, user, role, logout, switchToStudentPortal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/student/login');
  };

  const isAuthRoute = [
    '/student/login',
    '/admin/login',
    '/register',
    '/staff/register',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
  ].includes(location.pathname);
  const isStaff = role && ['SUPER_ADMIN', 'TEACHER', 'CR', 'CR_ASSISTANT'].includes(role);
  const dashboardPath = isStaff ? '/admin/dashboard' : '/student/dashboard';

  const getRoleLabel = () => {
    if (role === 'SUPER_ADMIN') return 'Super Admin';
    if (role === 'TEACHER') return 'Teacher';
    if (role === 'CR') return 'CR';
    return 'Student';
  };

  return (
    <header className="bg-slate-950/80 backdrop-blur-xl text-white shadow-lg border-b border-white/10 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-16 py-2 flex items-center justify-between gap-2">
        <Link to={isAuthenticated && !isAuthRoute ? dashboardPath : '/'} className="flex min-w-0 items-center gap-2 sm:gap-3 hover:opacity-90 transition">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl text-white shadow-md shadow-blue-500/20 border border-white/20">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-lg leading-tight tracking-tight truncate">Assignment & Quiz Portal</h1>
            <p className="hidden sm:block text-xs text-slate-400">Class & Examination Portal</p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          {isAuthenticated && !isAuthRoute ? (
            <div className="flex items-center gap-1.5 sm:gap-3">
              {isStaff && localStorage.getItem('studentPortalToken') && (
                <button
                  type="button"
                  onClick={() => {
                    if (switchToStudentPortal()) navigate('/student/dashboard');
                  }}
                  className="px-2.5 sm:px-3.5 py-1.5 text-xs font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 rounded-lg border border-blue-500/30"
                >
                  Portal
                </button>
              )}
              {isStaff ? (
                <Link
                  to="/admin/dashboard"
                  className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-full border border-slate-700 transition"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  {getRoleLabel()}: {(user as AdminUser)?.name}
                </Link>
              ) : (
                <Link
                  to="/student/dashboard"
                  className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 bg-blue-900/50 hover:bg-blue-900/80 text-blue-200 text-xs font-semibold rounded-full border border-blue-700/50 transition"
                >
                  <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                  {(user as StudentUser)?.name} (Roll #{(user as StudentUser)?.rollNumber})
                </Link>
              )}


              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-medium bg-red-600/20 hover:bg-red-600/30 text-red-300 hover:text-red-200 rounded-lg transition border border-red-500/30"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/student/login"
                className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-white px-2 sm:px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Student Login</span>
                <span className="sm:hidden">Student</span>
              </Link>
              {!location.pathname.startsWith('/admin') && (
                <Link
                  to="/admin/login"
                  className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-slate-300 hover:text-white px-2 sm:px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span className="hidden sm:inline">Staff / CR Login</span>
                  <span className="sm:hidden">Staff</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
