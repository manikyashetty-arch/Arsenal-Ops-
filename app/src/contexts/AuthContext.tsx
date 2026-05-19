import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { API_BASE_URL } from '@/config/api';
import { setAuthFailureHandler, resetAuthFailureLatch } from '@/lib/api';
import { matchesCapability } from '@/lib/capabilities';

interface User {
  id: number;
  email: string;
  name: string;
  role: string; // Comma-separated roles: 'admin', 'project_manager', 'developer', or 'admin,project_manager'
  is_first_login: boolean;
}

// Helper functions for role checking
export const hasRole = (userRole: string | undefined, requiredRole: string): boolean => {
  if (!userRole) return false;
  const roles = userRole.split(',').map((r) => r.trim());
  return roles.includes(requiredRole);
};

export const hasAnyRole = (userRole: string | undefined, requiredRoles: string[]): boolean => {
  if (!userRole) return false;
  const roles = userRole.split(',').map((r) => r.trim());
  return requiredRoles.some((role) => roles.includes(role));
};

export const isAdmin = (user: User | null): boolean => hasRole(user?.role, 'admin');
export const isProjectManager = (user: User | null): boolean =>
  hasAnyRole(user?.role, ['admin', 'project_manager']);
export const isDeveloper = (user: User | null): boolean => hasRole(user?.role, 'developer');

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginDev: () => Promise<void>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  checkAuth: () => Promise<void>;
  showWarning: boolean;
  dismissWarning: () => void;
  // RBAC capabilities
  capabilities: string[];
  can: (cap: string) => boolean;
  refreshCapabilities: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 30-minute idle auto-logout. Warning modal shows at 25 minutes and counts
// down 5 minutes before the actual logout. Copy in App.tsx ("inactive for
// 25 minutes") must stay in sync — change all three constants together.
const IDLE_TIMEOUT = 30 * 60 * 1000;
const WARNING_TIME = 25 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  // We no longer store the JWT in localStorage — it lives in an httpOnly
  // cookie set by the backend. We do cache the user profile so the shell
  // can render instantly on reload; the cached value is validated against
  // /api/auth/me on mount and discarded if the session is no longer valid.
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch {
        return null;
      }
    }
    return null;
  });
  // Start in loading mode if we have a cached user — the session may have
  // expired and we don't know until /me responds.
  const [isLoading, setIsLoading] = useState(() => !!localStorage.getItem('user'));
  const [showWarning, setShowWarning] = useState(false);
  const [capabilities, setCapabilities] = useState<string[]>(() => {
    // Restore from localStorage so UI doesn't flash unauthorized on reload.
    const saved = localStorage.getItem('capabilities');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const lastActivityRef = useRef(Date.now());
  const showWarningRef = useRef(false);
  const isAuthenticated = !!user;

  // Fetch + cache the user's effective capabilities. Keeps stale cache on
  // failure so a transient backend hiccup doesn't wipe every gated UI.
  const fetchCapabilities = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me/capabilities`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const caps: string[] = Array.isArray(data?.capabilities) ? data.capabilities : [];
        setCapabilities(caps);
        localStorage.setItem('capabilities', JSON.stringify(caps));
      }
    } catch {
      // keep stale cache on network error
    }
  }, []);

  const refreshCapabilities = useCallback(async () => {
    await fetchCapabilities();
  }, [fetchCapabilities]);

  const can = useCallback((cap: string) => matchesCapability(cap, capabilities), [capabilities]);

  const logout = useCallback(async () => {
    // Tell the backend to clear the cookie. Best-effort: if the request
    // fails the cookie will still be cleared on the next load via its
    // max-age, and we always clear local state.
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    setUser(null);
    showWarningRef.current = false;
    setShowWarning(false);
    setCapabilities([]);
    localStorage.removeItem('user');
    localStorage.removeItem('capabilities');
    resetAuthFailureLatch();
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        // Refresh capabilities alongside user so the two stay in sync.
        fetchCapabilities();
      } else {
        // Cookie missing or expired — clear local user.
        setUser(null);
        setCapabilities([]);
        localStorage.removeItem('user');
        localStorage.removeItem('capabilities');
      }
    } catch {
      // Network error — keep cached user so the shell still renders; the
      // first real request to a protected endpoint will trigger the global
      // 401 handler if the session is actually gone.
    } finally {
      setIsLoading(false);
    }
  }, [fetchCapabilities]);

  // Validate the session on mount. checkAuth is intentionally excluded from
  // deps — we re-validate via the regular login flow, not by re-running.
  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wire the global 401 handler so any apiFetch landing on an expired
  // session triggers a single logout instead of leaving the UI staring at
  // silent failures.
  useEffect(() => {
    setAuthFailureHandler(() => {
      logout();
    });
    return () => setAuthFailureHandler(null);
  }, [logout]);

  // Activity tracking
  useEffect(() => {
    if (!isAuthenticated) return;

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      // No-op guard. mousedown/keydown/touchstart can fire several times per
      // second; without this, every event would re-render AuthProvider and
      // every useAuth() consumer. Only set state when the warning is up.
      if (showWarningRef.current) {
        showWarningRef.current = false;
        setShowWarning(false);
      }
    };

    // `mousemove` is excluded (60Hz noise; cursor motion is not engagement).
    // `scroll` is also excluded — it fires continuously during a scroll
    // gesture and adds nothing meaningful: the click/key/touch that
    // initiated the scroll already counted as activity, and a user who is
    // *only* scrolling (no clicks/keys/touch) for 23+ hours is exactly the
    // idle-warning case the timeout is meant to catch.
    const events = ['mousedown', 'keydown', 'touchstart'];
    events.forEach((event) => {
      document.addEventListener(event, updateActivity, true);
    });

    const interval = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= IDLE_TIMEOUT) {
        logout();
      } else if (idle >= WARNING_TIME && !showWarningRef.current) {
        showWarningRef.current = true;
        setShowWarning(true);
      }
    }, 60000);

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, updateActivity, true);
      });
      clearInterval(interval);
    };
  }, [isAuthenticated, logout]);

  const dismissWarning = useCallback(() => {
    showWarningRef.current = false;
    setShowWarning(false);
    lastActivityRef.current = Date.now();
  }, []);

  // All login endpoints set the auth cookie server-side; the response JSON
  // still carries the user profile so we can rehydrate state instantly.
  const finalizeLogin = useCallback(
    (profile: User) => {
      setUser(profile);
      localStorage.setItem('user', JSON.stringify(profile));
      lastActivityRef.current = Date.now();
      resetAuthFailureLatch();
      fetchCapabilities();
    },
    [fetchCapabilities],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();
      finalizeLogin(data.user);
    },
    [finalizeLogin],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      const response = await fetch(`${API_BASE_URL}/api/auth/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: idToken }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Google login failed');
      }

      const data = await response.json();
      finalizeLogin(data.user);
    },
    [finalizeLogin],
  );

  const loginDev = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/auth/dev-login`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Dev login unavailable (set DEV_AUTH_BYPASS=1 on backend)');
    }
    const data = await response.json();
    finalizeLogin(data.user);
  }, [finalizeLogin]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to change password');
    }

    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, is_first_login: false };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      login,
      loginWithGoogle,
      loginDev,
      logout,
      changePassword,
      checkAuth,
      showWarning,
      dismissWarning,
      capabilities,
      can,
      refreshCapabilities,
    }),
    [
      user,
      isLoading,
      isAuthenticated,
      showWarning,
      login,
      loginWithGoogle,
      loginDev,
      logout,
      changePassword,
      checkAuth,
      dismissWarning,
      capabilities,
      can,
      refreshCapabilities,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
