'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '@/components/UserContext';

interface Stats {
  total_attempted: number;
  total_correct: number;
  total_wrong: number;
}

interface Props {
  totalQuestions: number;
}

export default function LearnStats({ totalQuestions }: Props) {
  const { user, token } = useUser();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/user/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (typeof d.total_attempted === 'number') setStats(d);
      })
      .catch(() => {});
  }, [token]);

  const accuracy = stats && stats.total_attempted > 0
    ? Math.round((stats.total_correct / stats.total_attempted) * 100)
    : null;

  const hasStarted = stats && stats.total_attempted > 0;

  return (
    <div style={{
      display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
      background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 12,
      padding: '14px 18px', marginBottom: 32,
    }}>
      {/* 题库总量 — 始终显示 */}
      <div style={{ background: '#F5EFE8', borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#7A6145', lineHeight: 1 }}>
          {totalQuestions.toLocaleString()}<span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>题</span>
        </div>
        <div style={{ fontSize: 11, color: '#8A8078', marginTop: 3 }}>题库总量</div>
      </div>

      {/* 已有答题记录才展示详细统计 */}
      {user && hasStarted && (
        <>
          <div style={{ width: 1, height: 36, background: '#EDE5D8', flexShrink: 0 }} />

          {[
            { label: '已刷题目', value: stats!.total_attempted, color: '#1A5276', bg: '#EBF5FB' },
            { label: '回答正确', value: stats!.total_correct, color: '#0E6655', bg: '#E9F7EF' },
            { label: '回答错误', value: stats!.total_wrong, color: stats!.total_wrong > 0 ? '#c0392b' : '#8A8078', bg: stats!.total_wrong > 0 ? '#FDEDEC' : '#F5F5F5' },
          ].map((item, i) => (
            <div key={i} style={{ background: item.bg, borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: item.color, lineHeight: 1 }}>
                {item.value.toLocaleString()}<span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>题</span>
              </div>
              <div style={{ fontSize: 11, color: '#8A8078', marginTop: 3 }}>{item.label}</div>
            </div>
          ))}

          {accuracy !== null && (
            <div style={{
              background: accuracy >= 80 ? '#E9F7EF' : accuracy >= 60 ? '#FDF2E9' : '#FDEDEC',
              borderRadius: 8, padding: '8px 14px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, color: accuracy >= 80 ? '#0E6655' : accuracy >= 60 ? '#B7470A' : '#c0392b' }}>
                {accuracy}<span style={{ fontSize: 12, fontWeight: 400, marginLeft: 1 }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: '#8A8078', marginTop: 3 }}>正确率</div>
            </div>
          )}
        </>
      )}

      {/* 右侧引导文字 */}
      <div style={{ marginLeft: 'auto', fontSize: 13, color: '#A08060' }}>
        {!user ? (
          <>
            <Link href="/login?redirect=/learn" style={{ color: '#7A6145', textDecoration: 'none', fontWeight: 500 }}>登录</Link>
            {' '}后自动记录答题进度
          </>
        ) : !hasStarted ? (
          '开始答题，自动记录进度 →'
        ) : (
          <Link href="/my-learning" style={{ color: '#7A6145', textDecoration: 'none' }}>查看学习记录 →</Link>
        )}
      </div>
    </div>
  );
}
