import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  requiredRole?: UserRole | UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRole }) => {
  const { isAuthenticated, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  const isStaffRole = role && ['SUPER_ADMIN', 'TEACHER', 'CR', 'CR_ASSISTANT'].includes(role);

  if (!isAuthenticated) {
    const isStaffRequired = requiredRole === 'ADMIN' || (Array.isArray(requiredRole) && requiredRole.some(r => ['ADMIN', 'SUPER_ADMIN', 'TEACHER', 'CR', 'CR_ASSISTANT'].includes(r)));
    return <Navigate to={isStaffRequired ? '/admin/login' : '/student/login'} replace />;
  }

  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    // The staff dashboard is shared by Super Admins, Teachers, and CRs.
    const isAllowed = role !== 'ADMIN' && (allowed.includes(role!) || (allowed.includes('ADMIN') && isStaffRole));
    if (!isAllowed) {
      return <Navigate to={isStaffRole ? '/admin/dashboard' : '/student/dashboard'} replace />;
    }
  }

  return <Outlet />;
};
