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
    <header className="bg-[#0B1F3A] text-[#FFFDF7] shadow-lg border-b border-[#D6A84F]/20 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-16 py-2 flex items-center justify-between gap-2">
        <Link to={isAuthenticated && !isAuthRoute ? dashboardPath : '/'} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 hover:opacity-90 transition">
          <div className="bg-gradient-to-br from-[#D6A84F] to-[#C49A3A] p-2 rounded-xl text-[#0B1F3A] shadow-md shadow-[#D6A84F]/20 border border-[#D6A84F]/40 shrink-0">
            <GraduationCap className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm sm:text-lg leading-tight tracking-tight truncate text-[#FFFDF7]">Assignment & Quiz Portal</h1>
            <p className="hidden sm:block text-xs text-[#E3DCCF]/80">Class & Examination Portal</p>
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
                  aria-label="Switch to student portal"
                  className="min-h-11 shrink-0 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold bg-[#102744] hover:bg-[#18385D] text-[#D6A84F] rounded-lg border border-[#D6A84F]/40 transition"
                >
                  Portal
                </button>
              )}
              {isStaff ? (
                <Link
                  to="/admin/dashboard"
                  className="hidden md:inline-flex min-h-11 items-center gap-1.5 px-3 py-1 bg-[#102744] hover:bg-[#18385D] text-[#FFFDF7] text-xs font-semibold rounded-full border border-[#D6A84F]/30 transition"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#D6A84F]" />
                  {getRoleLabel()}: {(user as AdminUser)?.name}
                </Link>
              ) : (
                <Link
                  to="/student/dashboard"
                  className="hidden md:inline-flex min-h-11 items-center gap-1.5 px-3 py-1 bg-[#102744] hover:bg-[#18385D] text-[#FFFDF7] text-xs font-semibold rounded-full border border-[#D6A84F]/30 transition"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#D6A84F]" />
                  {(user as StudentUser)?.name} (Roll #{(user as StudentUser)?.rollNumber})
                </Link>
              )}


              <button
                type="button"
                onClick={handleLogout}
                aria-label="Logout"
                className="min-h-11 min-w-11 shrink-0 flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold bg-red-950/40 hover:bg-red-900/60 text-red-200 rounded-lg transition border border-red-500/40"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="hidden min-[360px]:inline">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/student/login"
                aria-label="Student Login"
                className="min-h-11 min-w-11 shrink-0 flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-semibold text-[#FFFDF7] px-2.5 sm:px-3.5 py-2 rounded-lg bg-[#102744] hover:bg-[#18385D] border border-[#D6A84F]/40 transition shadow-sm"
              >
                <User className="w-4 h-4 text-[#D6A84F]" />
                <span className="hidden sm:inline">Student Login</span>
                <span className="hidden min-[400px]:inline sm:hidden">Student</span>
              </Link>
              {!location.pathname.startsWith('/admin') && (
                <Link
                  to="/admin/login"
                  aria-label="Staff / CR Login"
                  className="min-h-11 min-w-11 shrink-0 flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-semibold text-[#E3DCCF] hover:text-[#FFFDF7] px-2.5 sm:px-3.5 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#102744] border border-[#E3DCCF]/30 transition"
                >
                  <ShieldCheck className="w-4 h-4 text-[#D6A84F]" />
                  <span className="hidden sm:inline">Staff / CR Login</span>
                  <span className="hidden min-[400px]:inline sm:hidden">Staff</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
