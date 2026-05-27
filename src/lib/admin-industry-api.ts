import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { jsonArrayValue, normalizeIndustryRow } from '@/lib/industry-utils';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

type FieldValue = string | number | null;

export interface IndustryCrudConfig {
  table: string;
  idField: string;
  entityLabel: string;
  requiredFields: string[];
  textFields: string[];
  jsonFields?: string[];
  numberFields?: string[];
  dateFields?: string[];
  booleanFields?: string[];
  searchFields: string[];
  filterFields?: string[];
  defaultOrder: string;
  listSelect?: string;
}

function optionalValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return String(value).trim() || null;
}

function numberValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function booleanValue(value: unknown) {
  if (value === undefined) return undefined;
  return value ? 1 : 0;
}

function dateValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : text;
}

function getIdFromPath(request: NextRequest) {
  return Number(new URL(request.url).pathname.split('/').at(-1));
}

function getMysqlErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code?: unknown }).code || '');
    if (code === 'ER_DUP_ENTRY') return '唯一字段已存在，请换一个值';
    if (code === 'ER_NO_SUCH_TABLE') return '数据库表不存在，请先执行行业模块迁移';
    if (code === 'WARN_DATA_TRUNCATED') return '字段值不符合数据库枚举或格式要求';
  }
  return fallback;
}

function normalizeBody(config: IndustryCrudConfig, body: Record<string, unknown>, partial = false) {
  const jsonFields = config.jsonFields || [];
  const numberFields = config.numberFields || [];
  const dateFields = config.dateFields || [];
  const booleanFields = config.booleanFields || [];
  const fields = [
    ...config.textFields,
    ...jsonFields,
    ...numberFields,
    ...dateFields,
    ...booleanFields,
  ];
  const values: Record<string, FieldValue> = {};

  for (const field of fields) {
    if (partial && !Object.prototype.hasOwnProperty.call(body, field)) continue;
    if (jsonFields.includes(field)) {
      const next = jsonArrayValue(body[field]);
      if (next !== undefined) values[field] = next;
    } else if (numberFields.includes(field)) {
      const next = numberValue(body[field]);
      if (next !== undefined) values[field] = next;
    } else if (dateFields.includes(field)) {
      const next = dateValue(body[field]);
      if (next !== undefined) values[field] = next;
    } else if (booleanFields.includes(field)) {
      const next = booleanValue(body[field]);
      if (next !== undefined) values[field] = next;
    } else {
      const next = optionalValue(body[field]);
      if (next !== undefined) values[field] = next;
    }
  }

  return values;
}

export function makeListHandler(config: IndustryCrudConfig) {
  return async function listHandler(request: NextRequest) {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status');
      const search = searchParams.get('search');
      const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
      const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '20') || 20));
      const offset = (page - 1) * pageSize;

      const conditions: string[] = [];
      const params: (string | number)[] = [];
      if (status) {
        conditions.push(`${config.table}.status = ?`);
        params.push(status);
      }
      if (search) {
        const likes = config.searchFields.map((field) => `${field} LIKE ?`);
        conditions.push(`(${likes.join(' OR ')})`);
        for (let index = 0; index < config.searchFields.length; index += 1) {
          params.push(`%${search}%`);
        }
      }
      for (const field of config.filterFields || []) {
        const value = searchParams.get(field);
        if (value) {
          conditions.push(`${config.table}.${field} = ?`);
          params.push(value);
        }
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const [countRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM ${config.table} ${where}`,
        params
      );
      const total = Number(countRows[0]?.total || 0);
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT ${config.listSelect || `${config.table}.*`}
         FROM ${config.table}
         ${where}
         ORDER BY ${config.defaultOrder}
         LIMIT ${pageSize} OFFSET ${offset}`,
        params
      );
      return NextResponse.json({
        items: rows.map((row) => normalizeIndustryRow(row, config.jsonFields || [])),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (error) {
      console.error(`获取${config.entityLabel}列表失败:`, error);
      return NextResponse.json({ error: getMysqlErrorMessage(error, `获取${config.entityLabel}列表失败`) }, { status: 500 });
    }
  };
}

export function makeCreateHandler(config: IndustryCrudConfig) {
  return async function createHandler(request: NextRequest) {
    try {
      const body = await request.json();
      for (const field of config.requiredFields) {
        if (!body[field]) {
          return NextResponse.json({ error: `缺少必填字段: ${field}` }, { status: 400 });
        }
      }
      const values = normalizeBody(config, body);
      const fields = Object.keys(values);
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO ${config.table} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
        fields.map((field) => values[field])
      );
      return NextResponse.json({ success: true, [config.idField]: result.insertId }, { status: 201 });
    } catch (error) {
      console.error(`创建${config.entityLabel}失败:`, error);
      return NextResponse.json({ error: getMysqlErrorMessage(error, `创建${config.entityLabel}失败`) }, { status: 500 });
    }
  };
}

export function makeGetHandler(config: IndustryCrudConfig) {
  return async function getHandler(request: NextRequest) {
    try {
      const id = getIdFromPath(request);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: `无效${config.entityLabel} ID` }, { status: 400 });
      }
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${config.table} WHERE ${config.idField} = ? LIMIT 1`,
        [id]
      );
      if (rows.length === 0) return NextResponse.json({ error: `${config.entityLabel}不存在` }, { status: 404 });
      return NextResponse.json({ item: normalizeIndustryRow(rows[0], config.jsonFields || []) });
    } catch (error) {
      console.error(`获取${config.entityLabel}详情失败:`, error);
      return NextResponse.json({ error: getMysqlErrorMessage(error, `获取${config.entityLabel}详情失败`) }, { status: 500 });
    }
  };
}

export function makeUpdateHandler(config: IndustryCrudConfig) {
  return async function updateHandler(request: NextRequest) {
    try {
      const id = getIdFromPath(request);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: `无效${config.entityLabel} ID` }, { status: 400 });
      }
      const body = await request.json();
      const values = normalizeBody(config, body, true);
      const fields = Object.keys(values);
      if (fields.length === 0) return NextResponse.json({ success: true });
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE ${config.table} SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE ${config.idField} = ?`,
        [...fields.map((field) => values[field]), id]
      );
      if (result.affectedRows === 0) return NextResponse.json({ error: `${config.entityLabel}不存在` }, { status: 404 });
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error(`更新${config.entityLabel}失败:`, error);
      return NextResponse.json({ error: getMysqlErrorMessage(error, `更新${config.entityLabel}失败`) }, { status: 500 });
    }
  };
}

export function makeDeleteHandler(config: IndustryCrudConfig) {
  return async function deleteHandler(request: NextRequest) {
    try {
      const id = getIdFromPath(request);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: `无效${config.entityLabel} ID` }, { status: 400 });
      }
      const [result] = await pool.execute<ResultSetHeader>(
        `DELETE FROM ${config.table} WHERE ${config.idField} = ?`,
        [id]
      );
      if (result.affectedRows === 0) return NextResponse.json({ error: `${config.entityLabel}不存在` }, { status: 404 });
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error(`删除${config.entityLabel}失败:`, error);
      return NextResponse.json({ error: getMysqlErrorMessage(error, `删除${config.entityLabel}失败`) }, { status: 500 });
    }
  };
}

export function makeBulkHandler(config: IndustryCrudConfig) {
  return async function bulkHandler(request: NextRequest) {
    try {
      const body = await request.json();
      const ids = Array.isArray(body.ids)
        ? body.ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
        : [];
      if (ids.length === 0) return NextResponse.json({ error: '请选择要处理的记录' }, { status: 400 });
      const placeholders = ids.map(() => '?').join(',');
      let sql = '';
      const params: (string | number)[] = [];
      if (body.action === 'publish') {
        sql = `UPDATE ${config.table} SET status = 'published' WHERE ${config.idField} IN (${placeholders})`;
        params.push(...ids);
      } else if (body.action === 'draft') {
        sql = `UPDATE ${config.table} SET status = 'draft' WHERE ${config.idField} IN (${placeholders})`;
        params.push(...ids);
      } else if (body.action === 'delete') {
        sql = `DELETE FROM ${config.table} WHERE ${config.idField} IN (${placeholders})`;
        params.push(...ids);
      } else {
        return NextResponse.json({ error: '未知批量操作' }, { status: 400 });
      }
      const [result] = await pool.execute<ResultSetHeader>(sql, params);
      return NextResponse.json({ success: true, affectedRows: result.affectedRows });
    } catch (error) {
      console.error(`批量处理${config.entityLabel}失败:`, error);
      return NextResponse.json({ error: getMysqlErrorMessage(error, `批量处理${config.entityLabel}失败`) }, { status: 500 });
    }
  };
}
