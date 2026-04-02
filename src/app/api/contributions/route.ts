/**
 * 贡献提交 API
 * POST /api/contributions - 提交新的贡献请求（类 PR）
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken } from '@/lib/auth';
import pool from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { EntityType, ActionType } from '@/types';

interface EntityRow extends RowDataPacket {
  exists: number;
}

// 验证实体是否存在
async function checkEntityExists(entityType: EntityType, entityId: number): Promise<boolean> {
  const tableMap: Record<EntityType, { table: string; idField: string }> = {
    brand: { table: 'sup_brands', idField: 'brand_id' },
    product: { table: 'sup_products', idField: 'product_id' },
    athlete: { table: 'sup_athletes', idField: 'athlete_id' },
    creator: { table: 'sup_creators', idField: 'creator_id' },
  };

  const { table, idField } = tableMap[entityType];
  const [result] = await pool.execute<EntityRow[]>(
    `SELECT COUNT(*) as \`exists\` FROM ${table} WHERE ${idField} = ?`,
    [entityId]
  );

  return result[0].exists > 0;
}

// 验证 payload 字段
function validatePayload(entityType: EntityType, payload: Record<string, unknown>): string | null {
  const requiredFields: Record<EntityType, string[]> = {
    brand: ['name', 'slug'],
    product: ['model', 'brand_id'],
    athlete: ['name'],
    creator: ['nickname', 'platform'],
  };

  const required = requiredFields[entityType];
  for (const field of required) {
    if (!payload[field]) {
      return `缺少必填字段: ${field}`;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const jwtPayload = verifyToken(token);
    if (!jwtPayload) {
      return NextResponse.json(
        { error: 'token 无效或已过期' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { entity_type, entity_id, action, payload } = body as {
      entity_type: EntityType;
      entity_id?: number;
      action: ActionType;
      payload: Record<string, unknown>;
    };

    // 验证参数
    if (!entity_type || !['brand', 'product', 'athlete', 'creator'].includes(entity_type)) {
      return NextResponse.json(
        { error: '无效的实体类型' },
        { status: 400 }
      );
    }

    if (!action || !['create', 'update'].includes(action)) {
      return NextResponse.json(
        { error: '无效的操作类型' },
        { status: 400 }
      );
    }

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json(
        { error: '缺少 payload' },
        { status: 400 }
      );
    }

    // 更新操作需要指定 entity_id
    if (action === 'update' && !entity_id) {
      return NextResponse.json(
        { error: '更新操作需要指定 entity_id' },
        { status: 400 }
      );
    }

    // 检查实体是否存在（更新操作时）
    if (action === 'update' && entity_id) {
      const exists = await checkEntityExists(entity_type, entity_id);
      if (!exists) {
        return NextResponse.json(
          { error: '要更新的实体不存在' },
          { status: 404 }
        );
      }
    }

    // 验证 payload 必填字段
    const validationError = validatePayload(entity_type, payload);
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    // 创建贡献记录
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_contributions (sup_user_id, entity_type, entity_id, action, payload, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [
        jwtPayload.sup_user_id,
        entity_type,
        entity_id || null,
        action,
        JSON.stringify(payload),
      ]
    );

    return NextResponse.json({
      success: true,
      contribution_id: result.insertId,
      message: '贡献已提交，等待审核',
    });
  } catch (error) {
    console.error('提交贡献失败:', error);
    return NextResponse.json(
      { error: '提交贡献失败' },
      { status: 500 }
    );
  }
}
