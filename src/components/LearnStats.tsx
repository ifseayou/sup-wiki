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

  const attempted = stats?.total_attempted || 0;
  const progress = totalQuestions > 0 ? Math.min(100, Math.round((attempted / totalQuestions) * 100)) : 0;

  return (
    <section className="learn-stats">
      <div className="learn-stats__icon">▰</div>
      <div className="learn-stats__total">
        <strong>{totalQuestions.toLocaleString()}</strong><span>题</span>
        <small>题库总量</small>
      </div>
      <div className="learn-stats__divider" />
      <div className="learn-stats__body">
        <div className="learn-stats__title">
          {user ? '系统已自动记录答题进度' : '登录后自动记录答题进度'}
        </div>
        <div className="learn-stats__subtitle">
          {user ? `已练习 ${attempted.toLocaleString()} 题，继续保持系统训练。` : '登录后，系统将为你保存练习与测验进度'}
        </div>
        <div className="learn-stats__bar" aria-label="学习进度">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="learn-stats__percent">{progress}%</div>
      <Link href={user ? '/my-learning' : '/login?redirect=/learn'} className="learn-stats__cta">
        {user ? '查看记录' : '登录开启记录'}
      </Link>
    </section>
  );
}
