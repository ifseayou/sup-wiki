import Link from 'next/link';
import Tooltip from '@/components/Tooltip';
import LearnStats from '@/components/LearnStats';
import WrongAnswerEntry from '@/components/WrongAnswerEntry';
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

const CATEGORIES = [
  {
    key: 'equipment',
    label: '装备知识',
    labelEn: 'Equipment',
    icon: '🏄',
    desc: '板型选择、材质工艺、充气板 vs 硬板、鳍系统',
    color: '#7A6145',
    bg: '#F5EFE8',
  },
  {
    key: 'technique',
    label: '技术动作',
    labelEn: 'Technique',
    icon: '🎯',
    desc: '划桨姿势、入水角度、转向技术、竞速策略',
    color: '#1A5276',
    bg: '#EBF5FB',
  },
  {
    key: 'race',
    label: '竞赛规则',
    labelEn: 'Competition',
    icon: '🏆',
    desc: 'ICF 规则、组别说明、CPL 联赛、绕标规范',
    color: '#B7470A',
    bg: '#FDF2E9',
  },
  {
    key: 'safety',
    label: '安全知识',
    labelEn: 'Safety',
    icon: '🛡️',
    desc: '踝绳使用、天气判断、离岸风、落水处置',
    color: '#0E6655',
    bg: '#E9F7EF',
  },
  {
    key: 'maintenance',
    label: '保养维护',
    labelEn: 'Maintenance',
    icon: '🔧',
    desc: '充气存放、碳板防护、修补方法、日常保养',
    color: '#6C3483',
    bg: '#F4ECF7',
  },
  {
    key: 'history',
    label: '运动历史',
    labelEn: 'History',
    icon: '📖',
    desc: 'SUP 起源、夏威夷文化、国际发展、中国现状',
    color: '#515A5A',
    bg: '#F2F3F4',
  },
  {
    key: 'board_id',
    label: '看图识板',
    labelEn: 'Board ID',
    icon: '🖼️',
    desc: '根据图片识别桨板品牌与型号，练就火眼金睛',
    color: '#7A6145',
    bg: '#F5EFE8',
    badge: '图片题',
  },
  {
    key: 'athlete_id',
    label: '认识运动员',
    labelEn: 'Athlete ID',
    icon: '🏅',
    desc: '看脸认人，掌握国际顶尖桨板运动员的中英文名',
    color: '#1A5276',
    bg: '#EBF5FB',
    badge: '图片题',
  },
];

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

      {/* 全科综合测验入口 */}
      <div style={{
        background: 'linear-gradient(135deg, #2E2118 0%, #5E4A33 100%)',
        borderRadius: 16, padding: '32px 36px', marginBottom: 40,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20,
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
            <Tooltip tip="综合测验" dotted={false}>Comprehensive Test</Tooltip>
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#fff', marginBottom: 8 }}>全科综合测验</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
            随机抽取 20 道题，覆盖所有知识领域，测试你的综合桨板知识水平
          </div>
        </div>
        <Link
          href="/learn/quiz"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#C4A882', color: '#2E2118', fontWeight: 600,
            padding: '14px 28px', borderRadius: 10, fontSize: 15,
            textDecoration: 'none', whiteSpace: 'nowrap', transition: 'opacity 0.15s',
          }}
        >
          开始测验 →
        </Link>
      </div>

      {/* 错题练习入口（登录后有错题才显示） */}
      <WrongAnswerEntry />

      {/* 分类题库 */}
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: '#2E2118', marginBottom: 24 }}>
        按分类学习 &amp; 测验
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {CATEGORIES.map(cat => (
          <div
            key={cat.key}
            style={{
              background: cat.bg, border: `1px solid ${cat.color}25`,
              borderRadius: 12, padding: '24px', display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>{cat.icon}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#2E2118' }}>{cat.label}</div>
                <div style={{ fontSize: 11, color: cat.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  <Tooltip tip={cat.label} dotted={false}>{cat.labelEn}</Tooltip>
                </div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: '#655D56', lineHeight: 1.65, margin: 0 }}>{cat.desc}</p>
            {(cat as typeof cat & { badge?: string }).badge && (
              <span style={{ fontSize: 10, background: cat.color, color: '#fff', padding: '2px 7px', borderRadius: 8, width: 'fit-content', opacity: 0.85 }}>
                {(cat as typeof cat & { badge?: string }).badge}
              </span>
            )}
            <Link
              href={`/learn/quiz?category=${cat.key}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'auto',
                padding: '9px 18px', background: cat.color, color: '#fff',
                borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none',
                width: 'fit-content', transition: 'opacity 0.15s',
              }}
            >
              开始 {cat.label} 测验 →
            </Link>
          </div>
        ))}
      </div>

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
