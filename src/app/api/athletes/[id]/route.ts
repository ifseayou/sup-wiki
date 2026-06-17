/**
 * 运动员详情 API
 * GET /api/athletes/[id] - 获取运动员详情
 *
 * 隐私口径与列表 API（/api/athletes）保持一致：
 * - 未认领运动员：姓名脱敏、最小展示（隐藏头像/简介/成就/社交）
 * - 隐藏主页/匿名：返回"隐藏"占位
 * - 本人（已认领自己运动员）与外籍运动员：全量展示
 * - delete_frontend：404
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { normalizeNationality } from '@/lib/nationality';
import { getAthletePrivacyState, getViewerOwnedAthleteIds } from '@/lib/result-privacy';
import { hiddenAthleteName, maskAthleteName } from '@/lib/name-mask';
import type { RowDataPacket } from 'mysql2';

interface AthleteRow extends RowDataPacket {
  athlete_id: number;
  name: string;
  name_en: string | null;
  gender: 'male' | 'female' | 'mixed' | 'unknown';
  gender_source: 'manual' | 'result_inferred' | 'unknown';
  gender_confidence: number | null;
  nationality: string | null;
  province: string | null;
  city: string | null;
  photo: string | null;
  bio: string | null;
  discipline: string;
  achievements: string | null;
  icf_ranking: number | null;
  social_links: string | null;
  race_times?: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const athleteId = parseInt(id);

    if (isNaN(athleteId)) {
      return NextResponse.json(
        { error: '无效的运动员 ID' },
        { status: 400 }
      );
    }

    const [athletes] = await pool.execute<AthleteRow[]>(
      "SELECT * FROM sup_athletes WHERE athlete_id = ? AND status = 'published'",
      [athleteId]
    );

    if (athletes.length === 0) {
      return NextResponse.json(
        { error: '运动员不存在' },
        { status: 404 }
      );
    }

    const athlete = athletes[0];

    // 观看者身份 + 隐私状态（与列表 /api/athletes 同源）
    const [{ ownedAthleteIds }, privacyState] = await Promise.all([
      getViewerOwnedAthleteIds(request),
      getAthletePrivacyState(athleteId),
    ]);
    const { privacy, hasOwner } = privacyState;

    // delete_frontend：前台不可见
    if (privacy.deleted) {
      return NextResponse.json(
        { error: '运动员不存在' },
        { status: 404 }
      );
    }

    const normalizedNationality = normalizeNationality(athlete.nationality);
    const isForeignAthlete = Boolean(normalizedNationality && normalizedNationality !== '中国');
    const isMyAthlete = ownedAthleteIds.has(athleteId);
    // 本人与外籍运动员不脱敏
    const bypassMask = isForeignAthlete || isMyAthlete;
    const hiddenByPrivacy = !bypassMask && Boolean(privacy.hidden || privacy.anonymized);
    const minimal = !bypassMask && (!hasOwner || hiddenByPrivacy);

    const parseArr = (v: unknown) => Array.isArray(v) ? v : (v ? JSON.parse(String(v)) : []);
    const parseObj = (v: unknown) => (v && typeof v === 'object') ? v : (v ? JSON.parse(String(v)) : {});

    const result = {
      ...athlete,
      name: hiddenByPrivacy
        ? hiddenAthleteName()
        : (!hasOwner && !bypassMask ? maskAthleteName(athlete.name) : athlete.name),
      name_en: minimal ? null : athlete.name_en,
      photo: minimal ? null : athlete.photo,
      bio: minimal ? '' : athlete.bio,
      nationality: normalizedNationality,
      achievements: minimal ? [] : parseArr(athlete.achievements),
      race_times: minimal ? [] : parseArr(athlete.race_times),
      social_links: minimal
        ? { privacy_mode: privacy.hidden ? 'hidden' : 'minimal' }
        : parseObj(athlete.social_links),
      is_claimed: !minimal,
      is_foreign_athlete: isForeignAthlete,
      is_my_athlete: isMyAthlete,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取运动员详情失败:', error);
    return NextResponse.json(
      { error: '获取运动员详情失败' },
      { status: 500 }
    );
  }
}
