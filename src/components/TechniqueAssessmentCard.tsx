/**
 * 桨板 35 项技术考核卡片组件。
 * 每项一个 TechniqueInline 组件：序号徽章 + 动作名 + 分值 + 要点 + 常见错误。
 * 阶段颜色主题见 STAGES，用于序号徽章背景 / 阶段标签背景。
 */

interface Technique {
  id: string;          // "01"..."35"
  no: number;
  name: string;
  stage: 1 | 2 | 3 | 4 | 5 | 6;
  points: number;
  keyPoints: string;
  errors: string;
}

interface StageMeta {
  label: string;
  short: string;
  bg: string;
  color: string;
  badgeBg: string;
  badgeColor: string;
}

export const STAGES: Record<1 | 2 | 3 | 4 | 5 | 6, StageMeta> = {
  1: { label: '阶段 1 · 跪姿基础',       short: '跪姿基础',   bg: '#E9F7EF', color: '#0E6655', badgeBg: '#7FC6A4', badgeColor: '#FFFFFF' },
  2: { label: '阶段 2 · 站立起步',       short: '站立起步',   bg: '#FDF2E9', color: '#B7470A', badgeBg: '#EFA878', badgeColor: '#FFFFFF' },
  3: { label: '阶段 3 · 站姿控船',       short: '站姿控船',   bg: '#FDEBD0', color: '#9A6A1E', badgeBg: '#D9A45E', badgeColor: '#FFFFFF' },
  4: { label: '阶段 4 · 落水与回板',     short: '落水回板',   bg: '#EBF5FB', color: '#1A5276', badgeBg: '#5DADE2', badgeColor: '#FFFFFF' },
  5: { label: '阶段 5 · 支撑与走板',     short: '支撑走板',   bg: '#F4ECF7', color: '#6C3483', badgeBg: '#AF7AC5', badgeColor: '#FFFFFF' },
  6: { label: '阶段 6 · 高阶转向与救援', short: '高阶救援',   bg: '#F0EAE0', color: '#7A6145', badgeBg: '#A08060', badgeColor: '#FFFFFF' },
};

export const TECHNIQUES: Technique[] = [
  // 阶段 1 · 跪姿基础（1-6）
  { id: '01', no: 1, name: '上下水', stage: 1, points: 1,
    keyPoints: '从岸边或浅水区侧身趴板，双手撑板慢慢爬上，重心落在板中线后再跪起；下板顺序相反。关键是上板前先平衡好桨和自己再做动作。',
    errors: '正面直立上板 → 板头瞬间被压翻。' },
  { id: '02', no: 2, name: '跪姿直线', stage: 1, points: 1,
    keyPoints: '双膝与板宽同宽跪稳，上身直立、核心收紧。桨叶入水尽量贴近板身，左右两桨幅度一致让板走直线。',
    errors: '单边连续划 → 板越划越歪。' },
  { id: '03', no: 3, name: '跪姿扫桨转向（前后）', stage: 1, points: 1,
    keyPoints: '想转左就用右手单侧从板头到板尾画大弧；倒转则桨叶在板尾往前扫。核心发力在躯干而非手臂，弧度越大转向越快。',
    errors: '只动手腕、弧度太小 → 转不动。' },
  { id: '04', no: 4, name: '跪姿锚点急停', stage: 1, points: 1,
    keyPoints: '桨叶垂直插入板侧水中，下刃全没、桨柄贴在板身上。利用板身与桨叶形成的阻力在 1-2 个船身内停下。',
    errors: '桨插得浅或斜插 → 板继续漂。' },
  { id: '05', no: 5, name: '跪姿直线停止', stage: 1, points: 1,
    keyPoints: '左右两侧交替做反向短划（桨叶凹面朝前推水）直到板速归零，全程保持直线不偏航。',
    errors: '只反划一侧 → 停的时候偏航。' },
  { id: '06', no: 6, name: '跪姿倒退', stage: 1, points: 1,
    keyPoints: '桨叶凹面朝前，从脚边往板头推水；两侧交替节奏对称让板匀速后退。头扭过肩盯着后方防撞。',
    errors: '桨叶方向没反 → 板原地打转。' },

  // 阶段 2 · 站立起步（7-10）
  { id: '07', no: 7, name: '站立', stage: 2, points: 1,
    keyPoints: '双手撑桨横放板上保持三点支撑，一脚踩跪点→另一脚对称踩→缓慢直立，全程视线落在板头前方 3-5 米。',
    errors: '低头看脚 → 失去前庭参照必倒。' },
  { id: '08', no: 8, name: '站立划行', stage: 2, points: 1,
    keyPoints: '膝盖微屈、髋部略前倾、核心绷紧；桨插前、拉至脚边出水；"身体稳而板不稳"是正确状态。',
    errors: '直腿僵立 → 板一晃就倒。' },
  { id: '09', no: 9, name: '站立扫桨转向（前后）', stage: 2, points: 1,
    keyPoints: '站姿大弧扫桨比跪姿更依赖上肢与核心联动，扫桨时膝盖跟着躯干微屈缓冲稳定板身。',
    errors: '只用手转向 → 板转不动还失衡。' },
  { id: '10', no: 10, name: '站立锚点急停', stage: 2, points: 1,
    keyPoints: '桨叶垂直插板侧水中，同时屈膝下沉重心抵消惯性前冲，桨柄贴紧板身借阻力。',
    errors: '直立插桨 → 人往前飞。' },

  // 阶段 3 · 站姿控船（11-15）
  { id: '11', no: 11, name: '划行姿态', stage: 3, points: 1,
    keyPoints: '脚尖朝前与板平行、膝盖微屈可吸震、髋中立、核心绷紧、肩胛下沉、目视前方。这是所有进阶动作共同的起点。',
    errors: '驼背 / 锁膝 / 低头。' },
  { id: '12', no: 12, name: '划行发力', stage: 3, points: 1,
    keyPoints: '发力主链是核心旋转 → 肩带 → 手臂。上桨手压下、下桨手拉后，像"划独木舟"而不是"扫地"，每一桨要长而深。',
    errors: '只用手臂 → 5 桨就酸。' },
  { id: '13', no: 13, name: '站立晃板', stage: 3, points: 1,
    keyPoints: '板受侧浪晃动时用脚踝和髋关节微调，而非大幅重心移动，学会在小幅晃动里保持身体中线。',
    errors: '上身乱倾斜 → 越调越晃。' },
  { id: '14', no: 14, name: '站立直线停止', stage: 3, points: 1,
    keyPoints: '交替做左右短反划直至板停，下半身保持站姿稳定，不靠身体前后倾压板头板尾。',
    errors: '急剧前倾压板 → 板头扎水落水。' },
  { id: '15', no: 15, name: '站立倒退', stage: 3, points: 1,
    keyPoints: '桨叶反向推水，从脚边推到板头，头和肩主动朝后观察防撞，两侧交替节奏对称。',
    errors: '只顾往后划不看方向 → 撞岸或撞人。' },

  // 阶段 4 · 落水与回板（16-18）
  { id: '16', no: 16, name: '主动落水', stage: 4, points: 1,
    keyPoints: '察觉即将失衡时主动侧身脱板向侧后方滑落水，手不抓板沿避免扭伤，尽量落在板尾侧远离尾鳍。',
    errors: '直线往前扑 → 砸到板鼻或尾鳍。' },
  { id: '17', no: 17, name: '被动落水', stage: 4, points: 1,
    keyPoints: '意外摔下时护头护面（手臂下意识抱头），脚蜷起避免撞尾鳍；落水后立即浮上来找桨和板的位置。',
    errors: '挺身硬扎入水 → 呛水或磕碰。' },
  { id: '18', no: 18, name: '中位上板', stage: 4, points: 1,
    keyPoints: '游到板中间握住两侧提手或板沿，双脚蹬水使上半身冲上板面，重心沿板中线趴稳后再跪起。',
    errors: '从板头板尾爬 → 容易翻板或被板打。' },

  // 阶段 5 · 支撑与走板（19-25）
  { id: '19', no: 19, name: '高支撑', stage: 5, points: 1,
    keyPoints: '桨叶以拍水面方式向下支撑，桨柄横贴胸前，通过拍水反作用力把快要翻的板身按回中线。',
    errors: '桨叶入水太深 → 借不到力还扭肩。' },
  { id: '20', no: 20, name: '低支撑', stage: 5, points: 1,
    keyPoints: '桨叶贴水面滑动做外扫，桨柄贴在大腿前，适用于轻度失衡的快速修复，反应速度比高支撑更快。',
    errors: '桨叶抬离水面 → 错过修正窗口。' },
  { id: '21', no: 21, name: '平行式走板', stage: 5, points: 1,
    keyPoints: '双脚平行小幅前后挪动（每次挪 10-15 cm），用脚掌"粘着"板面而非抬起，重心始终在两脚之间。',
    errors: '大跨步挪动 → 板一晃失衡。' },
  { id: '22', no: 22, name: '横移步走板', stage: 5, points: 1,
    keyPoints: '侧身朝板头或板尾，一脚横挪一脚跟进，保持两脚始终与板平行，身体不扭转。',
    errors: '转身朝板头走 → 身体扭来扭去必翻。' },
  { id: '23', no: 23, name: '板尾外轴转', stage: 5, points: 1,
    keyPoints: '后脚移到板尾使板尾沉水，板头翘出水面，用桨在板头前方做大弧扫实现快速 180° 调头。',
    errors: '脚没踩到板尾最后 → 板不翘起转不动。' },
  { id: '24', no: 24, name: '单边直线划行', stage: 5, points: 1,
    keyPoints: '只用单侧划 10 桨以上不偏航，靠桨叶出水前向外轻扫（J 形尾扫）或入水角度略外开抵消船头偏转。',
    errors: '直接连划不做补正 → 5 桨就偏。' },
  { id: '25', no: 25, name: '压桨平移', stage: 5, points: 1,
    keyPoints: '桨叶插入板侧方、桨叶与板身平行，把水横向推向自己让板朝反方向平移，靠岸 / 避障必备。',
    errors: '桨叶朝前 → 变成刹车不是平移。' },

  // 阶段 6 · 高阶转向与救援（26-35）
  { id: '26', no: 26, name: '前舵转向', stage: 6, points: 1,
    keyPoints: '把桨插到板头最前端，一推一拉做 C 形划，利用前端力矩急转弯，绕标赛和窄水道必备。',
    errors: '桨没到板头 → 变成普通扫桨。' },
  { id: '27', no: 27, name: '拧身拨桨', stage: 6, points: 1,
    keyPoints: '用躯干大幅度旋转带动桨做 C 形划，借助腰腹力量而不是手臂，效率提升 30% 以上。',
    errors: '只扭肩不转髋 → 力量传不到桨。' },
  { id: '28', no: 28, name: '跨板头转向', stage: 6, points: 1,
    keyPoints: '脚主动前移到板头，踩压使板头沉水并以此为支点做 180° 调头，难度比外轴转更高。',
    errors: '重心没压下去 → 板不沉转不动。' },
  { id: '29', no: 29, name: '趴板划水', stage: 6, points: 1,
    keyPoints: '趴在板上，双手交替划水，头稍抬保持视野；适用于大风大浪回板或恶劣天气前行。',
    errors: '双手同划 → 方向难控。' },
  { id: '30', no: 30, name: '趴板转向', stage: 6, points: 1,
    keyPoints: '趴姿只用单侧手臂连续划水即可转向，胸口顶住板上减少阻力，小幅度持续拨水最有效。',
    errors: '身体扭来扭去 → 划水效率差。' },
  { id: '31', no: 31, name: '趴板急停', stage: 6, points: 1,
    keyPoints: '两手同时掌心朝前撑水制动，身体略抬肩增加阻力，几秒内让板停下。',
    errors: '一手先一手后 → 板打转。' },
  { id: '32', no: 32, name: '水下翻板', stage: 6, points: 1,
    keyPoints: '落水后板底朝上时，游到板侧抓对侧边缘，脚蹬水 + 手臂发力把板翻回正面。',
    errors: '想从板头板尾翻 → 杠杆太短翻不动。' },
  { id: '33', no: 33, name: '翻板救援', stage: 6, points: 1,
    keyPoints: '队友被压板下或体力不支时，从板侧并排抓手帮助翻板并保其上板；自己先稳住自己的板再去救人。',
    errors: '慌乱靠近 → 两板撞击更危险。' },
  { id: '34', no: 34, name: '交叉步走板', stage: 6, points: 1,
    keyPoints: '前脚交叉跨到另一脚前方（步距约 30 cm），后脚再跟进，用于快速移动到板头或板尾。',
    errors: '步幅太大 → 板剧烈摇晃。' },
  { id: '35', no: 35, name: '不换手倒退', stage: 6, points: 1,
    keyPoints: '保持同侧握桨不换边，用 J 形尾扫 + 反向推水组合让板后退还不偏航，是桨控能力的最高阶体现。',
    errors: '不做尾扫补偿 → 板斜着后退。' },
];

/* ============================================================
   单项内联卡片
   ============================================================ */

export function TechniqueInline({ id }: { id: string }) {
  const t = TECHNIQUES.find(x => x.id === id);
  if (!t) return null;
  const s = STAGES[t.stage];

  return (
    <div style={{
      display: 'flex', gap: 14, alignItems: 'stretch',
      background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 12,
      padding: 14, margin: '12px 0 16px',
    }}>
      {/* 序号徽章 */}
      <div style={{
        width: 64, flexShrink: 0,
        background: s.bg, borderRadius: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 2, padding: '6px 4px',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500,
          color: s.color, lineHeight: 1,
        }}>{t.id}</div>
        <div style={{ fontSize: 10, color: s.color, opacity: 0.75, letterSpacing: '0.04em' }}>
          {t.points} 分
        </div>
      </div>

      {/* 主体 */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10, background: s.badgeBg, color: s.badgeColor,
            padding: '2px 8px', borderRadius: 6, fontWeight: 500, letterSpacing: '0.04em',
          }}>{s.short}</span>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#2E2118' }}>{t.name}</h4>
        </div>

        <p style={{ fontSize: 13, color: '#3D3730', margin: 0, lineHeight: 1.7 }}>
          <span style={{ color: '#7A6145', fontWeight: 600 }}>要点：</span>{t.keyPoints}
        </p>

        <p style={{
          fontSize: 12, color: '#8A8078', margin: 0, lineHeight: 1.6,
          background: '#FDF8F0', padding: '6px 10px',
          borderLeft: '2px solid #C4A882', borderRadius: '0 4px 4px 0',
        }}>
          ⚠️ <span style={{ fontWeight: 500 }}>常见错误</span>：{t.errors}
        </p>
      </div>
    </div>
  );
}

export default TechniqueInline;
