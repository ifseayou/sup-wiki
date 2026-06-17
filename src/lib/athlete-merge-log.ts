/**
 * 运动员身份治理引擎（Phase 3）：迁移 / 拆分 / 合并的行级审计与回滚。
 *
 * 所有改动 athlete_id 的操作都先把受影响行的 (table, pk, from, to) 写入
 * sup_athlete_merge_log，再执行 UPDATE；合并删除草稿档案前先把整行快照入日志。
 * 回滚以 batch_id 为单位，按日志逐行还原 athlete_id（并在需要时重建被删档案）。
 */
import type { PoolConnection } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';

export interface AthleteFkTable {
  table: string;
  pk: string;
}

/** 所有引用 athlete_id 的成绩/积分/认领表（全量迁移/合并时整体重指）。 */
export const ATHLETE_FK_TABLES: AthleteFkTable[] = [
  { table: 'sup_event_results', pk: 'result_id' },
  { table: 'sup_event_result_members', pk: 'member_id' },
  { table: 'sup_event_point_standings', pk: 'standing_id' },
  { table: 'sup_annual_point_standings', pk: 'standing_id' },
  { table: 'sup_athlete_profile_claims', pk: 'claim_id' },
];

const ROLLBACK_ALLOWED_TABLES = new Set<string>([
  ...ATHLETE_FK_TABLES.map((t) => t.table),
  'sup_athletes',
]);

export type MergeOperation = 'merge' | 'transfer' | 'split';

export interface LogContext {
  batchId: string;
  operation: MergeOperation;
  adminUserId?: number | null;
  note?: string | null;
}

export function generateBatchId(operation: MergeOperation) {
  // 路由运行时允许 Date.now / Math.random
  return `${operation}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function insertLogRows(
  conn: PoolConnection,
  ctx: LogContext,
  table: string,
  pk: string,
  rowPks: number[],
  fromId: number | null,
  toId: number | null,
) {
  if (!rowPks.length) return;
  const values = rowPks.map((rowPk) => [
    ctx.batchId, ctx.operation, table, pk, rowPk, fromId, toId, ctx.adminUserId ?? null, ctx.note ?? null,
  ]);
  await conn.query(
    `INSERT INTO sup_athlete_merge_log
       (batch_id, operation, table_name, pk_column, row_pk, from_athlete_id, to_athlete_id, admin_user_id, note)
     VALUES ?`,
    [values]
  );
}

/** 把某档案在某表的全部行重指到 toId，并逐行记录日志。返回搬动行数。 */
async function reassignTableByAthlete(
  conn: PoolConnection,
  { table, pk }: AthleteFkTable,
  fromId: number,
  toId: number,
  ctx: LogContext,
) {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT ${pk} AS pk FROM ${table} WHERE athlete_id = ?`,
    [fromId]
  );
  const pks = rows.map((r) => Number(r.pk));
  if (!pks.length) return 0;
  await insertLogRows(conn, ctx, table, pk, pks, fromId, toId);
  await conn.execute(`UPDATE ${table} SET athlete_id = ? WHERE athlete_id = ?`, [toId, fromId]);
  return pks.length;
}

/**
 * 回链「同名未关联快照行」到 toId（成绩录入遇同名会把 athlete_id 留空）。
 * 先按 normalized_name 选出受影响主键并记日志(from=NULL)，再更新，保证可回滚。
 */
async function reassignNullSnapshotByName(
  conn: PoolConnection,
  table: string,
  pk: string,
  nameColumn: string,
  normalizedName: string,
  toId: number,
  ctx: LogContext,
) {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT ${pk} AS pk FROM ${table}
     WHERE athlete_id IS NULL AND REPLACE(LOWER(TRIM(${nameColumn})), ' ', '') = ?`,
    [normalizedName]
  );
  const pks = rows.map((r) => Number(r.pk));
  if (!pks.length) return 0;
  await insertLogRows(conn, ctx, table, pk, pks, null, toId);
  await conn.query(`UPDATE ${table} SET athlete_id = ? WHERE ${pk} IN (?)`, [toId, pks]);
  return pks.length;
}

/** 把指定成绩(及其团体成员行)从 fromId 迁到 toId（迁移/拆分），逐行记日志。 */
async function reassignResultsByIds(
  conn: PoolConnection,
  fromId: number,
  toId: number,
  resultIds: number[],
  ctx: LogContext,
) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT result_id FROM sup_event_results WHERE athlete_id = ? AND result_id IN (?)`,
    [fromId, resultIds]
  );
  const ids = rows.map((r) => Number(r.result_id));
  if (!ids.length) return { results: 0, members: 0 };
  await insertLogRows(conn, ctx, 'sup_event_results', 'result_id', ids, fromId, toId);
  await conn.query(`UPDATE sup_event_results SET athlete_id = ? WHERE result_id IN (?)`, [toId, ids]);

  const [mrows] = await conn.query<RowDataPacket[]>(
    `SELECT member_id FROM sup_event_result_members WHERE athlete_id = ? AND result_id IN (?)`,
    [fromId, ids]
  );
  const memberIds = mrows.map((r) => Number(r.member_id));
  if (memberIds.length) {
    await insertLogRows(conn, ctx, 'sup_event_result_members', 'member_id', memberIds, fromId, toId);
    await conn.query(`UPDATE sup_event_result_members SET athlete_id = ? WHERE member_id IN (?)`, [toId, memberIds]);
  }
  return { results: ids.length, members: memberIds.length };
}

/** 记录被删除档案整行快照（供回滚重建）。 */
export async function snapshotDeletedAthlete(
  conn: PoolConnection,
  athleteId: number,
  keepId: number,
  ctx: LogContext,
) {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT * FROM sup_athletes WHERE athlete_id = ? LIMIT 1`,
    [athleteId]
  );
  if (!rows.length) return;
  await conn.query(
    `INSERT INTO sup_athlete_merge_log
       (batch_id, operation, table_name, pk_column, row_pk, from_athlete_id, to_athlete_id, snapshot, admin_user_id, note)
     VALUES (?, ?, 'sup_athletes', 'athlete_id', ?, ?, ?, ?, ?, ?)`,
    [ctx.batchId, ctx.operation, athleteId, athleteId, keepId, JSON.stringify(rows[0]), ctx.adminUserId ?? null, ctx.note ?? null]
  );
}

/** 全量重指一个档案的所有 FK 表行到 keep（合并/全量迁移共用），返回各表搬动数。 */
export async function reassignAllByAthlete(
  conn: PoolConnection,
  fromId: number,
  toId: number,
  ctx: LogContext,
) {
  const moved: Record<string, number> = {};
  for (const tableDef of ATHLETE_FK_TABLES) {
    moved[tableDef.table] = await reassignTableByAthlete(conn, tableDef, fromId, toId, ctx);
  }
  return moved;
}

/** 回链同名快照（合并/全量迁移后）。 */
export async function reassignNameSnapshots(
  conn: PoolConnection,
  normalizedName: string,
  toId: number,
  ctx: LogContext,
) {
  if (!normalizedName) return;
  await reassignNullSnapshotByName(conn, 'sup_event_results', 'result_id', 'athlete_name_snapshot', normalizedName, toId, ctx);
  await reassignNullSnapshotByName(conn, 'sup_event_result_members', 'member_id', 'member_name', normalizedName, toId, ctx);
  await reassignNullSnapshotByName(conn, 'sup_annual_point_standings', 'standing_id', 'athlete_name_snapshot', normalizedName, toId, ctx);
}

export interface TransferOptions {
  fromAthleteId: number;
  toAthleteId: number;
  resultIds?: number[] | null;
  operation: MergeOperation;
  adminUserId?: number | null;
  note?: string | null;
}

/**
 * 跨档案迁移 / 拆分：
 * - 传 resultIds：仅迁移这些成绩(及团体成员行)（拆分用）。
 * - 不传 resultIds：迁移 fromAthlete 的全部成绩/积分/认领到 toAthlete（全量迁移；不删档案）。
 * 返回 { batchId, moved }。调用方负责事务。
 */
export async function transferResults(conn: PoolConnection, opts: TransferOptions) {
  const batchId = generateBatchId(opts.operation);
  const ctx: LogContext = {
    batchId,
    operation: opts.operation,
    adminUserId: opts.adminUserId ?? null,
    note: opts.note ?? null,
  };
  if (opts.resultIds && opts.resultIds.length) {
    const counts = await reassignResultsByIds(conn, opts.fromAthleteId, opts.toAthleteId, opts.resultIds, ctx);
    return { batchId, moved: counts };
  }
  const moved = await reassignAllByAthlete(conn, opts.fromAthleteId, opts.toAthleteId, ctx);
  return { batchId, moved };
}

/** 按批次回滚：还原每行 athlete_id，必要时重建被删档案。调用方负责事务。 */
export async function rollbackBatch(conn: PoolConnection, batchId: string) {
  const [logs] = await conn.execute<RowDataPacket[]>(
    `SELECT log_id, table_name, pk_column, row_pk, from_athlete_id, snapshot
     FROM sup_athlete_merge_log
     WHERE batch_id = ? AND rolled_back = 0
     ORDER BY (table_name = 'sup_athletes') DESC, log_id ASC`,
    [batchId]
  );
  if (!logs.length) return { restored: 0, recreatedAthletes: 0 };
  let restored = 0;
  let recreatedAthletes = 0;
  for (const lg of logs) {
    const tableName = String(lg.table_name);
    if (!ROLLBACK_ALLOWED_TABLES.has(tableName)) continue;
    if (tableName === 'sup_athletes' && lg.snapshot) {
      const snap = typeof lg.snapshot === 'string' ? JSON.parse(lg.snapshot) : lg.snapshot;
      const [exist] = await conn.execute<RowDataPacket[]>(
        `SELECT athlete_id FROM sup_athletes WHERE athlete_id = ? LIMIT 1`,
        [Number(lg.row_pk)]
      );
      if (!exist.length) {
        const cols = Object.keys(snap);
        await conn.query(
          `INSERT INTO sup_athletes (${cols.map((c) => `\`${c}\``).join(',')}) VALUES (?)`,
          [cols.map((c) => snap[c])]
        );
        recreatedAthletes += 1;
      }
    } else {
      await conn.execute(
        `UPDATE ${tableName} SET athlete_id = ? WHERE ${String(lg.pk_column)} = ?`,
        [lg.from_athlete_id ?? null, Number(lg.row_pk)]
      );
    }
    restored += 1;
  }
  await conn.execute(
    `UPDATE sup_athlete_merge_log SET rolled_back = 1 WHERE batch_id = ? AND rolled_back = 0`,
    [batchId]
  );
  return { restored, recreatedAthletes };
}
