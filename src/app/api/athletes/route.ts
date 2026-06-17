/**
 * 运动员列表 API
 * GET /api/athletes - 获取运动员列表（支持分页、筛选）
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getNationalityAliases, normalizeNationality } from '@/lib/nationality';
import { buildAthleteOwnerMap, buildPrivacyMap } from '@/lib/result-privacy';
import { hiddenAthleteName, maskAthleteName } from '@/lib/name-mask';
import { resolveResultAccess, applyPublicPreview, quotaExceededMessage } from '@/lib/result-access';
import type { RowDataPacket } from 'mysql2';
import type { Athlete, Discipline, PaginatedResponse } from '@/types';

interface AthleteRow extends RowDataPacket {
  athlete_id: number;
  name: string;
  name_en: string | null;
  gender: string | null;
  gender_source: string | null;
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const discipline = searchParams.get('discipline') as Discipline | null;
    const nationality = searchParams.get('nationality');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'ranking'; // ranking, name, newest
    const shouldConsumeAccess = Boolean(search || discipline || nationality);
    const access = await resolveResultAccess(request, { consume: shouldConsumeAccess });
    if (shouldConsumeAccess && access.authenticated && access.remaining === 0 && access.previewLimit === 0) {
      return NextResponse.json({ error: quotaExceededMessage(access), access }, { status: 429 });
    }

    const offset = (page - 1) * pageSize;
    const conditions: string[] = ['status = "published"'];
    const params: (string | number)[] = [];

    if (discipline) {
      conditions.push('discipline = ?');
      params.push(discipline);
    }

    if (nationality) {
      const aliases = getNationalityAliases(nationality);
      conditions.push(`nationality IN (${aliases.map(() => '?').join(',')})`);
      params.push(...aliases);
    }

    if (search) {
      conditions.push('(name LIKE ? OR name_en LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 排序
    let orderBy = 'COALESCE(icf_ranking, 9999) ASC, name ASC';
    if (sort === 'name') {
      orderBy = 'name ASC';
    } else if (sort === 'newest') {
      orderBy = 'created_at DESC';
    }

    // 获取总数
    const [countResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM sup_athletes ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // 获取运动员列表
    const [athletes] = await pool.execute<AthleteRow[]>(
      `SELECT * FROM sup_athletes ${whereClause} ORDER BY ${orderBy} LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const parseArr = (v: unknown) => Array.isArray(v) ? v : (v ? JSON.parse(String(v)) : []);
    const parseObj = (v: unknown) => (v && typeof v === 'object') ? v : (v ? JSON.parse(String(v)) : {});
    const [ownerMap, privacyMap] = await Promise.all([
      buildAthleteOwnerMap(athletes.map((item) => item.athlete_id)),
      buildPrivacyMap('athlete', athletes.map((item) => item.athlete_id)),
    ]);
    const parsedAthletes = athletes
      .filter((a) => !privacyMap.get(Number(a.athlete_id))?.deleted)
      .map((a) => {
        const privacy = privacyMap.get(Number(a.athlete_id));
        const hasOwner = (ownerMap.get(Number(a.athlete_id)) || []).length > 0;
        const normalizedNationality = normalizeNationality(a.nationality);
        const isForeignAthlete = Boolean(normalizedNationality && normalizedNationality !== '中国');
        const hiddenByPrivacy = !isForeignAthlete && (privacy?.hidden || privacy?.anonymized);
        const minimal = !isForeignAthlete && (!hasOwner || hiddenByPrivacy);
        return {
          ...a,
          name: hiddenByPrivacy ? hiddenAthleteName() : !hasOwner && !isForeignAthlete ? maskAthleteName(a.name) : a.name,
          name_en: minimal ? null : a.name_en,
          photo: minimal ? null : a.photo,
          bio: minimal ? '' : a.bio,
          nationality: normalizedNationality,
          achievements: minimal ? [] : parseArr(a.achievements),
          race_times: minimal ? [] : parseArr(a.race_times),
          social_links: minimal ? { privacy_mode: privacy?.hidden ? 'hidden' : 'minimal' } : parseObj(a.social_links),
          is_claimed: !minimal,
          is_foreign_athlete: isForeignAthlete,
        };
      });
    const preview = shouldConsumeAccess
      ? applyPublicPreview(parsedAthletes, access)
      : { items: parsedAthletes, previewLocked: false };

    const response: PaginatedResponse<Athlete> = {
      items: preview.items as unknown as Athlete[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      access: shouldConsumeAccess ? access : undefined,
      preview_locked: preview.previewLocked,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('获取运动员列表失败:', error);
    return NextResponse.json(
      { error: '获取运动员列表失败' },
      { status: 500 }
    );
  }
}
