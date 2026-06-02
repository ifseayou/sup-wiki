import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import Tooltip from '@/components/Tooltip';
import OfficialEliteBadge from '@/components/OfficialEliteBadge';
import AthleteResultsPanel from '@/components/AthleteResultsPanel';
import AthleteClaimEntry from '@/components/AthleteClaimEntry';
import AthletePhotoCarousel from '@/components/AthletePhotoCarousel';
import pool from '@/lib/db';
import { verifyUserToken } from '@/lib/auth';
import { normalizeNationality } from '@/lib/nationality';
import { athleteOwnerCondition, getAthletePrivacyState } from '@/lib/result-privacy';
import type { RowDataPacket } from 'mysql2';
import { marked } from 'marked';

interface AthleteRow extends RowDataPacket {
  athlete_id: number;
  name: string;
  name_en: string | null;
  nationality: string | null;
  province: string | null;
  city: string | null;
  photo: string | null;
  photos: string | null;
  bio: string | null;
  discipline: string;
  achievements: string | null;
  race_times: string | null;
  icf_ranking: number | null;
  elite_event_status: 'none' | 'formal' | 'reserve' | null;
  elite_event_groups: string[] | string | null;
  elite_event_note: string | null;
  elite_event_source_title: string | null;
  social_links: string | null;
}

interface Achievement {
  year: number;
  event: string;
  result: string;
  location?: string;
  source_url?: string;
  source_title?: string;
  highlight?: boolean;  // 金牌/冠军等重要成就
  story?: string;       // 花边/趣事
}

interface RaceTime {
  distance: string;     // '200m' / '6km' / '10km' / '1000m' 等
  year?: number;
  event: string;        // 赛事名称
  round?: string;       // 预赛 / 四分之一决赛 / 半决赛 / 决赛 / Final B 等（可选）
  result?: string;      // 名次说明（可选）
  time: string;         // 耗时，格式自由："57.124"（秒）或 "38:23"（分:秒）等
  note?: string;        // 备注（可选）
  event_id?: number;
}

interface AnnualPointSummary extends RowDataPacket {
  year: number;
  group_code: string | null;
  group_name: string | null;
  rank_position: number | null;
  athlete_id: number | null;
  athlete_name_snapshot: string;
  team_name: string | null;
  total_points: number | string | null;
  endurance_points: number | string | null;
  sprint_points: number | string | null;
  technical_points: number | string | null;
  source_title: string | null;
  source_url: string | null;
  match_level: 'confirmed' | 'candidate';
}

const distanceLabels: Record<string, { label: string; icon: string; order: number }> = {
  '200m':  { label: '200 米竞速',    icon: '⚡', order: 1 },
  '500m':  { label: '500 米竞速',    icon: '⚡', order: 2 },
  '1000m': { label: '1000 米竞速',   icon: '⚡', order: 3 },
  '3km':   { label: '3 公里长距离',  icon: '🏃', order: 4 },
  '5km':   { label: '5 公里长距离',  icon: '🏃', order: 5 },
  '6km':   { label: '6 公里长距离',  icon: '🏃', order: 6 },
  '8km':   { label: '8 公里长距离',  icon: '🏃', order: 7 },
  '10km':  { label: '10 公里长距离', icon: '🏃', order: 8 },
  '16km':  { label: '16 公里长距离', icon: '🏃', order: 9 },
};

const disciplineLabels: Record<string, string> = {
  race: '竞速', surf: '冲浪', distance: '长距离', technical: '技巧',
};

function parseJsonObject(value: unknown) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : [];
  } catch {
    return String(value).split(/[、,，;]/).map((item) => item.trim()).filter(Boolean);
  }
}

function displayNationality(value: string | null) {
  const nationality = normalizeNationality(value);
  if (!nationality) return '';
  return nationality === '中国' ? '🇨🇳 中国' : `🌏 ${nationality}`;
}

async function getAthlete(id: number) {
  try {
    const [athletes] = await pool.execute<AthleteRow[]>(
      'SELECT * FROM sup_athletes WHERE athlete_id = ?', [id]
    );
    if (athletes.length === 0) return null;

    return athletes[0];
  } catch (error) {
    console.error('获取运动员详情失败:', error);
    return null;
  }
}

async function getViewerIsAthleteOwner(athleteId: number) {
  try {
    const rawToken = (await cookies()).get('sup_user_token')?.value || '';
    const token = rawToken ? decodeURIComponent(rawToken) : '';
    const user = token ? verifyUserToken(token) : null;
    if (!user) return false;
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_id
       FROM sup_athlete_profile_owners
       WHERE athlete_id = ? AND user_id = ? AND ${athleteOwnerCondition('sup_athlete_profile_owners')}
       LIMIT 1`,
      [athleteId, user.user_id]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function getAthleteAnnualPointSummary(athleteId: number, athleteName: string) {
  try {
    const completedYear = new Date().getFullYear() - 1;
    const [yearRows] = await pool.execute<RowDataPacket[]>(
      `SELECT MAX(year) AS year
       FROM sup_annual_point_standings
       WHERE year <= ?
         AND source_id IN (SELECT source_id FROM sup_annual_point_sources WHERE point_scope = 'domestic')
         AND (athlete_id = ? OR athlete_name_snapshot = ?)`,
      [completedYear, athleteId, athleteName]
    );
    let year = Number(yearRows[0]?.year || 0);
    if (!year) {
      const [fallbackRows] = await pool.execute<RowDataPacket[]>(
        `SELECT MAX(year) AS year
         FROM sup_annual_point_standings
         WHERE source_id IN (SELECT source_id FROM sup_annual_point_sources WHERE point_scope = 'domestic')
           AND (athlete_id = ? OR athlete_name_snapshot = ?)`,
        [athleteId, athleteName]
      );
      year = Number(fallbackRows[0]?.year || 0);
    }
    if (!year) return null;

    const [rows] = await pool.execute<AnnualPointSummary[]>(
      `SELECT
         s.year, s.group_code, s.group_name, s.rank_position, s.athlete_id,
         s.athlete_name_snapshot, s.team_name, s.total_points, s.endurance_points,
         s.sprint_points, s.technical_points, src.title AS source_title, src.source_url,
         CASE WHEN s.athlete_id = ? THEN 'confirmed' ELSE 'candidate' END AS match_level
       FROM sup_annual_point_standings s
       INNER JOIN sup_annual_point_sources src ON src.source_id = s.source_id
       WHERE s.year = ?
         AND src.point_scope = 'domestic'
         AND (s.athlete_id = ? OR s.athlete_name_snapshot = ?)
       ORDER BY
         CASE WHEN s.athlete_id = ? THEN 0 ELSE 1 END,
         COALESCE(s.rank_position, 999999) ASC,
         s.total_points DESC,
         s.standing_id ASC
       LIMIT 1`,
      [athleteId, year, athleteId, athleteName, athleteId]
    );
    return rows[0] || null;
  } catch (error) {
    console.error('获取运动员年度积分失败:', error);
    return null;
  }
}

function formatAnnualPoint(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return num.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

marked.setOptions({ breaks: true });

export default async function AthleteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ claim?: string }>;
}) {
  const { id } = await params;
  const { claim } = await searchParams;
  const athleteId = parseInt(id);
  if (isNaN(athleteId)) notFound();

  const athlete = await getAthlete(athleteId);
  if (!athlete) notFound();
  const { privacy, hasOwner } = await getAthletePrivacyState(athleteId);
  if (privacy.deleted) notFound();
  const viewerIsOwner = await getViewerIsAthleteOwner(athleteId);
  const normalizedNationality = normalizeNationality(athlete.nationality);
  const isForeignAthlete = Boolean(normalizedNationality && normalizedNationality !== '中国');
  const restrictedByPrivacy = !isForeignAthlete && !viewerIsOwner && (privacy.hidden || privacy.anonymized);
  const isMinimalProfile = !isForeignAthlete && (!hasOwner || restrictedByPrivacy);
  const displayName = athlete.name;
  const annualPoint = isMinimalProfile ? null : await getAthleteAnnualPointSummary(athleteId, athlete.name);
  const hideIdentitySignals = restrictedByPrivacy;
  const eliteEventGroups = hideIdentitySignals ? [] : parseStringArray(athlete.elite_event_groups);
  const showEliteBadge = !hideIdentitySignals && (athlete.elite_event_status === 'formal' || athlete.elite_event_status === 'reserve');

  const rawAchievements = Array.isArray(athlete.achievements)
    ? athlete.achievements
    : (athlete.achievements ? JSON.parse(String(athlete.achievements)) : []);
  const achievements: Achievement[] = rawAchievements;

  const socialLinks = parseJsonObject(athlete.social_links);
  const publicProfile = parseJsonObject(socialLinks.public_profile);
  const livingLocation = [publicProfile.living_province, publicProfile.living_city].filter(Boolean).join(' · ');
  const birthDate = String(publicProfile.birth_date || '').trim();
  const birthYear = Number(publicProfile.birth_year || birthDate.slice(0, 4) || 0) || null;
  const startedSupYear = Number(publicProfile.started_sup_year || 0) || null;
  const introShort = String(publicProfile.intro_short || '').trim();

  const references: { title: string; url: string }[] = socialLinks.references as { title: string; url: string }[] || [];

  const bioHtml = athlete.bio ? marked.parse(athlete.bio) as string : '';

  // 多张照片
  const extraPhotos: string[] = Array.isArray(athlete.photos)
    ? athlete.photos
    : (athlete.photos ? JSON.parse(String(athlete.photos)) : []);
  const galleryPhotos = isMinimalProfile ? [] : Array.from(new Set([athlete.photo, ...extraPhotos].filter(Boolean) as string[]));

  const rawRaceTimes: RaceTime[] = isMinimalProfile
    ? []
    : Array.isArray(athlete.race_times)
      ? athlete.race_times as RaceTime[]
      : (athlete.race_times ? JSON.parse(String(athlete.race_times)) : []);

  // 按距离分组
  const raceTimesByDistance = rawRaceTimes.reduce<Record<string, RaceTime[]>>((acc, rt) => {
    (acc[rt.distance] ||= []).push(rt);
    return acc;
  }, {});

  const distanceKeys = Object.keys(raceTimesByDistance).sort((a, b) => {
    const oa = distanceLabels[a]?.order ?? 99;
    const ob = distanceLabels[b]?.order ?? 99;
    return oa - ob;
  });
  const profileCompleteness = Math.round(([
    athlete.photo,
    livingLocation,
    birthYear,
    startedSupYear,
    introShort,
    athlete.bio,
  ].filter(Boolean).length / 6) * 100);
  const profileLevel = achievements.length >= 5 || athlete.icf_ranking ? '精英选手' : achievements.length >= 2 ? '进阶选手' : '基础档案';
  const displayDiscipline = disciplineLabels[athlete.discipline] || athlete.discipline || '桨板';
  const heroFacts = [
    startedSupYear ? `从${startedSupYear}年开始玩桨板` : '',
  ].filter(Boolean).join(' · ');
  const minimalPrivacyText = restrictedByPrivacy
    ? '该运动员已主动隐藏个人主页，公开页面不再展示个人资料、照片和主页成绩。'
    : '该档案来自公开赛事成绩，尚未由本人认领。平台当前仅展示最小必要赛事记录；本人可申请认领并更新资料。';

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:py-10">
      <nav className="mb-7 flex items-center gap-2 text-sm text-warm-gray-400">
        <Link href="/" className="text-warm-gray-400 no-underline hover:text-brown-600">首页</Link>
        <span>/</span>
        <Link href="/athletes" className="text-warm-gray-400 no-underline hover:text-brown-600">运动员</Link>
        <span>/</span>
        <span className="font-medium text-brown-800">{displayName}</span>
      </nav>

      {claim === 'submitted' && (
        <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          资料已提交，管理员审核通过后会更新到运动员主页。
        </div>
      )}

      <section className="mb-8 overflow-visible rounded-xl border border-cream-200 bg-[radial-gradient(circle_at_top_right,#F5E7D4,transparent_34%),#FEFCF9] shadow-[0_20px_60px_rgba(68,51,35,0.08)]">
        <div className="grid gap-7 p-4 sm:p-5 lg:grid-cols-[280px_1fr_240px] lg:p-7">
          {isMinimalProfile ? (
            <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-cream-200 bg-cream-100">
              <div className="text-center">
                <div className="mx-auto grid size-24 place-items-center rounded-full bg-white text-4xl font-black text-brown-400 shadow-sm">{displayName.slice(0, 1)}</div>
                <div className="mt-4 text-sm font-semibold text-brown-600">
                  {restrictedByPrivacy ? '该运动员已隐藏个人主页' : '公开成绩最小化展示'}
                </div>
              </div>
            </div>
          ) : (
            <AthletePhotoCarousel name={athlete.name} images={galleryPhotos} />
          )}

          <div className="flex min-w-0 flex-col justify-center py-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-[var(--font-display)] text-5xl font-medium leading-tight text-brown-800 sm:text-6xl">
                {displayName}
              </h1>
              {showEliteBadge && <OfficialEliteBadge status={athlete.elite_event_status as 'formal' | 'reserve'} groups={eliteEventGroups} />}
              {!isMinimalProfile && athlete.icf_ranking && (
                <span className="rounded-full border border-[#AED6F1] bg-[#EBF5FB] px-3 py-1 text-xs font-semibold text-[#1A5276]">
                  <Tooltip tip="国际皮划艇联合会 (International Canoe Federation) 世界排名">ICF #{athlete.icf_ranking}</Tooltip>
                </span>
              )}
            </div>
            {!isMinimalProfile && athlete.name_en && <div className="mt-1 font-[var(--font-display)] text-2xl italic text-warm-gray-400">{athlete.name_en}</div>}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {!isMinimalProfile && athlete.nationality && <span className="rounded-full bg-cream-100 px-3 py-1 text-sm text-warm-gray-600">{displayNationality(athlete.nationality)}</span>}
              {!isMinimalProfile && livingLocation && <span className="rounded-full bg-cream-100 px-3 py-1 text-sm text-warm-gray-600">现居 · {livingLocation}</span>}
              <span className="rounded-full border border-cream-200 bg-cream-100 px-3 py-1 text-sm text-brown-600">{displayDiscipline}</span>
              {!hasOwner && !isForeignAthlete && <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-700">待本人认领</span>}
            </div>

            {!isMinimalProfile && heroFacts && <p className="mt-5 text-base text-warm-gray-500">{heroFacts}</p>}

            <div className="mt-6">
              <div className="mb-2 text-sm font-semibold text-brown-800">{isMinimalProfile ? '隐私说明' : '一句话介绍自己'}</div>
              <div className="relative pl-6 text-lg font-medium leading-8 text-brown-800">
                <span className="absolute left-0 top-0 font-[var(--font-display)] text-4xl text-cream-300">“</span>
                {isMinimalProfile
                  ? minimalPrivacyText
                  : introShort || '这位运动员还没有补充个人介绍'}
                <span className="ml-2 font-[var(--font-display)] text-4xl text-cream-300">”</span>
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-5">
            <div className="flex justify-start lg:justify-end">
              <AthleteClaimEntry athleteId={athleteId} />
            </div>
            {annualPoint ? (
              <div className="rounded-xl border border-cream-200 bg-white/72 p-5 shadow-[0_14px_34px_rgba(68,51,35,0.05)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-warm-gray-500">{annualPoint.year} 年度积分</div>
                  {annualPoint.match_level === 'candidate' && <span className="rounded-full border border-[#E8D9C4] bg-[#FFF8ED] px-2 py-0.5 text-[11px] font-semibold text-[#8A6A45]">待核验</span>}
                </div>
                <div className="mt-5 flex items-center gap-4">
                  <span className="grid size-14 place-items-center rounded-full bg-[#F4D986] text-2xl font-bold text-brown-700">{annualPoint.rank_position || '-'}</span>
                  <div>
                    <div className="text-xl font-bold text-brown-800">{annualPoint.group_name || '年度榜单'}</div>
                    <div className="mt-1 text-sm text-brown-400">第 {annualPoint.rank_position || '-'} 名 · {formatAnnualPoint(annualPoint.total_points)} 分</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-cream-100 px-2 py-2 text-warm-gray-500"><div className="font-bold text-brown-700">{formatAnnualPoint(annualPoint.endurance_points)}</div><div>耐力</div></div>
                  <div className="rounded-lg bg-cream-100 px-2 py-2 text-warm-gray-500"><div className="font-bold text-brown-700">{formatAnnualPoint(annualPoint.sprint_points)}</div><div>竞速</div></div>
                  <div className="rounded-lg bg-cream-100 px-2 py-2 text-warm-gray-500"><div className="font-bold text-brown-700">{formatAnnualPoint(annualPoint.technical_points)}</div><div>技巧</div></div>
                </div>
                <div className="mt-4 text-xs text-warm-gray-400">{annualPoint.team_name || '个人'}</div>
                <Link href={`/results?tab=points&year=${annualPoint.year}&athlete=${encodeURIComponent(athlete.name)}`} className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-cream-300 bg-white px-3 py-2 text-sm font-semibold text-brown-700 no-underline hover:bg-cream-50">
                  查看积分明细
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-cream-200 bg-white/72 p-5 shadow-[0_14px_34px_rgba(68,51,35,0.05)]">
                <div className="text-sm text-warm-gray-500">运动员等级</div>
                <div className="mt-5 flex items-center gap-4">
                  <span className="grid size-14 place-items-center rounded-full bg-[#F4D986] text-2xl text-brown-700">奖</span>
                  <div>
                    <div className="text-xl font-bold text-brown-800">{profileLevel}</div>
                    <div className="mt-1 text-sm text-brown-400">{profileCompleteness} 分</div>
                  </div>
                </div>
                <div className="mt-4 text-xs text-warm-gray-400">资料完整度 {profileCompleteness}%</div>
                <div className="mt-2 h-2 rounded-full bg-cream-200">
                  <div className="h-full rounded-full bg-brown-500" style={{ width: `${profileCompleteness}%` }} />
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      {!isMinimalProfile && <AthleteResultsPanel athleteId={athleteId} athleteName={athlete.name} />}

      {/* ── 关键项目耗时 ──────────────────────────────────── */}
      {distanceKeys.length > 0 && (
        <div style={{ background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 14, padding: '28px 32px', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 3, height: 20, background: '#7A6145', borderRadius: 2 }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: '#2E2118', margin: 0 }}>关键项目耗时</h2>
            <span style={{ fontSize: 12, color: '#A08060', marginLeft: 6 }}>（核心竞速距离的公开可查成绩）</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {distanceKeys.map(dk => {
              const meta = distanceLabels[dk] || { label: dk, icon: '⏱' };
              const rows = raceTimesByDistance[dk];
              return (
                <div key={dk}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 16 }}>{meta.icon}</span>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: '#2E2118', margin: 0 }}>{meta.label}</h3>
                  </div>

                  <div style={{ border: '1px solid #EDE5D8', borderRadius: 10, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#F5EDE4', color: '#655D56' }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500 }}>赛事</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500, width: 110 }}>轮次 / 名次</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, width: 90 }}>用时</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((rt, i) => (
                          <tr key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid #F0EAE0' }}>
                            <td style={{ padding: '10px 12px', color: '#3D3730', lineHeight: 1.55 }}>
                              {rt.year && <span style={{ color: '#8A8078', marginRight: 6 }}>{rt.year}</span>}
                              {rt.event_id ? (
                                <Link href={`/events/${rt.event_id}`} style={{ color: '#7A6145', textDecoration: 'none' }}>
                                  {rt.event}
                                </Link>
                              ) : rt.event}
                              {rt.note && (
                                <div style={{ fontSize: 11, color: '#8A8078', marginTop: 3, fontStyle: 'italic' }}>※ {rt.note}</div>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#655D56' }}>
                              {rt.round || rt.result || '—'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: 15, color: '#7A6145', fontWeight: 600 }}>
                              {rt.time}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 个人简介（Markdown 渲染）─────────────────────────── */}
      {!isMinimalProfile && bioHtml && (
        <div style={{ background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 14, padding: '28px 32px', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 3, height: 20, background: '#7A6145', borderRadius: 2 }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: '#2E2118', margin: 0 }}>个人简介</h2>
          </div>
          <div
            className="article-guide-body"
            dangerouslySetInnerHTML={{ __html: bioHtml }}
            style={{ fontSize: 15, lineHeight: 1.85, color: '#3D3730' }}
          />
        </div>
      )}

      {/* ── 参考资料 ─────────────────────────────────────────── */}
      {references.length > 0 && (
        <div style={{ borderTop: '1px solid #EDE5D8', paddingTop: 20, marginTop: 8 }}>
          <h3 style={{ fontSize: 12, color: '#8A8078', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>参考资料 / References</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {references.map((ref, idx) => (
              <a key={idx} href={ref.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: '#7A6145', textDecoration: 'none', lineHeight: 1.6 }}>
                [{idx + 1}] {ref.title} <span style={{ fontSize: 10, color: '#C0B4A4' }}>↗ {ref.url.split('/')[2]}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
