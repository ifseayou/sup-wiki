import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import type { RowDataPacket } from 'mysql2';
import { buildSalesWhere } from '@/lib/sales-orders';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const { where, params } = buildSalesWhere(searchParams);

    // 汇总（按当前筛选口径，与明细一致）。
    const [sumRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS total_orders,
         COALESCE(SUM(selling_price), 0) AS total_revenue,
         COALESCE(SUM(cost_price), 0) AS total_cost,
         COALESCE(SUM(COALESCE(profit, selling_price - cost_price)), 0) AS total_profit,
         COALESCE(SUM(CASE WHEN order_type = 'equipment' THEN COALESCE(profit, selling_price - cost_price) ELSE 0 END), 0) AS equipment_profit,
         COALESCE(SUM(CASE WHEN order_type = 'course' THEN COALESCE(profit, selling_price - cost_price) ELSE 0 END), 0) AS course_profit,
         SUM(CASE WHEN order_type = 'equipment' THEN 1 ELSE 0 END) AS equipment_count,
         SUM(CASE WHEN order_type = 'course' THEN 1 ELSE 0 END) AS course_count
       FROM sup_sales_orders ${where}`,
      params
    );
    const s = sumRows[0] as Record<string, number | string>;
    const totalRevenue = Number(s.total_revenue) || 0;
    const totalProfit = Number(s.total_profit) || 0;
    const avgMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : null;

    // 按月趋势：当前筛选下最近 12 个月。
    const [monthRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         DATE_FORMAT(order_date, '%Y-%m') AS ym,
         COALESCE(SUM(selling_price), 0) AS revenue,
         COALESCE(SUM(COALESCE(profit, selling_price - cost_price)), 0) AS profit
       FROM sup_sales_orders ${where}
       GROUP BY ym
       ORDER BY ym DESC
       LIMIT 12`,
      params
    );
    const monthly = (monthRows as Array<{ ym: string; revenue: number | string; profit: number | string }>)
      .map((m) => ({ ym: m.ym, revenue: Number(m.revenue) || 0, profit: Number(m.profit) || 0 }))
      .reverse();

    return NextResponse.json({
      total_orders: Number(s.total_orders) || 0,
      total_revenue: totalRevenue,
      total_cost: Number(s.total_cost) || 0,
      total_profit: totalProfit,
      equipment_profit: Number(s.equipment_profit) || 0,
      course_profit: Number(s.course_profit) || 0,
      equipment_count: Number(s.equipment_count) || 0,
      course_count: Number(s.course_count) || 0,
      avg_margin: avgMargin,
      monthly,
    });
  } catch (error) {
    console.error('获取销售统计失败:', error);
    return NextResponse.json({ error: '获取销售统计失败' }, { status: 500 });
  }
});
