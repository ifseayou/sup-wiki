import Link from 'next/link';
import pool from '@/lib/db';
import ArticleGuideTabs from '@/components/ArticleGuideTabs';
import type { RowDataPacket } from 'mysql2';

interface GuideArticle extends RowDataPacket {
  article_id: number;
  title: string;
  summary: string | null;
  content: string | null;
}

async function getGuideArticles() {
  try {
    const [rows] = await pool.execute<GuideArticle[]>(
      `SELECT article_id, title, summary, content
       FROM sup_articles
       WHERE status = 'published' AND category = 'event_guide'
       ORDER BY sort_order ASC, article_id ASC`
    );
    return rows;
  } catch (error) {
    console.error('获取赛事体系文档失败:', error);
    return [];
  }
}

export default async function EventGuideDocsPage() {
  const articles = await getGuideArticles();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
      <nav className="mb-7 flex items-center gap-2 text-sm text-[#8A8078]">
        <Link href="/" className="text-[#8A8078] no-underline hover:text-[#7A6145]">首页</Link>
        <span>/</span>
        <Link href="/learn" className="text-[#8A8078] no-underline hover:text-[#7A6145]">学习</Link>
        <span>/</span>
        <Link href="/learn/docs" className="text-[#8A8078] no-underline hover:text-[#7A6145]">学习文档</Link>
        <span>/</span>
        <span className="text-[#2E2118]">赛事体系与竞赛规则</span>
      </nav>

      <header className="mb-7">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#A08060]">Race System</p>
        <h1 className="font-[var(--font-display)] text-4xl font-medium text-[#2E2118] md:text-5xl">赛事体系与竞赛规则</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#655D56]">
          集中查看中国赛事体系、国际赛事体系和中国桨板竞赛规则（2026版），保持赛事模块中的原有图表与格式。
        </p>
      </header>

      <ArticleGuideTabs articles={articles} defaultExpanded />
    </div>
  );
}
