'use client';

/**
 * 桨板拉伸指南配套动画组件。
 * 每个动作一个简笔小人 SVG + CSS 关键帧循环动画，纯原创（无版权风险），
 * 用于动作方向示意。详细的动作要点 / 常见错误仍以正文文字为主。
 */

interface Stretch {
  id: string;
  name: string;
  nameEn: string;
  phase: 'dynamic' | 'static';
  duration: string;
  note: string;
  Animation: React.FC;
}

/* ============================================================
   SVG 小人基础元素 — 头圆 / 躯干椭圆 / 四肢线段 / 手脚小圆
   ============================================================ */

// 颜色主题
const C_SKIN = '#D4B896';
const C_SHIRT = '#7A9AB5';
const C_PANT = '#5C6F80';
const C_STROKE = '#2E2118';
const C_ACCENT = '#C4A882'; // 高亮（运动部位）

/* ---------- 动态拉伸（5）---------- */

// 1. 肩绕环 — 手臂绕圆
const ArmCircles: React.FC = () => (
  <svg viewBox="0 0 120 160" style={{ width: '100%', height: '100%' }}>
    {/* 头 */}
    <circle cx="60" cy="24" r="10" fill={C_SKIN} stroke={C_STROKE} strokeWidth="1.5" />
    {/* 身体 */}
    <rect x="50" y="36" width="20" height="50" rx="5" fill={C_SHIRT} stroke={C_STROKE} strokeWidth="1.5" />
    {/* 腿 */}
    <line x1="54" y1="86" x2="50" y2="130" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <line x1="66" y1="86" x2="70" y2="130" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    {/* 脚 */}
    <ellipse cx="48" cy="134" rx="6" ry="2.5" fill={C_STROKE} />
    <ellipse cx="72" cy="134" rx="6" ry="2.5" fill={C_STROKE} />
    {/* 绕环手臂组 — 肩膀为轴旋转 */}
    <g className="anim-arm-left" style={{ transformOrigin: '50px 42px' }}>
      <line x1="50" y1="42" x2="35" y2="70" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
      <circle cx="35" cy="70" r="3.5" fill={C_SKIN} stroke={C_STROKE} strokeWidth="1" />
    </g>
    <g className="anim-arm-right" style={{ transformOrigin: '70px 42px' }}>
      <line x1="70" y1="42" x2="85" y2="70" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
      <circle cx="85" cy="70" r="3.5" fill={C_SKIN} stroke={C_STROKE} strokeWidth="1" />
    </g>
    {/* 弧线轨迹提示 */}
    <path d="M 30 42 A 20 28 0 0 1 70 42" fill="none" stroke={C_ACCENT} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
  </svg>
);

// 2. 躯干旋转 — 上身左右扭
const TrunkRotation: React.FC = () => (
  <svg viewBox="0 0 120 160" style={{ width: '100%', height: '100%' }}>
    {/* 腿脚（静止） */}
    <line x1="54" y1="100" x2="50" y2="140" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <line x1="66" y1="100" x2="70" y2="140" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <ellipse cx="48" cy="144" rx="6" ry="2.5" fill={C_STROKE} />
    <ellipse cx="72" cy="144" rx="6" ry="2.5" fill={C_STROKE} />
    {/* 骨盆（不动） */}
    <rect x="52" y="92" width="16" height="12" fill={C_PANT} />
    {/* 旋转的上身组 */}
    <g className="anim-torso-rotate" style={{ transformOrigin: '60px 98px' }}>
      <rect x="50" y="46" width="20" height="50" rx="5" fill={C_SHIRT} stroke={C_STROKE} strokeWidth="1.5" />
      <circle cx="60" cy="34" r="10" fill={C_SKIN} stroke={C_STROKE} strokeWidth="1.5" />
      {/* 双手合十胸前 */}
      <line x1="50" y1="54" x2="45" y2="66" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
      <line x1="70" y1="54" x2="75" y2="66" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
      <line x1="45" y1="66" x2="60" y2="70" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
      <line x1="75" y1="66" x2="60" y2="70" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
    </g>
    {/* 旋转提示弧 */}
    <path d="M 40 98 Q 60 112 80 98" fill="none" stroke={C_ACCENT} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
  </svg>
);

// 3. 弓步扭转 — 侧面弓步 + 上身扭向前膝
const LungeTwist: React.FC = () => (
  <svg viewBox="0 0 140 160" style={{ width: '100%', height: '100%' }}>
    {/* 后脚 */}
    <ellipse cx="30" cy="146" rx="7" ry="2.5" fill={C_STROKE} />
    {/* 后腿（弓步） */}
    <line x1="55" y1="85" x2="32" y2="144" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    {/* 前脚 */}
    <ellipse cx="100" cy="146" rx="7" ry="2.5" fill={C_STROKE} />
    {/* 前腿 90 度屈膝 */}
    <line x1="95" y1="85" x2="100" y2="115" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <line x1="100" y1="115" x2="100" y2="144" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    {/* 骨盆 */}
    <rect x="55" y="75" width="40" height="14" rx="5" fill={C_PANT} />
    {/* 扭转的上身组 */}
    <g className="anim-lunge-twist" style={{ transformOrigin: '75px 82px' }}>
      <rect x="65" y="35" width="20" height="44" rx="5" fill={C_SHIRT} stroke={C_STROKE} strokeWidth="1.5" />
      <circle cx="75" cy="24" r="10" fill={C_SKIN} stroke={C_STROKE} strokeWidth="1.5" />
      {/* 双手过头 */}
      <line x1="65" y1="40" x2="60" y2="18" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
      <line x1="85" y1="40" x2="90" y2="18" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
      <circle cx="75" cy="14" r="4" fill="none" stroke={C_STROKE} strokeWidth="1" />
    </g>
  </svg>
);

// 4. 手腕前臂激活 — 双手合十胸前，上下扭动
const WristActivation: React.FC = () => (
  <svg viewBox="0 0 120 160" style={{ width: '100%', height: '100%' }}>
    {/* 腿 */}
    <line x1="54" y1="96" x2="50" y2="140" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <line x1="66" y1="96" x2="70" y2="140" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <ellipse cx="48" cy="144" rx="6" ry="2.5" fill={C_STROKE} />
    <ellipse cx="72" cy="144" rx="6" ry="2.5" fill={C_STROKE} />
    {/* 身体 */}
    <rect x="50" y="40" width="20" height="54" rx="5" fill={C_SHIRT} stroke={C_STROKE} strokeWidth="1.5" />
    {/* 头 */}
    <circle cx="60" cy="28" r="10" fill={C_SKIN} stroke={C_STROKE} strokeWidth="1.5" />
    {/* 上臂固定 */}
    <line x1="50" y1="50" x2="45" y2="70" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
    <line x1="70" y1="50" x2="75" y2="70" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
    {/* 前臂合十（动画：上下扭动） */}
    <g className="anim-wrist" style={{ transformOrigin: '60px 70px' }}>
      <line x1="45" y1="70" x2="60" y2="76" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
      <line x1="75" y1="70" x2="60" y2="76" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="76" r="5" fill={C_ACCENT} stroke={C_STROKE} strokeWidth="1" />
    </g>
  </svg>
);

// 5. 桨板起手式 — 侧面持桨向前伸
const PaddleRehearsal: React.FC = () => (
  <svg viewBox="0 0 140 160" style={{ width: '100%', height: '100%' }}>
    {/* 腿（微屈） */}
    <line x1="62" y1="88" x2="56" y2="140" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <line x1="72" y1="88" x2="78" y2="140" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <ellipse cx="54" cy="144" rx="6" ry="2.5" fill={C_STROKE} />
    <ellipse cx="80" cy="144" rx="6" ry="2.5" fill={C_STROKE} />
    {/* 身体略前倾 */}
    <rect x="56" y="40" width="20" height="50" rx="5" fill={C_SHIRT} stroke={C_STROKE} strokeWidth="1.5" transform="rotate(-8 66 65)" />
    {/* 头 */}
    <circle cx="64" cy="26" r="10" fill={C_SKIN} stroke={C_STROKE} strokeWidth="1.5" />
    {/* 划桨动作组 */}
    <g className="anim-paddle">
      {/* 上手持桨顶 */}
      <line x1="60" y1="50" x2="50" y2="36" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
      {/* 下手扶桨身 */}
      <line x1="72" y1="52" x2="100" y2="60" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
      {/* 桨 */}
      <line x1="46" y1="30" x2="115" y2="90" stroke={C_STROKE} strokeWidth="3" strokeLinecap="round" />
      {/* 桨叶 */}
      <path d="M 110 85 L 125 110 L 120 112 L 105 90 Z" fill={C_ACCENT} stroke={C_STROKE} strokeWidth="1" />
    </g>
  </svg>
);

/* ---------- 静态拉伸（6）---------- */

// 6. 胸肩拉伸 — 侧面一手抵墙身体前转
const ChestStretch: React.FC = () => (
  <svg viewBox="0 0 140 160" style={{ width: '100%', height: '100%' }}>
    {/* 墙 */}
    <rect x="0" y="0" width="14" height="160" fill="#EDE5D8" />
    <line x1="14" y1="0" x2="14" y2="160" stroke={C_STROKE} strokeWidth="1.5" />
    {/* 腿 */}
    <line x1="70" y1="92" x2="66" y2="140" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <line x1="82" y1="92" x2="86" y2="140" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <ellipse cx="64" cy="144" rx="6" ry="2.5" fill={C_STROKE} />
    <ellipse cx="88" cy="144" rx="6" ry="2.5" fill={C_STROKE} />
    {/* 身体（动画：前后轻摆） */}
    <g className="anim-chest" style={{ transformOrigin: '76px 90px' }}>
      <rect x="66" y="44" width="20" height="50" rx="5" fill={C_SHIRT} stroke={C_STROKE} strokeWidth="1.5" />
      <circle cx="76" cy="32" r="10" fill={C_SKIN} stroke={C_STROKE} strokeWidth="1.5" />
      {/* 后手抵墙（保持在墙面） */}
      <line x1="66" y1="52" x2="18" y2="56" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
      <circle cx="18" cy="56" r="4" fill={C_ACCENT} stroke={C_STROKE} strokeWidth="1" />
      {/* 前手自然垂 */}
      <line x1="86" y1="52" x2="92" y2="80" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
    </g>
  </svg>
);

// 7. 背阔肌拉伸 — 双手举过头身体一侧倾
const LatStretch: React.FC = () => (
  <svg viewBox="0 0 120 160" style={{ width: '100%', height: '100%' }}>
    {/* 腿 */}
    <line x1="54" y1="100" x2="50" y2="140" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <line x1="66" y1="100" x2="70" y2="140" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <ellipse cx="48" cy="144" rx="6" ry="2.5" fill={C_STROKE} />
    <ellipse cx="72" cy="144" rx="6" ry="2.5" fill={C_STROKE} />
    {/* 身体 + 双手向上向一侧倾斜 */}
    <g className="anim-lat" style={{ transformOrigin: '60px 104px' }}>
      <rect x="50" y="48" width="20" height="54" rx="5" fill={C_SHIRT} stroke={C_STROKE} strokeWidth="1.5" />
      <circle cx="60" cy="36" r="10" fill={C_SKIN} stroke={C_STROKE} strokeWidth="1.5" />
      {/* 双手合掌过头顶 */}
      <line x1="50" y1="52" x2="54" y2="16" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
      <line x1="70" y1="52" x2="66" y2="16" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="12" r="4" fill={C_ACCENT} stroke={C_STROKE} strokeWidth="1" />
    </g>
  </svg>
);

// 8. 髋屈肌拉伸 — 跪姿半弓步推骨盆
const HipFlexorStretch: React.FC = () => (
  <svg viewBox="0 0 140 160" style={{ width: '100%', height: '100%' }}>
    {/* 地面 */}
    <line x1="0" y1="148" x2="140" y2="148" stroke={C_STROKE} strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
    {/* 后腿跪地 */}
    <line x1="60" y1="92" x2="45" y2="146" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <circle cx="45" cy="146" r="5" fill={C_PANT} stroke={C_STROKE} strokeWidth="1" />
    {/* 前腿 90 度屈膝 */}
    <line x1="80" y1="85" x2="95" y2="110" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <line x1="95" y1="110" x2="95" y2="144" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <ellipse cx="98" cy="148" rx="7" ry="2.5" fill={C_STROKE} />
    {/* 骨盆（动画：前后推动） */}
    <g className="anim-hip">
      <rect x="58" y="75" width="24" height="16" rx="5" fill={C_PANT} />
      <rect x="62" y="30" width="20" height="46" rx="5" fill={C_SHIRT} stroke={C_STROKE} strokeWidth="1.5" />
      <circle cx="72" cy="20" r="10" fill={C_SKIN} stroke={C_STROKE} strokeWidth="1.5" />
      <line x1="62" y1="40" x2="54" y2="70" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
      <line x1="82" y1="40" x2="90" y2="70" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
    </g>
    {/* 推动箭头 */}
    <path d="M 50 110 L 95 110" fill="none" stroke={C_ACCENT} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" markerEnd="url(#arrow)" />
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={C_ACCENT} />
      </marker>
    </defs>
  </svg>
);

// 9. 腘绳肌拉伸 — 坐姿前倾摸脚尖
const HamstringStretch: React.FC = () => (
  <svg viewBox="0 0 160 160" style={{ width: '100%', height: '100%' }}>
    {/* 地面 */}
    <line x1="0" y1="130" x2="160" y2="130" stroke={C_STROKE} strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
    {/* 伸直的前腿 */}
    <line x1="50" y1="108" x2="130" y2="128" stroke={C_PANT} strokeWidth="6" strokeLinecap="round" />
    <ellipse cx="135" cy="126" rx="8" ry="3" fill={C_STROKE} />
    {/* 屈膝的后腿 */}
    <line x1="50" y1="108" x2="65" y2="95" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <line x1="65" y1="95" x2="75" y2="128" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    {/* 臀部 */}
    <ellipse cx="45" cy="110" rx="10" ry="6" fill={C_PANT} />
    {/* 上身（动画：前倾） */}
    <g className="anim-hamstring" style={{ transformOrigin: '45px 105px' }}>
      <rect x="35" y="58" width="20" height="48" rx="5" fill={C_SHIRT} stroke={C_STROKE} strokeWidth="1.5" />
      <circle cx="45" cy="48" r="10" fill={C_SKIN} stroke={C_STROKE} strokeWidth="1.5" />
      {/* 双手前伸 */}
      <line x1="45" y1="68" x2="95" y2="110" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
      <circle cx="95" cy="110" r="4" fill={C_ACCENT} stroke={C_STROKE} strokeWidth="1" />
    </g>
  </svg>
);

// 10. 小腿拉伸 — 面墙，后腿伸直脚跟贴地
const CalfStretch: React.FC = () => (
  <svg viewBox="0 0 160 160" style={{ width: '100%', height: '100%' }}>
    {/* 墙 */}
    <rect x="130" y="0" width="30" height="160" fill="#EDE5D8" />
    <line x1="130" y1="0" x2="130" y2="160" stroke={C_STROKE} strokeWidth="1.5" />
    {/* 地面 */}
    <line x1="0" y1="148" x2="160" y2="148" stroke={C_STROKE} strokeWidth="1" opacity="0.4" />
    {/* 后腿（伸直） */}
    <line x1="50" y1="88" x2="45" y2="146" stroke={C_PANT} strokeWidth="6" strokeLinecap="round" />
    <ellipse cx="45" cy="150" rx="9" ry="3" fill={C_STROKE} />
    {/* 前腿（屈膝靠墙） */}
    <line x1="70" y1="88" x2="95" y2="115" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <line x1="95" y1="115" x2="105" y2="146" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <ellipse cx="108" cy="150" rx="7" ry="2.5" fill={C_STROKE} />
    {/* 身体（略前倾） */}
    <rect x="50" y="38" width="20" height="52" rx="5" fill={C_SHIRT} stroke={C_STROKE} strokeWidth="1.5" transform="rotate(12 60 64)" />
    <circle cx="64" cy="26" r="10" fill={C_SKIN} stroke={C_STROKE} strokeWidth="1.5" />
    {/* 双手抵墙（动画：轻微前后推） */}
    <g className="anim-calf">
      <line x1="66" y1="48" x2="125" y2="50" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
      <circle cx="125" cy="50" r="4" fill={C_ACCENT} stroke={C_STROKE} strokeWidth="1" />
    </g>
    {/* 小腿拉伸强调 */}
    <path d="M 42 116 Q 38 128 42 140" fill="none" stroke={C_ACCENT} strokeWidth="2" opacity="0.5" />
  </svg>
);

// 11. 前臂手腕拉伸 — 一手伸直，另一手掰手指
const WristFlexorStretch: React.FC = () => (
  <svg viewBox="0 0 140 160" style={{ width: '100%', height: '100%' }}>
    {/* 腿 */}
    <line x1="64" y1="96" x2="60" y2="140" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <line x1="76" y1="96" x2="80" y2="140" stroke={C_PANT} strokeWidth="5" strokeLinecap="round" />
    <ellipse cx="58" cy="144" rx="6" ry="2.5" fill={C_STROKE} />
    <ellipse cx="82" cy="144" rx="6" ry="2.5" fill={C_STROKE} />
    {/* 身体 */}
    <rect x="60" y="40" width="20" height="54" rx="5" fill={C_SHIRT} stroke={C_STROKE} strokeWidth="1.5" />
    <circle cx="70" cy="28" r="10" fill={C_SKIN} stroke={C_STROKE} strokeWidth="1.5" />
    {/* 伸直的手臂（左） */}
    <line x1="60" y1="52" x2="28" y2="66" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
    {/* 动画：掰手指的手 */}
    <g className="anim-wrist-flexor" style={{ transformOrigin: '28px 66px' }}>
      <line x1="28" y1="66" x2="20" y2="56" stroke={C_SKIN} strokeWidth="3" strokeLinecap="round" />
      <line x1="28" y1="66" x2="18" y2="62" stroke={C_SKIN} strokeWidth="3" strokeLinecap="round" />
      <line x1="28" y1="66" x2="16" y2="68" stroke={C_SKIN} strokeWidth="3" strokeLinecap="round" />
      <circle cx="28" cy="66" r="4" fill={C_ACCENT} />
    </g>
    {/* 另一只手扶掰（右手从胸前过来） */}
    <line x1="80" y1="52" x2="40" y2="62" stroke={C_SKIN} strokeWidth="4" strokeLinecap="round" />
  </svg>
);

/* ============================================================
   拉伸动作数据
   ============================================================ */

const STRETCHES: Stretch[] = [
  // 动态 5 个
  { id: 'arm-circles',      name: '肩绕环',         nameEn: 'Arm Circles',        phase: 'dynamic', duration: '30 秒 / 前后各 10 圈', note: '耸肩代偿 → 先主动下沉肩胛再画圈', Animation: ArmCircles },
  { id: 'trunk-rotation',   name: '躯干旋转',       nameEn: 'Trunk Rotation',     phase: 'dynamic', duration: '每侧 15 次',           note: '保持骨盆不动，只转上半身',       Animation: TrunkRotation },
  { id: 'lunge-twist',      name: '弓步扭转',       nameEn: 'Lunge with Twist',   phase: 'dynamic', duration: '每侧 8 次',            note: '后膝离地半掌距，不落地',        Animation: LungeTwist },
  { id: 'wrist-activation', name: '手腕前臂激活',   nameEn: 'Wrist Mobilization', phase: 'dynamic', duration: '1 分钟',              note: '微痛即可，幅度不要太小',        Animation: WristActivation },
  { id: 'paddle-rehearsal', name: '桨板起手式',     nameEn: 'Paddle Rehearsal',   phase: 'dynamic', duration: '1 分钟（20 次）',      note: '幅度由小到大，预告神经系统',    Animation: PaddleRehearsal },

  // 静态 6 个
  { id: 'chest-stretch',     name: '胸肩拉伸',     nameEn: 'Doorway Chest Stretch', phase: 'static', duration: '每侧 30 秒 × 2',  note: '保持肩胛下沉，不耸肩',      Animation: ChestStretch },
  { id: 'lat-stretch',       name: '背阔肌拉伸',   nameEn: 'Lat Stretch',           phase: 'static', duration: '30 秒 × 2',      note: '脊柱保持中立，不要拱背',   Animation: LatStretch },
  { id: 'hip-flexor',        name: '髋屈肌拉伸',   nameEn: 'Hip Flexor Stretch',    phase: 'static', duration: '每侧 30 秒 × 2', note: '前膝在脚踝正上方，不超脚尖', Animation: HipFlexorStretch },
  { id: 'hamstring-stretch', name: '腘绳肌拉伸',   nameEn: 'Hamstring Stretch',     phase: 'static', duration: '每侧 30 秒 × 2', note: '背挺直前倾，够不到就不勉强', Animation: HamstringStretch },
  { id: 'calf-stretch',      name: '小腿拉伸',     nameEn: 'Calf Stretch',          phase: 'static', duration: '每侧 30 秒 × 2', note: '后脚脚跟必须贴地',         Animation: CalfStretch },
  { id: 'wrist-flexor',      name: '前臂手腕拉伸', nameEn: 'Wrist Flexor Stretch',  phase: 'static', duration: '每侧 20 秒 × 2', note: '掰到"紧"而不是"疼"',      Animation: WristFlexorStretch },
];

/* ============================================================
   Gallery 组件
   ============================================================ */

function StretchCard({ s }: { s: Stretch }) {
  const phaseColor = s.phase === 'dynamic' ? { bg: '#FDF2E9', color: '#B7470A', label: '动态' } : { bg: '#EBF5FB', color: '#1A5276', label: '静态' };
  return (
    <div style={{
      background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 12,
      padding: 14, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{
        background: 'linear-gradient(180deg, #FDF7EE 0%, #F5EDE4 100%)',
        borderRadius: 10, aspectRatio: '1 / 1', padding: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <s.Animation />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#2E2118' }}>{s.name}</h4>
        <span style={{
          fontSize: 10, background: phaseColor.bg, color: phaseColor.color,
          padding: '2px 8px', borderRadius: 6, fontWeight: 500, flexShrink: 0,
        }}>{phaseColor.label}</span>
      </div>
      <p style={{ fontSize: 11, color: '#A08060', margin: 0, letterSpacing: '0.04em' }}>{s.nameEn}</p>
      <p style={{ fontSize: 12, color: '#655D56', margin: 0, lineHeight: 1.5 }}>
        <span style={{ color: '#7A6145', fontWeight: 500 }}>⏱ {s.duration}</span>
      </p>
      <p style={{ fontSize: 11, color: '#8A8078', margin: 0, lineHeight: 1.55, background: '#FDF8F0', padding: '6px 8px', borderLeft: '2px solid #C4A882', borderRadius: '0 4px 4px 0' }}>
        💡 {s.note}
      </p>
    </div>
  );
}

export default function StretchAnimationGallery() {
  const dynamicList = STRETCHES.filter(s => s.phase === 'dynamic');
  const staticList  = STRETCHES.filter(s => s.phase === 'static');

  return (
    <div style={{
      background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 16,
      padding: 24, marginBottom: 32,
    }}>
      <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #F0EAE0' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 500, color: '#2E2118', margin: 0 }}>
          🧘 拉伸动作示意动画
        </h3>
        <p style={{ fontSize: 12, color: '#8A8078', margin: '4px 0 0' }}>
          每个动作自动循环演示方向与关键姿态，具体做法 / 时长 / 常见错误见下方正文。
        </p>
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: '#B7470A', fontWeight: 600, marginBottom: 12, letterSpacing: '0.08em' }}>
          🔥 动态拉伸 · 下水前 5-8 分钟
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {dynamicList.map(s => <StretchCard key={s.id} s={s} />)}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: '#1A5276', fontWeight: 600, marginBottom: 12, letterSpacing: '0.08em' }}>
          🌿 静态拉伸 · 下水后 8-12 分钟
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {staticList.map(s => <StretchCard key={s.id} s={s} />)}
        </div>
      </div>

      <style>{`
        /* 肩绕环 — 手臂绕圆 */
        .anim-arm-left  { animation: arm-rotate-left  3s linear infinite; }
        .anim-arm-right { animation: arm-rotate-right 3s linear infinite; }
        @keyframes arm-rotate-left  { from { transform: rotate(0deg); }   to { transform: rotate(-360deg); } }
        @keyframes arm-rotate-right { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }

        /* 躯干旋转 */
        .anim-torso-rotate { animation: torso-rotate 2.6s ease-in-out infinite; }
        @keyframes torso-rotate { 0%,100% { transform: rotate(-22deg); } 50% { transform: rotate(22deg); } }

        /* 弓步扭转 */
        .anim-lunge-twist { animation: lunge-rotate 2.8s ease-in-out infinite; }
        @keyframes lunge-rotate { 0%,100% { transform: rotate(-18deg); } 50% { transform: rotate(18deg); } }

        /* 手腕激活 — 前臂上下 */
        .anim-wrist { animation: wrist-bend 1.6s ease-in-out infinite; }
        @keyframes wrist-bend { 0%,100% { transform: rotate(-18deg) translateY(-3px); } 50% { transform: rotate(18deg) translateY(3px); } }

        /* 桨板划桨 — 轻微前伸 */
        .anim-paddle { animation: paddle-stroke 2.4s ease-in-out infinite; transform-origin: 60px 55px; }
        @keyframes paddle-stroke {
          0%,100% { transform: translate(0,0) rotate(0deg); }
          50%     { transform: translate(-6px,6px) rotate(-10deg); }
        }

        /* 胸肩拉伸 — 身体前后摆 */
        .anim-chest { animation: chest-sway 3s ease-in-out infinite; }
        @keyframes chest-sway { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(8deg); } }

        /* 背阔拉伸 — 身体侧倾 */
        .anim-lat { animation: lat-side 3s ease-in-out infinite; }
        @keyframes lat-side { 0%,100% { transform: rotate(-15deg); } 50% { transform: rotate(15deg); } }

        /* 髋屈肌 — 骨盆前推 */
        .anim-hip { animation: hip-push 2.6s ease-in-out infinite; transform-origin: 70px 85px; }
        @keyframes hip-push { 0%,100% { transform: translateX(0); } 50% { transform: translateX(8px); } }

        /* 腘绳肌 — 身体前倾 */
        .anim-hamstring { animation: hamstring-fold 3s ease-in-out infinite; }
        @keyframes hamstring-fold { 0%,100% { transform: rotate(-8deg); } 50% { transform: rotate(22deg); } }

        /* 小腿 — 身体前推 */
        .anim-calf { animation: calf-push 2.6s ease-in-out infinite; transform-origin: 66px 50px; }
        @keyframes calf-push { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-6px); } }

        /* 前臂 — 掰手指上下 */
        .anim-wrist-flexor { animation: wrist-flex-bend 2s ease-in-out infinite; }
        @keyframes wrist-flex-bend { 0%,100% { transform: rotate(-25deg); } 50% { transform: rotate(15deg); } }

        @media (prefers-reduced-motion: reduce) {
          .anim-arm-left, .anim-arm-right, .anim-torso-rotate, .anim-lunge-twist,
          .anim-wrist, .anim-paddle, .anim-chest, .anim-lat, .anim-hip,
          .anim-hamstring, .anim-calf, .anim-wrist-flexor {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
