'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '@/components/UserContext';

export default function BookmarkEntry() {
  const { user, token } = useUser();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/user/bookmarks', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.bookmarks)) setCount(d.bookmarks.length); })
      .catch(() => {});
  }, [token]);

  if (!user || (count !== null && count === 0)) return null;

  return (
    <div style={{
      background: '#FEFCF9',
      border: '1px solid #EDE5D8',
      borderLeft: '3px solid #7A6145',
      borderRadius: 10,
      padding: '18px 22px',
      marginBottom: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#A08060', marginBottom: 6 }}>
          Bookmarked Questions
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#2E2118' }}>收藏题练习</span>
          {count !== null && (
            <span style={{ fontSize: 11, background: '#F5EFE8', color: '#7A6145', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
              {count} 道
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#8B7355', lineHeight: 1.5 }}>
          专门练习你收藏的题目，巩固重点内容
        </div>
      </div>
      <Link
        href="/learn/quiz?mode=bookmark"
        style={{
          padding: '9px 20px',
          background: '#7A6145',
          color: '#fff',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        开始练习 →
      </Link>
    </div>
  );
}
