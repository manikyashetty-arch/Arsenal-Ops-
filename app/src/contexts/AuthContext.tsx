import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { API_BASE_URL } from '@/config/api';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;  // Comma-separated roles: 'admin', 'project_manager', 'developer', or 'admin,project_manager'
  is_first_login: boolean;
}

// Helper functions for role checking
export const hasRole = (userRole: string | undefined, requiredRole: string): boolean => {
  if (!userRole) return false;
  const roles = userRole.split(',').map(r => r.trim());
  return roles.includes(requiredRole);
};

export const hasAnyRole = (userRole: string | undefined, requiredRoles: string[]): boolean => {
  if (!userRole) return false;
  const roles = userRole.split(',').map(r => r.trim());
  return requiredRoles.some(role => roles.includes(role));
};

export const isAdmin = (user: User | null): boolean => hasRole(user?.role, 'admin');
export const isProjectManager = (user: User | null): boolean => hasAnyRole(user?.role, ['admin', 'project_manager']);
export const isDeveloper = (user: User | null): boolean => hasRole(user?.role, 'developer');

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  checkAuth: () => Promise<void>;
  idleTime: number;
  showWarning: boolean;
  dismissWarning: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 30 minutes in milliseconds
const IDLE_TIMEOUT = 30 * 60 * 1000;
const WARNING_TIME = 25 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const [idleTime, setIdleTime] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  
  const lastActivityRef = useRef(Date.now());
  const isAuthenticated = !!user && !!token;

  useEffect(() => {
    if (token) {
      checkAuth();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  // Activity tracking
  useEffect(() => {
    if (!isAuthenticated) return;

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      setIdleTime(0);
      setShowWarning(false);
    };

    // Track user activity
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    // Check idle time every minute
    const interval = setInterval(() => {
      const now = Date.now();
      const idle = now - lastActivityRef.current;
      setIdleTime(idle);

      if (idle >= IDLE_TIMEOUT) {
        // Auto logout after 30 minutes
        logout();
      } else if (idle >= WARNING_TIME) {
        // Show warning at 25 minutes
        setShowWarning(true);
      }
    }, 60000); // Check every minute

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true);
      });
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  const dismissWarning = () => {
    setShowWarning(false);
    lastActivityRef.current = Date.now();
    setIdleTime(0);
  };

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Token invalid
        logout();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('token', data.access_token);
    lastActivityRef.current = Date.now();
    setIdleTime(0);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIdleTime(0);
    setShowWarning(false);
    localStorage.removeItem('token');
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to change password');
    }

    // Update user state to reflect password changed
    setUser(prev => prev ? { ...prev, is_first_login: false } : null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      isAuthenticated,
      login,
      logout,
      changePassword,
      checkAuth,
      idleTime,
      showWarning,
      dismissWarning
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
