'use client';

import { useState } from 'react';

/**
 * 交互式桨板肌群发力图。前视 / 后视两个视图，每个视图 5 个可交互肌群区域。
 * 鼠标悬停 / 移动端点击 → 右侧（或下方）信息面板显示该肌群在桨板运动中的角色、发力时机、新手提示、练习建议。
 * 非解剖图——以信息图风格呈现，与站内整体米色 / 棕褐色调统一。
 */

interface MuscleHotspot {
  id: string;
  name: string;          // 中文肌群名
  alias: string;         // 解剖学细项
  color: string;         // 区域填充
  hoverColor: string;    // hover 填充
  action: string;        // 桨板动作中的角色
  timing: string;        // 发力时机
  tip: string;           // 新手提示 / 误区
  training: string;      // 陆上辅助训练
}

// 前视肌群数据
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

// 后视肌群数据
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

// 把 Markdown 风格的 ** 加粗渲染成 React 节点（tooltip 内文用）
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

// 前视图 SVG — 纯色块组合人形，每个肌群是一个独立可交互区域
function AnteriorBody({
  activeId, setActiveId,
}: { activeId: string | null; setActiveId: (id: string | null) => void; }) {
  const fill = (id: string, base: string, hover: string) =>
    activeId === id ? hover : base;
  const stroke = (id: string) =>
    activeId === id ? '#2E2118' : 'transparent';

  return (
    <svg viewBox="0 0 260 500" style={{ width: '100%', height: '100%', maxHeight: 500 }}>
      {/* 中性部位（不可交互）：头、脖、手掌、脚、手臂骨架 */}
      <g fill="#EDE0CE">
        {/* 头 */}
        <ellipse cx="130" cy="45" rx="28" ry="32" />
        {/* 脖 */}
        <rect x="118" y="72" width="24" height="18" rx="4" />
        {/* 手掌 */}
        <circle cx="48" cy="295" r="13" />
        <circle cx="212" cy="295" r="13" />
        {/* 脚 */}
        <ellipse cx="100" cy="480" rx="18" ry="10" />
        <ellipse cx="160" cy="480" rx="18" ry="10" />
        {/* 大臂连接部分（中性填充） */}
        <rect x="40" y="95" width="26" height="105" rx="10" />
        <rect x="194" y="95" width="26" height="105" rx="10" />
      </g>

      {/* 胸肌 + 三角肌前束（肩 + 胸上部，一个 polygon） */}
      <path
        d="M 70 92 L 190 92 L 182 155 L 140 165 L 120 165 L 78 155 Z"
        fill={fill('chest_front_delt', '#D4A574', '#B8823F')}
        stroke={stroke('chest_front_delt')}
        strokeWidth="2"
        style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
        onMouseEnter={() => setActiveId('chest_front_delt')}
        onClick={() => setActiveId('chest_front_delt')}
      />

      {/* 核心 — 腹肌 */}
      <path
        d="M 95 165 L 165 165 L 170 250 L 90 250 Z"
        fill={fill('core_anterior', '#C49A6C', '#9A7042')}
        stroke={stroke('core_anterior')}
        strokeWidth="2"
        style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
        onMouseEnter={() => setActiveId('core_anterior')}
        onClick={() => setActiveId('core_anterior')}
      />

      {/* 骨盆过渡 */}
      <path d="M 90 250 L 170 250 L 168 280 L 92 280 Z" fill="#EDE0CE" />

      {/* 股四头 — 左右两条 */}
      <path
        d="M 92 280 L 128 280 L 124 390 L 96 390 Z
           M 132 280 L 168 280 L 164 390 L 136 390 Z"
        fill={fill('quadriceps', '#96A886', '#6F8563')}
        stroke={stroke('quadriceps')}
        strokeWidth="2"
        style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
        onMouseEnter={() => setActiveId('quadriceps')}
        onClick={() => setActiveId('quadriceps')}
      />

      {/* 前臂屈肌 — 左右两条 */}
      <path
        d="M 36 200 L 62 200 L 60 288 L 36 288 Z
           M 198 200 L 224 200 L 224 288 L 200 288 Z"
        fill={fill('forearm_front', '#B5A3C7', '#8D76A5')}
        stroke={stroke('forearm_front')}
        strokeWidth="2"
        style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
        onMouseEnter={() => setActiveId('forearm_front')}
        onClick={() => setActiveId('forearm_front')}
      />

      {/* 小腿 — 左右两条 */}
      <path
        d="M 96 390 L 124 390 L 122 470 L 98 470 Z
           M 136 390 L 164 390 L 162 470 L 138 470 Z"
        fill={fill('calf_front', '#A8BF9A', '#7E9770')}
        stroke={stroke('calf_front')}
        strokeWidth="2"
        style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
        onMouseEnter={() => setActiveId('calf_front')}
        onClick={() => setActiveId('calf_front')}
      />

      {/* 可交互区域中心的小标签（hover 时显示） */}
      {activeId && (() => {
        const positions: Record<string, { x: number; y: number }> = {
          chest_front_delt: { x: 130, y: 128 },
          core_anterior: { x: 130, y: 210 },
          quadriceps: { x: 130, y: 335 },
          forearm_front: { x: 130, y: 244 },
          calf_front: { x: 130, y: 430 },
        };
        const p = positions[activeId];
        if (!p) return null;
        return (
          <circle cx={p.x} cy={p.y} r="4" fill="#2E2118" opacity="0.6">
            <animate attributeName="r" values="4;7;4" dur="1.5s" repeatCount="indefinite" />
          </circle>
        );
      })()}
    </svg>
  );
}

// 后视图 SVG
function PosteriorBody({
  activeId, setActiveId,
}: { activeId: string | null; setActiveId: (id: string | null) => void; }) {
  const fill = (id: string, base: string, hover: string) =>
    activeId === id ? hover : base;
  const stroke = (id: string) =>
    activeId === id ? '#2E2118' : 'transparent';

  return (
    <svg viewBox="0 0 260 500" style={{ width: '100%', height: '100%', maxHeight: 500 }}>
      {/* 中性部位 */}
      <g fill="#EDE0CE">
        <ellipse cx="130" cy="45" rx="28" ry="32" />
        <rect x="118" y="72" width="24" height="18" rx="4" />
        <circle cx="48" cy="295" r="13" />
        <circle cx="212" cy="295" r="13" />
        <ellipse cx="100" cy="480" rx="18" ry="10" />
        <ellipse cx="160" cy="480" rx="18" ry="10" />
        {/* 大臂中性 */}
        <rect x="40" y="95" width="26" height="105" rx="10" />
        <rect x="194" y="95" width="26" height="105" rx="10" />
        {/* 后视前臂中性（后视图前臂不做主要讲解，保持中性） */}
        <rect x="36" y="200" width="26" height="88" rx="8" />
        <rect x="198" y="200" width="26" height="88" rx="8" />
      </g>

      {/* 斜方 + 三角肌后束 — 上背 */}
      <path
        d="M 70 92 L 190 92 L 182 142 L 78 142 Z"
        fill={fill('traps_rear_delt', '#D4A574', '#B8823F')}
        stroke={stroke('traps_rear_delt')}
        strokeWidth="2"
        style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
        onMouseEnter={() => setActiveId('traps_rear_delt')}
        onClick={() => setActiveId('traps_rear_delt')}
      />

      {/* 背阔肌 — 中背（重点突出） */}
      <path
        d="M 78 142 L 182 142 L 175 215 L 85 215 Z"
        fill={fill('lats', '#8B6F4E', '#5A4530')}
        stroke={stroke('lats')}
        strokeWidth="2"
        style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
        onMouseEnter={() => setActiveId('lats')}
        onClick={() => setActiveId('lats')}
      />

      {/* 竖脊肌 — 下背 */}
      <path
        d="M 85 215 L 175 215 L 170 250 L 90 250 Z"
        fill={fill('erector_spinae', '#A88660', '#7C5E3D')}
        stroke={stroke('erector_spinae')}
        strokeWidth="2"
        style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
        onMouseEnter={() => setActiveId('erector_spinae')}
        onClick={() => setActiveId('erector_spinae')}
      />

      {/* 臀大肌 */}
      <path
        d="M 90 250 L 170 250 L 168 300 L 92 300 Z"
        fill={fill('glutes', '#96A886', '#6F8563')}
        stroke={stroke('glutes')}
        strokeWidth="2"
        style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
        onMouseEnter={() => setActiveId('glutes')}
        onClick={() => setActiveId('glutes')}
      />

      {/* 腘绳肌 — 大腿后 */}
      <path
        d="M 92 300 L 128 300 L 124 390 L 96 390 Z
           M 132 300 L 168 300 L 164 390 L 136 390 Z"
        fill={fill('hamstrings', '#A8BF9A', '#7E9770')}
        stroke={stroke('hamstrings')}
        strokeWidth="2"
        style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
        onMouseEnter={() => setActiveId('hamstrings')}
        onClick={() => setActiveId('hamstrings')}
      />

      {/* 小腿（后视图为保持完整性，以中性色填充但不交互） */}
      <path d="M 96 390 L 124 390 L 122 470 L 98 470 Z" fill="#E1D5C2" />
      <path d="M 136 390 L 164 390 L 162 470 L 138 470 Z" fill="#E1D5C2" />

      {/* 脉冲指示点 */}
      {activeId && (() => {
        const positions: Record<string, { x: number; y: number }> = {
          traps_rear_delt: { x: 130, y: 115 },
          lats: { x: 130, y: 178 },
          erector_spinae: { x: 130, y: 232 },
          glutes: { x: 130, y: 275 },
          hamstrings: { x: 130, y: 345 },
        };
        const p = positions[activeId];
        if (!p) return null;
        return (
          <circle cx={p.x} cy={p.y} r="4" fill="#2E2118" opacity="0.6">
            <animate attributeName="r" values="4;7;4" dur="1.5s" repeatCount="indefinite" />
          </circle>
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
      {/* 头部：标题 + 视图切换 */}
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

      {/* 主体：左图 + 右面板（桌面）/ 上图 + 下面板（移动） */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 300px) 1fr',
        gap: 24,
        alignItems: 'flex-start',
      }} className="muscle-diagram-grid">
        {/* SVG 区域 */}
        <div style={{
          position: 'relative',
          background: '#F8F1E5',
          borderRadius: 12,
          padding: '18px 24px',
          aspectRatio: '1/1.9',
          minHeight: 340,
        }}>
          <div
            style={{ position: 'absolute', inset: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseLeave={() => setActiveId(null)}
          >
            {view === 'anterior'
              ? <AnteriorBody activeId={activeId} setActiveId={setActiveId} />
              : <PosteriorBody activeId={activeId} setActiveId={setActiveId} />
            }
          </div>
        </div>

        {/* 信息面板 */}
        <div style={{ minHeight: 340, display: 'flex', flexDirection: 'column' }}>
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

          {/* 肌群速查列表 */}
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
