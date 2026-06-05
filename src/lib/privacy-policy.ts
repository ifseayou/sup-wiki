/**
 * 数据与隐私说明（后台可配置，单例）。
 * 小程序经内部网关读取 /api/privacy-policy；管理员在后台编辑。
 */
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export interface PrivacySection {
  title: string;
  body: string;
}
export interface PrivacyPolicy {
  title: string;
  sections: PrivacySection[];
}

export const DEFAULT_PRIVACY_POLICY: PrivacyPolicy = {
  title: '数据与隐私说明',
  sections: [
    { title: '我们收录哪些数据', body: 'SUP Wiki 主要收录公开赛事成绩册、赛事公告、赛事官网和公开 PDF 中的赛事、项目、组别、成绩、名次和来源信息。' },
    { title: '未认领运动员默认展示', body: '未认领运动员仅展示最小必要赛事成绩信息，不展示头像、联系方式、个人简介、完整主页、分享卡、课程或装备推荐。' },
    { title: '本人可申请处理', body: '如果你是相关运动员本人，可以申请认领、更正、隐藏运动员主页、匿名化姓名、删除前台展示或恢复展示。' },
  ],
};

async function ensureTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sup_privacy_policy (
      id TINYINT NOT NULL DEFAULT 1,
      title VARCHAR(160) NOT NULL,
      sections JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

function parseSections(value: unknown): PrivacySection[] {
  let arr: unknown = value;
  if (typeof value === 'string') {
    try { arr = JSON.parse(value); } catch { arr = []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map(item => ({
      title: String((item as { title?: unknown })?.title || '').trim(),
      body: String((item as { body?: unknown })?.body || '').trim(),
    }))
    .filter(item => item.title || item.body);
}

export async function getPrivacyPolicy(): Promise<PrivacyPolicy> {
  await ensureTable();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT title, sections FROM sup_privacy_policy WHERE id = 1 LIMIT 1'
  );
  if (!rows.length) {
    await savePrivacyPolicy(DEFAULT_PRIVACY_POLICY);
    return DEFAULT_PRIVACY_POLICY;
  }
  const sections = parseSections(rows[0].sections);
  return {
    title: String(rows[0].title || DEFAULT_PRIVACY_POLICY.title),
    sections: sections.length ? sections : DEFAULT_PRIVACY_POLICY.sections,
  };
}

export async function savePrivacyPolicy(policy: PrivacyPolicy): Promise<void> {
  await ensureTable();
  const title = String(policy.title || '').trim().slice(0, 160) || DEFAULT_PRIVACY_POLICY.title;
  const sections = parseSections(policy.sections);
  const finalSections = sections.length ? sections : DEFAULT_PRIVACY_POLICY.sections;
  await pool.execute(
    `INSERT INTO sup_privacy_policy (id, title, sections) VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title), sections = VALUES(sections)`,
    [title, JSON.stringify(finalSections)]
  );
}
