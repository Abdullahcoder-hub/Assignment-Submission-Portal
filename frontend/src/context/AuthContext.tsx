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
  studentRegister: (data: any) => Promise<{ success: boolean; message?: string }>;
  googleLoginStudent: (data: { idToken: string; rollNumber?: string; joinCode?: string }) => Promise<{
    success: boolean;
    requiresJoinCode?: boolean;
    message?: string;
  }>;
  logout: () => void;
  refreshStudentProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | StudentUser | null>(null);
  const [role, setRole] = useState<UserRole | null>((localStorage.getItem('userRole') as UserRole) || null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('portalToken'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const verifyToken = async () => {
      const storedToken = localStorage.getItem('portalToken');
      const storedRole = localStorage.getItem('userRole') as UserRole;

      if (!storedToken || !storedRole) {
        setIsLoading(false);
        return;
      }

      try {
        if (storedRole === 'ADMIN') {
          const res = await api.get('/auth/me');
          if (res.data.success) {
            setUser(res.data.admin);
            setRole('ADMIN');
            setToken(storedToken);
          } else {
            logout();
          }
        } else if (storedRole === 'STUDENT') {
          const res = await api.get('/auth/student/me');
          if (res.data.success) {
            setUser(res.data.student);
            setRole('STUDENT');
            setToken(storedToken);
          } else {
            logout();
          }
        }
      } catch (error) {
        logout();
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
        localStorage.setItem('portalToken', jwtToken);
        localStorage.setItem('userRole', 'ADMIN');
        setToken(jwtToken);
        setRole('ADMIN');
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
        localStorage.setItem('portalToken', jwtToken);
        localStorage.setItem('userRole', 'STUDENT');
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

  const studentRegister = async (formData: any): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await api.post('/auth/student/register', formData);
      return { success: res.data.success, message: res.data.message };
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed.';
      return { success: false, message };
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
        localStorage.setItem('portalToken', jwtToken);
        localStorage.setItem('userRole', 'STUDENT');
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
    setToken(null);
    setRole(null);
    setUser(null);
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
