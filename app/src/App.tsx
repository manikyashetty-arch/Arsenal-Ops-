import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { PasswordChange } from './components/PasswordChange';
import ProjectsPage from './pages/ProjectsPage';
import ProjectBoard from './pages/ProjectBoard';
import ProjectDetail from './pages/ProjectDetail';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

function AuthenticatedRoutes() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#05060B] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#6366F1]/30 border-t-[#6366F1] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  // If first login, force password change
  if (user?.is_first_login) {
    return <PasswordChange />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/project/:id" element={<ProjectDetail />} />
        <Route path="/project/:id/board" element={<ProjectBoard />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthenticatedRoutes />
    </AuthProvider>
  );
}

export default App;