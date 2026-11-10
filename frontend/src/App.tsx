import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
const StudentLogin = React.lazy(() =>
  import('./pages/StudentLogin').then(({ StudentLogin: Page }) => ({ default: Page }))
);
const StudentRegister = React.lazy(() =>
  import('./pages/StudentRegister').then(({ StudentRegister: Page }) => ({ default: Page }))
);
const VerifyEmail = React.lazy(() =>
  import('./pages/VerifyEmail').then(({ VerifyEmail: Page }) => ({ default: Page }))
);
const ForgotPassword = React.lazy(() =>
  import('./pages/ForgotPassword').then(({ ForgotPassword: Page }) => ({ default: Page }))
);
const ResetPassword = React.lazy(() =>
  import('./pages/ResetPassword').then(({ ResetPassword: Page }) => ({ default: Page }))
);
const AdminLogin = React.lazy(() =>
  import('./pages/AdminLogin').then(({ AdminLogin: Page }) => ({ default: Page }))
);
const StaffRegister = React.lazy(() =>
  import('./pages/StaffRegister').then(({ StaffRegister: Page }) => ({ default: Page }))
);
const SubmissionPreview = React.lazy(() =>
  import('./pages/SubmissionPreview').then(({ SubmissionPreview: Page }) => ({ default: Page }))
);

const StudentDashboard = React.lazy(() =>
  import('./pages/StudentDashboard').then(({ StudentDashboard: Dashboard }) => ({ default: Dashboard }))
);
const AdminDashboard = React.lazy(() =>
  import('./pages/AdminDashboard').then(({ AdminDashboard: Dashboard }) => ({ default: Dashboard }))
);

const HomeRedirect: React.FC = () => {
  const { isAuthenticated, role, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/student/login" replace />;
  const isStaff = role && ['SUPER_ADMIN', 'TEACHER', 'CR', 'CR_ASSISTANT'].includes(role);
  return <Navigate to={isStaff ? '/admin/dashboard' : '/student/dashboard'} replace />;
};


export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-[#F5F0E6] text-[#172B45] flex flex-col font-sans selection:bg-[#D6A84F]/30 selection:text-[#0B1F3A]">
          <Navbar />
          <div className="flex-1 flex flex-col">
            <React.Suspense fallback={null}>
              <Routes>
                {/* Home Route */}
                <Route path="/" element={<HomeRedirect />} />

                {/* Student Auth Routes */}
                <Route path="/student/login" element={<StudentLogin />} />
                <Route path="/register" element={<StudentRegister />} />
                <Route path="/staff/register" element={<StaffRegister />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/submission-preview/:id" element={<SubmissionPreview />} />

                {/* Student Protected Dashboard */}
                <Route element={<ProtectedRoute requiredRole="STUDENT" />}>
                  <Route path="/student/dashboard" element={<StudentDashboard />} />
                </Route>

                {/* Admin Auth Routes */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route element={<ProtectedRoute requiredRole="ADMIN" />}>
                  <Route path="/admin/dashboard" element={<AdminDashboard />} />
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </React.Suspense>
          </div>
          <Footer />
        </div>
        <Analytics />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
