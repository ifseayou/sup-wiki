'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ---- Auth Context ----
interface AdminAuthCtx {
  token: string;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthCtx | null>(null);

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminLayout');
  return ctx;
}

// ---- Nav config ----
const navItems = [
  { href: '/admin', label: '仪表板', icon: '📊', exact: true },
  { href: '/admin/brands', label: '品牌', icon: '🏷️' },
  { href: '/admin/products', label: '产品', icon: '🏄' },
  { href: '/admin/athletes', label: '运动员', icon: '🏆' },
  { href: '/admin/creators', label: '博主', icon: '📱' },
  { href: '/admin/events', label: '赛事', icon: '🗓️' },
  { href: '/admin/import', label: '批量导入', icon: '📥' },
];

// ---- Login Screen ----
function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        onLogin(data.token);
      } else {
        setError(data.error || '登录失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center px-4">
      <div className="bg-cream-50 border border-cream-200 rounded-2xl p-8 w-full max-w-sm shadow-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🏄</span>
          <h1 className="text-xl font-bold text-brown-800 mt-3">SUP Wiki 管理后台</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-warm-gray-500 mb-1.5">管理密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-cream-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800"
              placeholder="请输入密码"
              autoFocus
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brown-500 text-white rounded-lg hover:bg-brown-600 transition-colors font-medium disabled:opacity-50"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---- Admin Shell ----
function AdminShell({ token, logout, children }: { token: string; logout: () => void; children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AdminAuthContext.Provider value={{ token, logout }}>
      <div className="min-h-screen bg-cream-100 flex">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-56 bg-brown-800 flex flex-col transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:flex`}>
          {/* Logo */}
          <div className="h-16 flex items-center px-5 border-b border-brown-700">
            <span className="text-xl">🏄</span>
            <span className="ml-2 font-bold text-cream-50">SUP Wiki Admin</span>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-4 overflow-y-auto">
            {navItems.map(item => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href) && pathname !== '/admin';
              const isActive = item.exact ? pathname === item.href : active;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-brown-700 text-cream-50'
                      : 'text-cream-300 hover:bg-brown-700 hover:text-cream-50'
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-brown-700">
            <button
              onClick={logout}
              className="w-full text-sm text-cream-300 hover:text-cream-50 transition-colors py-2"
            >
              退出登录
            </button>
          </div>
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="h-16 bg-cream-50 border-b border-cream-200 flex items-center px-4 md:px-6">
            <button
              className="md:hidden mr-3 p-2 text-warm-gray-500"
              onClick={() => setSidebarOpen(true)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex-1" />
            <Link href="/" target="_blank" className="text-sm text-warm-gray-400 hover:text-brown-500 transition-colors">
              查看前台 →
            </Link>
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </AdminAuthContext.Provider>
  );
}

// ---- Root Layout ----
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('admin_token');
    if (saved) setToken(saved);
    setLoading(false);
  }, []);

  function handleLogin(t: string) {
    localStorage.setItem('admin_token', t);
    setToken(t);
  }

  function handleLogout() {
    localStorage.removeItem('admin_token');
    setToken(null);
  }

  if (loading) {
    return <div className="min-h-screen bg-cream-100 flex items-center justify-center"><span className="text-warm-gray-400">加载中...</span></div>;
  }

  if (!token) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <AdminShell token={token} logout={handleLogout}>{children}</AdminShell>;
}
