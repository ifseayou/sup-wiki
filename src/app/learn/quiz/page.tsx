'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Question {
  question_id: number;
  question: string;
  type: 'single' | 'multiple' | 'truefalse';
  options: string[];
  correct: number | number[];
  explanation: string | null;
  category: string;
  difficulty: string;
}

const CAT_LABELS: Record<string, string> = {
  equipment: '装备知识', technique: '技术动作', race: '竞赛规则',
  safety: '安全知识', maintenance: '保养维护', history: '运动历史',
};
const DIFF_LABELS: Record<string, string> = {
  beginner: '入门', intermediate: '进阶', advanced: '高级',
};
const DIFF_COLORS: Record<string, string> = {
  beginner: '#0E6655', intermediate: '#B7470A', advanced: '#6C3483',
};

function QuizContent() {
  const searchParams = useSearchParams();
  const category = searchParams.get('category') || '';
  const difficulty = searchParams.get('difficulty') || '';

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | number[] | null)[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [finished, setFinished] = useState(false);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (category) params.set('category', category);
      if (difficulty) params.set('difficulty', difficulty);
      const res = await fetch(`/api/learn/questions?${params}`);
      const data = await res.json();
      if (data.items?.length) {
        setQuestions(data.items);
        setAnswers(new Array(data.items.length).fill(null));
      } else {
        setError('暂无题目，请稍后再试');
      }
    } catch {
      setError('加载失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  }, [category, difficulty]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const q = questions[current];

  function toggleOption(idx: number) {
    if (showExplanation) return;
    if (q.type === 'single' || q.type === 'truefalse') {
      setSelected([idx]);
    } else {
      setSelected(prev =>
        prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
      );
    }
  }

  function confirmAnswer() {
    if (selected.length === 0) return;
    const newAnswers = [...answers];
    newAnswers[current] = q.type === 'multiple' ? [...selected].sort() : selected[0];
    setAnswers(newAnswers);
    setShowExplanation(true);
  }

  function nextQuestion() {
    setShowExplanation(false);
    setSelected([]);
    if (current + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrent(current + 1);
    }
  }

  function isCorrect(qIdx: number): boolean {
    const q = questions[qIdx];
    const ans = answers[qIdx];
    if (ans === null) return false;
    const correct = q.correct;
    if (Array.isArray(correct)) {
      if (!Array.isArray(ans)) return false;
      return JSON.stringify([...ans].sort()) === JSON.stringify([...correct].sort());
    }
    return ans === correct;
  }

  function calcScore() {
    return answers.filter((_, i) => isCorrect(i)).length;
  }

  // ── 加载中 ──
  if (loading) {
    return (
      <div style={{ maxWidth: 720, margin: '100px auto', textAlign: 'center', color: '#8A8078' }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
        <div>正在加载题目...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 720, margin: '100px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>😢</div>
        <div style={{ color: '#c0392b', marginBottom: 20 }}>{error}</div>
        <Link href="/learn" style={{ color: '#7A6145', textDecoration: 'none' }}>← 返回学习中心</Link>
      </div>
    );
  }

  // ── 结果页 ──
  if (finished) {
    const score = calcScore();
    const pct = Math.round((score / questions.length) * 100);
    const grade = pct >= 90 ? { label: '桨板专家', color: '#B7470A', icon: '🏆' }
      : pct >= 70 ? { label: '进阶达人', color: '#0E6655', icon: '🎯' }
      : pct >= 50 ? { label: '入门学员', color: '#1A5276', icon: '📚' }
      : { label: '继续加油', color: '#8A8078', icon: '💪' };

    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>{grade.icon}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 300, color: '#2E2118', marginBottom: 8 }}>
            {grade.label}
          </div>
          <div style={{ fontSize: 64, fontWeight: 700, color: grade.color, lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: 16, color: '#8A8078', marginTop: 8 }}>
            共 {questions.length} 题，答对 {score} 题
          </div>
        </div>

        {/* 逐题回顾 */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#2E2118', marginBottom: 16 }}>答题详情</h3>
          {questions.map((q, i) => {
            const correct = isCorrect(i);
            return (
              <div key={q.question_id} style={{
                borderRadius: 10, border: `1px solid ${correct ? '#A9DFBF' : '#F5CBA7'}`,
                background: correct ? '#F9FFF9' : '#FFF8F5',
                padding: '16px 18px', marginBottom: 10,
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{correct ? '✅' : '❌'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#2E2118', marginBottom: 6 }}>
                      {i + 1}. {q.question}
                    </div>
                    {!correct && (
                      <div style={{ fontSize: 12, color: '#0E6655', marginBottom: 4 }}>
                        ✓ 正确答案：{
                          Array.isArray(q.correct)
                            ? (q.correct as number[]).map(idx => q.options[idx]).join(' / ')
                            : q.options[q.correct as number]
                        }
                      </div>
                    )}
                    {q.explanation && (
                      <div style={{ fontSize: 12, color: '#655D56', lineHeight: 1.65, borderTop: '1px solid #EDE5D8', paddingTop: 8, marginTop: 6 }}>
                        💡 {q.explanation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => { fetchQuestions(); setCurrent(0); setAnswers([]); setSelected([]); setShowExplanation(false); setFinished(false); }}
            style={{ padding: '12px 24px', background: '#7A6145', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            再来一轮
          </button>
          <Link href="/learn" style={{ padding: '12px 24px', border: '1px solid #EDE5D8', borderRadius: 8, fontSize: 14, color: '#655D56', textDecoration: 'none' }}>
            返回学习中心
          </Link>
        </div>
      </div>
    );
  }

  // ── 答题页 ──
  const progress = ((current + (showExplanation ? 1 : 0)) / questions.length) * 100;
  const correctArr = Array.isArray(q.correct) ? q.correct as number[] : [q.correct as number];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      {/* 顶部进度 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#8A8078' }}>
            {category ? CAT_LABELS[category] : '综合测验'}
            {difficulty ? ` · ${DIFF_LABELS[difficulty]}` : ''}
          </span>
          <span style={{ fontSize: 13, color: '#8A8078' }}>{current + 1} / {questions.length}</span>
        </div>
        <div style={{ height: 4, background: '#EDE5D8', borderRadius: 2 }}>
          <div style={{ height: '100%', background: '#7A6145', borderRadius: 2, width: `${progress}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* 题目卡片 */}
      <div style={{ background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 14, padding: '28px 28px 24px' }}>
        {/* 标签 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <span style={{ fontSize: 11, background: '#F0EAE0', color: '#7A6145', padding: '2px 8px', borderRadius: 10 }}>
            {CAT_LABELS[q.category] || q.category}
          </span>
          <span style={{ fontSize: 11, background: `${DIFF_COLORS[q.difficulty]}18`, color: DIFF_COLORS[q.difficulty], padding: '2px 8px', borderRadius: 10 }}>
            {DIFF_LABELS[q.difficulty] || q.difficulty}
          </span>
          <span style={{ fontSize: 11, background: '#F2F3F4', color: '#8A8078', padding: '2px 8px', borderRadius: 10 }}>
            {q.type === 'single' ? '单选' : q.type === 'multiple' ? '多选' : '判断'}
          </span>
        </div>

        {/* 题干 */}
        <p style={{ fontSize: 17, fontWeight: 500, color: '#2E2118', lineHeight: 1.65, marginBottom: 24 }}>
          {q.question}
        </p>

        {/* 选项 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {q.options.map((opt, idx) => {
            const isSelected = selected.includes(idx);
            const isRight = correctArr.includes(idx);
            let bg = '#fff', border = '#EDE5D8', textColor = '#2E2118';
            if (showExplanation) {
              if (isRight) { bg = '#E9F7EF'; border = '#A9DFBF'; textColor = '#0E6655'; }
              else if (isSelected && !isRight) { bg = '#FDEDEC'; border = '#F5B7B1'; textColor = '#c0392b'; }
            } else if (isSelected) {
              bg = '#F0EAE0'; border = '#C4A882'; textColor = '#5E4A33';
            }

            return (
              <button
                key={idx}
                onClick={() => toggleOption(idx)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', background: bg, border: `1.5px solid ${border}`,
                  borderRadius: 8, cursor: showExplanation ? 'default' : 'pointer',
                  textAlign: 'left', transition: 'all 0.15s',
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: q.type === 'multiple' ? 4 : '50%',
                  border: `1.5px solid ${isSelected || (showExplanation && isRight) ? border : '#C0B4A4'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: (isSelected || (showExplanation && isRight)) ? bg : 'transparent',
                  flexShrink: 0, fontSize: 11, color: textColor, fontWeight: 700,
                }}>
                  {showExplanation && isRight ? '✓' : showExplanation && isSelected && !isRight ? '✗' : String.fromCharCode(65 + idx)}
                </span>
                <span style={{ fontSize: 14, color: textColor, lineHeight: 1.5 }}>{opt}</span>
              </button>
            );
          })}
        </div>

        {/* 解析 */}
        {showExplanation && q.explanation && (
          <div style={{
            marginTop: 20, padding: '14px 16px', background: '#FAF7F2',
            border: '1px solid #EDE5D8', borderRadius: 8,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#7A6145', marginBottom: 6 }}>💡 解析</div>
            <p style={{ fontSize: 13, color: '#3D3730', lineHeight: 1.75, margin: 0 }}>{q.explanation}</p>
          </div>
        )}

        {/* 操作按钮 */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          {!showExplanation ? (
            <button
              onClick={confirmAnswer}
              disabled={selected.length === 0}
              style={{
                padding: '11px 28px', background: selected.length > 0 ? '#7A6145' : '#C0B4A4',
                color: '#fff', border: 'none', borderRadius: 8, fontSize: 14,
                fontWeight: 500, cursor: selected.length > 0 ? 'pointer' : 'default',
                transition: 'background 0.15s',
              }}
            >
              确认答案
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              style={{
                padding: '11px 28px', background: '#2E2118', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}
            >
              {current + 1 >= questions.length ? '查看结果 →' : '下一题 →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: '#8A8078' }}>加载中...</div>}>
      <QuizContent />
    </Suspense>
  );
}
