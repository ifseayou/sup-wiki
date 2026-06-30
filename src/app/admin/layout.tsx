'use client';

import { useState, useEffect, createContext, useContext, Suspense } from 'react';
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
const navGroups = [
  {
    key: 'dashboard',
    label: '仪表盘',
    icon: '⌂',
    items: [
      { href: '/admin', label: '后台首页', exact: true },
      { href: '/admin/quality', label: '质量仪表盘' },
    ],
  },
  {
    key: 'results',
    label: '赛事中心',
    icon: '◈',
    items: [
      { href: '/admin/events', label: '赛事' },
      { href: '/admin/event-submissions', label: '赛事提报审核' },
      { href: '/admin/results', label: '成绩明细' },
      { href: '/admin/annual-points', label: '年度积分' },
      { href: '/admin/annual-point-events', label: '积分赛事雷达' },
      { href: '/admin/event-result-submissions', label: '成绩册提交' },
      { href: '/admin/result-sources', label: '成绩来源' },
    ],
  },
  {
    key: 'athletes',
    label: '运动员中心',
    icon: '◎',
    items: [
      { href: '/admin/athletes', label: '运动员' },
      { href: '/admin/athlete-analytics', label: '运动员分析' },
      { href: '/admin/athlete-claims', label: '资料审批' },
      { href: '/admin/athlete-identities', label: '身份匹配' },
      { href: '/admin/athlete-transfer', label: '成绩迁移/回滚' },
      { href: '/admin/athlete-blacklist', label: '隐私黑名单' },
    ],
  },
  {
    key: 'industry',
    label: '行业组织',
    icon: '◉',
    items: [
      { href: '/admin/industry-submissions', label: '入驻审核' },
      { href: '/admin/club-claims', label: '俱乐部认领' },
      { href: '/admin/club-team-aliases', label: '队伍映射' },
      { href: '/admin/clubs', label: '俱乐部' },
      { href: '/admin/coach-certificate-checks', label: '教练员线索' },
      { href: '/admin/professionals', label: '专业人员' },
      { href: '/admin/professional-certificates', label: '证书资料' },
      { href: '/admin/club-members', label: '成员关系' },
    ],
  },
  {
    key: 'content',
    label: '内容资料',
    icon: '▤',
    items: [
      { href: '/admin/brands', label: '品牌' },
      { href: '/admin/products', label: '产品' },
      { href: '/admin/creators', label: '博主' },
      { href: '/admin/articles', label: '文章' },
      { href: '/admin/media', label: '图片库' },
      { href: '/admin/shop', label: '商城' },
    ],
  },
  {
    key: 'business',
    label: '经营管理',
    icon: '◐',
    items: [
      { href: '/admin/sales-orders', label: '销售订单' },
    ],
  },
  {
    key: 'learning',
    label: '学习体系',
    icon: '◇',
    items: [
      { href: '/admin/learn-questions', label: '题库' },
      { href: '/admin/learn-docs', label: '学习文档' },
      { href: '/admin/courses', label: '课程' },
      { href: '/admin/techniques', label: '技术动作库' },
    ],
  },
  {
    key: 'system',
    label: '系统管理',
    icon: '◍',
    items: [
      { href: '/admin/users', label: '用户管理' },
      { href: '/admin/mini-feedback', label: '用户反馈' },
      { href: '/admin/search-logs', label: '搜索日志' },
      { href: '/admin/mini-announcements', label: '首页公告' },
      { href: '/admin/privacy-policy', label: '隐私说明' },
      { href: '/admin/athlete-data-license', label: '数据许可协议' },
      { href: '/admin/privacy-requests', label: '隐私请求' },
    ],
  },
];

function isNavActive(pathname: string, item: { href: string; exact?: boolean }) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href) && pathname !== '/admin';
}

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);
  const activeGroupKey = navGroups.find(group => group.items.some(item => isNavActive(pathname, item)))?.key || 'dashboard';
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navGroups.map(group => [group.key, group.key === activeGroupKey || group.key === 'results']))
  );
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const isSidebarExpanded = isMobile || !sidebarCollapsed || sidebarHover;

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
          onMouseEnter={() => setSidebarHover(true)}
          onMouseLeave={() => setSidebarHover(false)}
          style={{
            width: isSidebarExpanded ? 220 : 18,
            background: 'linear-gradient(180deg, #102D29 0%, #201914 100%)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            transition: 'width 0.18s ease, transform 0.2s ease',
            overflow: 'hidden',
            // Mobile: hidden by default
            ...(isMobile
              ? {
                  position: 'fixed' as const,
                  inset: '0 auto 0 0',
                  zIndex: 60,
                  width: 220,
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
              borderBottom: '1px solid rgba(224,238,229,0.08)',
              opacity: isSidebarExpanded ? 1 : 0,
              pointerEvents: isSidebarExpanded ? 'auto' : 'none',
              transition: 'opacity 0.12s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  background: 'linear-gradient(145deg, #0F5C52, #A57A43)',
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
                <div style={{ fontSize: 11, color: '#9FB7AD', marginTop: 1 }}>
                  Admin Console
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSidebarCollapsed((value) => !value)}
                className="ml-auto hidden h-7 w-7 items-center justify-center rounded-md border border-white/10 text-[#9FB7AD] transition hover:border-white/20 hover:text-white md:inline-flex"
                aria-label={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
                title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
              >
                {sidebarCollapsed ? '›' : '‹'}
              </button>
            </div>
          </div>

          {/* Nav items */}
          <nav
            style={{
              flex: 1,
              padding: '14px 10px',
              overflowY: 'auto',
              opacity: isSidebarExpanded ? 1 : 0,
              pointerEvents: isSidebarExpanded ? 'auto' : 'none',
              transition: 'opacity 0.12s ease',
            }}
          >
            {navGroups.map(group => {
              const groupActive = group.items.some(item => isNavActive(pathname, item));
              const isOpen = groupActive || (openGroups[group.key] ?? false);
              return (
                <div key={group.key} style={{ marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={() => setOpenGroups(prev => ({ ...prev, [group.key]: !isOpen }))}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '9px 10px',
                      borderRadius: 8,
                      border: 'none',
                      background: groupActive ? 'rgba(21,154,122,0.14)' : 'transparent',
                      color: groupActive ? '#F5FBF8' : '#88A098',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textAlign: 'left',
                      boxShadow: groupActive ? 'inset 3px 0 0 #31C49B' : 'inset 3px 0 0 transparent',
                    }}
                  >
                    <span style={{ width: 16, color: groupActive ? '#77E0C0' : '#5F7870' }}>{group.icon}</span>
                    <span style={{ flex: 1 }}>{group.label}</span>
                    <span style={{ color: groupActive ? '#9DE8D1' : '#5F7870', fontSize: 11 }}>{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && (
                    <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: '1px solid rgba(157,232,209,0.12)' }}>
                      {group.items.map(item => {
                        const isActive = isNavActive(pathname, item);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '7px 10px 7px 14px',
                              borderRadius: 8,
                              marginBottom: 2,
                              color: isActive ? '#F7FFFB' : '#98A59F',
                              background: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
                              fontWeight: isActive ? 600 : 400,
                              textDecoration: 'none',
                              transition: 'all 0.1s',
                              fontSize: 13,
                            }}
                            onMouseEnter={e => {
                              if (!isActive) {
                                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                                (e.currentTarget as HTMLElement).style.color = '#E0EEE5';
                              }
                            }}
                            onMouseLeave={e => {
                              if (!isActive) {
                                (e.currentTarget as HTMLElement).style.background = 'transparent';
                                (e.currentTarget as HTMLElement).style.color = '#98A59F';
                              }
                            }}
                          >
                            {isActive && (
                              <span
                                style={{
                                  width: 3,
                                  height: 14,
                                  borderRadius: 3,
                                  background: '#31C49B',
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
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Bottom actions */}
          <div
            style={{
              padding: '12px 8px 16px',
              borderTop: '1px solid rgba(224,238,229,0.08)',
              opacity: isSidebarExpanded ? 1 : 0,
              pointerEvents: isSidebarExpanded ? 'auto' : 'none',
              transition: 'opacity 0.12s ease',
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
                color: '#88A098',
                textDecoration: 'none',
                fontSize: 13,
                transition: 'color 0.1s',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#E0EEE5')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#88A098')}
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
                color: '#88A098',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                transition: 'color 0.1s',
                textAlign: 'left',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#E0EEE5')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#88A098')}
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
          <button
            className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-[#E3D8C9] bg-[#FFFDF9]/95 text-[#6B6560] shadow-[0_10px_25px_rgba(74,58,38,0.14)] md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="打开后台导航"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Content */}
          <main
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '28px 28px',
              background:
                'radial-gradient(circle at 12% 4%, rgba(15,92,82,0.06), transparent 30%), #F7F3EC',
            }}
          >
            <Suspense fallback={null}>{children}</Suspense>
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
    const timer = window.setTimeout(() => {
      const saved = localStorage.getItem('admin_token');
      if (saved) setToken(saved);
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
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
