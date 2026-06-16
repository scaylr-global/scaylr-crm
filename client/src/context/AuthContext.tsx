import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, getToken, setToken, clearToken, User } from '../lib/api';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage (no server round-trip needed)
    const stored = getToken();
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { clearToken(); }
    }
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const r = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    setToken(JSON.stringify(r.user));
    setUser(r.user);
  }

  function logout() {
    clearToken();
    setUser(null);
    window.location.hash = '/login';
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
