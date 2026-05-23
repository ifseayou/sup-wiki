import Link from 'next/link';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import LearnCreatorsClient, { type LearnCreatorItem } from '@/components/LearnCreatorsClient';

export const dynamic = 'force-dynamic';

interface CreatorRow extends RowDataPacket {
  creator_id: number;
  nickname: string;
  avatar: string | null;
  bio: string | null;
  platform: string;
  follower_tier: string;
  content_style: string;
  region: string;
  profile_url: string | null;
}

const tierOrder = `CASE follower_tier
  WHEN '1m+' THEN 1 WHEN '100k-1m' THEN 2
  WHEN '10k-100k' THEN 3 WHEN '1k-10k' THEN 4 ELSE 5 END`;

async function getCreators(): Promise<LearnCreatorItem[]> {
  try {
    const [rows] = await pool.execute<CreatorRow[]>(
      `SELECT creator_id, nickname, avatar, bio, platform, follower_tier, content_style, region, profile_url
       FROM sup_creators
       WHERE status = 'published'
       ORDER BY ${tierOrder} ASC, nickname ASC`
    );
    return rows.map(row => ({
      creator_id: Number(row.creator_id),
      nickname: row.nickname,
      avatar: row.avatar,
      bio: row.bio,
      platform: row.platform,
      follower_tier: row.follower_tier,
      content_style: row.content_style,
      region: row.region,
      profile_url: row.profile_url,
    }));
  } catch (error) {
    console.error('获取博主学习列表失败:', error);
    return [];
  }
}

export default async function LearnCreatorsPage() {
  const creators = await getCreators();

  return (
    <main className="learn-library-page">
      <style>{`
        .learn-library-page {
          min-height: 100vh;
          background: radial-gradient(circle at 12% 0%, rgba(216,158,74,.14), transparent 30%), #fbf7f1;
          color: #2e2118;
          padding: 22px 16px 52px;
        }
        .learn-library-shell { max-width: 1060px; margin: 0 auto; }
        .learn-library-back { display: inline-flex; min-height: 44px; align-items: center; color: #8a6a42; text-decoration: none; font-size: 14px; font-weight: 800; }
        .learn-library-hero {
          margin-top: 8px;
          padding: 24px;
          border: 1px solid #eadbc8;
          border-radius: 18px;
          background: rgba(255,252,248,.9);
          box-shadow: 0 18px 42px rgba(92,65,35,.08);
        }
        .learn-library-eyebrow { color: #a46d35; letter-spacing: .14em; text-transform: uppercase; font-size: 12px; font-weight: 900; }
        .learn-library-hero h1 { margin: 10px 0 10px; font-family: var(--font-display); font-size: clamp(34px, 8vw, 54px); line-height: 1.05; font-weight: 500; letter-spacing: 0; }
        .learn-library-hero p { max-width: 720px; margin: 0; color: #5f544b; line-height: 1.8; }
        .learn-directory { margin-top: 18px; }
        .learn-filter {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          padding: 14px;
          border: 1px solid #eadbc8;
          border-radius: 16px;
          background: rgba(255,252,248,.92);
        }
        .learn-filter label { display: grid; gap: 7px; min-width: 0; }
        .learn-filter span { font-size: 12px; color: #8a8078; font-weight: 800; }
        .learn-filter input, .learn-filter select {
          width: 100%;
          height: 48px;
          border: 1px solid #e2d4c2;
          border-radius: 12px;
          background: #fff;
          color: #2e2118;
          font-size: 15px;
          padding: 0 13px;
          outline: none;
        }
        .learn-filter input:focus, .learn-filter select:focus { border-color: #b67525; box-shadow: 0 0 0 3px rgba(182,117,37,.12); }
        .learn-result-meta { margin: 14px 4px; color: #8a8078; font-size: 14px; }
        .learn-creator-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .learn-creator-card {
          display: grid;
          grid-template-columns: 92px 1fr;
          gap: 16px;
          padding: 18px;
          border: 1px solid #eadbc8;
          border-radius: 16px;
          background: #fffdfa;
          box-shadow: 0 12px 30px rgba(92,65,35,.06);
        }
        .learn-creator-card__avatar {
          width: 92px;
          height: 92px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 50%;
          background: #f6eee4;
          color: #9a6429;
          text-decoration: none;
          font-size: 32px;
          font-weight: 900;
        }
        .learn-creator-card h2 { margin: 0; font-size: 22px; }
        .learn-creator-card p { margin: 12px 0 0; color: #5f544b; line-height: 1.72; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .learn-creator-card__tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
        .learn-creator-card__tags span {
          border-radius: 999px;
          background: #f6eee4;
          color: #8a5b2d;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 800;
        }
        .learn-creator-card__actions { display: flex; gap: 10px; margin-top: 16px; }
        .learn-creator-card__actions a {
          min-height: 44px;
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #7a4b22;
          color: white;
          text-decoration: none;
          font-size: 14px;
          font-weight: 900;
        }
        .learn-creator-card__actions a + a { background: #fff; color: #7a4b22; border: 1px solid #d8c7b3; }
        .learn-empty { padding: 38px 16px; text-align: center; color: #8a8078; }
        @media (max-width: 760px) {
          .learn-library-page { padding: 14px 12px 42px; }
          .learn-library-hero { padding: 20px 18px; border-radius: 16px; }
          .learn-filter, .learn-creator-grid { grid-template-columns: 1fr; }
          .learn-creator-card { grid-template-columns: 74px 1fr; padding: 16px; gap: 13px; }
          .learn-creator-card__avatar { width: 74px; height: 74px; font-size: 26px; }
        }
      `}</style>
      <div className="learn-library-shell">
        <Link href="/learn" className="learn-library-back">返回学习模块</Link>
        <section className="learn-library-hero">
          <div className="learn-library-eyebrow">Creator Learning</div>
          <h1>认识常见博主</h1>
          <p>把桨板内容创作者浓缩成学习卡片，快速判断他们在哪个平台、擅长什么内容、适合从哪里获取教程和测评。</p>
        </section>
        <LearnCreatorsClient creators={creators} />
      </div>
    </main>
  );
}
