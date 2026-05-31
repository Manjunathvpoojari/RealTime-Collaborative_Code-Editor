import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import LoginPage     from './pages/LoginPage';
import RegisterPage  from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import BoardPage     from './pages/BoardPage';
import EditorPage    from './pages/EditorPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-theme-primary">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

function ToasterWrapper() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: theme === 'dark' ? '#1c2232' : '#ffffff',
          color:      theme === 'dark' ? '#e8eaf0' : '#111827',
          border:     theme === 'dark' ? '1px solid #252d42' : '1px solid #e2e6f0',
          fontSize: '13px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        },
      }}
    />
  );
}

function AppRoutes() {
  return (
    <>
      <ToasterWrapper />
      <Routes>
        <Route path="/"          element={<Navigate to="/dashboard" replace />} />
        <Route path="/login"     element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register"  element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/board/:boardId" element={<PrivateRoute><BoardPage /></PrivateRoute>} />
        <Route path="/editor/:boardId" element={<PrivateRoute><EditorPage /></PrivateRoute>} />
        <Route path="*"          element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}