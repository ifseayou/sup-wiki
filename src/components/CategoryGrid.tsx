'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '@/components/UserContext';

const CATEGORIES = [
  { key: 'equipment', label: '装备知识', labelEn: 'Equipment', icon: '🏄', desc: '板型选择、材质工艺、充气板 vs 硬板、鳍系统', color: '#8B5A1F', bg: '#FFF7EA' },
  { key: 'technique', label: '技术动作', labelEn: 'Technique', icon: '🎯', desc: '划桨姿势、入水角度、转向技术、竞速策略', color: '#155F88', bg: '#EEF8FF' },
  { key: 'race', label: '竞赛规则', labelEn: 'Competition', icon: '🏆', desc: 'ICF 规则、组别说明、CPL 联赛、绕标规范', color: '#B7470A', bg: '#FFF4EB' },
  { key: 'safety', label: '安全知识', labelEn: 'Safety', icon: '🛡️', desc: '天气判断、离岸风、落水处置、救援要点', color: '#0E7664', bg: '#EBFAF5' },
  { key: 'maintenance', label: '保养维护', labelEn: 'Maintenance', icon: '🔧', desc: '充气存放、碳板防护、修补方法、日常保养', color: '#7A3A92', bg: '#F8F0FF' },
  { key: 'history', label: '运动历史', labelEn: 'History', icon: '📖', desc: 'SUP 起源、夏威夷文化、国际发展、中国现状', color: '#4F5C5C', bg: '#F3F6F6' },
  { key: 'board_id', label: '看图识板', labelEn: 'Board ID', icon: '🖼️', desc: '识别桨板品牌与型号，练就火眼金睛', color: '#7A6145', bg: '#F8F0E7', badge: '图片题' },
  { key: 'athlete_id', label: '认识运动员', labelEn: 'Athlete ID', icon: '🏅', desc: '看脸认人，掌握国际顶尖桨板运动员的中英文名', color: '#1A5276', bg: '#EEF8FF', badge: '图片题' },
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
    if (token) headers.Authorization = `Bearer ${token}`;
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

  const quickCards = [
    {
      title: '收藏题练习',
      titleEn: 'My Bookmarks',
      icon: '⭐',
      desc: '专门练习你收藏的题目，巩固重点内容',
      href: user ? '/learn/quiz?mode=bookmark' : '/login?redirect=/learn',
      cta: '开始练习',
      count: user && bookmarkCount !== null ? `${bookmarkCount} 题` : '',
      tone: 'light',
    },
    {
      title: '错题专项练习',
      titleEn: 'Wrong Answer Review',
      icon: '🔁',
      desc: '针对薄弱点专项复习，攻克错题提升水平',
      href: user ? '/learn/quiz?mode=wrong' : '/login?redirect=/learn',
      cta: '开始练习',
      count: user && wrongCount !== null ? `${wrongCount} 题` : '',
      tone: 'warm',
    },
    {
      title: '全科综合测验',
      titleEn: 'Comprehensive Test',
      icon: '🎯',
      desc: '随机抽取 20 道题，全面检验知识水平',
      href: '/learn/quiz',
      cta: '开始测验',
      count: '20 题 / 次',
      tone: 'dark',
    },
  ];

  return (
    <div className="learn-category-wrap">
      <div className="learn-quick-grid">
        {quickCards.map(card => (
          <Link key={card.title} href={card.href} className={`learn-quick-card learn-quick-card--${card.tone}`}>
            <span className="learn-quick-card__icon">{card.icon}</span>
            <span className="learn-quick-card__body">
              <span className="learn-quick-card__title">{card.title}</span>
              <span className="learn-quick-card__en">{card.titleEn}</span>
              <span className="learn-quick-card__desc">{card.desc}</span>
            </span>
            {card.count && <span className="learn-quick-card__count">{card.count}</span>}
            <span className="learn-quick-card__cta">{card.cta} →</span>
          </Link>
        ))}
      </div>

      <div className="learn-category-grid">
        {CATEGORIES.map(cat => {
          const total = progress.totals[cat.key] ?? null;
          const done = progress.attempted[cat.key] ?? 0;

          return (
            <Link
              key={cat.key}
              href={`/learn/quiz?category=${cat.key}`}
              className="learn-category-card"
              style={{ background: cat.bg, borderColor: `${cat.color}24` }}
            >
              <span className="learn-category-card__icon">{cat.icon}</span>
              <span className="learn-category-card__body">
                <span className="learn-category-card__head">
                  <span>
                    <strong>{cat.label}</strong>
                    <em style={{ color: cat.color }}>{cat.labelEn}</em>
                  </span>
                  {total !== null && <small>{done}/{total} 题</small>}
                </span>
                <span className="learn-category-card__desc">{cat.desc}</span>
                {cat.badge && <span className="learn-category-card__badge" style={{ background: cat.color }}>{cat.badge}</span>}
              </span>
              <span className="learn-category-card__arrow">›</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
