import Link from 'next/link';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import LearnBrandsClient, { type LearnBrandItem } from '@/components/LearnBrandsClient';

export const dynamic = 'force-dynamic';

interface BrandRow extends RowDataPacket {
  brand_id: number;
  slug: string;
  name: string;
  name_en: string | null;
  logo: string | null;
  country: string | null;
  website: string | null;
  description: string | null;
  tier: string;
  product_count: number;
  product_types: string | null;
}

async function getBrands(): Promise<LearnBrandItem[]> {
  try {
    const [rows] = await pool.execute<BrandRow[]>(
      `SELECT
         b.brand_id, b.slug, b.name, b.name_en, b.logo, b.country, b.website, b.description, b.tier,
         COUNT(DISTINCT p.product_id) AS product_count,
         GROUP_CONCAT(DISTINCT p.type ORDER BY p.type SEPARATOR ',') AS product_types
       FROM sup_brands b
       LEFT JOIN sup_products p ON p.brand_id = b.brand_id AND p.status = 'published'
       WHERE b.status = 'published'
       GROUP BY b.brand_id
       ORDER BY product_count DESC, b.name ASC`
    );
    return rows.map((row) => ({
      brand_id: Number(row.brand_id),
      slug: row.slug,
      name: row.name,
      name_en: row.name_en,
      logo: row.logo,
      country: row.country,
      website: row.website,
      description: row.description,
      tier: row.tier,
      product_count: Number(row.product_count || 0),
      product_types: row.product_types ? row.product_types.split(',').filter(Boolean) : [],
    }));
  } catch (error) {
    console.error('获取品牌学习列表失败:', error);
    return [];
  }
}

export default async function LearnBrandsPage() {
  const brands = await getBrands();

  return (
    <main className="learn-library-page">
      <style>{`
        .learn-library-page {
          min-height: 100vh;
          background: radial-gradient(circle at 12% 0%, rgba(216,158,74,.14), transparent 30%), #fbf7f1;
          color: #2e2118;
          padding: 22px 16px 52px;
        }
        .learn-library-shell { max-width: 1160px; margin: 0 auto; }
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
        .learn-brand-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .learn-brand-card {
          padding: 18px;
          border: 1px solid #eadbc8;
          border-radius: 16px;
          background: #fffdfa;
          box-shadow: 0 12px 30px rgba(92,65,35,.06);
        }
        .learn-brand-card__top { display: grid; grid-template-columns: 112px 1fr; gap: 15px; align-items: center; }
        .learn-brand-card__logo { min-height: 74px; display: grid; place-items: center; border-radius: 14px; background: #f8efe4; text-decoration: none; }
        .learn-brand-card h2 { margin: 0; font-size: 21px; }
        .learn-brand-card p { margin: 0; }
        .learn-brand-card__top p { margin-top: 4px; color: #8a8078; font-size: 13px; }
        .learn-brand-card__tags, .learn-brand-card__products { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 14px; }
        .learn-brand-card__tags span, .learn-brand-card__products span {
          border-radius: 999px;
          background: #f6eee4;
          color: #8a5b2d;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 800;
        }
        .learn-brand-card__desc { margin-top: 14px !important; color: #5f544b; line-height: 1.75; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .learn-brand-card__actions { display: flex; gap: 10px; margin-top: 16px; }
        .learn-brand-card__actions a {
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
        .learn-brand-card__actions a + a { background: #fff; color: #7a4b22; border: 1px solid #d8c7b3; }
        .learn-empty { padding: 38px 16px; text-align: center; color: #8a8078; }
        @media (max-width: 760px) {
          .learn-library-page { padding: 14px 12px 42px; }
          .learn-library-hero { padding: 20px 18px; border-radius: 16px; }
          .learn-filter, .learn-brand-grid { grid-template-columns: 1fr; }
          .learn-brand-card { padding: 16px; }
          .learn-brand-card__top { grid-template-columns: 90px 1fr; gap: 12px; }
          .learn-brand-card__logo { min-height: 66px; }
        }
      `}</style>
      <div className="learn-library-shell">
        <Link href="/learn" className="learn-library-back">返回学习模块</Link>
        <section className="learn-library-hero">
          <div className="learn-library-eyebrow">Brand Learning</div>
          <h1>认识常见品牌</h1>
          <p>把品牌库和产品线浓缩成适合学习的知识卡片，快速了解品牌国家、定位、代表产品线与后续查阅入口。</p>
        </section>
        <LearnBrandsClient brands={brands} />
      </div>
    </main>
  );
}
