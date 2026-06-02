import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireUser } from '@/lib/user-auth';
import { athleteOwnerCondition } from '@/lib/result-privacy';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

const REQUEST_TYPES = new Set(['correction', 'hide_athlete', 'anonymize_name', 'delete_frontend']);
const TARGET_TYPES = new Set(['athlete', 'result']);

function cleanText(value: unknown, max = 1000) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : null;
}

async function ensurePrivacyTables() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sup_privacy_requests (
      request_id BIGINT NOT NULL AUTO_INCREMENT,
      user_id BIGINT NULL,
      nickname VARCHAR(120) NULL,
      request_type VARCHAR(48) NOT NULL,
      target_type VARCHAR(32) NOT NULL,
      target_id BIGINT NULL,
      athlete_id BIGINT NULL,
      result_id BIGINT NULL,
      event_id BIGINT NULL,
      description TEXT NULL,
      contact TEXT NULL,
      proof_images JSON NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      handler_user_id BIGINT NULL,
      handler_name VARCHAR(120) NULL,
      handler_note TEXT NULL,
      handled_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (request_id),
      KEY idx_status_created (status, created_at),
      KEY idx_target (target_type, target_id),
      KEY idx_athlete (athlete_id),
      KEY idx_result (result_id),
      KEY idx_user_created (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sup_privacy_request_logs (
      log_id BIGINT NOT NULL AUTO_INCREMENT,
      request_id BIGINT NOT NULL,
      action VARCHAR(64) NOT NULL,
      actor_user_id BIGINT NULL,
      actor_name VARCHAR(120) NULL,
      note TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (log_id),
      KEY idx_request_created (request_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (user instanceof NextResponse) return user;

  try {
    await ensurePrivacyTables();
    const body = await request.json().catch(() => ({}));
    const requestType = String(body.request_type || '').trim();
    const targetType = String(body.target_type || '').trim();
    const targetId = Number(body.target_id || 0);
    const athleteId = Number(body.athlete_id || (targetType === 'athlete' ? targetId : 0)) || null;
    const resultId = Number(body.result_id || (targetType === 'result' ? targetId : 0)) || null;
    const eventId = Number(body.event_id || 0) || null;
    if (!REQUEST_TYPES.has(requestType)) return NextResponse.json({ error: '无效请求类型' }, { status: 400 });
    if (!TARGET_TYPES.has(targetType) || !Number.isInteger(targetId) || targetId <= 0) {
      return NextResponse.json({ error: '无效处理对象' }, { status: 400 });
    }
    const isOwnerHideAthlete = requestType === 'hide_athlete' && targetType === 'athlete' && athleteId;
    let ownerCanComplete = false;
    if (isOwnerHideAthlete) {
      const [ownerRows] = await pool.execute<RowDataPacket[]>(
        `SELECT owner_id
         FROM sup_athlete_profile_owners
         WHERE athlete_id = ? AND user_id = ? AND ${athleteOwnerCondition('sup_athlete_profile_owners')}
         LIMIT 1`,
        [athleteId, user.user_id]
      );
      ownerCanComplete = ownerRows.length > 0;
    }
    const description = cleanText(body.description, 2000) || (ownerCanComplete ? '本人确认隐藏运动员主页' : null);
    if (!description) return NextResponse.json({ error: '请填写说明' }, { status: 400 });
    const status = ownerCanComplete ? 'completed' : 'pending';
    const handledAtSql = ownerCanComplete ? 'NOW()' : 'NULL';

    const [inserted] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_privacy_requests
       (user_id, nickname, request_type, target_type, target_id, athlete_id, result_id, event_id, description, contact, proof_images, status, handler_user_id, handler_name, handler_note, handled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, JSON_ARRAY(), ?, ?, ?, ?, ${handledAtSql})`,
      [
        user.user_id,
        user.nickname || null,
        requestType,
        targetType,
        targetId,
        athleteId,
        resultId,
        eventId,
        description,
        cleanText(body.contact, 500),
        status,
        ownerCanComplete ? user.user_id : null,
        ownerCanComplete ? user.nickname || null : null,
        ownerCanComplete ? '本人确认隐藏主页，系统自动完成' : null,
      ]
    );
    await pool.execute(
      `INSERT INTO sup_privacy_request_logs (request_id, action, actor_user_id, actor_name, note)
       VALUES (?, 'submitted', ?, ?, ?)`,
      [inserted.insertId, user.user_id, user.nickname || null, description]
    );
    if (ownerCanComplete) {
      await pool.execute(
        `INSERT INTO sup_privacy_request_logs (request_id, action, actor_user_id, actor_name, note)
         VALUES (?, 'owner_completed_hide_athlete', ?, ?, '本人确认后立即隐藏主页')`,
        [inserted.insertId, user.user_id, user.nickname || null]
      );
    }
    return NextResponse.json({ success: true, request_id: inserted.insertId, status }, { status: 201 });
  } catch (error) {
    console.error('提交隐私请求失败:', error);
    return NextResponse.json({ error: '提交隐私请求失败' }, { status: 500 });
  }
}
