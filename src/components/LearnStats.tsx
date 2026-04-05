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

  const items = [
    {
      label: '题库总量',
      value: totalQuestions.toLocaleString(),
      unit: '题',
      color: '#7A6145',
      bg: '#F5EFE8',
    },
    ...(user && stats ? [
      {
        label: '已刷题目',
        value: stats.total_attempted.toLocaleString(),
        unit: '题',
        color: '#1A5276',
        bg: '#EBF5FB',
      },
      {
        label: '回答正确',
        value: stats.total_correct.toLocaleString(),
        unit: '题',
        color: '#0E6655',
        bg: '#E9F7EF',
      },
      {
        label: '回答错误',
        value: stats.total_wrong.toLocaleString(),
        unit: '题',
        color: stats.total_wrong > 0 ? '#c0392b' : '#8A8078',
        bg: stats.total_wrong > 0 ? '#FDEDEC' : '#F5F5F5',
      },
      ...(accuracy !== null ? [{
        label: '正确率',
        value: `${accuracy}`,
        unit: '%',
        color: accuracy >= 80 ? '#0E6655' : accuracy >= 60 ? '#B7470A' : '#c0392b',
        bg: accuracy >= 80 ? '#E9F7EF' : accuracy >= 60 ? '#FDF2E9' : '#FDEDEC',
      }] : []),
    ] : []),
  ];

  return (
    <div style={{
      display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
      background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 12,
      padding: '14px 18px', marginBottom: 32,
    }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: item.bg, borderRadius: 8, padding: '8px 14px',
          minWidth: 80,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: item.color, lineHeight: 1 }}>
              {item.value}<span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>{item.unit}</span>
            </div>
            <div style={{ fontSize: 11, color: '#8A8078', marginTop: 3 }}>{item.label}</div>
          </div>
        </div>
      ))}

      {!user && (
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#8A8078' }}>
          <Link href="/login?redirect=/learn" style={{ color: '#7A6145', textDecoration: 'none' }}>
            登录
          </Link>
          {' '}后记录学习进度
        </div>
      )}

      {user && stats && stats.total_attempted === 0 && (
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#A08060' }}>
          开始答题，自动记录进度 →
        </div>
      )}
    </div>
  );
}
