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
  if (articles.length === 0) return null;

  const active = articles[activeIndex];
  const html = active.content ? marked.parse(active.content) as string : '';

  return (
    <div style={{
      background: '#FEFCF9',
      border: '1px solid #EDE5D8',
      borderRadius: 12,
      marginBottom: 40,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 28px 0', borderBottom: '1px solid #EDE5D8' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#A08060', marginBottom: 12 }}>
          赛事指南
        </p>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {articles.map((a, i) => (
            <button
              key={a.article_id}
              onClick={() => setActiveIndex(i)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: i === activeIndex ? '2px solid #7A6145' : '2px solid transparent',
                padding: '0 20px 12px',
                fontSize: 14,
                fontWeight: i === activeIndex ? 500 : 400,
                color: i === activeIndex ? '#2E2118' : '#8A8078',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                letterSpacing: '0.02em',
                marginBottom: -1,
              }}
            >
              {a.title}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 28px 28px' }}>
        {active.summary && (
          <p style={{ fontSize: 14, color: '#655D56', lineHeight: 1.75, marginBottom: 20, borderLeft: '3px solid #DDD1C0', paddingLeft: 14 }}>
            {active.summary}
          </p>
        )}
        <div
          className="article-guide-body"
          dangerouslySetInnerHTML={{ __html: html }}
          style={{ maxHeight: 480, overflowY: 'auto' }}
        />
      </div>
    </div>
  );
}
