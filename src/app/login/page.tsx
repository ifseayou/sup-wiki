'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/components/UserContext';

const SPORT_HACKER_QR = 'https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/public/1775813712802-9xmppk.jpg';

type Tab = 'qr' | 'code' | 'password';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/learn';
  const { login, user } = useUser();

  const [tab, setTab] = useState<Tab>('qr');

  // 邮箱密码登录
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 验证码登录
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace(redirect);
  }, [user, redirect, router]);

  // ── 邮箱登录 ──
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) { login(data.token, data.user); router.replace(redirect); }
      else setError(data.error || '登录失败');
    } catch { setError('网络错误，请稍后重试'); }
    finally { setLoading(false); }
  }

  // ── 验证码登录 ──
  function handleDigitChange(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...digits]; next[idx] = digit; setDigits(next);
    if (digit && idx < 5) inputRefs.current[idx + 1]?.focus();
  }
  function handleDigitKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
  }
  function handleDigitPaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) { e.preventDefault(); setDigits(pasted.split('')); inputRefs.current[5]?.focus(); }
  }
  async function handleCodeLogin(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== 6) { setError('请输入完整的6位验证码'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/user/code-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok && data.token) { login(data.token, data.user); router.replace(redirect); }
      else { setError(data.error || '验证码无效'); setDigits(['', '', '', '', '', '']); inputRefs.current[0]?.focus(); }
    } catch { setError('网络错误，请稍后重试'); }
    finally { setLoading(false); }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px', border: '1px solid #EDE5D8',
    borderRadius: 10, fontSize: 14, color: '#2E2118', background: '#FAF7F2',
    outline: 'none', boxSizing: 'border-box',
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px 0', background: 'none', border: 'none',
    borderBottom: active ? '2px solid #7A6145' : '2px solid transparent',
    fontSize: 13, fontWeight: active ? 600 : 400,
    color: active ? '#2E2118' : '#A08060',
    cursor: 'pointer', transition: 'all 0.15s',
  });

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #F5EFE6 0%, #FAF7F2 60%, #EDE5D8 100%)',
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: '#FEFCF9',
        border: '1px solid #EDE5D8',
        borderRadius: 20,
        boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>
        {/* ── 顶部品牌区 ── */}
        <div style={{
          padding: '32px 36px 24px',
          borderBottom: '1px solid #F0E8DB',
          textAlign: 'center',
          background: 'linear-gradient(to bottom, #FAF7F2, #FEFCF9)',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#2E2118',
            marginBottom: 6,
          }}>
            SUP Wiki
          </div>
          <div style={{ fontSize: 13, color: '#A08060', letterSpacing: '0.02em' }}>
            登录账号，解锁桨板学习全功能
          </div>
        </div>

        {/* ── Tab 切换 ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid #EDE5D8', padding: '0 36px' }}>
          <button style={tabBtn(tab === 'qr')} onClick={() => { setTab('qr'); setError(''); }}>
            扫码登录
          </button>
          <button style={tabBtn(tab === 'code')} onClick={() => { setTab('code'); setError(''); }}>
            验证码
          </button>
          <button style={tabBtn(tab === 'password')} onClick={() => { setTab('password'); setError(''); }}>
            邮箱
          </button>
        </div>

        <div style={{ padding: '28px 36px 32px' }}>

          {/* ── 扫码登录 Tab ── */}
          {tab === 'qr' && (
            <div style={{ textAlign: 'center' }}>
              {/* 步骤说明 */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
                {[
                  { step: '1', text: '扫描二维码' },
                  { step: '2', text: '打开小程序' },
                  { step: '3', text: '获取验证码' },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: '#F0E8DB', color: '#7A6145',
                        fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{s.step}</div>
                      <span style={{ fontSize: 11, color: '#A08060', whiteSpace: 'nowrap' }}>{s.text}</span>
                    </div>
                    {i < 2 && <div style={{ width: 20, height: 1, background: '#EDE5D8', marginBottom: 16, flexShrink: 0 }} />}
                  </div>
                ))}
              </div>

              {/* 二维码主体 */}
              <div style={{
                display: 'inline-block',
                padding: 14,
                background: '#fff',
                borderRadius: 16,
                border: '2px solid #EDE5D8',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                marginBottom: 16,
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={SPORT_HACKER_QR}
                  alt="运动骇客小程序二维码"
                  style={{ width: 180, height: 180, display: 'block', borderRadius: 8 }}
                />
              </div>

              <div style={{ fontSize: 15, fontWeight: 600, color: '#2E2118', marginBottom: 6 }}>
                运动骇客
              </div>
              <div style={{ fontSize: 13, color: '#8A8078', lineHeight: 1.7, marginBottom: 20 }}>
                微信扫码打开小程序<br />
                在「我的」页面获取 <span style={{ color: '#7A6145', fontWeight: 600 }}>6 位登录码</span>
              </div>

              {/* 切换到验证码输入 */}
              <button
                onClick={() => setTab('code')}
                style={{
                  width: '100%', padding: '12px',
                  background: '#7A6145', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: 14, fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                已获取验证码，去输入 →
              </button>
            </div>
          )}

          {/* ── 验证码 Tab ── */}
          {tab === 'code' && (
            <form onSubmit={handleCodeLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#8A8078', marginBottom: 6 }}>
                  在「运动骇客」小程序「我的」页面获取
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#2E2118', marginBottom: 20 }}>
                  6 位登录验证码
                </div>

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
                        width: 46, height: 58,
                        textAlign: 'center',
                        fontSize: 26, fontWeight: 700, color: '#2E2118',
                        background: d ? '#F5EFE8' : '#FAF7F2',
                        border: `2px solid ${d ? '#C4A882' : '#EDE5D8'}`,
                        borderRadius: 12, outline: 'none',
                        transition: 'all 0.15s',
                      }}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ fontSize: 13, color: '#c0392b', background: '#FDEDEC', padding: '8px 12px', borderRadius: 8, textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || digits.join('').length !== 6}
                style={{
                  padding: '13px',
                  background: digits.join('').length === 6 ? '#7A6145' : '#C0B4A4',
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: 14, fontWeight: 500,
                  cursor: digits.join('').length === 6 ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                }}
              >
                {loading ? '验证中...' : '登录'}
              </button>

              <button
                type="button"
                onClick={() => setTab('qr')}
                style={{ background: 'none', border: 'none', fontSize: 13, color: '#A08060', cursor: 'pointer' }}
              >
                ← 返回扫码
              </button>
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
                <div style={{ fontSize: 13, color: '#c0392b', background: '#FDEDEC', padding: '8px 12px', borderRadius: 8 }}>{error}</div>
              )}

              <button
                type="submit" disabled={loading}
                style={{ padding: '13px', background: '#7A6145', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? '登录中...' : '登录'}
              </button>

              <div style={{ textAlign: 'center', fontSize: 13, color: '#8A8078' }}>
                还没有账号？
                <Link href={`/register?redirect=${encodeURIComponent(redirect)}`} style={{ color: '#7A6145', marginLeft: 4, textDecoration: 'none', fontWeight: 500 }}>
                  立即注册
                </Link>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF7F2' }}>加载中...</div>}>
      <LoginForm />
    </Suspense>
  );
}
