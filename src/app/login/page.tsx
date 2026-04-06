'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/components/UserContext';

type Tab = 'password' | 'code';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/learn';
  const { login, user } = useUser();

  const [tab, setTab] = useState<Tab>('code');

  // 邮箱密码登录
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 运动骇客验证码登录
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace(redirect);
  }, [user, redirect, router]);

  // ── 邮箱登录 ───────────────────────────────────────────────────
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        login(data.token, data.user);
        router.replace(redirect);
      } else {
        setError(data.error || '登录失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  // ── 验证码登录 ─────────────────────────────────────────────────
  function handleDigitChange(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  }

  function handleDigitKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  }

  function handleDigitPaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setDigits(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  }

  async function handleCodeLogin(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== 6) { setError('请输入完整的6位验证码'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/user/code-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        login(data.token, data.user);
        router.replace(redirect);
      } else {
        setError(data.error || '验证码无效');
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  const tabStyle = (active: boolean) => ({
    flex: 1, padding: '9px 0', background: 'none', border: 'none',
    borderBottom: active ? '2px solid #7A6145' : '2px solid transparent',
    fontSize: 13, fontWeight: active ? 600 : 400,
    color: active ? '#2E2118' : '#8A8078',
    cursor: 'pointer', transition: 'color 0.15s', marginBottom: -1,
  } as const);

  const inp = {
    width: '100%', padding: '10px 12px', border: '1px solid #EDE5D8',
    borderRadius: 8, fontSize: 14, color: '#2E2118', background: '#FAF7F2',
    outline: 'none', boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF7F2', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400, background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 16, padding: '40px 36px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2E2118' }}>
            SUP Wiki
          </div>
          <div style={{ fontSize: 13, color: '#8A8078', marginTop: 6 }}>登录账号，保存学习进度</div>
        </div>

        {/* Tab 切换 */}
        <div style={{ display: 'flex', borderBottom: '1px solid #EDE5D8', marginBottom: 24 }}>
          <button style={tabStyle(tab === 'code')} onClick={() => { setTab('code'); setError(''); }}>
            运动骇客码
          </button>
          <button style={tabStyle(tab === 'password')} onClick={() => { setTab('password'); setError(''); }}>
            邮箱登录
          </button>
        </div>

        {/* ── 验证码 Tab ── */}
        {tab === 'code' && (
          <form onSubmit={handleCodeLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#8A8078', marginBottom: 16, lineHeight: 1.6 }}>
                在「运动骇客」小程序中获取<br />
                <span style={{ color: '#2E2118', fontWeight: 500 }}>6 位登录验证码</span>，输入后直接登录
              </div>

              {/* 6 位数字输入框 */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }} onPaste={handleDigitPaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleDigitChange(i, e.target.value)}
                    onKeyDown={e => handleDigitKeyDown(i, e)}
                    style={{
                      width: 46, height: 56,
                      textAlign: 'center',
                      fontSize: 24, fontWeight: 700, color: '#2E2118',
                      background: d ? '#F5EFE8' : '#FAF7F2',
                      border: `1.5px solid ${d ? '#C4A882' : '#EDE5D8'}`,
                      borderRadius: 10, outline: 'none',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div style={{ fontSize: 13, color: '#c0392b', background: '#FDEDEC', padding: '8px 12px', borderRadius: 6, textAlign: 'center' }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading || digits.join('').length !== 6}
              style={{ padding: '12px', background: digits.join('').length === 6 ? '#7A6145' : '#C0B4A4', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: loading || digits.join('').length !== 6 ? 'default' : 'pointer', transition: 'background 0.15s' }}
            >
              {loading ? '验证中...' : '登录'}
            </button>

            <div style={{ textAlign: 'center', fontSize: 12, color: '#C0B4A4' }}>
              验证码在小程序内有效期通常为 5 分钟
            </div>
          </form>
        )}

        {/* ── 邮箱密码 Tab ── */}
        {tab === 'password' && (
          <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#8A8078', marginBottom: 6 }}>邮箱</label>
              <input type="email" required autoComplete="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#8A8078', marginBottom: 6 }}>密码</label>
              <input type="password" required autoComplete="current-password" value={password}
                onChange={e => setPassword(e.target.value)} placeholder="至少6位" style={inp} />
            </div>

            {error && (
              <div style={{ fontSize: 13, color: '#c0392b', background: '#FDEDEC', padding: '8px 12px', borderRadius: 6 }}>{error}</div>
            )}

            <button
              type="submit" disabled={loading}
              style={{ padding: '12px', background: '#7A6145', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? '登录中...' : '登录'}
            </button>

            <div style={{ textAlign: 'center', fontSize: 13, color: '#8A8078' }}>
              还没有账号？
              <Link href={`/register?redirect=${encodeURIComponent(redirect)}`} style={{ color: '#7A6145', marginLeft: 4, textDecoration: 'none' }}>
                立即注册
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>加载中...</div>}>
      <LoginForm />
    </Suspense>
  );
}
