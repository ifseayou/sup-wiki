'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Tooltip from '@/components/Tooltip';
import { useUser } from '@/components/UserContext';

const CATEGORIES = [
  { key: 'equipment',  label: '装备知识',   labelEn: 'Equipment',   icon: '🏄', desc: '板型选择、材质工艺、充气板 vs 硬板、鳍系统',         color: '#7A6145', bg: '#F5EFE8' },
  { key: 'technique',  label: '技术动作',   labelEn: 'Technique',   icon: '🎯', desc: '划桨姿势、入水角度、转向技术、竞速策略',             color: '#1A5276', bg: '#EBF5FB' },
  { key: 'race',       label: '竞赛规则',   labelEn: 'Competition', icon: '🏆', desc: 'ICF 规则、组别说明、CPL 联赛、绕标规范',             color: '#B7470A', bg: '#FDF2E9' },
  { key: 'safety',     label: '安全知识',   labelEn: 'Safety',      icon: '🛡️', desc: '踝绳使用、天气判断、离岸风、落水处置',               color: '#0E6655', bg: '#E9F7EF' },
  { key: 'maintenance',label: '保养维护',   labelEn: 'Maintenance', icon: '🔧', desc: '充气存放、碳板防护、修补方法、日常保养',             color: '#6C3483', bg: '#F4ECF7' },
  { key: 'history',    label: '运动历史',   labelEn: 'History',     icon: '📖', desc: 'SUP 起源、夏威夷文化、国际发展、中国现状',           color: '#515A5A', bg: '#F2F3F4' },
  { key: 'board_id',   label: '看图识板',   labelEn: 'Board ID',    icon: '🖼️', desc: '根据图片识别桨板品牌与型号，练就火眼金睛',           color: '#7A6145', bg: '#F5EFE8', badge: '图片题' },
  { key: 'athlete_id', label: '认识运动员', labelEn: 'Athlete ID',  icon: '🏅', desc: '看脸认人，掌握国际顶尖桨板运动员的中英文名',         color: '#1A5276', bg: '#EBF5FB', badge: '图片题' },
];

interface Progress {
  totals: Record<string, number>;
  attempted: Record<string, number>;
}

export default function CategoryGrid() {
  const { user, token } = useUser();
  const [progress, setProgress] = useState<Progress>({ totals: {}, attempted: {} });
  const [bookmarkCount, setBookmarkCount] = useState<number | null>(null);
  const [wrongCount, setWrongCount] = useState<number | null>(null);

  useEffect(() => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch('/api/user/category-progress', { headers })
      .then(r => r.json())
      .then(d => { if (d.totals) setProgress(d); })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/user/bookmarks', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.bookmarks)) setBookmarkCount(d.bookmarks.length); })
      .catch(() => {});
    fetch('/api/user/wrong-answers', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.wrong_answers)) setWrongCount(d.wrong_answers.length); })
      .catch(() => {});
  }, [token]);

  // 三张特殊入口：收藏 / 错题 / 全科综合
  const bookmarkHref = user ? '/learn/quiz?mode=bookmark' : '/login?redirect=/learn';
  const wrongHref    = user ? '/learn/quiz?mode=wrong'    : '/login?redirect=/learn';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
      {/* ── 1. 收藏题练习 ── */}
      <div style={{
        background: '#F5EFE8', border: '1px solid #7A614525', borderRadius: 12,
        padding: '24px', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>⭐</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#2E2118' }}>收藏题练习</div>
              {user && bookmarkCount !== null && (
                <span style={{ fontSize: 11, color: bookmarkCount > 0 ? '#7A6145' : '#A08060',
                  background: bookmarkCount > 0 ? '#7A614514' : '#F0EAE0',
                  padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                  {bookmarkCount} 道
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#7A6145', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              My Bookmarks
            </div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: '#655D56', lineHeight: 1.65, margin: 0 }}>
          专门练习你收藏的题目，巩固重点内容。答题时点击 ⭐ 图标即可加入收藏。
        </p>
        <Link
          href={bookmarkHref}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'auto',
            padding: '9px 18px', background: '#7A6145', color: '#fff',
            borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none',
            width: 'fit-content', transition: 'opacity 0.15s',
          }}
        >
          {user ? '开始 收藏题 练习 →' : '登录后开始练习 →'}
        </Link>
      </div>

      {/* ── 2. 错题专项练习 ── */}
      <div style={{
        background: '#FDF2E9', border: '1px solid #B7470A25', borderRadius: 12,
        padding: '24px', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🔁</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#2E2118' }}>错题专项练习</div>
              {user && wrongCount !== null && (
                <span style={{ fontSize: 11, color: wrongCount > 0 ? '#B7470A' : '#A08060',
                  background: wrongCount > 0 ? '#B7470A14' : '#F0EAE0',
                  padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                  {wrongCount} 道
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#B7470A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Wrong Answer Review
            </div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: '#655D56', lineHeight: 1.65, margin: 0 }}>
          针对薄弱点专项复习，答对即从错题库自动移除，真正把薄弱点消灭掉。
        </p>
        <Link
          href={wrongHref}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'auto',
            padding: '9px 18px', background: '#B7470A', color: '#fff',
            borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none',
            width: 'fit-content', transition: 'opacity 0.15s',
          }}
        >
          {user ? '开始 错题 练习 →' : '登录后开始练习 →'}
        </Link>
      </div>

      {/* ── 3. 全科综合测验 ── */}
      <div style={{
        background: 'linear-gradient(135deg, #2E2118 0%, #5E4A33 100%)',
        border: '1px solid #2E211825', borderRadius: 12,
        padding: '24px', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🎯</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#FAF7F2' }}>全科综合测验</div>
              <span style={{ fontSize: 11, color: '#C4A882', background: 'rgba(196,168,130,0.15)',
                padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                20 道 / 次
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#C4A882', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Comprehensive Test
            </div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, margin: 0 }}>
          随机抽取 20 道题，覆盖所有知识领域，<span style={{ color: '#FAF7F2', fontWeight: 600 }}>测试你的综合桨板知识水平</span>。
        </p>
        <Link
          href="/learn/quiz"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'auto',
            padding: '9px 18px', background: '#C4A882', color: '#2E2118',
            borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
            width: 'fit-content', transition: 'opacity 0.15s',
          }}
        >
          开始综合测验 →
        </Link>
      </div>

      {/* ── 之后：8 个分类学习入口 ── */}
      {CATEGORIES.map(cat => {
        const total = progress.totals[cat.key] ?? null;
        const done = progress.attempted[cat.key] ?? 0;
        const pct = total ? Math.round((done / total) * 100) : 0;

        return (
          <div
            key={cat.key}
            style={{ background: cat.bg, border: `1px solid ${cat.color}25`, borderRadius: 12, padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>{cat.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#2E2118' }}>{cat.label}</div>
                  {total !== null && (
                    <span style={{ fontSize: 11, color: done > 0 ? cat.color : '#A08060', background: done > 0 ? `${cat.color}14` : '#F0EAE0', padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {done}/{total} 题
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: cat.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  <Tooltip tip={cat.label} dotted={false}>{cat.labelEn}</Tooltip>
                </div>
              </div>
            </div>

            {/* 进度条 */}
            {total !== null && done > 0 && (
              <div style={{ height: 3, background: `${cat.color}22`, borderRadius: 2 }}>
                <div style={{ height: '100%', background: cat.color, borderRadius: 2, width: `${pct}%`, transition: 'width 0.4s' }} />
              </div>
            )}

            <p style={{ fontSize: 13, color: '#655D56', lineHeight: 1.65, margin: 0 }}>{cat.desc}</p>

            {cat.badge && (
              <span style={{ fontSize: 10, background: cat.color, color: '#fff', padding: '2px 7px', borderRadius: 8, width: 'fit-content', opacity: 0.85 }}>
                {cat.badge}
              </span>
            )}
            <Link
              href={`/learn/quiz?category=${cat.key}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'auto',
                padding: '9px 18px', background: cat.color, color: '#fff',
                borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none',
                width: 'fit-content', transition: 'opacity 0.15s',
              }}
            >
              开始 {cat.label} 测验 →
            </Link>
          </div>
        );
      })}
    </div>
  );
}
