'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

const navLinks = [
  { href: '/brands', label: '品牌' },
  { href: '/products', label: '产品' },
  { href: '/athletes', label: '运动员' },
  { href: '/creators', label: '博主' },
  { href: '/events', label: '赛事' },
  { href: '/learn', label: '学习' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
