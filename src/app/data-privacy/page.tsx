const sections = [
  {
    title: '我们收录哪些数据',
    body: 'SUP Wiki 收录的赛事成绩主要来自赛事主办方公开发布的成绩册、赛事公告、赛事官网和公开 PDF 资料，用于桨板赛事资料整理和成绩查询。',
  },
  {
    title: '未认领运动员默认展示哪些信息',
    body: '对于未认领运动员，平台仅展示最小必要成绩信息，包括姓名、赛事名称、项目、组别、成绩、名次和数据来源。',
  },
  {
    title: '哪些信息不会默认展示',
    body: '未认领运动员不默认展示头像、联系方式、个人简介、完整主页、历史成绩聚合、积分排名、分享卡、课程或装备推荐。',
  },
  {
    title: '本人如何处理',
    body: '如果你是相关运动员本人，可以申请认领、更正、隐藏运动员主页、成绩榜姓名匿名化或删除前台展示。删除前台展示不是物理删除，后台会保留来源记录、处理记录和操作日志。',
  },
];

export default function DataPrivacyPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#FAF7F2', padding: '56px 20px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <section style={{ background: '#0F766E', borderRadius: 24, padding: 36, color: '#fff', marginBottom: 20 }}>
          <div style={{ letterSpacing: 5, fontWeight: 800, opacity: 0.62, fontSize: 13 }}>SUP WIKI</div>
          <h1 style={{ margin: '20px 0 12px', fontSize: 42, lineHeight: 1.15 }}>数据与隐私说明</h1>
          <p style={{ margin: 0, maxWidth: 720, color: 'rgba(255,255,255,0.78)', lineHeight: 1.8 }}>
            公开赛事资料用于成绩查询和历史归档；本人可以申请认领、更正、隐藏、匿名化或删除相关前台展示。
          </p>
        </section>
        <div style={{ display: 'grid', gap: 14 }}>
          {sections.map(section => (
            <section key={section.title} style={{ background: '#FEFCF9', border: '1px solid #E0D8CC', borderRadius: 18, padding: 24 }}>
              <h2 style={{ margin: 0, fontSize: 22, color: '#2A2118' }}>{section.title}</h2>
              <p style={{ margin: '12px 0 0', color: '#6F665E', lineHeight: 1.85 }}>{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
