import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { PasswordChange } from './components/PasswordChange';
import ProjectsPage from './pages/ProjectsPage';
import ProjectBoard from './pages/ProjectBoard';
import ProjectDetail from './pages/ProjectDetail';
import AdminDashboard from './pages/AdminDashboard';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock } from 'lucide-react';
import './App.css';

function IdleWarningModal({ onStay, onLogout, remainingSeconds }: { onStay: () => void, onLogout: () => void, remainingSeconds: number }) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-[#0d0d0d] border border-[rgba(255,255,255,0.07)] rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-[#F59E0B]/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-[#F59E0B]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Session Timeout Warning</h2>
            <p className="text-sm text-[#737373]">You have been inactive for 25 minutes</p>
          </div>
        </div>
        
        <div className="bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.2)] rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-[#F59E0B] mb-2">
            <Clock className="w-4 h-4" />
            <span className="font-medium">Auto-logout in:</span>
          </div>
          <div className="text-3xl font-bold text-white tabular-nums">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
          <p className="text-xs text-[#a3a3a3] mt-2">
            You will be automatically logged out due to inactivity.
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button 
            variant="ghost" 
            onClick={onLogout}
            className="flex-1 text-[#737373] hover:text-white rounded-xl h-11"
          >
            Logout Now
          </Button>
          <Button 
            onClick={onStay}
            className="flex-1 bg-gradient-to-r from-[#E0B954] to-[#B8872A] hover:from-[#5558E6] hover:to-[#4338CA] text-white rounded-xl h-11 font-medium"
          >
            Stay Logged In
          </Button>
        </div>
      </div>
    </div>
  );
}

function AuthenticatedRoutes() {
  const { user, isLoading, isAuthenticated, showWarning, dismissWarning, logout } = useAuth();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds

  // Redirect to home if already authenticated and on login page
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const currentPath = window.location.pathname;
      // Don't redirect if already on a valid page
      if (!['/'].includes(currentPath) && !currentPath.startsWith('/project')) {
        navigate('/');
      }
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Countdown timer for warning modal
  useEffect(() => {
    if (!showWarning) {
      setCountdown(300);
      return;
    }
    
    const timer = setInterval(() => {
      setCountdown((prev: number) => {
        if (prev <= 1) {
          logout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [showWarning, logout]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#E0B954]/30 border-t-[#E0B954] rounded-full animate-spin" />
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
    <>
      {showWarning && (
        <IdleWarningModal 
          onStay={dismissWarning}
          onLogout={logout}
          remainingSeconds={countdown}
        />
      )}
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/project/:id" element={<ProjectDetail />} />
        <Route path="/project/:id/board" element={<ProjectBoard />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AuthenticatedRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;