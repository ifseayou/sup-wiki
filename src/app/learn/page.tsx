import Link from 'next/link';
import LearnStats from '@/components/LearnStats';
import CategoryGrid from '@/components/CategoryGrid';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

async function getTotalQuestions(): Promise<number> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as total FROM sup_quiz_questions WHERE status = 'published'"
    );
    return (rows[0] as { total: number }).total;
  } catch {
    return 0;
  }
}

const difficultyCards = [
  { key: 'beginner', label: '入门练习', sub: '基础知识，巩固入门', icon: '🌱', tag: '适合新手入门', tone: 'green' },
  { key: 'intermediate', label: '进阶挑战', sub: '提升理解，强化能力', icon: '⛰️', tag: '巩固提升进阶', tone: 'orange' },
  { key: 'advanced', label: '专家题目', sub: '高阶应用，综合突破', icon: '♛', tag: '高阶能力突破', tone: 'purple' },
];

const internationalPlatforms = [
  {
    name: 'ICF 国际皮划艇联合会',
    nameEn: 'International Canoe Federation',
    url: 'https://www.canoeicf.com/disciplines/stand-up-paddling',
    tag: '官方机构',
    icon: '🏛️',
    desc: '竞技 SUP 重要国际组织，制定竞速规则，举办世界杯与世界锦标赛，维护官方世界排名。',
  },
  {
    name: 'ISA 国际冲浪协会',
    nameEn: 'International Surfing Association',
    url: 'https://isasurf.org/',
    tag: '官方机构',
    icon: '🏛️',
    desc: '国际冲浪与 SUP 相关项目组织，举办覆盖 SUP 冲浪、竞速和俯卧板的世界锦标赛。',
  },
  {
    name: 'APP World Tour',
    nameEn: 'Action Sports Paddling World Tour',
    url: 'https://www.appworldtour.com/',
    tag: '职业赛事',
    icon: '🏄',
    desc: '国际职业 SUP 巡回赛，涵盖冲浪和竞速两项，产生男女职业世界冠军。',
  },
  {
    name: 'TotalSUP',
    nameEn: 'TotalSUP',
    url: 'https://www.totalsup.com/',
    tag: '专业媒体',
    icon: '📰',
    desc: '国际 SUP 媒体，提供赛事报道、装备评测、运动员专访和赛事日历。',
  },
  {
    name: 'SUP Racer',
    nameEn: 'SUP Racer / Paddle Daily',
    url: 'https://supracer.com/',
    tag: '专业媒体',
    icon: '📰',
    desc: '专注竞速方向，维护独立的 SUP 世界排名系统，并提供深度赛事故事。',
  },
  {
    name: 'SUPboarder Magazine',
    nameEn: 'SUPboarder Magazine',
    url: 'https://supboardermag.com/',
    tag: '专业媒体',
    icon: '📰',
    desc: '英国 SUP 专业杂志，以独立装备评测、视频教学和付费专区内容见长。',
  },
];

type PlatformItem = (typeof internationalPlatforms)[number];

function PlatformGrid({ title, flag, items }: { title: string; flag: string; items: PlatformItem[] }) {
  return (
    <section className="platform-section">
      <div className="platform-section__head">
        <span>{flag}</span>
        <h3>{title}</h3>
        <i />
      </div>
      <div className="platform-grid">
        {items.map(item => (
          <a key={item.name} href={item.url} target="_blank" rel="noopener noreferrer" className="platform-card">
            <span className="platform-card__icon">{item.icon}</span>
            <span className="platform-card__main">
              <strong>{item.name}</strong>
              <em>{item.nameEn}</em>
              <small>{item.desc}</small>
              <b>{item.tag}</b>
            </span>
            <span className="platform-card__arrow">↗</span>
          </a>
        ))}
      </div>
    </section>
  );
}

export default async function LearnPage() {
  const totalQuestions = await getTotalQuestions();

  return (
    <main className="learn-page">
      <style>{`
        .learn-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at 16% 2%, rgba(216, 158, 74, 0.13), transparent 28%),
            radial-gradient(circle at 88% 18%, rgba(126, 89, 47, 0.09), transparent 24%),
            #fbf7f1;
          color: #2e2118;
          padding: 32px 24px 56px;
        }
        .learn-shell { max-width: 1160px; margin: 0 auto; }
        .learn-stats {
          display: grid;
          grid-template-columns: auto auto 1px minmax(220px, 1fr) auto auto;
          align-items: center;
          gap: 22px;
          margin: 0 auto 24px;
          padding: 20px 28px;
          border: 1px solid #eadbc8;
          border-radius: 18px;
          background: rgba(255, 252, 248, 0.88);
          box-shadow: 0 18px 42px rgba(92, 65, 35, 0.08);
        }
        .learn-stats__icon {
          width: 70px;
          height: 70px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          color: #c88a2b;
          background: linear-gradient(145deg, #fff8ed, #f3e4cf);
          font-size: 34px;
          transform: rotate(90deg);
        }
        .learn-stats__total strong { font-size: 28px; line-height: 1; color: #7a4b22; }
        .learn-stats__total span { margin-left: 4px; color: #8a6a42; font-weight: 700; }
        .learn-stats__total small { display: block; margin-top: 8px; color: #8a8078; font-size: 13px; }
        .learn-stats__divider { height: 46px; width: 1px; background: #eadbc8; }
        .learn-stats__title { font-weight: 800; color: #2e2118; }
        .learn-stats__subtitle { margin-top: 6px; font-size: 13px; color: #6d6258; }
        .learn-stats__bar { height: 10px; margin-top: 12px; border-radius: 999px; background: #efe8e1; overflow: hidden; }
        .learn-stats__bar span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #b67525, #dfaa52); }
        .learn-stats__percent { font-size: 14px; color: #7a6145; font-weight: 800; }
        .learn-stats__cta {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          min-width: 126px;
          height: 44px;
          padding: 0 20px;
          border-radius: 999px;
          background: linear-gradient(135deg, #d79d43, #b67525);
          color: white;
          text-decoration: none;
          font-size: 14px;
          font-weight: 800;
          box-shadow: 0 12px 24px rgba(154, 100, 37, 0.22);
        }
        .learn-hero { padding: 10px 4px 14px; }
        .learn-eyebrow { color: #a46d35; letter-spacing: 0.16em; text-transform: uppercase; font-size: 13px; margin-bottom: 12px; }
        .learn-hero h1 {
          font-family: var(--font-display);
          font-size: clamp(38px, 5vw, 58px);
          line-height: 1.05;
          font-weight: 400;
          margin: 0 0 16px;
          letter-spacing: 0;
        }
        .learn-rule { width: 42px; height: 2px; background: #d89a36; margin-bottom: 18px; }
        .learn-hero p { color: #5f544b; line-height: 1.8; margin: 0; max-width: 560px; }
        .learn-doc-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin: 10px 0 18px;
          padding: 18px 24px;
          border: 1px solid #eadbc8;
          border-radius: 16px;
          background: rgba(255, 252, 248, 0.9);
          box-shadow: 0 12px 30px rgba(92, 65, 35, 0.06);
          text-decoration: none;
          color: inherit;
        }
        .learn-doc-card__left { display: flex; align-items: center; gap: 18px; min-width: 0; }
        .learn-doc-card__icon {
          width: 70px; height: 70px; border-radius: 18px;
          display: grid; place-items: center; background: #f4eee8; font-size: 32px;
        }
        .learn-doc-card em { display: block; color: #b67525; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; font-style: normal; }
        .learn-doc-card strong { display: block; margin-top: 4px; font-size: 22px; }
        .learn-doc-card small { display: block; margin-top: 6px; color: #6d6258; font-size: 14px; }
        .learn-doc-card__cta {
          border: 1px solid #d3a15d;
          border-radius: 999px;
          color: #b67525;
          padding: 12px 24px;
          font-weight: 800;
          white-space: nowrap;
        }
        .section-title { margin: 24px 0 14px; }
        .section-title h2 { margin: 0 0 8px; font-family: var(--font-display); font-size: 28px; font-weight: 500; }
        .section-title p { margin: 0; color: #8a8078; font-size: 14px; }
        .learn-knowledge-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 16px 0 20px; }
        .learn-knowledge-card {
          min-height: 150px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 18px;
          padding: 22px 24px;
          border: 1px solid #eadbc8;
          border-radius: 16px;
          background: rgba(255,252,248,0.9);
          color: #2e2118;
          text-decoration: none;
          box-shadow: 0 12px 30px rgba(92, 65, 35, 0.06);
        }
        .learn-knowledge-card__icon {
          width: 68px;
          height: 68px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: linear-gradient(145deg, #fff8ed, #f3e4cf);
          font-size: 34px;
        }
        .learn-knowledge-card strong { display: block; font-size: 22px; }
        .learn-knowledge-card em { display: block; margin-top: 4px; color: #b67525; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; font-style: normal; }
        .learn-knowledge-card small { display: block; margin-top: 10px; color: #5f544b; font-size: 14px; line-height: 1.7; }
        .learn-knowledge-card__arrow { color: #9b7b53; font-size: 28px; }
        .learn-quick-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px; }
        .learn-quick-card {
          position: relative;
          min-height: 148px;
          display: grid;
          grid-template-columns: auto 1fr;
          grid-template-rows: auto 1fr auto;
          gap: 16px;
          padding: 20px 20px 18px;
          border: 1px solid #eadbc8;
          border-radius: 14px;
          text-decoration: none;
          color: #2e2118;
          background: #fffaf4;
          overflow: hidden;
        }
        .learn-quick-card--warm { background: #fff3eb; border-color: #efcdb8; }
        .learn-quick-card--dark { background: linear-gradient(135deg, #3a281c, #6c4d31); color: #fff8ee; border-color: #4c3827; }
        .learn-quick-card__icon, .learn-category-card__icon, .platform-card__icon {
          width: 54px; height: 54px; border-radius: 14px; display: grid; place-items: center; background: rgba(255,255,255,0.66); font-size: 28px;
        }
        .learn-quick-card__icon { grid-row: 1 / 4; }
        .learn-quick-card__body { min-width: 0; padding-right: 72px; }
        .learn-quick-card__body span { display: block; }
        .learn-quick-card__title { font-size: 18px; font-weight: 900; }
        .learn-quick-card__en { margin-top: 4px; color: #b67525; font-size: 12px; text-transform: uppercase; }
        .learn-quick-card--dark .learn-quick-card__en { color: #dba85d; }
        .learn-quick-card__desc { margin-top: 12px; color: #6d6258; font-size: 14px; line-height: 1.7; }
        .learn-quick-card--dark .learn-quick-card__desc { color: rgba(255,255,255,0.76); }
        .learn-quick-card__count { position: absolute; top: 16px; right: 18px; padding: 5px 12px; border-radius: 999px; background: rgba(176, 128, 63, 0.14); color: #9a6429; font-size: 12px; font-weight: 800; }
        .learn-quick-card--dark .learn-quick-card__count { background: rgba(255,255,255,0.13); color: #f0c780; }
        .learn-quick-card__cta { grid-column: 2; justify-self: end; align-self: end; margin-top: 8px; color: #9a6429; font-size: 13px; font-weight: 900; white-space: nowrap; }
        .learn-quick-card--dark .learn-quick-card__cta { color: #f0c780; }
        .learn-category-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .learn-category-card {
          min-height: 112px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 16px;
          padding: 18px 20px;
          border: 1px solid;
          border-radius: 12px;
          color: #2e2118;
          text-decoration: none;
        }
        .learn-category-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .learn-category-card strong { display: block; font-size: 18px; }
        .learn-category-card em { display: block; margin-top: 4px; font-size: 12px; font-style: normal; text-transform: uppercase; }
        .learn-category-card small { padding: 5px 10px; border-radius: 999px; background: rgba(255,255,255,0.66); color: #9b7b53; font-size: 12px; white-space: nowrap; }
        .learn-category-card__desc { display: block; margin-top: 12px; color: #5f544b; font-size: 14px; line-height: 1.65; }
        .learn-category-card__badge { display: inline-block; margin-top: 10px; padding: 4px 10px; border-radius: 999px; color: white; font-size: 11px; font-weight: 800; }
        .learn-category-card__arrow { color: #7a6145; font-size: 28px; }
        .difficulty-section { margin-top: 42px; padding-top: 30px; border-top: 1px solid #eadbc8; }
        .difficulty-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
        .difficulty-card {
          display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 20px;
          padding: 24px 28px; border-radius: 14px; border: 1px solid #eadbc8; color: #2e2118; text-decoration: none;
          box-shadow: 0 14px 34px rgba(92, 65, 35, 0.06);
        }
        .difficulty-card--green { background: #eef9f4; }
        .difficulty-card--orange { background: #fff6ee; }
        .difficulty-card--purple { background: #f8f0ff; }
        .difficulty-card__icon { width: 78px; height: 78px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,0.64); font-size: 38px; }
        .difficulty-card strong { display: block; font-size: 22px; }
        .difficulty-card small { display: block; margin-top: 6px; color: #6d6258; font-size: 14px; }
        .difficulty-card b { display: inline-block; margin-top: 12px; padding: 6px 12px; border-radius: 999px; background: rgba(255,255,255,0.7); color: #a46d35; font-size: 12px; }
        .platforms { margin-top: 44px; padding-top: 34px; border-top: 1px solid #eadbc8; }
        .platforms__eyebrow { color: #a46d35; letter-spacing: 0.16em; text-transform: uppercase; font-size: 13px; }
        .platforms h2 { margin: 14px 0 8px; font-family: var(--font-display); font-size: 34px; font-weight: 500; }
        .platforms > p { color: #5f544b; max-width: 760px; line-height: 1.8; }
        .platform-section { margin-top: 28px; }
        .platform-section__head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .platform-section__head h3 { margin: 0; font-size: 18px; }
        .platform-section__head i { flex: 1; height: 1px; background: #eadbc8; }
        .platform-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .platform-card {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 16px;
          min-height: 154px;
          padding: 22px;
          border: 1px solid #eadbc8;
          border-radius: 14px;
          background: rgba(255,252,248,0.88);
          box-shadow: 0 12px 28px rgba(92, 65, 35, 0.06);
          color: #2e2118;
          text-decoration: none;
        }
        .platform-card__main strong { display: block; font-size: 17px; line-height: 1.4; }
        .platform-card__main em { display: block; margin-top: 3px; color: #9b7b53; font-size: 12px; font-style: normal; }
        .platform-card__main small { display: block; margin-top: 12px; color: #5f544b; font-size: 14px; line-height: 1.7; }
        .platform-card__main b { display: inline-block; margin-top: 12px; padding: 5px 10px; border-radius: 999px; background: #eef8f3; color: #277056; font-size: 12px; }
        .platform-card__arrow { color: #9b7b53; font-size: 20px; }
        @media (max-width: 900px) {
          .learn-stats { grid-template-columns: auto auto 1fr; gap: 16px; }
          .learn-stats__divider, .learn-stats__percent { display: none; }
          .learn-stats__body, .learn-stats__cta { grid-column: 1 / -1; }
          .learn-knowledge-grid, .learn-quick-grid, .learn-category-grid, .difficulty-grid, .platform-grid { grid-template-columns: 1fr; }
          .learn-knowledge-card { min-height: 0; padding: 18px; grid-template-columns: auto 1fr; }
          .learn-knowledge-card__arrow { display: none; }
          .learn-quick-card__body { padding-right: 76px; }
          .learn-doc-card { align-items: flex-start; }
          .learn-doc-card__cta { display: none; }
        }
      `}</style>

      <div className="learn-shell">
        <LearnStats totalQuestions={totalQuestions} />

        <section className="learn-hero">
          <div className="learn-eyebrow">SUP Knowledge Hub</div>
          <h1>桨板知识系统学习</h1>
          <div className="learn-rule" />
          <p>
            从装备选购到竞技规则，系统掌握桨板运动知识。通过分类题库检验自己的掌握程度，成为真正的桨板专家。
          </p>
        </section>

        <Link href="/learn/docs" className="learn-doc-card">
          <span className="learn-doc-card__left">
            <span className="learn-doc-card__icon">📖</span>
            <span>
              <em>Learning Documents</em>
              <strong>学习文档</strong>
              <small>系统阅读肌肉训练、拉伸放松、进阶技术动作等主题文档，配合题库一起学。</small>
            </span>
          </span>
          <span className="learn-doc-card__cta">浏览全部 →</span>
        </Link>

        <section className="section-title">
          <h2>认识桨板圈</h2>
          <p>把品牌、产品线和内容创作者浓缩成适合手机浏览的学习卡片。</p>
        </section>
        <div className="learn-knowledge-grid">
          <Link href="/learn/brands" className="learn-knowledge-card">
            <span className="learn-knowledge-card__icon">🏷️</span>
            <span>
              <strong>认识常见品牌</strong>
              <em>Brand Learning</em>
              <small>了解主流桨板品牌、国家地区、定位与代表产品线，后续再进入详情页深挖。</small>
            </span>
            <span className="learn-knowledge-card__arrow">›</span>
          </Link>
          <Link href="/learn/creators" className="learn-knowledge-card">
            <span className="learn-knowledge-card__icon">🎙️</span>
            <span>
              <strong>认识常见博主</strong>
              <em>Creator Learning</em>
              <small>快速认识桨板内容创作者，判断他们适合用来学习教程、测评还是训练经验。</small>
            </span>
            <span className="learn-knowledge-card__arrow">›</span>
          </Link>
        </div>

        <section className="section-title">
          <h2>分类学习 &amp; 测验</h2>
          <p>前三张用于巩固当前学习进度，后续按分类深入具体知识领域。</p>
        </section>
        <CategoryGrid />

        <section className="difficulty-section">
          <div className="section-title">
            <h2>按难度练习</h2>
            <p>循序渐进提升知识与技能，选择适合你的练习难度开始学习。</p>
          </div>
          <div className="difficulty-grid">
            {difficultyCards.map(card => (
              <Link key={card.key} href={`/learn/quiz?difficulty=${card.key}`} className={`difficulty-card difficulty-card--${card.tone}`}>
                <span className="difficulty-card__icon">{card.icon}</span>
                <span>
                  <strong>{card.label}</strong>
                  <small>{card.sub}</small>
                  <b>{card.tag}</b>
                </span>
                <span className="learn-category-card__arrow">›</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="platforms">
          <div className="platforms__eyebrow">Media &amp; Official Platforms</div>
          <h2>媒体与官方平台</h2>
          <p>
            收录国际 SUP 官方机构、赛事平台和专业媒体，帮助你获取一手资讯、规则和成绩数据。
          </p>
          <PlatformGrid title="国外平台" flag="🌐" items={internationalPlatforms} />
        </section>
      </div>
    </main>
  );
}
