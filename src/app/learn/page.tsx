import Link from 'next/link';
import Tooltip from '@/components/Tooltip';

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
];

export default function LearnPage() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>
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
    </div>
  );
}
