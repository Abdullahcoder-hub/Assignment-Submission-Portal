import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { AdminUser, StudentUser, UserRole } from '../types';

interface AuthContextType {
  user: AdminUser | StudentUser | null;
  role: UserRole | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  adminLogin: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  studentLogin: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  studentRegister: (data: any) => Promise<{ success: boolean; message?: string; canResend?: boolean }>;
  googleLoginStudent: (data: { idToken: string; rollNumber?: string; joinCode?: string }) => Promise<{
    success: boolean;
    requiresJoinCode?: boolean;
    message?: string;
  }>;
  logout: () => void;
  replaceToken: (token: string) => void;
  switchToStaffPortal: () => Promise<boolean>;
  switchToStudentPortal: () => boolean;
  refreshStudentProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getCachedUser = (): AdminUser | StudentUser | null => {
  try {
    const item = localStorage.getItem('portalUser');
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const storedToken = localStorage.getItem('portalToken');
  const storedRole = (localStorage.getItem('userRole') as UserRole) || null;
  const cachedUser = getCachedUser() || (storedToken && storedRole ? ({ id: '', email: '', name: '', role: storedRole } as any) : null);

  const [user, setUser] = useState<AdminUser | StudentUser | null>(cachedUser);
  const [role, setRole] = useState<UserRole | null>(storedRole);
  const [token, setToken] = useState<string | null>(storedToken);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const verifyToken = async () => {
      const storedToken = localStorage.getItem('portalToken');
      const storedRole = localStorage.getItem('userRole') as UserRole;

      if (!storedToken || !storedRole) {
        setIsLoading(false);
        return;
      }

      try {
        if (['SUPER_ADMIN', 'TEACHER', 'CR', 'CR_ASSISTANT'].includes(storedRole)) {
          const res = await api.get('/auth/me');
          if (res.data.success) {
            setUser(res.data.admin);
            setRole(res.data.admin.role || storedRole);
            setToken(storedToken);
            localStorage.setItem('userRole', res.data.admin.role || storedRole);
            localStorage.setItem('portalUser', JSON.stringify(res.data.admin));
          } else {
            logout();
          }
        } else if (storedRole === 'STUDENT') {
          const res = await api.get('/auth/student/me');
          if (res.data.success) {
            setUser(res.data.student);
            setRole('STUDENT');
            setToken(storedToken);
            localStorage.setItem('portalUser', JSON.stringify(res.data.student));
          } else {
            logout();
          }
        } else {
          logout();
        }
      } catch (error: any) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          logout();
        }
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, []);

  const refreshStudentProfile = async () => {
    try {
      const res = await api.get('/auth/student/me');
      if (res.data.success) {
        setUser(res.data.student);
        localStorage.setItem('portalUser', JSON.stringify(res.data.student));
      }
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  };

  const adminLogin = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        const jwtToken = res.data.token;
        const adminData = res.data.admin;
        const assignedRole = adminData.role as UserRole;
        if (!['SUPER_ADMIN', 'TEACHER', 'CR', 'CR_ASSISTANT'].includes(assignedRole)) {
          return { success: false, message: 'This account role is not allowed to sign in.' };
        }
        localStorage.removeItem('staffPortalToken');
        localStorage.removeItem('studentPortalToken');
        localStorage.removeItem('studentPortalUser');
        localStorage.setItem('admin_active_tab', 'dashboard');
        localStorage.setItem('admin_active_tab_role', assignedRole);
        localStorage.setItem('portalToken', jwtToken);
        localStorage.setItem('userRole', assignedRole);
        localStorage.setItem('portalUser', JSON.stringify(adminData));
        setToken(jwtToken);
        setRole(assignedRole);
        setUser(adminData);
        return { success: true };
      }
      return { success: false, message: res.data.message || 'Login failed.' };
    } catch (error: any) {
      const message = error.response?.data?.message || 'Incorrect email or password.';
      return { success: false, message };
    }
  };


  const studentLogin = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await api.post('/auth/student/login', { email, password });
      if (res.data.success) {
        const jwtToken = res.data.token;
        const studentData = res.data.student;
        localStorage.removeItem('studentPortalToken');
        localStorage.removeItem('studentPortalUser');
        if (res.data.staffPortalToken) {
          localStorage.setItem('staffPortalToken', res.data.staffPortalToken);
        } else {
          localStorage.removeItem('staffPortalToken');
        }
        localStorage.setItem('portalToken', jwtToken);
        localStorage.setItem('userRole', 'STUDENT');
        localStorage.setItem('portalUser', JSON.stringify(studentData));
        setToken(jwtToken);
        setRole('STUDENT');
        setUser(studentData);
        return { success: true };
      }
      return { success: false, message: res.data.message || 'Login failed.' };
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed.';
      return { success: false, message };
    }
  };

  const studentRegister = async (formData: any): Promise<{ success: boolean; message?: string; canResend?: boolean }> => {
    try {
      const res = await api.post('/auth/student/register', formData);
      return { success: res.data.success, message: res.data.message };
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed.';
      return { success: false, message, canResend: error.response?.status === 502 };
    }
  };

  const googleLoginStudent = async (data: {
    idToken: string;
    rollNumber?: string;
    joinCode?: string;
  }): Promise<{ success: boolean; requiresJoinCode?: boolean; message?: string }> => {
    try {
      const res = await api.post('/auth/student/google', data);
      if (res.data.success) {
        const jwtToken = res.data.token;
        const studentData = res.data.student;
        localStorage.removeItem('staffPortalToken');
        localStorage.removeItem('studentPortalToken');
        localStorage.removeItem('studentPortalUser');
        localStorage.setItem('portalToken', jwtToken);
        localStorage.setItem('userRole', 'STUDENT');
        localStorage.setItem('portalUser', JSON.stringify(studentData));
        setToken(jwtToken);
        setRole('STUDENT');
        setUser(studentData);
        return { success: true };
      }

      if (res.data.requiresJoinCode) {
        return { success: false, requiresJoinCode: true, message: res.data.message };
      }

      return { success: false, message: res.data.message || 'Google authentication failed.' };
    } catch (error: any) {
      const message = error.response?.data?.message || 'Google authentication failed.';
      return { success: false, message };
    }
  };

  const logout = () => {
    localStorage.removeItem('portalToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('portalUser');
    localStorage.removeItem('staffPortalToken');
    localStorage.removeItem('studentPortalToken');
    localStorage.removeItem('studentPortalUser');
    setToken(null);
    setRole(null);
    setUser(null);
  };

  const replaceToken = (updatedToken: string) => {
    localStorage.setItem('portalToken', updatedToken);
    if (role === 'CR' || role === 'CR_ASSISTANT') {
      localStorage.setItem('staffPortalToken', updatedToken);
    }
    setToken(updatedToken);
  };

  const switchToStaffPortal = async (): Promise<boolean> => {
    const currentStudentToken = localStorage.getItem('portalToken');
    const currentStudentUser = localStorage.getItem('portalUser');
    if (!currentStudentToken || !currentStudentUser) return false;
    try {
      const sessionResponse = await api.post('/auth/student/staff-session');
      const staffToken = sessionResponse.data.token as string;
      if (!staffToken) throw new Error('CR session token was not returned.');
      localStorage.setItem('studentPortalToken', currentStudentToken);
      localStorage.setItem('studentPortalUser', currentStudentUser);
      localStorage.setItem('staffPortalToken', staffToken);
      localStorage.setItem('portalToken', staffToken);
      const res = await api.get('/auth/me');
      if (!res.data.success) throw new Error('Unable to verify staff account.');
      const adminData = res.data.admin as AdminUser;
      localStorage.setItem('userRole', adminData.role);
      localStorage.setItem('portalUser', JSON.stringify(adminData));
      setToken(staffToken);
      setRole(adminData.role);
      setUser(adminData);
      return true;
    } catch (error) {
      localStorage.setItem('portalToken', currentStudentToken);
      localStorage.setItem('userRole', 'STUDENT');
      localStorage.setItem('portalUser', currentStudentUser);
      localStorage.removeItem('studentPortalToken');
      localStorage.removeItem('studentPortalUser');
      return false;
    }
  };

  const switchToStudentPortal = (): boolean => {
    const studentToken = localStorage.getItem('studentPortalToken');
    const studentUser = localStorage.getItem('studentPortalUser');
    if (!studentToken || !studentUser) return false;
    let studentData: StudentUser;
    try {
      studentData = JSON.parse(studentUser) as StudentUser;
    } catch {
      return false;
    }
    localStorage.setItem('portalToken', studentToken);
    localStorage.setItem('userRole', 'STUDENT');
    localStorage.setItem('portalUser', JSON.stringify(studentData));
    localStorage.removeItem('studentPortalToken');
    localStorage.removeItem('studentPortalUser');
    setToken(studentToken);
    setRole('STUDENT');
    setUser(studentData);
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        adminLogin,
        studentLogin,
        studentRegister,
        googleLoginStudent,
        logout,
        replaceToken,
        switchToStaffPortal,
        switchToStudentPortal,
        refreshStudentProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
