import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as total FROM sup_quiz_questions WHERE status = 'published'"
    );
    const total = (rows[0] as { total: number }).total;
    return NextResponse.json({ total });
  } catch {
    return NextResponse.json({ total: 0 });
  }
}
