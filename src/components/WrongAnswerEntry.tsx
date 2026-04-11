'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '@/components/UserContext';

interface WrongItem { question_id: number; wrong_count: number }

export default function WrongAnswerEntry() {
  const { user, token } = useUser();
  const [items, setItems] = useState<WrongItem[] | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/user/wrong-answers', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.wrong_answers)) setItems(d.wrong_answers); })
      .catch(() => {});
  }, [token]);

  // 未登录：不展示
  if (!user) return null;
  // 已登录但暂无错题：不展示
  if (items !== null && items.length === 0) return null;

  const count = items?.length ?? null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #7B241C 0%, #C0392B 100%)',
      borderRadius: 16, padding: '24px 28px', marginBottom: 24,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
    }}>
      <div>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
          Wrong Answer Review
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>错题专项练习</span>
          {count !== null && (
            <span style={{
              fontSize: 13, fontWeight: 700,
              background: 'rgba(255,255,255,0.2)', color: '#fff',
              padding: '2px 10px', borderRadius: 20,
            }}>
              {count} 道
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
          针对你的薄弱点，每轮最多抽取 20 题，答对即从错题库移除
        </div>
      </div>
      <Link
        href="/learn/quiz?mode=wrong"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)',
          color: '#fff', fontWeight: 600,
          padding: '12px 24px', borderRadius: 10, fontSize: 14,
          textDecoration: 'none', whiteSpace: 'nowrap',
          backdropFilter: 'blur(4px)',
        }}
      >
        开始练习 →
      </Link>
    </div>
  );
}
