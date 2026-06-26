#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 回填：把 athlete_id IS NULL 的成绩/团体成员/年度积分行，按归一化姓名重指到
 * 唯一命中的「已发布」运动员档案。修复英文名外籍选手（如 "Rai TAGUCHI" → id=36
 * "Rai Taguchi"）因大小写差异导入时未关联、详情页/小程序查不到成绩的问题。
 *
 * 安全设计：
 *  - 默认 --dry-run，只读打印映射与受影响行数；--apply 才在单事务内写库。
 *  - 默认仅回填「外籍」候选（候选档案 nationality 非国内），中文重名风险更高，
 *    需 --all 显式放开（仍要求唯一已发布候选）。
 *  - 0 个或 ≥2 个候选一律跳过，留后台 athlete-identities 人工确认。
 *  - 每行改动写入 sup_athlete_merge_log（from=NULL, to=候选），同一 batchId，
 *    事后可 `POST /api/admin/athletes/merge-rollback {batch_id}` 整批回滚。
 *
 * 用法：
 *   node scripts/backfill-foreign-athlete-results.js            # dry-run，仅外籍
 *   node scripts/backfill-foreign-athlete-results.js --apply    # 执行回填
 *   node scripts/backfill-foreign-athlete-results.js --all      # 含国内唯一候选（dry-run）
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');

const SNAPSHOT_TABLES = [
  { table: 'sup_event_results', pk: 'result_id', nameColumn: 'athlete_name_snapshot' },
  { table: 'sup_event_result_members', pk: 'member_id', nameColumn: 'member_name' },
  { table: 'sup_annual_point_standings', pk: 'standing_id', nameColumn: 'athlete_name_snapshot' },
];

// ---- 纯函数（可单测） ----

/** 归一化姓名：与 sup_athlete_identity_links.normalized_name 口径一致（去空白 + 小写）。 */
function normalizeName(name) {
  return String(name == null ? '' : name).replace(/\s+/g, '').toLowerCase();
}

const DOMESTIC_NATIONALITIES = new Set([
  '中国', '中华人民共和国', 'CHINA', 'CHN', 'CN', 'PRCHINA', "PEOPLESREPUBLICOFCHINA",
  '中国香港', 'HONGKONG', 'HKG', 'HK',
  '中国台北', 'CHINESETAIPEI', 'TPE', 'TWN', 'TAIWAN',
  '中国澳门', 'MACAU', 'MACAO', 'MAC',
]);

/** 国内（含港澳台）判定。空值视为「无法判定」→ 当作国内（外籍回填时跳过，偏保守）。 */
function isDomesticNationality(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return true;
  const key = raw.replace(/\s+/g, '').toUpperCase();
  return DOMESTIC_NATIONALITIES.has(key) || DOMESTIC_NATIONALITIES.has(raw.replace(/\s+/g, ''));
}

/**
 * 规划回填：对每个 NULL 姓名组，按候选档案数 / 国籍决定回填或跳过。
 * @param {Array<{norm:string, sample:string, affected:number}>} nullGroups
 * @param {Map<string, Array<{athlete_id:number, name:string, nationality:string|null}>>} candidatesByNorm
 * @param {{allowDomestic:boolean}} opts
 */
function planRelink(nullGroups, candidatesByNorm, opts = {}) {
  const relinks = [];
  const skipped = [];
  for (const group of nullGroups) {
    const candidates = candidatesByNorm.get(group.norm) || [];
    if (candidates.length === 0) {
      skipped.push({ ...group, reason: 'no-candidate', candidateCount: 0 });
      continue;
    }
    if (candidates.length > 1) {
      skipped.push({ ...group, reason: 'ambiguous', candidateCount: candidates.length });
      continue;
    }
    const candidate = candidates[0];
    const domestic = isDomesticNationality(candidate.nationality);
    if (domestic && !opts.allowDomestic) {
      skipped.push({ ...group, reason: 'domestic', candidateCount: 1, toId: candidate.athlete_id });
      continue;
    }
    relinks.push({
      norm: group.norm,
      sample: group.sample,
      affected: group.affected,
      toId: candidate.athlete_id,
      toName: candidate.name,
      nationality: candidate.nationality || null,
    });
  }
  return { relinks, skipped };
}

// ---- DB / CLI（仅 require.main 时执行） ----

function loadEnv() {
  const env = { ...process.env };
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

function connectionConfig(env) {
  return {
    host: env.MYSQL_HOST,
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
  };
}

function generateBatchId() {
  return `transfer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 收集所有 NULL 姓名组（跨三张快照表合并计数）。 */
async function collectNullGroups(conn) {
  const map = new Map(); // norm -> { norm, sample, affected }
  for (const { table, nameColumn } of SNAPSHOT_TABLES) {
    const [rows] = await conn.execute(
      `SELECT REPLACE(LOWER(TRIM(${nameColumn})), ' ', '') AS norm,
              MIN(${nameColumn}) AS sample, COUNT(*) AS cnt
         FROM ${table}
        WHERE athlete_id IS NULL AND ${nameColumn} IS NOT NULL AND TRIM(${nameColumn}) <> ''
        GROUP BY norm`
    );
    for (const r of rows) {
      const norm = String(r.norm || '');
      if (!norm) continue;
      const prev = map.get(norm) || { norm, sample: r.sample, affected: 0 };
      prev.affected += Number(r.cnt);
      map.set(norm, prev);
    }
  }
  return [...map.values()].sort((a, b) => b.affected - a.affected);
}

/** 查每个归一化名的「已发布」候选档案（同时匹配 name 与 name_en：外籍中文名档案+罗马音成绩快照）。 */
async function loadPublishedCandidates(conn, norms) {
  const byNorm = new Map();
  if (!norms.length) return byNorm;
  const want = new Set(norms);
  const [rows] = await conn.query(
    `SELECT athlete_id, name, name_en, nationality,
            REPLACE(LOWER(TRIM(name)), ' ', '') AS norm_name,
            REPLACE(LOWER(TRIM(COALESCE(name_en, ''))), ' ', '') AS norm_en
       FROM sup_athletes
      WHERE status = 'published'
        AND (REPLACE(LOWER(TRIM(name)), ' ', '') IN (?)
             OR (name_en IS NOT NULL AND name_en <> '' AND REPLACE(LOWER(TRIM(name_en)), ' ', '') IN (?)))`,
    [norms, norms]
  );
  const add = (norm, cand) => {
    if (!norm || !want.has(norm)) return;
    const list = byNorm.get(norm) || [];
    if (!list.some((c) => c.athlete_id === cand.athlete_id)) list.push(cand);
    byNorm.set(norm, list);
  };
  for (const r of rows) {
    const cand = { athlete_id: Number(r.athlete_id), name: r.name, nationality: r.nationality };
    add(r.norm_name, cand);
    add(r.norm_en, cand);
  }
  return byNorm;
}

/** 对一个 norm 在某表回填 athlete_id，逐行写审计日志。返回搬动行数。 */
async function relinkTable(conn, table, pk, nameColumn, norm, toId, batchId, note) {
  const [rows] = await conn.execute(
    `SELECT ${pk} AS pk FROM ${table}
      WHERE athlete_id IS NULL AND REPLACE(LOWER(TRIM(${nameColumn})), ' ', '') = ?`,
    [norm]
  );
  const pks = rows.map((r) => Number(r.pk));
  if (!pks.length) return 0;
  const logValues = pks.map((rowPk) => [batchId, 'transfer', table, pk, rowPk, null, toId, null, note]);
  await conn.query(
    `INSERT INTO sup_athlete_merge_log
       (batch_id, operation, table_name, pk_column, row_pk, from_athlete_id, to_athlete_id, admin_user_id, note)
     VALUES ?`,
    [logValues]
  );
  await conn.query(`UPDATE ${table} SET athlete_id = ? WHERE ${pk} IN (?)`, [toId, pks]);
  return pks.length;
}

/** 重算运动员 race_times 缓存（网页详情页直接读此字段）。与 fix-result-quality.js 同口径。 */
async function syncAthleteRaceTimes(conn, athleteId) {
  if (!athleteId) return;
  const [rows] = await conn.execute(
    `SELECT DISTINCT er.discipline, er.round_label, er.result_label, er.finish_time,
            er.result_status_code, er.result_status_note, er.rank_position,
            er.discipline_family, er.entry_type,
            e.start_date, e.event_id, e.name AS event_name
     FROM sup_event_results er
     INNER JOIN sup_events e ON e.event_id = er.event_id
     LEFT JOIN sup_event_result_members erm ON erm.result_id = er.result_id
     WHERE er.athlete_id = ? OR erm.athlete_id = ?
     ORDER BY e.start_date DESC, er.rank_position ASC`,
    [athleteId, athleteId]
  );
  const raceTimes = rows.map((row) => ({
    distance: row.discipline,
    year: row.start_date ? new Date(row.start_date).getFullYear() : undefined,
    event: row.event_name, event_id: row.event_id,
    round: row.round_label || undefined, result: row.result_label || undefined,
    time: row.finish_time, status: row.result_status_code || undefined,
    status_label: row.result_status_note || undefined,
    family: row.discipline_family || 'unknown',
    entry_type: row.entry_type === 'team' ? 'team' : 'individual',
    is_team: row.entry_type === 'team',
  }));
  await conn.execute('UPDATE sup_athletes SET race_times = ? WHERE athlete_id = ?', [JSON.stringify(raceTimes), athleteId]);
}

function parseSyncIds() {
  const arg = process.argv.find((a) => a.startsWith('--sync-ids='));
  if (!arg) return null;
  return arg.slice('--sync-ids='.length).split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const allowDomestic = process.argv.includes('--all');
  const syncIds = parseSyncIds();
  const env = loadEnv();
  const conn = await mysql.createConnection(connectionConfig(env));
  try {
    // 独立模式：只重算指定运动员的 race_times 缓存（用于已回填但缓存未刷新的档案）。
    if (syncIds) {
      for (const id of syncIds) await syncAthleteRaceTimes(conn, id);
      console.log(`[sync] 已重算 race_times: ${syncIds.join(', ')}`);
      return;
    }
    const nullGroups = await collectNullGroups(conn);
    const candidatesByNorm = await loadPublishedCandidates(conn, nullGroups.map((g) => g.norm));
    const { relinks, skipped } = planRelink(nullGroups, candidatesByNorm, { allowDomestic });

    console.log(`\n=== 回填规划（${allowDomestic ? '含国内' : '仅外籍'}）===`);
    console.log(`NULL 姓名组: ${nullGroups.length} | 将回填: ${relinks.length} | 跳过: ${skipped.length}`);
    console.log('\n-- 将回填 --');
    for (const r of relinks) {
      console.log(`  ${r.sample}  →  athlete_id=${r.toId} (${r.toName}, ${r.nationality || '?'})  影响 ${r.affected} 行`);
    }
    const ambiguous = skipped.filter((s) => s.reason === 'ambiguous');
    const noCand = skipped.filter((s) => s.reason === 'no-candidate');
    const domestic = skipped.filter((s) => s.reason === 'domestic');
    console.log(`\n-- 跳过 -- 多候选(需人工): ${ambiguous.length} | 无候选档案: ${noCand.length} | 国内单候选(需 --all): ${domestic.length}`);
    if (ambiguous.length) console.log('  多候选样例:', ambiguous.slice(0, 10).map((s) => `${s.sample}(${s.candidateCount})`).join(', '));

    if (!apply) {
      console.log('\n[dry-run] 未写库。确认无误后加 --apply 执行。');
      return;
    }
    if (!relinks.length) {
      console.log('\n无可回填项，结束。');
      return;
    }

    const batchId = generateBatchId();
    await conn.beginTransaction();
    try {
      let total = 0;
      for (const r of relinks) {
        for (const { table, pk, nameColumn } of SNAPSHOT_TABLES) {
          total += await relinkTable(conn, table, pk, nameColumn, r.norm, r.toId, batchId, `回填外籍未关联成绩: ${r.sample}`);
        }
      }
      // 重算被回填档案的 race_times 缓存（网页详情页直接读此字段）。
      for (const r of relinks) await syncAthleteRaceTimes(conn, r.toId);
      await conn.commit();
      console.log(`\n[applied] batchId=${batchId} 共回填 ${total} 行（${relinks.length} 名运动员）。`);
      console.log(`回滚: POST /api/admin/athletes/merge-rollback { "batch_id": "${batchId}" }`);
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  } finally {
    await conn.end();
  }
}

module.exports = { normalizeName, isDomesticNationality, planRelink };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
