import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, ShieldCheck, GraduationCap, UserCheck, User } from 'lucide-react';
import { StudentUser, AdminUser } from '../types';

export const Navbar: React.FC = () => {
  const { isAuthenticated, user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/student/login');
  };

  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-16 py-2 flex items-center justify-between gap-2">
        <Link to={role === 'STUDENT' ? '/student/dashboard' : '/'} className="flex min-w-0 items-center gap-2 sm:gap-3 hover:opacity-90 transition">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-lg leading-tight tracking-tight truncate">Assignment Portal</h1>
            <p className="hidden sm:block text-xs text-slate-400">Class Submission System</p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-1.5 sm:gap-3">
              {role === 'ADMIN' ? (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-slate-200 text-xs font-semibold rounded-full border border-slate-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  CR / Admin: {(user as AdminUser)?.name}
                </span>
              ) : (
                <Link
                  to="/student/dashboard"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-blue-900/60 hover:bg-blue-900/80 text-blue-200 text-xs font-semibold rounded-full border border-blue-700/50 transition"
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
              {!isAdminRoute && (
                <Link
                  to="/admin/login"
                  className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-slate-300 hover:text-white px-2 sm:px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span className="hidden sm:inline">CR Login</span>
                  <span className="sm:hidden">CR</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
