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
  { href: '/admin', label: '仪表板', exact: true },
  { href: '/admin/brands', label: '品牌' },
  { href: '/admin/products', label: '产品' },
  { href: '/admin/athletes', label: '运动员' },
  { href: '/admin/creators', label: '博主' },
  { href: '/admin/events', label: '赛事' },
  { href: '/admin/articles', label: '文章' },
  { href: '/admin/learn-questions', label: '题库' },
  { href: '/admin/shop', label: '商城' },
  { href: '/admin/import', label: '批量导入' },
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
        setError(data.error || '密码错误');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: '#FAF7F2' }}
    >
      <div style={{ width: 360 }}>
        {/* Logo mark */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
            style={{ background: '#3D3226' }}
          >
            <span style={{ fontSize: 20 }}>🏄</span>
          </div>
          <h1
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 22,
              fontWeight: 600,
              color: '#3D3226',
              letterSpacing: '-0.02em',
            }}
          >
            SUP Wiki
          </h1>
          <p style={{ fontSize: 13, color: '#8B8580', marginTop: 4 }}>管理后台</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入管理密码"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #E0D8CC',
                borderRadius: 10,
                background: '#FEFCF9',
                fontSize: 14,
                color: '#3D3226',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = '#8B7355'; e.target.style.boxShadow = '0 0 0 3px rgba(139,115,85,0.12)'; }}
              onBlur={e => { e.target.style.borderColor = '#E0D8CC'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
          {error && (
            <p style={{ fontSize: 13, color: '#c0392b', marginBottom: 12 }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px 0',
              background: loading ? '#B0A090' : '#3D3226',
              color: '#FAF7F2',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? '验证中…' : '进入后台'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---- Admin Shell ----
function AdminShell({
  token,
  logout,
  children,
}: {
  token: string;
  logout: () => void;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Derive current page title
  const currentNav = navItems.find(item =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href) && pathname !== '/admin'
  ) || navItems[0];

  return (
    <AdminAuthContext.Provider value={{ token, logout }}>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          background: '#F5F1EB',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: 14,
        }}
      >
        {/* ── Sidebar ── */}
        <aside
          style={{
            width: 220,
            background: '#2A2118',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            // Mobile: hidden by default
            ...(typeof window !== 'undefined' && window.innerWidth < 768
              ? {
                  position: 'fixed' as const,
                  inset: '0 auto 0 0',
                  zIndex: 60,
                  transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
                  transition: 'transform 0.2s ease',
                }
              : {}),
          }}
          className="md:flex md:static"
        >
          {/* Brand */}
          <div
            style={{
              padding: '24px 20px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  background: '#8B7355',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  flexShrink: 0,
                }}
              >
                🏄
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#FAF7F2',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.2,
                  }}
                >
                  SUP Wiki
                </div>
                <div style={{ fontSize: 11, color: '#6B6560', marginTop: 1 }}>
                  内容管理系统
                </div>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
            {navItems.map(item => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href) && pathname !== '/admin';
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 7,
                    marginBottom: 2,
                    color: isActive ? '#FAF7F2' : '#8B8580',
                    background: isActive ? 'rgba(139,115,85,0.25)' : 'transparent',
                    fontWeight: isActive ? 500 : 400,
                    textDecoration: 'none',
                    transition: 'all 0.1s',
                    fontSize: 13.5,
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                      (e.currentTarget as HTMLElement).style.color = '#E0D8CC';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = '#8B8580';
                    }
                  }}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <span
                      style={{
                        width: 3,
                        height: 3,
                        borderRadius: '50%',
                        background: '#C4A882',
                        marginRight: 10,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {!isActive && <span style={{ width: 13, flexShrink: 0 }} />}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Bottom actions */}
          <div
            style={{
              padding: '12px 8px 16px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: 7,
                marginBottom: 2,
                color: '#6B6560',
                textDecoration: 'none',
                fontSize: 13,
                transition: 'color 0.1s',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#E0D8CC')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#6B6560')}
            >
              <span style={{ marginRight: 8, fontSize: 11 }}>↗</span>
              查看前台
            </a>
            <button
              onClick={logout}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                padding: '8px 12px',
                borderRadius: 7,
                color: '#6B6560',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                transition: 'color 0.1s',
                textAlign: 'left',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#E0D8CC')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#6B6560')}
            >
              <span style={{ marginRight: 8, fontSize: 11 }}>←</span>
              退出登录
            </button>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="md:hidden"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              zIndex: 50,
            }}
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* ── Main area ── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {/* Top bar */}
          <header
            style={{
              height: 56,
              background: '#FAF7F2',
              borderBottom: '1px solid #EBE5DC',
              display: 'flex',
              alignItems: 'center',
              padding: '0 24px',
              flexShrink: 0,
              gap: 12,
            }}
          >
            {/* Mobile menu button */}
            <button
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: 4,
                cursor: 'pointer',
                color: '#6B6560',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>

            {/* Page title */}
            <span
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: 16,
                fontWeight: 600,
                color: '#3D3226',
                letterSpacing: '-0.01em',
              }}
            >
              {currentNav.label}
            </span>
          </header>

          {/* Content */}
          <main
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '28px 28px',
            }}
          >
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
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#FAF7F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#8B8580',
          fontSize: 13,
        }}
      >
        加载中…
      </div>
    );
  }

  if (!token) return <LoginScreen onLogin={handleLogin} />;

  return (
    <AdminShell token={token} logout={handleLogout}>
      {children}
    </AdminShell>
  );
}
