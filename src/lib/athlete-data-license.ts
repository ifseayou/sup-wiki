/**
 * 运动员数据许可协议（后台可配置，单例）。
 * 小程序认领/绑定运动员时展示并要求勾选同意；用户同意态（含版本号）在
 * sport_hacker 侧写入认领记录留底。管理员在后台分段落编辑。
 */
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export interface LicenseSection {
  title: string;
  body: string;
}
export interface AthleteDataLicense {
  title: string;
  sections: LicenseSection[];
  version: string;
}

// 默认协议：不含「删除」措辞（前台无删除入口，仅提供更正/隐藏/匿名化/恢复展示）。
export const DEFAULT_ATHLETE_DATA_LICENSE: AthleteDataLicense = {
  title: '运动员数据许可协议',
  version: '2026-06-05',
  sections: [
    {
      title: '你授权的信息范围',
      body: '你确认提交的头像、桨板照片、姓名、一句话简介、地区和赛事校验信息真实有效，并授权 SUP Wiki 在审核通过后用于运动员主页、成绩档案和赛事资料展示。',
    },
    {
      title: '你可以随时调整展示',
      body: '你可以随时通过「更正、隐藏运动员主页、成绩榜姓名匿名化、恢复展示」等隐私申请调整前台展示状态。',
    },
    {
      title: '联系方式仅用于审核',
      body: '联系方式和号码牌仅用于管理员审核，不会公开展示。',
    },
  ],
};

async function ensureTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sup_athlete_data_license (
      id TINYINT NOT NULL DEFAULT 1,
      title VARCHAR(160) NOT NULL,
      sections JSON NOT NULL,
      version VARCHAR(32) NOT NULL DEFAULT '',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

function parseSections(value: unknown): LicenseSection[] {
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

export async function getAthleteDataLicense(): Promise<AthleteDataLicense> {
  await ensureTable();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT title, sections, version FROM sup_athlete_data_license WHERE id = 1 LIMIT 1'
  );
  if (!rows.length) {
    await saveAthleteDataLicense(DEFAULT_ATHLETE_DATA_LICENSE);
    return DEFAULT_ATHLETE_DATA_LICENSE;
  }
  const sections = parseSections(rows[0].sections);
  return {
    title: String(rows[0].title || DEFAULT_ATHLETE_DATA_LICENSE.title),
    sections: sections.length ? sections : DEFAULT_ATHLETE_DATA_LICENSE.sections,
    version: String(rows[0].version || DEFAULT_ATHLETE_DATA_LICENSE.version),
  };
}

export async function saveAthleteDataLicense(license: AthleteDataLicense): Promise<void> {
  await ensureTable();
  const title = String(license.title || '').trim().slice(0, 160) || DEFAULT_ATHLETE_DATA_LICENSE.title;
  const sections = parseSections(license.sections);
  const finalSections = sections.length ? sections : DEFAULT_ATHLETE_DATA_LICENSE.sections;
  const version = String(license.version || '').trim().slice(0, 32) || DEFAULT_ATHLETE_DATA_LICENSE.version;
  await pool.execute(
    `INSERT INTO sup_athlete_data_license (id, title, sections, version) VALUES (1, ?, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title), sections = VALUES(sections), version = VALUES(version)`,
    [title, JSON.stringify(finalSections), version]
  );
}
