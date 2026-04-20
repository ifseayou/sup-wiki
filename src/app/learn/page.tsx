import Link from 'next/link';
import Tooltip from '@/components/Tooltip';
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
  } catch { return 0; }
}


export default async function LearnPage() {
  const totalQuestions = await getTotalQuestions();
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>
      {/* 学习进度统计 */}
      <LearnStats totalQuestions={totalQuestions} />

      {/* 页头 */}
      <div style={{ marginBottom: 48 }}>
        <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#A08060', marginBottom: 16 }}>
          <Tooltip tip="桨板知识中心" dotted={false}>SUP Knowledge Hub</Tooltip>
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px,5vw,60px)', fontWeight: 300, color: '#2E2118', lineHeight: 1.1, margin: '0 0 20px' }}>
          桨板知识<br /><em style={{ fontStyle: 'italic' }}>系统学习</em>
        </h1>
        <div style={{ width: 40, height: 1, background: '#A08060', marginBottom: 20 }} />
        <p style={{ fontSize: 15, color: '#655D56', lineHeight: 1.8, maxWidth: 560 }}>
          从装备选购到竞技规则，系统掌握桨板运动知识。通过分类题库检验自己的掌握程度，成为真正的桨板专家。
        </p>
      </div>

      {/* 学习文档入口 */}
      <Link
        href="/learn/docs"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
          background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 16,
          padding: '24px 28px', marginBottom: 28, textDecoration: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        className="learn-docs-entry"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 260 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: '#F5EDE4', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, flexShrink: 0,
          }}>📖</div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#A08060', marginBottom: 6 }}>
              Learning Documents
            </div>
            <div style={{ fontSize: 19, fontWeight: 600, color: '#2E2118', marginBottom: 4 }}>
              学习文档
            </div>
            <div style={{ fontSize: 13, color: '#655D56', lineHeight: 1.6 }}>
              系统阅读肌肉训练、拉伸放松、进阶技术动作等主题文档，配合题库一起学
            </div>
          </div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: '#7A6145', fontWeight: 500,
          padding: '10px 18px', border: '1px solid #D4C4B0', borderRadius: 10,
          whiteSpace: 'nowrap',
        }}>
          浏览全部 →
        </span>
      </Link>

      {/* 分类学习 & 测验（含：收藏 / 错题 / 全科综合 + 8 个分类） */}
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: '#2E2118', marginBottom: 6 }}>
        分类学习 &amp; 测验
      </h2>
      <p style={{ fontSize: 13, color: '#8A8078', marginBottom: 24, lineHeight: 1.7 }}>
        前三张（收藏 / 错题 / 综合测验）用于巩固当前学习进度，后续按分类深入具体知识领域。
      </p>
      <CategoryGrid />

      {/* 难度入口 */}
      <div style={{ marginTop: 48, borderTop: '1px solid #EDE5D8', paddingTop: 36 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: '#2E2118', marginBottom: 24 }}>
          按难度练习
        </h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { key: 'beginner', label: '入门练习', sub: '基础概念，快速掌握', color: '#0E6655', bg: '#E9F7EF' },
            { key: 'intermediate', label: '进阶挑战', sub: '深入规则，提升段位', color: '#B7470A', bg: '#FDF2E9' },
            { key: 'advanced', label: '专家题目', sub: '技术细节，精英认证', color: '#6C3483', bg: '#F4ECF7' },
          ].map(d => (
            <Link
              key={d.key}
              href={`/learn/quiz?difficulty=${d.key}`}
              style={{
                flex: 1, minWidth: 180, padding: '20px 24px',
                background: d.bg, border: `1px solid ${d.color}25`, borderRadius: 12,
                textDecoration: 'none', transition: 'border-color 0.15s',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: '#2E2118', marginBottom: 4 }}>{d.label}</div>
              <div style={{ fontSize: 12, color: d.color }}>{d.sub}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── 媒体与官方平台 ─────────────────────────────────────── */}
      <div style={{ marginTop: 56, borderTop: '1px solid #EDE5D8', paddingTop: 40 }}>
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#A08060', marginBottom: 10 }}>
            Media &amp; Official Platforms
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 400, color: '#2E2118', margin: '0 0 10px' }}>
            媒体与官方平台
          </h2>
          <p style={{ fontSize: 14, color: '#655D56', lineHeight: 1.7, maxWidth: 560, margin: 0 }}>
            收录国内外权威 SUP 媒体、官方机构与赛事平台，帮助你获取第一手资讯、规则和成绩数据。
          </p>
        </div>

        {/* 国内平台 */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ fontSize: 18 }}>🇨🇳</span>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#2E2118', margin: 0 }}>国内平台</h3>
            <div style={{ flex: 1, height: 1, background: '#EDE5D8' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {[
              {
                name: '国家体育总局水上运动管理中心',
                nameEn: 'CWSC – Water Sports',
                url: 'https://www.sport.gov.cn/sszx/',
                tag: '官方机构', tagColor: '#1A5276', tagBg: '#EBF5FB',
                icon: '🏛️',
                desc: '桨板项目在国内的最高主管机构，负责全国俱乐部管理、技能认证和官方赛事组织，发布竞速等项目规则。',
              },
              {
                name: '中国桨板俱乐部联赛 CPL',
                nameEn: 'China Paddle League',
                url: 'https://www.sport.gov.cn/n14471/n14492/n14529/',
                tag: '官方赛事', tagColor: '#B7470A', tagBg: '#FDF2E9',
                icon: '🏆',
                desc: '国内顶级桨板竞速联赛（China Paddle League），每年多站巡回，由国家体育总局水上中心主办，点击可查看最新赛事动态与成绩。',
              },
              {
                name: '2025 桨板亚洲杯（浙江青田）',
                nameEn: '2025 SUP Asian Cup – Qingtian',
                url: 'http://www.qingtian.gov.cn/art/2025/7/14/art_1229365841_508699.html',
                tag: '官方赛事', tagColor: '#B7470A', tagBg: '#FDF2E9',
                icon: '🌏',
                desc: '2025年7月10-13日在浙江丽水青田举办，吸引亚洲10+国家845名运动员参赛，是亚洲最大规模桨板赛事系列之一。',
              },
              {
                name: '亚洲桨板锦标赛（ASF主办）',
                nameEn: 'Asian Surfing Federation – SUP',
                url: 'https://asiansurfing.org/',
                tag: '官方赛事', tagColor: '#B7470A', tagBg: '#FDF2E9',
                icon: '🏅',
                desc: '亚洲冲浪联合会（Asian Surfing Federation）主办的亚洲桨板锦标赛，2024年在湖北黄石举办，是亚洲区域最高级别官方桨板赛事。',
              },
              {
                name: '国家体育总局水上运动中心·桨板',
                nameEn: 'CWSC SUP News & Announcements',
                url: 'https://www.sport.gov.cn/sszx/n5207/',
                tag: '官方公告', tagColor: '#1A5276', tagBg: '#EBF5FB',
                icon: '📋',
                desc: '国家体育总局水上运动管理中心桨板专栏，发布桨板项目规则、俱乐部注册名单、赛事公告和运动员等级评定结果。',
              },
            ].map(p => (
              <a
                key={p.name}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 10,
                  background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 12, padding: '18px 20px',
                  transition: 'box-shadow 0.15s, border-color 0.15s', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{p.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#2E2118', lineHeight: 1.3 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#A08060', marginTop: 2 }}>{p.nameEn}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 14, color: '#C0B4A4', flexShrink: 0, marginTop: 2 }}>↗</span>
                </div>
                <p style={{ fontSize: 12, color: '#655D56', lineHeight: 1.65, margin: 0 }}>{p.desc}</p>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, width: 'fit-content',
                  background: p.tagBg, color: p.tagColor, fontWeight: 500 }}>{p.tag}</span>
              </a>
            ))}
          </div>
        </div>

        {/* 国际平台 */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ fontSize: 18 }}>🌐</span>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#2E2118', margin: 0 }}>国际平台</h3>
            <div style={{ flex: 1, height: 1, background: '#EDE5D8' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {[
              {
                name: 'ICF 国际皮划艇联合会',
                nameEn: 'International Canoe Federation',
                url: 'https://www.canoeicf.com/disciplines/stand-up-paddling',
                tag: '官方机构', tagColor: '#1A5276', tagBg: '#EBF5FB',
                icon: '🏛️',
                desc: 'IOC 认可的竞技 SUP 最高机构，制定竞速规则，举办世界杯与世界锦标赛，维护官方世界排名。',
              },
              {
                name: 'ISA 国际冲浪协会',
                nameEn: 'International Surfing Association',
                url: 'https://isasurf.org/',
                tag: '官方机构', tagColor: '#1A5276', tagBg: '#EBF5FB',
                icon: '🏛️',
                desc: 'IOC 认可的 SUP 奥运项目管辖机构，举办涵盖 SUP 冲浪、竞速和俯卧板的综合世界锦标赛。',
              },
              {
                name: 'APP World Tour',
                nameEn: 'Action Sports Paddling World Tour',
                url: 'https://www.appworldtour.com/',
                tag: '职业赛事', tagColor: '#6C3483', tagBg: '#F4ECF7',
                icon: '🏄',
                desc: '2010 年创办的国际职业 SUP 巡回赛（前身 Stand Up World Tour），涵盖冲浪和竞速两项，产生男女职业世界冠军。',
              },
              {
                name: 'TotalSUP',
                nameEn: 'TotalSUP',
                url: 'https://www.totalsup.com/',
                tag: '专业媒体', tagColor: '#7A6145', tagBg: '#F5EFE8',
                icon: '📰',
                desc: '创立于 2013 年，国际 SUP 第一大媒体，提供英语/法语双语内容，每日更新赛事报道、装备评测、运动员专访和赛事日历。',
              },
              {
                name: 'SUP Racer',
                nameEn: 'SUP Racer / Paddle Daily',
                url: 'https://supracer.com/',
                tag: '专业媒体', tagColor: '#7A6145', tagBg: '#F5EFE8',
                icon: '📰',
                desc: '专注竞速方向，维护独立的 SUP 世界排名系统（2013 年至今，覆盖 100+ 赛事），深度赛事故事和运动员专访是其核心优势。',
              },
              {
                name: 'SUPboarder Magazine',
                nameEn: 'SUPboarder Magazine',
                url: 'https://supboardermag.com/',
                tag: '专业媒体', tagColor: '#7A6145', tagBg: '#F5EFE8',
                icon: '📰',
                desc: '2012 年创办的英国 SUP 专业杂志，以独立装备评测著称（"by paddlers, for paddlers"），同时提供视频教学和付费专区内容。',
              },
              {
                name: 'SUP World Magazine',
                nameEn: 'SUP World Mag',
                url: 'https://www.supworldmag.com/',
                tag: '专业媒体', tagColor: '#7A6145', tagBg: '#F5EFE8',
                icon: '📰',
                desc: '国际印刷+数字一体 SUP 杂志（每年一期专题增刊），涵盖竞速、冲浪、远征、翼板等多种形式，是纸质 SUP 杂志中的代表。',
              },
              {
                name: 'Supconnect',
                nameEn: 'Supconnect',
                url: 'https://www.supconnect.com/',
                tag: '专业媒体', tagColor: '#7A6145', tagBg: '#F5EFE8',
                icon: '📰',
                desc: '成立于 2007 年，历史最悠久的 SUP 数字媒体，以深度桨板选购指南和 175+ 款产品横评为核心，每周覆盖 25 万+ 读者。',
              },
              {
                name: 'SUP Mag UK',
                nameEn: 'Stand Up Paddle Magazine UK',
                url: 'https://standuppaddlemag.co.uk/',
                tag: '专业媒体', tagColor: '#7A6145', tagBg: '#F5EFE8',
                icon: '📰',
                desc: '英国最主要的 SUP 数字+印刷杂志，聚焦英国及欧洲市场动态，兼顾全球旅行目的地和国际赛事报道。',
              },
            ].map(p => (
              <a
                key={p.name}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 10,
                  background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 12, padding: '18px 20px',
                  transition: 'box-shadow 0.15s, border-color 0.15s', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{p.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#2E2118', lineHeight: 1.3 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#A08060', marginTop: 2 }}>{p.nameEn}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 14, color: '#C0B4A4', flexShrink: 0, marginTop: 2 }}>↗</span>
                </div>
                <p style={{ fontSize: 12, color: '#655D56', lineHeight: 1.65, margin: 0 }}>{p.desc}</p>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, width: 'fit-content',
                  background: p.tagBg, color: p.tagColor, fontWeight: 500 }}>{p.tag}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
