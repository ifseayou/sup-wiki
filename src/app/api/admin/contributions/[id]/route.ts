/**
 * 管理员 - 贡献详情和审核 API
 * GET /api/admin/contributions/[id] - 获取贡献详情（含 diff）
 * PUT /api/admin/contributions/[id] - 审核贡献（通过/拒绝）
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken, isAdmin } from '@/lib/auth';
import pool from '@/lib/db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { EntityType } from '@/types';

interface ContributionRow extends RowDataPacket {
  contribution_id: number;
  sup_user_id: number;
  entity_type: EntityType;
  entity_id: number | null;
  action: string;
  payload: string;
  status: string;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  user_nickname: string | null;
  user_avatar: string | null;
}

// 获取实体当前数据（用于 diff 对比）
async function getEntityData(entityType: EntityType, entityId: number): Promise<Record<string, unknown> | null> {
  const tableMap: Record<EntityType, { table: string; idField: string }> = {
    brand: { table: 'sup_brands', idField: 'brand_id' },
    product: { table: 'sup_products', idField: 'product_id' },
    athlete: { table: 'sup_athletes', idField: 'athlete_id' },
    creator: { table: 'sup_creators', idField: 'creator_id' },
  };

  const { table, idField } = tableMap[entityType];
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${table} WHERE ${idField} = ?`,
    [entityId]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  // 解析 JSON 字段
  if (entityType === 'product') {
    if (row.buy_links) row.buy_links = JSON.parse(row.buy_links);
    if (row.images) row.images = JSON.parse(row.images);
  } else if (entityType === 'athlete') {
    if (row.achievements) row.achievements = JSON.parse(row.achievements);
    if (row.social_links) row.social_links = JSON.parse(row.social_links);
  }

  return row;
}

// 应用贡献变更（合并到主数据）
async function applyContribution(
  entityType: EntityType,
  entityId: number | null,
  action: string,
  payload: Record<string, unknown>
): Promise<number> {
  const tableMap: Record<EntityType, { table: string; idField: string }> = {
    brand: { table: 'sup_brands', idField: 'brand_id' },
    product: { table: 'sup_products', idField: 'product_id' },
    athlete: { table: 'sup_athletes', idField: 'athlete_id' },
    creator: { table: 'sup_creators', idField: 'creator_id' },
  };

  const { table, idField } = tableMap[entityType];

  // 处理 JSON 字段
  const processedPayload = { ...payload };
  if (entityType === 'product') {
    if (processedPayload.buy_links && typeof processedPayload.buy_links !== 'string') {
      processedPayload.buy_links = JSON.stringify(processedPayload.buy_links);
    }
    if (processedPayload.images && typeof processedPayload.images !== 'string') {
      processedPayload.images = JSON.stringify(processedPayload.images);
    }
  } else if (entityType === 'athlete') {
    if (processedPayload.achievements && typeof processedPayload.achievements !== 'string') {
      processedPayload.achievements = JSON.stringify(processedPayload.achievements);
    }
    if (processedPayload.social_links && typeof processedPayload.social_links !== 'string') {
      processedPayload.social_links = JSON.stringify(processedPayload.social_links);
    }
  }

  if (action === 'create') {
    const fields = Object.keys(processedPayload);
    const values = Object.values(processedPayload) as (string | number | null)[];
    const placeholders = fields.map(() => '?').join(', ');

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    return result.insertId;
  } else {
    // update
    const fields = Object.keys(processedPayload);
    const values = Object.values(processedPayload) as (string | number | null)[];
    const setClause = fields.map((f) => `${f} = ?`).join(', ');

    await pool.execute(
      `UPDATE ${table} SET ${setClause} WHERE ${idField} = ?`,
      [...values, entityId]
    );
    return entityId as number;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证管理员权限
  const authHeader = request.headers.get('authorization');
  const token = extractToken(authHeader);

  if (!token) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload || !isAdmin(payload)) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const contributionId = parseInt(id);

    if (isNaN(contributionId)) {
      return NextResponse.json({ error: '无效的贡献 ID' }, { status: 400 });
    }

    // 获取贡献详情
    const [contributions] = await pool.execute<ContributionRow[]>(
      `SELECT c.*, u.nickname as user_nickname, u.avatar as user_avatar
       FROM sup_contributions c
       JOIN sup_wiki_users sw ON c.sup_user_id = sw.sup_user_id
       JOIN users u ON sw.user_id = u.user_id
       WHERE c.contribution_id = ?`,
      [contributionId]
    );

    if (contributions.length === 0) {
      return NextResponse.json({ error: '贡献不存在' }, { status: 404 });
    }

    const contribution = contributions[0];
    const parsedPayload = JSON.parse(contribution.payload);

    // 获取原始数据（用于 diff 对比）
    let originalData: Record<string, unknown> | null = null;
    if (contribution.action === 'update' && contribution.entity_id) {
      originalData = await getEntityData(contribution.entity_type, contribution.entity_id);
    }

    return NextResponse.json({
      ...contribution,
      payload: parsedPayload,
      original: originalData,
    });
  } catch (error) {
    console.error('获取贡献详情失败:', error);
    return NextResponse.json({ error: '获取贡献详情失败' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证管理员权限
  const authHeader = request.headers.get('authorization');
  const token = extractToken(authHeader);

  if (!token) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const jwtPayload = verifyToken(token);
  if (!jwtPayload || !isAdmin(jwtPayload)) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const contributionId = parseInt(id);
    const body = await request.json();
    const { action, review_note } = body as {
      action: 'approve' | 'reject';
      review_note?: string;
    };

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: '无效的操作' }, { status: 400 });
    }

    if (action === 'reject' && !review_note) {
      return NextResponse.json({ error: '拒绝时需要填写理由' }, { status: 400 });
    }

    // 获取贡献详情
    const [contributions] = await pool.execute<ContributionRow[]>(
      'SELECT * FROM sup_contributions WHERE contribution_id = ?',
      [contributionId]
    );

    if (contributions.length === 0) {
      return NextResponse.json({ error: '贡献不存在' }, { status: 404 });
    }

    const contribution = contributions[0];

    if (contribution.status !== 'pending') {
      return NextResponse.json({ error: '该贡献已被处理' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // 如果通过，应用变更
    if (action === 'approve') {
      const payload = JSON.parse(contribution.payload);
      await applyContribution(
        contribution.entity_type,
        contribution.entity_id,
        contribution.action,
        payload
      );
    }

    // 更新贡献状态
    await pool.execute(
      `UPDATE sup_contributions
       SET status = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE contribution_id = ?`,
      [newStatus, review_note || null, contributionId]
    );

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? '贡献已通过并合并' : '贡献已拒绝',
    });
  } catch (error) {
    console.error('审核贡献失败:', error);
    return NextResponse.json({ error: '审核贡献失败' }, { status: 500 });
  }
}
