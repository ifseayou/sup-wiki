import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireUser } from '@/lib/user-auth';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

function cleanText(value: unknown, max = 255) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : null;
}

function cleanYear(value: unknown, min = 1930, max = new Date().getFullYear()) {
  if (value === null || value === undefined || value === '') return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < min || year > max) return null;
  return year;
}

function normalizeBib(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
}

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (user instanceof NextResponse) return user;

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         c.*,
         a.name AS athlete_name,
         e.name AS event_name,
         er.discipline,
         er.gender_group,
         er.finish_time
       FROM sup_athlete_profile_claims c
       INNER JOIN sup_athletes a ON a.athlete_id = c.athlete_id
       LEFT JOIN sup_event_results er ON er.result_id = c.result_id
       LEFT JOIN sup_events e ON e.event_id = er.event_id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC
       LIMIT 30`,
      [user.user_id]
    );
    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error('获取我的认领提交失败:', error);
    return NextResponse.json({ error: '获取我的认领提交失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const athleteId = Number(body.athlete_id);
    const resultId = Number(body.result_id);
    const submittedBib = normalizeBib(body.submitted_bib_number);

    if (!Number.isInteger(athleteId) || athleteId <= 0) {
      return NextResponse.json({ error: '请选择要认领的运动员' }, { status: 400 });
    }
    if (!Number.isInteger(resultId) || resultId <= 0 || !submittedBib) {
      return NextResponse.json({ error: '请选择最近比赛，并补全该场号码牌' }, { status: 400 });
    }

    const [resultRows] = await pool.execute<RowDataPacket[]>(
      `SELECT er.result_id, er.athlete_id, er.bib_number, a.name AS athlete_name
       FROM sup_event_results er
       INNER JOIN sup_athletes a ON a.athlete_id = er.athlete_id
       WHERE er.result_id = ? AND er.athlete_id = ?
       LIMIT 1`,
      [resultId, athleteId]
    );
    const result = resultRows[0];
    if (!result) return NextResponse.json({ error: '所选成绩不属于该运动员' }, { status: 400 });

    const storedBib = normalizeBib(result.bib_number);
    if (!storedBib || storedBib !== submittedBib) {
      return NextResponse.json({ error: '号码牌校验未通过，请确认选择的是自己的最近比赛' }, { status: 400 });
    }

    const submittedName = cleanText(body.submitted_name, 80) || result.athlete_name;
    const birthYear = cleanYear(body.submitted_birth_year, 1940);
    const startedYear = cleanYear(body.submitted_started_sup_year, 1990);
    const introShort = cleanText(body.submitted_intro_short, 120);
    const intro = cleanText(body.submitted_intro, 1000);

    const [inserted] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_athlete_profile_claims (
         user_id, athlete_id, result_id, submitted_name, submitted_avatar_url,
         submitted_birth_year, submitted_hometown_province, submitted_hometown_city,
         submitted_living_province, submitted_living_city, submitted_started_sup_year,
         submitted_intro_short, submitted_intro, submitted_profile_json,
         bib_prefix, submitted_bib_number, bib_match_status, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'matched', 'pending')`,
      [
        user.user_id,
        athleteId,
        resultId,
        submittedName,
        cleanText(body.submitted_avatar_url, 500),
        birthYear,
        cleanText(body.submitted_hometown_province, 50),
        cleanText(body.submitted_hometown_city, 50),
        cleanText(body.submitted_living_province, 50),
        cleanText(body.submitted_living_city, 50),
        startedYear,
        introShort,
        intro,
        JSON.stringify({
          birth_year: birthYear,
          hometown: {
            province: cleanText(body.submitted_hometown_province, 50),
            city: cleanText(body.submitted_hometown_city, 50),
          },
          living: {
            province: cleanText(body.submitted_living_province, 50),
            city: cleanText(body.submitted_living_city, 50),
          },
          started_sup_year: startedYear,
          intro_short: introShort,
        }),
        storedBib.slice(0, 2),
        submittedBib,
      ]
    );

    return NextResponse.json({ success: true, claim_id: inserted.insertId });
  } catch (error) {
    console.error('提交运动员资料认领失败:', error);
    return NextResponse.json({ error: '提交运动员资料认领失败' }, { status: 500 });
  }
}
