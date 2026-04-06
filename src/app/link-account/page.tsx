'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/components/UserContext';

export default function LinkAccountPage() {
  const router = useRouter();
  const { user, token, loading } = useUser();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login?redirect=/link-account');
  }, [loading, user, router]);

  function handleDigitChange(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    if (digit && idx < 5) inputRefs.current[idx + 1]?.focus();
  }

  function handleDigitKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) { e.preventDefault(); setDigits(pasted.split('')); inputRefs.current[5]?.focus(); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== 6) return;
    setStatus('loading');
    setMsg('');
    try {
      const res = await fetch('/api/user/link-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setMsg(data.message || '账号关联成功！');
      } else {
        setStatus('error');
        setMsg(data.error || '关联失败');
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setStatus('error');
      setMsg('网络错误，请重试');
    }
  }

  if (loading || !user) return null;

  const code = digits.join('');
  const hasOpenid = false; // 可扩展：从 /api/user/me 获取是否已关联

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 16, padding: '40px 36px' }}>

        <div style={{ marginBottom: 28 }}>
          <Link href="/my-learning" style={{ fontSize: 13, color: '#8A8078', textDecoration: 'none' }}>← 返回</Link>
        </div>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: '#2E2118', marginBottom: 8 }}>
            关联运动骇客账号
          </div>
          <p style={{ fontSize: 13, color: '#8A8078', lineHeight: 1.7, margin: 0 }}>
            在「运动骇客」小程序中获取 6 位验证码，输入后即可将两个账号关联。
            关联后可以用验证码或邮箱密码任意方式登录同一账号。
          </p>
        </div>

        {/* 当前账号信息 */}
        <div style={{ background: '#F5EFE8', borderRadius: 8, padding: '10px 14px', marginBottom: 24, fontSize: 13, color: '#7A6145' }}>
          当前账号：<strong>{user.nickname}</strong>（{user.email}）
        </div>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#0E6655', marginBottom: 8 }}>{msg}</div>
            <p style={{ fontSize: 13, color: '#8A8078', marginBottom: 20 }}>
              现在可以用运动骇客验证码或邮箱密码登录同一账号。
            </p>
            <Link href="/my-learning" style={{ color: '#7A6145', textDecoration: 'none', fontSize: 14 }}>
              返回我的学习 →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#8A8078', marginBottom: 16 }}>输入运动骇客 6 位验证码</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }} onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    type="text" inputMode="numeric" maxLength={1} value={d}
                    onChange={e => handleDigitChange(i, e.target.value)}
                    onKeyDown={e => handleDigitKeyDown(i, e)}
                    style={{
                      width: 46, height: 56, textAlign: 'center',
                      fontSize: 24, fontWeight: 700, color: '#2E2118',
                      background: d ? '#F5EFE8' : '#FAF7F2',
                      border: `1.5px solid ${d ? '#C4A882' : '#EDE5D8'}`,
                      borderRadius: 10, outline: 'none', transition: 'all 0.15s',
                    }}
                  />
                ))}
              </div>
            </div>

            {status === 'error' && (
              <div style={{ fontSize: 13, color: '#c0392b', background: '#FDEDEC', padding: '8px 12px', borderRadius: 6, textAlign: 'center' }}>
                {msg}
              </div>
            )}

            <button
              type="submit" disabled={status === 'loading' || code.length !== 6}
              style={{ padding: '12px', background: code.length === 6 ? '#7A6145' : '#C0B4A4', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: code.length === 6 ? 'pointer' : 'default', transition: 'background 0.15s' }}
            >
              {status === 'loading' ? '关联中...' : '确认关联'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
