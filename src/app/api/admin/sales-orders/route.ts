import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { computeProfit, computeMargin, buildSalesWhere } from '@/lib/sales-orders';

interface OrderRow extends RowDataPacket {
  order_id: number;
  order_type: 'equipment' | 'course';
  customer_name: string;
  order_date: string;
  shop_item_id: number | null;
  item_name: string;
  selling_price: string;
  cost_price: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

function dateOrNull(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function priceOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const rawPage = parseInt(searchParams.get('page') || '1');
    const rawPageSize = parseInt(searchParams.get('pageSize') || '20');
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const pageSize = Number.isInteger(rawPageSize) && rawPageSize > 0 ? Math.min(rawPageSize, 100) : 20;
    const offset = (page - 1) * pageSize;

    const { where, params } = buildSalesWhere(searchParams);

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM sup_sales_orders ${where}`, params
    );
    const total = (countRows[0] as { total: number }).total;

    const [rows] = await pool.execute<OrderRow[]>(
      `SELECT * FROM sup_sales_orders ${where}
       ORDER BY order_date DESC, order_id DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const items = rows.map((r) => ({
      ...r,
      order_date: dateOrNull(r.order_date),
      selling_price: Number(r.selling_price),
      cost_price: Number(r.cost_price),
      profit: computeProfit(r.selling_price, r.cost_price),
      margin: computeMargin(r.selling_price, r.cost_price),
    }));

    return NextResponse.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取销售订单失败:', error);
    return NextResponse.json({ error: '获取销售订单失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const orderType = body.order_type === 'course' ? 'course' : body.order_type === 'equipment' ? 'equipment' : null;
    const customerName = String(body.customer_name || '').trim();
    const orderDate = dateOrNull(body.order_date);
    const sellingPrice = priceOrNull(body.selling_price);

    if (!orderType) return NextResponse.json({ error: '请选择订单类型' }, { status: 400 });
    if (!customerName) return NextResponse.json({ error: '请填写客户姓名' }, { status: 400 });
    if (!orderDate) return NextResponse.json({ error: '请选择成交日期' }, { status: 400 });
    if (sellingPrice === null) return NextResponse.json({ error: '请填写有效的销售价' }, { status: 400 });

    let shopItemId: number | null = null;
    let itemName = String(body.item_name || '').trim();
    let costPrice = 0;

    if (orderType === 'equipment') {
      shopItemId = Number(body.shop_item_id) || null;
      if (!shopItemId) return NextResponse.json({ error: '器材订单请选择商城产品' }, { status: 400 });
      // 服务端回查商品，做名称 + 成本价快照（前端可覆盖成本价）。
      const [itemRows] = await pool.execute<RowDataPacket[]>(
        'SELECT name, cost_price FROM sup_shop_items WHERE shop_item_id = ?', [shopItemId]
      );
      if (itemRows.length === 0) return NextResponse.json({ error: '所选商城产品不存在' }, { status: 400 });
      const item = itemRows[0] as { name: string; cost_price: number | null };
      itemName = itemName || item.name;
      const override = priceOrNull(body.cost_price);
      costPrice = override !== null ? override : (Number(item.cost_price) || 0);
    } else {
      // 课程：销售价即利润，成本恒为 0。
      if (!itemName) return NextResponse.json({ error: '请填写培训项目' }, { status: 400 });
      costPrice = 0;
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_sales_orders
         (order_type, customer_name, order_date, shop_item_id, item_name, selling_price, cost_price, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderType, customerName, orderDate, shopItemId, itemName, sellingPrice, costPrice, body.notes ? String(body.notes).trim() : null]
    );

    return NextResponse.json({ success: true, order_id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error('创建销售订单失败:', error);
    return NextResponse.json({ error: '创建销售订单失败' }, { status: 500 });
  }
});
