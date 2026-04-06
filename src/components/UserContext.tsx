'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
  user_id: number;
  nickname: string;
  email: string;
}

interface UserContextValue {
  user: User | null;
  token: string | null;
  hasSportHacker: boolean;   // 是否已关联运动骇客账号
  login: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
  refreshUser: () => void;   // 关联账号后刷新状态
}

const UserContext = createContext<UserContextValue>({
  user: null, token: null, hasSportHacker: false,
  login: () => {}, logout: () => {}, loading: true, refreshUser: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hasSportHacker, setHasSportHacker] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback((savedToken: string) => {
    return fetch('/api/user/me', { headers: { Authorization: `Bearer ${savedToken}` } })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setToken(savedToken);
          setUser(data.user);
          setHasSportHacker(!!data.user.has_sport_hacker);
          return true;
        } else {
          localStorage.removeItem('sup_user_token');
          return false;
        }
      })
      .catch(() => { localStorage.removeItem('sup_user_token'); return false; });
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('sup_user_token');
    if (saved) {
      loadUser(saved).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [loadUser]);

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem('sup_user_token', newToken);
    setToken(newToken);
    setUser(newUser);
    setHasSportHacker(!!(newUser as User & { has_sport_hacker?: boolean }).has_sport_hacker);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('sup_user_token');
    setToken(null);
    setUser(null);
    setHasSportHacker(false);
  }, []);

  const refreshUser = useCallback(() => {
    const saved = localStorage.getItem('sup_user_token');
    if (saved) loadUser(saved);
  }, [loadUser]);

  return (
    <UserContext.Provider value={{ user, token, hasSportHacker, login, logout, loading, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
