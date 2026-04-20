'use client';

import { useState } from 'react';

/**
 * 交互式桨板肌群发力图。前视 / 后视两个视图，每个视图 5 个可交互肌群区域。
 * 人体轮廓使用弧线 / 椭圆拼接，强调：
 *   - 肩膀三角肌弧度  - 腰部明显收窄
 *   - 臀部凸起（后视图重点）- 大腿 / 小腿上粗下细
 *   - 膝 / 肘关节圆，避免"积木感"
 */

interface MuscleHotspot {
  id: string;
  name: string;
  alias: string;
  color: string;
  hoverColor: string;
  action: string;
  timing: string;
  tip: string;
  training: string;
}

const ANTERIOR: MuscleHotspot[] = [
  {
    id: 'chest_front_delt',
    name: '胸肌 + 三角肌前束',
    alias: 'Pectoralis major / Anterior deltoid',
    color: '#D4A574',
    hoverColor: '#B8823F',
    action: '提桨入水，把桨送到板前方最远端。',
    timing: '划水周期的**起始阶段**——抓水前的前伸发力。',
    tip: '前伸不够远 = 每一桨的有效拉距被浪费。',
    training: '俯卧撑 / 弹力带前平举 / 双杠臂屈伸',
  },
  {
    id: 'core_anterior',
    name: '核心',
    alias: '腹直肌 / 腹斜肌',
    color: '#C49A6C',
    hoverColor: '#9A7042',
    action: '**躯干稳定 + 旋转**，把肩部发力通过脊柱传到脚底。',
    timing: '整个划水周期**持续收紧**（等长收缩），不能松。',
    tip: '划不到 10 分钟腰就酸 = 核心代偿不足，不是腰不行。',
    training: '平板支撑 / 侧平板 / 死虫 / 农夫行走',
  },
  {
    id: 'quadriceps',
    name: '股四头肌',
    alias: 'Quadriceps (大腿前)',
    color: '#96A886',
    hoverColor: '#6F8563',
    action: '站姿支撑 + **半蹲前倾推桨**的发力支点。',
    timing: '推桨发力阶段——臀腿联动把力送上躯干。',
    tip: '膝盖全程紧绷 = 没用臀吸震，几公里就抖腿。',
    training: '高脚杯深蹲 / 保加利亚分腿蹲 / 箭步蹲',
  },
  {
    id: 'forearm_front',
    name: '前臂屈肌 / 握力',
    alias: 'Flexor digitorum / Flexor carpi',
    color: '#B5A3C7',
    hoverColor: '#8D76A5',
    action: '**持桨 + 控制桨叶角度**，长距离赛的隐形短板。',
    timing: '全程——但要轻握，不是死握。',
    tip: '划半小时抓不住桨 = 握力储备不足，不是手废了。',
    training: '握力器 / 悬吊挂杠 / 毛巾拧水',
  },
  {
    id: 'calf_front',
    name: '小腿（前视）',
    alias: 'Tibialis anterior / Gastrocnemius',
    color: '#A8BF9A',
    hoverColor: '#7E9770',
    action: '**脚踝微调 + 重心转移吸震**，应对水面起伏。',
    timing: '涌浪 / 侧风 / 过航船尾流时。',
    tip: '站得笔直 = 小腿没参与平衡，一个浪就倒。',
    training: '提踵（双脚 / 单脚） / 跳绳 / 平衡板',
  },
];

const POSTERIOR: MuscleHotspot[] = [
  {
    id: 'traps_rear_delt',
    name: '斜方肌 + 三角肌后束',
    alias: 'Trapezius / Posterior deltoid',
    color: '#D4A574',
    hoverColor: '#B8823F',
    action: '**拔桨出水**——把桨叶迅速抽离水面不拖水。',
    timing: '划水周期的**收尾阶段**。',
    tip: '耸肩代偿 = 斜方上束过劳，肩胛没下沉。',
    training: '弹力带面拉 / 俯身飞鸟 / YTW 训练',
  },
  {
    id: 'lats',
    name: '背阔肌',
    alias: 'Latissimus dorsi（桨板主发力肌！）',
    color: '#8B6F4E',
    hoverColor: '#5A4530',
    action: '**拉桨发力主力**——像做引体向上。',
    timing: '入水后到拉到脚边的主拉距阶段。',
    tip: '新手用二头肌拉桨 = 半小时手臂废。**正确是背阔 + 躯干旋转**。',
    training: '引体向上 / 俯身划船 / 直臂下拉',
  },
  {
    id: 'erector_spinae',
    name: '竖脊肌 / 下背',
    alias: 'Erector spinae / Multifidus',
    color: '#A88660',
    hoverColor: '#7C5E3D',
    action: '**保持脊柱中立**，对抗前倾力矩，防止拱腰。',
    timing: '前倾姿态和涌浪冲击的瞬时反应。',
    tip: '腰酸 ≠ 腰不行，通常是竖脊肌耐力不够。',
    training: '硬拉 / 超人式 / 早安式屈体',
  },
  {
    id: 'glutes',
    name: '臀大肌',
    alias: 'Gluteus maximus',
    color: '#96A886',
    hoverColor: '#6F8563',
    action: '**前倾推桨的反作用力支点**——把力从板面反推回躯干。',
    timing: '每一桨的发力链末端；Pivot Turn 重心后压时。',
    tip: '不会用臀 = 膝盖代偿过度，长划膝盖疼。',
    training: '臀桥 / 相扑硬拉 / 髋外展',
  },
  {
    id: 'hamstrings',
    name: '腘绳肌',
    alias: 'Hamstrings (大腿后)',
    color: '#A8BF9A',
    hoverColor: '#7E9770',
    action: '**跪姿→站姿起身** + 减速吸震 + 髋伸展发力。',
    timing: '起立动作、紧急减速、过涌浪时。',
    tip: '跪站切换腿抖 = 腘绳肌发力与核心不同步。',
    training: '罗马尼亚硬拉 / 俯卧腿弯举 / 臀腿摆',
  },
];

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} style={{ color: '#2E2118', fontWeight: 600 }}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

/* ---------- 共用的中性骨架（头 / 脖 / 手 / 脚 / 上臂 / 膝肘关节） ---------- */
function NeutralSkeleton({ isAnterior = true }: { isAnterior?: boolean }) {
  return (
    <g>
      {/* 头 — 带下颌收缩 */}
      <path
        d="M 130 14
           C 151 14 164 30 164 50
           C 164 68 156 80 144 84
           L 147 96
           L 113 96
           L 116 84
           C 104 80 96 68 96 50
           C 96 30 109 14 130 14 Z"
        fill="#EDE0CE"
      />
      {/* 后视图在头中间加一点深色提示是"后脑勺" */}
      {!isAnterior && (
        <ellipse cx="130" cy="48" rx="18" ry="22" fill="#E1D1B7" opacity="0.4" />
      )}

      {/* 脖 */}
      <rect x="116" y="92" width="28" height="10" fill="#EDE0CE" />

      {/* 上臂 — 有三角肌弧形外凸 */}
      <path
        d="M 78 102
           Q 60 106 52 120
           Q 40 138 40 158
           L 38 196
           Q 42 210 54 210
           L 68 210
           Q 76 196 76 174
           L 80 140
           Q 82 118 78 102 Z"
        fill="#EDE0CE"
      />
      <path
        d="M 182 102
           Q 200 106 208 120
           Q 220 138 220 158
           L 222 196
           Q 218 210 206 210
           L 192 210
           Q 184 196 184 174
           L 180 140
           Q 178 118 182 102 Z"
        fill="#EDE0CE"
      />

      {/* 肘关节 */}
      <circle cx="53" cy="210" r="13" fill="#EDE0CE" />
      <circle cx="207" cy="210" r="13" fill="#EDE0CE" />

      {/* 手 — 带弧度的握姿暗示 */}
      <path
        d="M 42 300
           Q 42 314 54 316
           Q 68 316 68 302
           Q 68 290 60 285
           Q 48 283 44 290 Z"
        fill="#EDE0CE"
      />
      <path
        d="M 218 300
           Q 218 314 206 316
           Q 192 316 192 302
           Q 192 290 200 285
           Q 212 283 216 290 Z"
        fill="#EDE0CE"
      />

      {/* 膝关节 */}
      <circle cx="108" cy="395" r="14" fill="#EDE0CE" />
      <circle cx="152" cy="395" r="14" fill="#EDE0CE" />

      {/* 脚 — 椭圆带细节 */}
      <ellipse cx="105" cy="508" rx="19" ry="9" fill="#EDE0CE" />
      <ellipse cx="155" cy="508" rx="19" ry="9" fill="#EDE0CE" />
    </g>
  );
}

/* ---------- 前视图 ---------- */
function AnteriorBody({
  activeId, setActiveId,
}: { activeId: string | null; setActiveId: (id: string | null) => void; }) {
  const isActive = (id: string) => activeId === id;
  const region = (id: string, d: string, base: string, hover: string) => (
    <path
      d={d}
      fill={isActive(id) ? hover : base}
      stroke={isActive(id) ? '#2E2118' : 'transparent'}
      strokeWidth="2"
      style={{ cursor: 'pointer', transition: 'fill 0.18s, stroke 0.18s' }}
      onMouseEnter={() => setActiveId(id)}
      onClick={() => setActiveId(id)}
    />
  );

  return (
    <svg viewBox="0 0 260 540" style={{ width: '100%', height: '100%', maxHeight: 540 }}>
      <NeutralSkeleton isAnterior={true} />

      {/* 胸 + 三角肌前束 — 肩宽到胸下，有三角肌外凸弧度 */}
      {region(
        'chest_front_delt',
        `M 113 96
         C 92 100, 74 110, 66 130
         C 60 148, 64 166, 72 178
         L 86 180
         Q 130 184 174 180
         L 188 178
         C 196 166, 200 148, 194 130
         C 186 110, 168 100, 147 96
         Z`,
        '#D4A574', '#B8823F'
      )}

      {/* 核心 — 腹肌，梯形收腰 */}
      {region(
        'core_anterior',
        `M 72 178
         Q 70 210, 78 245
         L 98 252
         Q 130 256 162 252
         L 182 245
         Q 190 210, 188 178
         Q 130 186 72 178 Z`,
        '#C49A6C', '#9A7042'
      )}

      {/* 前视图的骨盆/髋 — 中性色（臀部在后视图突出） */}
      <path
        d="M 78 245
           Q 70 270 80 295
           C 105 310, 155 310, 180 295
           Q 190 270 182 245
           L 178 300
           Q 130 312 82 300 Z"
        fill="#E8DCC4"
      />

      {/* 股四头肌 — 大腿前，上粗下细 + 曲线 */}
      {region(
        'quadriceps',
        `M 82 300
         Q 80 340 92 380
         L 110 395
         Q 122 390 128 376
         L 130 305
         Q 105 310 82 300 Z

         M 130 305
         L 132 376
         Q 138 390 150 395
         L 168 380
         Q 180 340 178 300
         Q 155 310 130 305 Z`,
        '#96A886', '#6F8563'
      )}

      {/* 前臂屈肌 — 上臂下到腕，带曲线 */}
      {region(
        'forearm_front',
        `M 40 222
         Q 36 250 40 282
         Q 44 298 58 298
         L 70 295
         Q 76 270 76 240
         Q 72 220 66 220
         Z

         M 220 222
         Q 224 250 220 282
         Q 216 298 202 298
         L 190 295
         Q 184 270 184 240
         Q 188 220 194 220
         Z`,
        '#B5A3C7', '#8D76A5'
      )}

      {/* 小腿 — 带腓肠肌弧形（中段最粗） */}
      {region(
        'calf_front',
        `M 94 405
         Q 86 425 88 450
         Q 90 478 98 495
         L 116 497
         Q 124 478 124 450
         Q 122 420 118 405
         Q 108 402 94 405 Z

         M 142 405
         Q 138 420 136 450
         Q 136 478 144 497
         L 162 495
         Q 170 478 172 450
         Q 174 425 166 405
         Q 152 402 142 405 Z`,
        '#A8BF9A', '#7E9770'
      )}

      {/* 脉冲指示点 */}
      {activeId && (() => {
        const positions: Record<string, { x: number; y: number }> = {
          chest_front_delt: { x: 130, y: 138 },
          core_anterior:    { x: 130, y: 215 },
          quadriceps:       { x: 130, y: 345 },
          forearm_front:    { x: 130, y: 258 },
          calf_front:       { x: 130, y: 455 },
        };
        const p = positions[activeId];
        if (!p) return null;
        return (
          <g pointerEvents="none">
            <circle cx={p.x} cy={p.y} r="5" fill="#2E2118" opacity="0.7">
              <animate attributeName="r" values="5;9;5" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0.3;0.7" dur="1.6s" repeatCount="indefinite" />
            </circle>
          </g>
        );
      })()}
    </svg>
  );
}

/* ---------- 后视图 —— 臀部是视觉重点 ---------- */
function PosteriorBody({
  activeId, setActiveId,
}: { activeId: string | null; setActiveId: (id: string | null) => void; }) {
  const isActive = (id: string) => activeId === id;
  const region = (id: string, d: string, base: string, hover: string) => (
    <path
      d={d}
      fill={isActive(id) ? hover : base}
      stroke={isActive(id) ? '#2E2118' : 'transparent'}
      strokeWidth="2"
      style={{ cursor: 'pointer', transition: 'fill 0.18s, stroke 0.18s' }}
      onMouseEnter={() => setActiveId(id)}
      onClick={() => setActiveId(id)}
    />
  );

  return (
    <svg viewBox="0 0 260 540" style={{ width: '100%', height: '100%', maxHeight: 540 }}>
      <NeutralSkeleton isAnterior={false} />

      {/* 斜方 + 三角肌后束 — 上背（带肩膀弧度） */}
      {region(
        'traps_rear_delt',
        `M 113 96
         C 92 100, 74 110, 66 130
         C 60 148, 64 160, 72 165
         Q 130 170 188 165
         C 196 160, 200 148, 194 130
         C 186 110, 168 100, 147 96
         Z`,
        '#D4A574', '#B8823F'
      )}

      {/* 背阔肌 — V 形收窄，主发力肌最深色 */}
      {region(
        'lats',
        `M 72 165
         Q 70 190 76 215
         L 100 225
         Q 130 228 160 225
         L 184 215
         Q 190 190 188 165
         Q 130 172 72 165 Z`,
        '#8B6F4E', '#5A4530'
      )}

      {/* 竖脊肌 — 下背 */}
      {region(
        'erector_spinae',
        `M 76 215
         Q 76 235 80 255
         L 102 262
         Q 130 266 158 262
         L 180 255
         Q 184 235 184 215
         Q 130 220 76 215 Z`,
        '#A88660', '#7C5E3D'
      )}

      {/* 臀大肌 — 两瓣突出椭圆！这是后视图的视觉重点 */}
      {region(
        'glutes',
        // 两个独立的椭圆瓣，中间有缝隙，形成"屁股"感
        `M 82 262
         C 72 268, 68 285, 76 305
         C 88 320, 110 325, 120 315
         C 126 308, 128 292, 124 275
         C 120 265, 108 260, 98 260
         Q 88 260 82 262 Z

         M 178 262
         C 188 268, 192 285, 184 305
         C 172 320, 150 325, 140 315
         C 134 308, 132 292, 136 275
         C 140 265, 152 260, 162 260
         Q 172 260 178 262 Z`,
        '#96A886', '#6F8563'
      )}

      {/* 腘绳肌 — 大腿后，上接臀、下到膝 */}
      {region(
        'hamstrings',
        `M 82 315
         Q 82 350 90 380
         L 108 395
         Q 122 390 128 378
         L 130 322
         Q 106 320 82 315 Z

         M 130 322
         L 132 378
         Q 138 390 152 395
         L 170 380
         Q 178 350 178 315
         Q 154 320 130 322 Z`,
        '#A8BF9A', '#7E9770'
      )}

      {/* 小腿（后视图为保持完整性，以中性色填充但不交互） */}
      <path
        d="M 94 405 Q 86 425 88 450 Q 90 478 98 495 L 116 497 Q 124 478 124 450 Q 122 420 118 405 Q 108 402 94 405 Z
           M 142 405 Q 138 420 136 450 Q 136 478 144 497 L 162 495 Q 170 478 172 450 Q 174 425 166 405 Q 152 402 142 405 Z"
        fill="#E1D5C2"
      />

      {/* 脉冲指示点 */}
      {activeId && (() => {
        const positions: Record<string, { x: number; y: number }> = {
          traps_rear_delt: { x: 130, y: 130 },
          lats:            { x: 130, y: 192 },
          erector_spinae:  { x: 130, y: 240 },
          glutes:          { x: 130, y: 290 },
          hamstrings:      { x: 130, y: 350 },
        };
        const p = positions[activeId];
        if (!p) return null;
        return (
          <g pointerEvents="none">
            <circle cx={p.x} cy={p.y} r="5" fill="#2E2118" opacity="0.7">
              <animate attributeName="r" values="5;9;5" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0.3;0.7" dur="1.6s" repeatCount="indefinite" />
            </circle>
          </g>
        );
      })()}
    </svg>
  );
}

export default function MuscleDiagram() {
  const [view, setView] = useState<'anterior' | 'posterior'>('anterior');
  const [activeId, setActiveId] = useState<string | null>(null);

  const muscles = view === 'anterior' ? ANTERIOR : POSTERIOR;
  const active = muscles.find(m => m.id === activeId) || null;

  function switchView(v: 'anterior' | 'posterior') {
    setView(v);
    setActiveId(null);
  }

  return (
    <div
      style={{
        background: '#FEFCF9',
        border: '1px solid #EDE5D8',
        borderRadius: 16,
        padding: 24,
        marginBottom: 32,
      }}
    >
      {/* 头部 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #F0EAE0',
      }}>
        <div>
          <h3 style={{
            fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 500,
            color: '#2E2118', margin: 0,
          }}>
            🏄 交互式桨板发力图
          </h3>
          <p style={{ fontSize: 12, color: '#8A8078', margin: '4px 0 0' }}>
            悬停色块 / 点击查看该肌群在桨板运动中的发力作用
          </p>
        </div>

        <div style={{
          display: 'inline-flex', background: '#F5EDE4', borderRadius: 10, padding: 3,
          border: '1px solid #EDE5D8',
        }}>
          {[
            { key: 'anterior', label: '前视图' },
            { key: 'posterior', label: '后视图' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => switchView(t.key as 'anterior' | 'posterior')}
              style={{
                padding: '6px 16px',
                fontSize: 13,
                fontWeight: view === t.key ? 600 : 400,
                color: view === t.key ? '#2E2118' : '#8A8078',
                background: view === t.key ? '#FEFCF9' : 'transparent',
                border: 'none',
                borderRadius: 7,
                cursor: 'pointer',
                boxShadow: view === t.key ? '0 1px 3px rgba(46,33,24,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 主体 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 320px) 1fr',
        gap: 24,
        alignItems: 'flex-start',
      }} className="muscle-diagram-grid">
        <div style={{
          position: 'relative',
          background: 'radial-gradient(circle at 50% 30%, #FDF7EE 0%, #F5EDE4 100%)',
          borderRadius: 12,
          padding: '20px 20px',
          minHeight: 480,
        }}>
          <div
            style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseLeave={() => setActiveId(null)}
          >
            {view === 'anterior'
              ? <AnteriorBody activeId={activeId} setActiveId={setActiveId} />
              : <PosteriorBody activeId={activeId} setActiveId={setActiveId} />
            }
          </div>
        </div>

        <div style={{ minHeight: 480, display: 'flex', flexDirection: 'column' }}>
          {active ? (
            <div
              style={{
                background: '#FAF7F2', border: `2px solid ${active.hoverColor}`,
                borderRadius: 12, padding: '18px 20px',
                animation: 'muscle-panel-fade 0.2s ease-out',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{
                  display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                  background: active.hoverColor,
                }} />
                <h4 style={{
                  fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600,
                  color: '#2E2118', margin: 0,
                }}>
                  {active.name}
                </h4>
              </div>
              <p style={{ fontSize: 11, color: '#A08060', margin: '0 0 16px 20px', letterSpacing: '0.02em' }}>
                {active.alias}
              </p>

              <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <dt style={{ fontSize: 11, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    桨板动作
                  </dt>
                  <dd style={{ fontSize: 14, color: '#3D3730', margin: 0, lineHeight: 1.7 }}>
                    <RichText text={active.action} />
                  </dd>
                </div>
                <div>
                  <dt style={{ fontSize: 11, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    发力时机
                  </dt>
                  <dd style={{ fontSize: 14, color: '#3D3730', margin: 0, lineHeight: 1.7 }}>
                    <RichText text={active.timing} />
                  </dd>
                </div>
                <div style={{ background: '#FDF8F0', borderLeft: '3px solid #C4A882', padding: '10px 12px', borderRadius: '0 6px 6px 0' }}>
                  <dt style={{ fontSize: 11, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    💡 新手提示
                  </dt>
                  <dd style={{ fontSize: 13, color: '#3D3730', margin: 0, lineHeight: 1.65 }}>
                    <RichText text={active.tip} />
                  </dd>
                </div>
                <div>
                  <dt style={{ fontSize: 11, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    陆上练习
                  </dt>
                  <dd style={{ fontSize: 13, color: '#655D56', margin: 0, lineHeight: 1.65 }}>
                    {active.training}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div style={{
              background: '#FAF7F2', border: '1px dashed #D4C4B0', borderRadius: 12,
              padding: '32px 24px', textAlign: 'center', color: '#8A8078',
            }}>
              <div style={{ fontSize: 34, marginBottom: 10, opacity: 0.6 }}>👆</div>
              <p style={{ fontSize: 13, margin: 0, lineHeight: 1.7 }}>
                悬停左侧人体图的彩色区域<br />查看该肌群在桨板运动中的发力说明
              </p>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              本视图所有肌群
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {muscles.map(m => (
                <button
                  key={m.id}
                  onMouseEnter={() => setActiveId(m.id)}
                  onClick={() => setActiveId(m.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px',
                    background: activeId === m.id ? m.hoverColor : '#F5EDE4',
                    color: activeId === m.id ? '#fff' : '#655D56',
                    border: 'none', borderRadius: 8, cursor: 'pointer',
                    fontSize: 12, fontWeight: activeId === m.id ? 500 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                    background: m.hoverColor,
                    border: activeId === m.id ? '1.5px solid #fff' : 'none',
                  }} />
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes muscle-panel-fade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 640px) {
          .muscle-diagram-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
