'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@/components/UserContext';

const navLinks = [
  { href: '/brands', label: '品牌' },
  { href: '/athletes', label: '运动员' },
  { href: '/creators', label: '博主' },
  { href: '/events', label: '赛事' },
  { href: '/shop', label: '商城' },
  { href: '/learn', label: '学习' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout, loading, hasSportHacker } = useUser();

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: '#FAF7F2', borderBottom: '1px solid #EDE5D8' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: 56 }}>

          <Link
            href="/"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 500,
              color: '#2E2118',
              textDecoration: 'none',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginRight: 'auto',
            }}
          >
            SUP Wiki
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }} className="hidden md:flex">
            {navLinks.map(link => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-item${active ? ' active' : ''}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* 用户区域 */}
          {!loading && (
            <div style={{ position: 'relative', marginLeft: 16 }} className="hidden md:block">
              {user ? (
                <>
                  <button
                    onClick={() => setUserMenuOpen(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid #EDE5D8', borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 13, color: '#655D56' }}
                  >
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#7A6145', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 600 }}>
                      {user.nickname.slice(0, 1).toUpperCase()}
                    </span>
                    {user.nickname}
                  </button>
                  {userMenuOpen && (
                    <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 10, minWidth: 140, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 100 }}>
                      <Link href="/my-learning" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: '#2E2118', textDecoration: 'none', borderBottom: '1px solid #EDE5D8' }}>📚 我的学习</Link>
                      <Link href="/my-training" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: '#2E2118', textDecoration: 'none', borderBottom: '1px solid #EDE5D8' }}>🏄 我的训练</Link>
                      {!hasSportHacker && (
                        <Link href="/link-account" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: '#7A6145', textDecoration: 'none', borderBottom: '1px solid #EDE5D8' }}>🔗 关联运动骇客</Link>
                      )}
                      <button onClick={() => { logout(); setUserMenuOpen(false); }} style={{ display: 'block', width: '100%', padding: '10px 16px', fontSize: 13, color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>退出登录</button>
                    </div>
                  )}
                </>
              ) : (
                <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{ fontSize: 13, color: '#7A6145', textDecoration: 'none', border: '1px solid #C4A882', borderRadius: 20, padding: '4px 14px' }}>
                  登录
                </Link>
              )}
            </div>
          )}

          <button
            className="md:hidden"
            onClick={() => setOpen(!open)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#655D56', marginLeft: 8 }}
            aria-label="菜单"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              {open ? (
                <path d="M4 4l12 12M4 16L16 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              ) : (
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>

        {open && (
          <nav style={{ borderTop: '1px solid #EDE5D8', padding: '12px 0 16px', display: 'flex', flexDirection: 'column', gap: 0 }} className="md:hidden">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                style={{ fontSize: 14, color: '#655D56', textDecoration: 'none', padding: '10px 0', borderBottom: '1px solid #F0E8DB', letterSpacing: '0.02em' }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
