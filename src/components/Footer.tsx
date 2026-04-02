import Link from 'next/link';

const links = [
  { href: '/brands', label: '品牌' },
  { href: '/products', label: '产品' },
  { href: '/athletes', label: '运动员' },
  { href: '/creators', label: '博主' },
  { href: '/events', label: '赛事' },
];

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid #EDE5D8', background: '#FAF7F2' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 32 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2E2118', marginBottom: 10 }}>
              SUP Wiki
            </div>
            <p style={{ fontSize: 12, color: '#A08060', maxWidth: 300, lineHeight: 1.75, margin: 0 }}>
              桨板运动资讯百科。收录品牌、产品、运动员、博主与赛事信息。
            </p>
          </div>
          <nav style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {links.map(link => (
              <Link key={link.href} href={link.href} className="footer-link">{link.label}</Link>
            ))}
          </nav>
        </div>
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid #EDE5D8', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#C0B4A4', letterSpacing: '0.04em' }}>© {new Date().getFullYear()} SUP Wiki</span>
          <span style={{ fontSize: 11, color: '#C0B4A4', letterSpacing: '0.04em' }}>由运动骇客团队维护</span>
        </div>
      </div>
    </footer>
  );
}
