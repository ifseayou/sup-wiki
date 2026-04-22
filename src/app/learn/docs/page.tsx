import Link from 'next/link';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

interface LearnDocRow extends RowDataPacket {
  article_id: number;
  title: string;
  slug: string;
  category: string;
  summary: string | null;
  difficulty: string;
  sort_order: number;
  status: string;
  updated_at: string;
}

const categoryLabels: Record<string, { name: string; icon: string; tip: string }> = {
  muscle:    { name: '肌肉训练', icon: '💪', tip: '桨板涉及的核心肌群与辅助训练' },
  stretch:   { name: '拉伸指南', icon: '🧘', tip: '运动前后的动态 / 静态拉伸' },
  technique: { name: '技术动作', icon: '🏄', tip: '进阶划水、转向与冲浪动作' },
  safety:    { name: '安全知识', icon: '🛟', tip: '落水、救援与风险控制' },
  nutrition: { name: '运动饮食', icon: '🥗', tip: '训练前后的营养搭配与食材选择' },
  equipment: { name: '装备知识', icon: '🧰', tip: '板型、桨型与配件选择' },
  general:   { name: '通用', icon: '📘', tip: '综合类知识文档' },
};

const difficultyLabels: Record<string, { label: string; color: string; bg: string }> = {
  beginner:     { label: '入门', color: '#0E6655', bg: '#E9F7EF' },
  intermediate: { label: '进阶', color: '#B7470A', bg: '#FDF2E9' },
  advanced:     { label: '专家', color: '#6C3483', bg: '#F4ECF7' },
};

async function getLearnDocs(): Promise<LearnDocRow[]> {
  try {
    const [rows] = await pool.execute<LearnDocRow[]>(
      "SELECT * FROM sup_learn_articles WHERE status = 'published' ORDER BY sort_order ASC, created_at DESC"
    );
    return rows;
  } catch (error) {
    console.error('获取学习文档列表失败:', error);
    return [];
  }
}

export default async function LearnDocsPage() {
  const docs = await getLearnDocs();

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>
      {/* Breadcrumb */}
      <nav style={{ marginBottom: 24, fontSize: 13, color: '#8A8078' }}>
        <Link href="/" style={{ color: '#8A8078', textDecoration: 'none' }}>首页</Link>
        {' / '}
        <Link href="/learn" style={{ color: '#8A8078', textDecoration: 'none' }}>学习</Link>
        {' / '}
        <span style={{ color: '#2E2118' }}>学习文档</span>
      </nav>

      {/* 页头 */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#A08060', marginBottom: 12 }}>
          SUP Learning Documents
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px,4vw,44px)', fontWeight: 300, color: '#2E2118', lineHeight: 1.15, margin: '0 0 14px' }}>
          学习文档
        </h1>
        <div style={{ width: 40, height: 1, background: '#A08060', marginBottom: 16 }} />
        <p style={{ fontSize: 15, color: '#655D56', lineHeight: 1.8, maxWidth: 640 }}>
          系统化桨板知识入口——肌肉训练、拉伸放松、进阶技术动作等主题文档，配图 + 表格 + 实操清单，适合配合题库一起学习。
        </p>
      </div>

      {docs.length === 0 ? (
        <div style={{ background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📚</div>
          <p style={{ color: '#8A8078', fontSize: 14 }}>暂无已发布的学习文档。</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {docs.map(doc => {
            const cat = categoryLabels[doc.category] || { name: doc.category, icon: '📄', tip: '' };
            const diff = difficultyLabels[doc.difficulty] || { label: doc.difficulty, color: '#8A8078', bg: '#F0EAE0' };
            return (
              <Link
                key={doc.article_id}
                href={`/learn/docs/${doc.slug}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: '#FEFCF9',
                  border: '1px solid #EDE5D8',
                  borderRadius: 14,
                  padding: '24px 24px 20px',
                  textDecoration: 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
                  minHeight: 210,
                }}
                className="learn-doc-card"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 28 }}>{cat.icon}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#7A6145', background: '#F0EAE0', padding: '2px 8px', borderRadius: 10 }}>
                      {cat.name}
                    </span>
                    <span style={{ fontSize: 11, color: diff.color, background: diff.bg, padding: '2px 8px', borderRadius: 10 }}>
                      {diff.label}
                    </span>
                  </div>
                </div>

                <h3 style={{
                  fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500,
                  color: '#2E2118', margin: '0 0 10px', lineHeight: 1.3,
                }}>
                  {doc.title}
                </h3>

                {doc.summary && (
                  <p style={{ fontSize: 13, color: '#655D56', lineHeight: 1.7, margin: '0 0 16px', flex: 1 }}>
                    {doc.summary}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <span style={{ fontSize: 12, color: '#A08060', fontWeight: 500 }}>阅读全文 →</span>
                  <span style={{ fontSize: 11, color: '#C0B4A4' }}>
                    {new Date(doc.updated_at).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
