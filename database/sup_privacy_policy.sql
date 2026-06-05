-- 数据与隐私说明（单例，后台可配置；小程序经内部 API 读取）
-- 2026-06 新增。应用启动/首次读取时也会 CREATE TABLE IF NOT EXISTS 并自动种子默认内容。
CREATE TABLE IF NOT EXISTS sup_privacy_policy (
  id TINYINT NOT NULL DEFAULT 1,
  title VARCHAR(160) NOT NULL,
  sections JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 默认种子（若无记录）
INSERT INTO sup_privacy_policy (id, title, sections)
SELECT 1, '数据与隐私说明', JSON_ARRAY(
  JSON_OBJECT('title', '我们收录哪些数据', 'body', 'SUP Wiki 主要收录公开赛事成绩册、赛事公告、赛事官网和公开 PDF 中的赛事、项目、组别、成绩、名次和来源信息。'),
  JSON_OBJECT('title', '未认领运动员默认展示', 'body', '未认领运动员仅展示最小必要赛事成绩信息，不展示头像、联系方式、个人简介、完整主页、分享卡、课程或装备推荐。'),
  JSON_OBJECT('title', '本人可申请处理', 'body', '如果你是相关运动员本人，可以申请认领、更正、隐藏运动员主页、匿名化姓名、删除前台展示或恢复展示。')
)
WHERE NOT EXISTS (SELECT 1 FROM sup_privacy_policy WHERE id = 1);
