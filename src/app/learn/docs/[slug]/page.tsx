import Link from 'next/link';
import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import { marked } from 'marked';
import MuscleDiagram from '@/components/MuscleDiagram';
import { StretchInline, StretchAnimationsStyle } from '@/components/StretchAnimationGallery';
import { TechniqueInline } from '@/components/TechniqueAssessmentCard';
import BoardAnatomyGuide from '@/components/BoardAnatomyGuide';
import TrainingCertGuide from '@/components/TrainingCertGuide';

export const dynamic = 'force-dynamic';

interface LearnDocRow extends RowDataPacket {
  article_id: number;
  title: string;
  slug: string;
  category: string;
  summary: string | null;
  content: string | null;
  difficulty: string;
  status: string;
  updated_at: string;
}

const categoryLabels: Record<string, { name: string; icon: string }> = {
  muscle:    { name: '肌肉训练', icon: '💪' },
  stretch:   { name: '拉伸指南', icon: '🧘' },
  technique: { name: '技术动作', icon: '🏄' },
  safety:    { name: '安全知识', icon: '🛟' },
  nutrition: { name: '运动饮食', icon: '🥗' },
  equipment: { name: '装备知识', icon: '🧰' },
  general:   { name: '通用', icon: '📘' },
};

const difficultyLabels: Record<string, { label: string; color: string; bg: string }> = {
  beginner:     { label: '入门', color: '#0E6655', bg: '#E9F7EF' },
  intermediate: { label: '进阶', color: '#B7470A', bg: '#FDF2E9' },
  advanced:     { label: '专家', color: '#6C3483', bg: '#F4ECF7' },
};

marked.setOptions({ breaks: true });

// 把 marked 生成的 HTML 按 `<p>{{stretch:ID}}</p>` 标记拆开，
// 在标记处插入 <StretchInline id=ID />，其余段落原样 HTML 渲染。
function renderStretchBody(html: string) {
  const regex = /<p>\{\{stretch:([a-z-]+)\}\}<\/p>/g;
  const parts: Array<{ type: 'html'; value: string } | { type: 'stretch'; id: string }> = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    if (m.index > lastIndex) parts.push({ type: 'html', value: html.slice(lastIndex, m.index) });
    parts.push({ type: 'stretch', id: m[1] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < html.length) parts.push({ type: 'html', value: html.slice(lastIndex) });

  return (
    <article className="article-guide-body" style={{ fontSize: 15, lineHeight: 1.85, color: '#3D3730' }}>
      <StretchAnimationsStyle />
      {parts.map((p, i) =>
        p.type === 'html'
          ? <div key={i} dangerouslySetInnerHTML={{ __html: p.value }} />
          : <StretchInline key={i} id={p.id} />
      )}
    </article>
  );
}

// 同样模式：拆分 `<p>{{tech:NN}}</p>` → TechniqueInline。
function renderTechniqueBody(html: string) {
  const regex = /<p>\{\{tech:(\d{2})\}\}<\/p>/g;
  const parts: Array<{ type: 'html'; value: string } | { type: 'tech'; id: string }> = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    if (m.index > lastIndex) parts.push({ type: 'html', value: html.slice(lastIndex, m.index) });
    parts.push({ type: 'tech', id: m[1] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < html.length) parts.push({ type: 'html', value: html.slice(lastIndex) });

  return (
    <article className="article-guide-body" style={{ fontSize: 15, lineHeight: 1.85, color: '#3D3730' }}>
      {parts.map((p, i) =>
        p.type === 'html'
          ? <div key={i} dangerouslySetInnerHTML={{ __html: p.value }} />
          : <TechniqueInline key={i} id={p.id} />
      )}
    </article>
  );
}

async function getLearnDoc(slug: string) {
  try {
    const [rows] = await pool.execute<LearnDocRow[]>(
      "SELECT * FROM sup_learn_articles WHERE slug = ? AND status = 'published' LIMIT 1",
      [slug]
    );
    return rows.length === 0 ? null : rows[0];
  } catch (error) {
    console.error('获取学习文档详情失败:', error);
    return null;
  }
}

export default async function LearnDocDetailPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getLearnDoc(slug);
  if (!doc) notFound();

  const cat = categoryLabels[doc.category] || { name: doc.category, icon: '📄' };
  const diff = difficultyLabels[doc.difficulty] || { label: doc.difficulty, color: '#8A8078', bg: '#F0EAE0' };
  const contentHtml = doc.content ? marked.parse(doc.content) as string : '';

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 24px 64px' }}>
      {/* Breadcrumb */}
      <nav style={{ marginBottom: 24, fontSize: 13, color: '#8A8078' }}>
        <Link href="/" style={{ color: '#8A8078', textDecoration: 'none' }}>首页</Link>
        {' / '}
        <Link href="/learn" style={{ color: '#8A8078', textDecoration: 'none' }}>学习</Link>
        {' / '}
        <Link href="/learn/docs" style={{ color: '#8A8078', textDecoration: 'none' }}>学习文档</Link>
        {' / '}
        <span style={{ color: '#2E2118' }}>{doc.title}</span>
      </nav>

      {/* 文章头部 */}
      <header style={{ marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid #EDE5D8' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: '#7A6145', background: '#F0EAE0', padding: '3px 10px', borderRadius: 12 }}>
            {cat.icon} {cat.name}
          </span>
          <span style={{ fontSize: 12, color: diff.color, background: diff.bg, padding: '3px 10px', borderRadius: 12 }}>
            {diff.label}
          </span>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,38px)', fontWeight: 400,
          color: '#2E2118', lineHeight: 1.25, margin: '0 0 14px',
        }}>
          {doc.title}
        </h1>

        {doc.summary && (
          <p style={{ fontSize: 15, color: '#655D56', lineHeight: 1.85, margin: 0 }}>
            {doc.summary}
          </p>
        )}

        <p style={{ fontSize: 12, color: '#A08060', marginTop: 12 }}>
          最后更新：{new Date(doc.updated_at).toLocaleDateString('zh-CN')}
        </p>
      </header>

      {/* 肌肉训练类文档在正文前嵌入交互式肌群发力图 */}
      {doc.category === 'muscle' && <MuscleDiagram />}

      {/* 文章正文渲染：按 slug/category 派发到不同组件 */}
      {doc.slug === 'sup-board-anatomy' ? (
        <BoardAnatomyGuide />
      ) : doc.slug === 'sup-training-class-process-l1-l6' ? (
        <TrainingCertGuide />
      ) : contentHtml ? (
        doc.category === 'stretch'
          ? renderStretchBody(contentHtml)
          : doc.slug === 'sup-skill-assessment-35'
            ? renderTechniqueBody(contentHtml)
            : (
              <article
                className="article-guide-body"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
                style={{ fontSize: 15, lineHeight: 1.85, color: '#3D3730' }}
              />
            )
      ) : (
        <p style={{ color: '#8A8078', fontSize: 14 }}>本文档暂无正文内容。</p>
      )}

      {/* 返回 */}
      <div style={{ marginTop: 48, paddingTop: 20, borderTop: '1px solid #EDE5D8' }}>
        <Link
          href="/learn/docs"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: '#7A6145', textDecoration: 'none',
          }}
        >
          ← 返回学习文档列表
        </Link>
      </div>
    </div>
  );
}
