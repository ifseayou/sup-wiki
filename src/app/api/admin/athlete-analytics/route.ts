/**
 * 运动员分析 / 组别报告（后台）
 * GET /api/admin/athlete-analytics              总览（运动员画像 + 组别分析）
 * GET /api/admin/athlete-analytics?group_key=X  某标准化组别的运动员下钻（分页）
 *
 * 直接 GROUP BY 已回填的标准化列(discipline_family/normalized_group_key)；
 * 运动员画像以 status='published' 为口径。
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { extractToken, isAdmin, verifyToken } from '@/lib/auth';
import { normalizeNationality } from '@/lib/nationality';
import { disciplineFamilyLabel, genderSegLabel } from '@/lib/group-labels';
import type { RowDataPacket } from 'mysql2';

function ensureAdmin(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  const payload = token ? verifyToken(token) : null;
  return isAdmin(payload);
}

async function groupDrillDown(groupKey: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT athlete_id) AS total
     FROM sup_event_results WHERE normalized_group_key = ? AND athlete_id IS NOT NULL`,
    [groupKey]
  );
  const total = Number(countRows[0]?.total || 0);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT er.athlete_id,
            COALESCE(a.name, MIN(er.athlete_name_snapshot)) AS name,
            COUNT(*) AS appearances,
            COUNT(DISTINCT er.event_id) AS events,
            MIN(NULLIF(er.rank_position, 0)) AS best_rank
     FROM sup_event_results er
     LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
     WHERE er.normalized_group_key = ? AND er.athlete_id IS NOT NULL
     GROUP BY er.athlete_id, a.name
     ORDER BY appearances DESC, events DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    [groupKey]
  );
  return NextResponse.json({
    group_key: groupKey,
    items: rows.map((r) => ({
      athlete_id: Number(r.athlete_id),
      name: r.name,
      appearances: Number(r.appearances),
      events: Number(r.events),
      best_rank: r.best_rank != null ? Number(r.best_rank) : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
}

export async function GET(request: NextRequest) {
  if (!ensureAdmin(request)) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const groupKey = request.nextUrl.searchParams.get('group_key');
  if (groupKey) {
    const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(10, Number(request.nextUrl.searchParams.get('pageSize') || 30)));
    return groupDrillDown(groupKey, page, pageSize);
  }

  // ===== 运动员画像（published 为主口径）=====
  const [overviewRows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       SUM(status = 'published') AS published,
       SUM(status = 'draft') AS draft,
       SUM(status = 'published' AND photo IS NOT NULL AND photo <> '') AS has_photo,
       SUM(status = 'published' AND gender <> 'unknown') AS gender_known,
       SUM(status = 'published' AND elite_event_status <> 'none') AS elite,
       SUM(status = 'published' AND gender_source = 'result_inferred') AS gender_inferred
     FROM sup_athletes`
  );
  const ov = overviewRows[0] || {};

  const [claimedRows, genderRows, eliteRows, natRows, provRows, activityRows,
    familyRows, groupRows, groupLabelRows, crossRows] = await Promise.all([
    pool.execute<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT o.athlete_id) AS c
       FROM sup_athlete_profile_owners o
       INNER JOIN sup_athletes a ON a.athlete_id = o.athlete_id
       WHERE o.role = 'owner' AND o.status = 'active' AND a.status = 'published'`
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT gender, COUNT(*) AS n FROM sup_athletes WHERE status = 'published' GROUP BY gender`
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT elite_event_status AS s, COUNT(*) AS n FROM sup_athletes WHERE status = 'published' GROUP BY elite_event_status`
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT nationality, COUNT(*) AS n FROM sup_athletes WHERE status = 'published' GROUP BY nationality`
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT province, COUNT(*) AS n FROM sup_athletes
       WHERE status = 'published' AND province IS NOT NULL AND province <> ''
       GROUP BY province ORDER BY n DESC LIMIT 12`
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT bucket, COUNT(*) AS athletes FROM (
         SELECT athlete_id,
           CASE WHEN COUNT(*) = 1 THEN '1' WHEN COUNT(*) <= 5 THEN '2-5'
                WHEN COUNT(*) <= 10 THEN '6-10' ELSE '10+' END AS bucket
         FROM sup_event_results WHERE athlete_id IS NOT NULL GROUP BY athlete_id
       ) t GROUP BY bucket`
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(discipline_family, 'unknown') AS fam,
              COUNT(*) AS rows_n,
              COUNT(DISTINCT athlete_id) AS athletes,
              COUNT(DISTINCT event_id) AS events
       FROM sup_event_results GROUP BY fam ORDER BY rows_n DESC`
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT normalized_group_key AS gk,
              COUNT(*) AS rows_n,
              COUNT(DISTINCT athlete_id) AS athletes,
              COUNT(DISTINCT event_id) AS events,
              COUNT(DISTINCT gender_group) AS variants
       FROM sup_event_results
       WHERE normalized_group_key IS NOT NULL AND normalized_group_key <> ''
       GROUP BY normalized_group_key ORDER BY rows_n DESC LIMIT 60`
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT normalized_group_key AS gk, gender_group AS label, COUNT(*) AS c
       FROM sup_event_results
       WHERE normalized_group_key IS NOT NULL AND normalized_group_key <> ''
       GROUP BY normalized_group_key, gender_group`
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT SUBSTRING_INDEX(normalized_group_key, '_', 1) AS gseg,
              COALESCE(discipline_family, 'unknown') AS fam,
              COUNT(*) AS rows_n
       FROM sup_event_results
       WHERE normalized_group_key IS NOT NULL AND normalized_group_key <> ''
       GROUP BY gseg, fam`
    ),
  ]);

  const num = (v: unknown) => Number(v || 0);

  // 国籍：归一后分中国/外籍 + 外籍 Top
  const foreignMap = new Map<string, number>();
  let cn = 0; let foreign = 0; let natUnknown = 0;
  for (const r of natRows[0]) {
    const norm = normalizeNationality(r.nationality);
    const n = num(r.n);
    if (!norm) natUnknown += n;
    else if (norm === '中国') cn += n;
    else { foreign += n; foreignMap.set(norm, (foreignMap.get(norm) || 0) + n); }
  }
  const foreignTop = [...foreignMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, n]) => ({ name, n }));

  // 标准化组别 label：取每个 key 最高频原始 gender_group
  const labelOf = new Map<string, { label: string; max: number }>();
  for (const r of groupLabelRows[0]) {
    const gk = String(r.gk); const c = num(r.c);
    const cur = labelOf.get(gk);
    if (!cur || c > cur.max) labelOf.set(gk, { label: String(r.label || gk), max: c });
  }

  // 性别×项目族交叉透视
  const genderSegs = new Set<string>();
  const fams = new Set<string>();
  const crossMap = new Map<string, number>();
  for (const r of crossRows[0]) {
    const g = String(r.gseg || ''); const f = String(r.fam || 'unknown');
    genderSegs.add(g); fams.add(f);
    crossMap.set(`${g}|${f}`, num(r.rows_n));
  }
  const famOrder = ['sprint', 'technical', 'distance', 'marathon', 'team', 'special', 'unknown'].filter((f) => fams.has(f));
  const genderOrder = ['male', 'female', 'mixed', 'open'].filter((g) => genderSegs.has(g));

  return NextResponse.json({
    athlete_portrait: {
      overview: {
        total: num(ov.published),
        claimed: num(claimedRows[0][0]?.c),
        draft: num(ov.draft),
        has_photo: num(ov.has_photo),
        gender_known: num(ov.gender_known),
        elite: num(ov.elite),
      },
      gender: genderRows[0].map((r) => ({ key: String(r.gender), n: num(r.n) })),
      data_quality: {
        gender_inferred: num(ov.gender_inferred),
        photo_missing: num(ov.published) - num(ov.has_photo),
        published: num(ov.published),
      },
      nationality: { china: cn, foreign, unknown: natUnknown, foreign_top: foreignTop },
      provinces: provRows[0].map((r) => ({ province: r.province, n: num(r.n) })),
      elite_status: eliteRows[0].map((r) => ({ key: String(r.s), n: num(r.n) })),
      activity: activityRows[0].map((r) => ({ bucket: String(r.bucket), athletes: num(r.athletes) })),
    },
    group_analysis: {
      families: familyRows[0].map((r) => ({
        family: String(r.fam),
        label: disciplineFamilyLabel(String(r.fam)),
        rows: num(r.rows_n),
        athletes: num(r.athletes),
        events: num(r.events),
      })),
      groups: groupRows[0].map((r) => ({
        group_key: String(r.gk),
        label: labelOf.get(String(r.gk))?.label || String(r.gk),
        rows: num(r.rows_n),
        athletes: num(r.athletes),
        events: num(r.events),
        variants: num(r.variants),
      })),
      gender_family_cross: {
        genders: genderOrder.map((g) => ({ key: g, label: genderSegLabel(g) })),
        families: famOrder.map((f) => ({ key: f, label: disciplineFamilyLabel(f) })),
        matrix: genderOrder.map((g) => famOrder.map((f) => crossMap.get(`${g}|${f}`) || 0)),
      },
    },
  });
}
