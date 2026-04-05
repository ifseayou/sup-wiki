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
  login: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
}

const UserContext = createContext<UserContextValue>({
  user: null, token: null,
  login: () => {}, logout: () => {},
  loading: true,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('sup_user_token');
    if (saved) {
      // 验证 token 是否仍有效
      fetch('/api/user/me', { headers: { Authorization: `Bearer ${saved}` } })
        .then(r => r.json())
        .then(data => {
          if (data.user) {
            setToken(saved);
            setUser(data.user);
          } else {
            localStorage.removeItem('sup_user_token');
          }
        })
        .catch(() => localStorage.removeItem('sup_user_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem('sup_user_token', newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('sup_user_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <UserContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
