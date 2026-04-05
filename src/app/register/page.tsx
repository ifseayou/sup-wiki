'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/components/UserContext';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/learn';
  const { login, user } = useUser();

  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace(redirect);
  }, [user, redirect, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, email, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        login(data.token, data.user);
        router.replace(redirect);
      } else {
        setError(data.error || '注册失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF7F2', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400, background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 16, padding: '40px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2E2118' }}>
            SUP Wiki
          </div>
          <div style={{ fontSize: 13, color: '#8A8078', marginTop: 6 }}>创建账号，开始系统学习</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#8A8078', marginBottom: 6 }}>昵称</label>
            <input
              type="text" required
              value={nickname} onChange={e => setNickname(e.target.value)}
              placeholder="桨板爱好者"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #EDE5D8', borderRadius: 8, fontSize: 14, color: '#2E2118', background: '#FAF7F2', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#8A8078', marginBottom: 6 }}>邮箱</label>
            <input
              type="email" required autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #EDE5D8', borderRadius: 8, fontSize: 14, color: '#2E2118', background: '#FAF7F2', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#8A8078', marginBottom: 6 }}>密码</label>
            <input
              type="password" required autoComplete="new-password"
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="至少6位"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #EDE5D8', borderRadius: 8, fontSize: 14, color: '#2E2118', background: '#FAF7F2', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {error && <div style={{ fontSize: 13, color: '#c0392b', background: '#FDEDEC', padding: '8px 12px', borderRadius: 6 }}>{error}</div>}

          <button
            type="submit" disabled={loading}
            style={{ padding: '12px', background: '#7A6145', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? '注册中...' : '注册并登录'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#8A8078' }}>
          已有账号？
          <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} style={{ color: '#7A6145', marginLeft: 4, textDecoration: 'none' }}>
            去登录
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>加载中...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
