'use client';

import { useState } from 'react';
import { marked } from 'marked';

interface Article {
  article_id: number;
  title: string;
  summary: string | null;
  content: string | null;
}

interface Props {
  articles: Article[];
}

marked.setOptions({ breaks: true });

export default function ArticleGuideTabs({ articles }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  if (articles.length === 0) return null;

  const active = articles[activeIndex];
  const html = active.content ? marked.parse(active.content) as string : '';

  return (
    <div style={{
      background: '#FEFCF9',
      border: '1px solid #EDE5D8',
      borderRadius: 12,
      marginBottom: 32,
      overflow: 'hidden',
    }}>
      {/* 始终可见的折叠头部 */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#A08060' }}>
            赛事指南
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {articles.map((a, i) => (
              <span
                key={a.article_id}
                onClick={e => { e.stopPropagation(); setActiveIndex(i); setExpanded(true); }}
                style={{
                  fontSize: 12,
                  color: i === activeIndex ? '#7A6145' : '#8A8078',
                  background: i === activeIndex ? '#F0EAE0' : 'transparent',
                  border: '1px solid',
                  borderColor: i === activeIndex ? '#C8A87A' : '#EDE5D8',
                  borderRadius: 20,
                  padding: '2px 10px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {a.title}
              </span>
            ))}
          </div>
        </div>
        <span style={{
          fontSize: 13,
          color: '#A08060',
          transition: 'transform 0.2s',
          display: 'inline-block',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          ▾
        </span>
      </div>

      {/* 可折叠内容区 */}
      {expanded && (
        <>
          <div style={{ borderTop: '1px solid #EDE5D8', padding: '0 20px', display: 'flex' }}>
            {articles.map((a, i) => (
              <button
                key={a.article_id}
                onClick={() => setActiveIndex(i)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: i === activeIndex ? '2px solid #7A6145' : '2px solid transparent',
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: i === activeIndex ? 500 : 400,
                  color: i === activeIndex ? '#2E2118' : '#8A8078',
                  cursor: 'pointer',
                  transition: 'color 0.15s, border-color 0.15s',
                  marginBottom: -1,
                }}
              >
                {a.title}
              </button>
            ))}
          </div>
          <div style={{ padding: '20px 20px 24px' }}>
            {active.summary && (
              <p style={{ fontSize: 13, color: '#655D56', lineHeight: 1.75, marginBottom: 16, borderLeft: '3px solid #DDD1C0', paddingLeft: 12 }}>
                {active.summary}
              </p>
            )}
            <div
              className="article-guide-body"
              dangerouslySetInnerHTML={{ __html: html }}
              style={{ maxHeight: 400, overflowY: 'auto' }}
            />
          </div>
        </>
      )}
    </div>
  );
}
