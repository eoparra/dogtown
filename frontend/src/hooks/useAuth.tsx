import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@/types';
import { auth } from '@/services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, name: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // When the tab regains focus, re-verify the session in case the user
  // logged out in another tab.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        auth.me()
          .then(({ user }) => setUser(user))
          .catch(() => setUser(null));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // If any API call returns 401, immediately clear the session.
  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (email: string, password: string) => {
    const { user } = await auth.login({ email, password });
    setUser(user);
    return user;
  };

  const register = async (email: string, password: string, name: string, phone?: string) => {
    const { user } = await auth.register({ email, password, name, phone });
    setUser(user);
  };

  const logout = async () => {
    await auth.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
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
