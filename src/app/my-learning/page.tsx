'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/components/UserContext';

interface Question {
  question_id: number;
  question: string;
  type: string;
  options: string[];
  correct: number | number[];
  explanation: string | null;
  category: string;
  difficulty: string;
}

interface WrongRecord {
  question_id: number;
  wrong_count: number;
}

const CAT_LABELS: Record<string, string> = {
  equipment: '装备', technique: '技术', race: '竞赛',
  safety: '安全', maintenance: '保养', history: '历史',
};
const DIFF_LABELS: Record<string, string> = {
  beginner: '入门', intermediate: '进阶', advanced: '高级',
};
const DIFF_COLORS: Record<string, string> = {
  beginner: '#0E6655', intermediate: '#B7470A', advanced: '#6C3483',
};

function QuestionCard({
  q, wrongCount, bookmarked, onToggleBookmark,
}: {
  q: Question; wrongCount?: number; bookmarked: boolean; onToggleBookmark: (qid: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const correctArr = Array.isArray(q.correct) ? q.correct as number[] : [q.correct as number];

  return (
    <div style={{
      background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 10,
      overflow: 'hidden', transition: 'box-shadow 0.15s',
    }}>
      {/* 头部 */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start' }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, background: '#F0EAE0', color: '#7A6145', padding: '1px 6px', borderRadius: 8 }}>
              {CAT_LABELS[q.category] || q.category}
            </span>
            <span style={{ fontSize: 10, background: `${DIFF_COLORS[q.difficulty]}18`, color: DIFF_COLORS[q.difficulty], padding: '1px 6px', borderRadius: 8 }}>
              {DIFF_LABELS[q.difficulty] || q.difficulty}
            </span>
            {wrongCount !== undefined && (
              <span style={{ fontSize: 10, background: '#FDEDEC', color: '#c0392b', padding: '1px 6px', borderRadius: 8 }}>
                ❌ 错误 {wrongCount} 次
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, color: '#2E2118', lineHeight: 1.55 }}>
            {q.question}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* 收藏按钮 */}
          <button
            onClick={e => { e.stopPropagation(); onToggleBookmark(q.question_id); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '2px 4px' }}
            title="取消收藏"
          >
            {bookmarked ? '⭐' : '☆'}
          </button>
          <span style={{ fontSize: 12, color: '#C0B4A4', transition: 'transform 0.15s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</span>
        </div>
      </div>

      {/* 展开内容：答案 + 解析 */}
      {expanded && (
        <div style={{ borderTop: '1px solid #EDE5D8', padding: '14px 16px', background: '#FAF7F2' }}>
          <div style={{ fontSize: 12, color: '#8A8078', marginBottom: 8 }}>正确答案：</div>
          {q.options.map((opt, idx) => {
            const isCorrect = correctArr.includes(idx);
            return (
              <div key={idx} style={{
                padding: '8px 12px', marginBottom: 4, borderRadius: 6,
                background: isCorrect ? '#E9F7EF' : '#F7F7F7',
                border: `1px solid ${isCorrect ? '#A9DFBF' : '#EDE5D8'}`,
                fontSize: 13, color: isCorrect ? '#0E6655' : '#655D56',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontWeight: 600 }}>{String.fromCharCode(65 + idx)}.</span>
                {isCorrect && <span>✓</span>}
                {opt}
              </div>
            );
          })}
          {q.explanation && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#FFF8F0', border: '1px solid #F0E0C0', borderRadius: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#7A6145' }}>💡 解析　</span>
              <span style={{ fontSize: 13, color: '#3D3730', lineHeight: 1.7 }}>{q.explanation}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MyLearningPage() {
  const { user, token, loading } = useUser();
  const router = useRouter();

  const [tab, setTab] = useState<'bookmarks' | 'wrong'>('bookmarks');
  const [bookmarkIds, setBookmarkIds] = useState<number[]>([]);
  const [wrongRecords, setWrongRecords] = useState<WrongRecord[]>([]);
  const [questions, setQuestions] = useState<Record<number, Question>>({});
  const [fetching, setFetching] = useState(true);

  // 未登录跳转
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login?redirect=/my-learning');
    }
  }, [loading, user, router]);

  // 加载收藏 + 错题
  useEffect(() => {
    if (!token) return;
    setFetching(true);

    Promise.all([
      fetch('/api/user/bookmarks', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/user/wrong-answers', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(async ([bData, wData]) => {
      const bIds: number[] = bData.bookmarks || [];
      const wRecs: WrongRecord[] = wData.wrong_answers || [];
      setBookmarkIds(bIds);
      setWrongRecords(wRecs);

      // 收集所有需要加载的题目 ID
      const allIds = [...new Set([...bIds, ...wRecs.map(w => w.question_id)])];
      if (allIds.length === 0) { setFetching(false); return; }

      // 按 ID 精确查询（每批最多 50 个）
      const qMap: Record<number, Question> = {};
      for (let i = 0; i < allIds.length; i += 50) {
        const batch = allIds.slice(i, i + 50);
        const res = await fetch(`/api/learn/questions?ids=${batch.join(',')}`);
        const data = await res.json();
        (data.items || []).forEach((q: Question) => { qMap[q.question_id] = q; });
      }
      setQuestions(qMap);
      setFetching(false);
    }).catch(() => setFetching(false));
  }, [token]);

  function toggleBookmark(qid: number) {
    if (!token) return;
    fetch('/api/user/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question_id: qid }),
    }).then(r => r.json()).then(d => {
      if (d.bookmarked === false) {
        setBookmarkIds(prev => prev.filter(id => id !== qid));
      } else if (d.bookmarked === true) {
        setBookmarkIds(prev => [...prev, qid]);
      }
    });
  }

  if (loading || (!user && !loading)) {
    return <div style={{ padding: 48, textAlign: 'center', color: '#8A8078' }}>加载中...</div>;
  }

  const bookmarkQuestions = bookmarkIds.map(id => questions[id]).filter(Boolean);
  const wrongQuestions = wrongRecords.map(r => ({ q: questions[r.question_id], wrong_count: r.wrong_count })).filter(x => x.q);

  const tabStyle = (active: boolean) => ({
    padding: '10px 20px', background: 'none', border: 'none',
    borderBottom: active ? '2px solid #7A6145' : '2px solid transparent',
    fontSize: 14, fontWeight: active ? 600 : 400,
    color: active ? '#2E2118' : '#8A8078', cursor: 'pointer',
    marginBottom: -1, transition: 'color 0.15s',
  });

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px' }}>
      {/* 页头 */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#A08060', marginBottom: 10 }}>
          My Learning
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300, color: '#2E2118', margin: '0 0 6px' }}>
          我的学习
        </h1>
        <p style={{ fontSize: 14, color: '#8A8078' }}>你好，{user?.nickname}　|　收藏 {bookmarkIds.length} 题 · 错题 {wrongRecords.length} 题</p>
      </div>

      {/* Tab 栏 */}
      <div style={{ borderBottom: '1px solid #EDE5D8', marginBottom: 24, display: 'flex' }}>
        <button style={tabStyle(tab === 'bookmarks')} onClick={() => setTab('bookmarks')}>
          ⭐ 收藏题目
          <span style={{ marginLeft: 6, fontSize: 12, background: '#F0EAE0', color: '#7A6145', padding: '1px 6px', borderRadius: 10 }}>
            {bookmarkIds.length}
          </span>
        </button>
        <button style={tabStyle(tab === 'wrong')} onClick={() => setTab('wrong')}>
          ❌ 错题记录
          <span style={{ marginLeft: 6, fontSize: 12, background: '#FDEDEC', color: '#c0392b', padding: '1px 6px', borderRadius: 10 }}>
            {wrongRecords.length}
          </span>
        </button>
      </div>

      {fetching ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#8A8078' }}>加载中...</div>
      ) : tab === 'bookmarks' ? (
        bookmarkQuestions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>☆</div>
            <div style={{ color: '#8A8078', fontSize: 15 }}>还没有收藏任何题目</div>
            <Link href="/learn/quiz" style={{ display: 'inline-block', marginTop: 16, color: '#7A6145', textDecoration: 'none', fontSize: 14, border: '1px solid #C4A882', borderRadius: 8, padding: '8px 20px' }}>
              去做题并收藏 →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: '#8A8078' }}>共 {bookmarkQuestions.length} 道收藏题，点击展开查看答案</span>
            </div>
            {bookmarkQuestions.map(q => (
              <QuestionCard key={q.question_id} q={q} bookmarked={bookmarkIds.includes(q.question_id)} onToggleBookmark={toggleBookmark} />
            ))}
          </div>
        )
      ) : (
        wrongQuestions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
            <div style={{ color: '#8A8078', fontSize: 15 }}>暂无错题记录</div>
            <p style={{ fontSize: 13, color: '#C0B4A4', marginTop: 8 }}>登录后答题，错题会自动记录在这里</p>
            <Link href="/learn/quiz" style={{ display: 'inline-block', marginTop: 16, color: '#7A6145', textDecoration: 'none', fontSize: 14, border: '1px solid #C4A882', borderRadius: 8, padding: '8px 20px' }}>
              去做题 →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#8A8078' }}>
              共 {wrongQuestions.length} 道错题，错误次数越多说明越需要重点复习
            </div>
            {wrongQuestions
              .sort((a, b) => b.wrong_count - a.wrong_count)
              .map(({ q, wrong_count }) => (
                <QuestionCard key={q.question_id} q={q} wrongCount={wrong_count} bookmarked={bookmarkIds.includes(q.question_id)} onToggleBookmark={toggleBookmark} />
              ))}
          </div>
        )
      )}
    </div>
  );
}
