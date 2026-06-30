import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

function dateOrNull(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const m = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function priceOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export const PUT = withAdmin(async (request: NextRequest) => {
  try {
    const id = Number(new URL(request.url).pathname.split('/').at(-1));
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: '无效订单 ID' }, { status: 400 });
    const body = await request.json();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    const setField = (col: string, val: string | number | null) => { fields.push(`${col} = ?`); values.push(val); };

    if (body.order_type !== undefined) {
      const t = body.order_type === 'course' ? 'course' : body.order_type === 'equipment' ? 'equipment' : null;
      if (!t) return NextResponse.json({ error: '无效订单类型' }, { status: 400 });
      setField('order_type', t);
    }
    if (body.customer_name !== undefined) {
      const name = String(body.customer_name).trim();
      if (!name) return NextResponse.json({ error: '客户姓名不能为空' }, { status: 400 });
      setField('customer_name', name);
    }
    if (body.order_date !== undefined) {
      const d = dateOrNull(body.order_date);
      if (!d) return NextResponse.json({ error: '无效成交日期' }, { status: 400 });
      setField('order_date', d);
    }
    if (body.shop_item_id !== undefined) setField('shop_item_id', body.shop_item_id ? Number(body.shop_item_id) : null);
    if (body.item_name !== undefined) {
      const n = String(body.item_name).trim();
      if (!n) return NextResponse.json({ error: '项目/产品名不能为空' }, { status: 400 });
      setField('item_name', n);
    }
    if (body.selling_price !== undefined) {
      const p = priceOrNull(body.selling_price);
      if (p === null) return NextResponse.json({ error: '无效销售价' }, { status: 400 });
      setField('selling_price', p);
    }
    if (body.cost_price !== undefined) {
      const c = priceOrNull(body.cost_price);
      setField('cost_price', c === null ? 0 : c);
    }
    if (body.notes !== undefined) setField('notes', body.notes ? String(body.notes).trim() : null);

    if (fields.length === 0) return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });

    // 编辑为器材且未显式带成本价时，回查商品成本价快照。
    if (body.order_type === 'equipment' && body.shop_item_id && body.cost_price === undefined) {
      const [itemRows] = await pool.execute<RowDataPacket[]>(
        'SELECT cost_price FROM sup_shop_items WHERE shop_item_id = ?', [Number(body.shop_item_id)]
      );
      if (itemRows.length > 0) setField('cost_price', Number((itemRows[0] as { cost_price: number | null }).cost_price) || 0);
    }
    // 编辑为课程时强制成本 0。
    if (body.order_type === 'course') setField('cost_price', 0);

    values.push(id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sup_sales_orders SET ${fields.join(', ')} WHERE order_id = ?`, values
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新销售订单失败:', error);
    return NextResponse.json({ error: '更新销售订单失败' }, { status: 500 });
  }
});

export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    const id = Number(new URL(request.url).pathname.split('/').at(-1));
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: '无效订单 ID' }, { status: 400 });
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM sup_sales_orders WHERE order_id = ?', [id]
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除销售订单失败:', error);
    return NextResponse.json({ error: '删除销售订单失败' }, { status: 500 });
  }
});
