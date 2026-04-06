import Link from 'next/link';
import { notFound } from 'next/navigation';
import Tooltip from '@/components/Tooltip';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import { marked } from 'marked';

interface AthleteRow extends RowDataPacket {
  athlete_id: number;
  name: string;
  name_en: string | null;
  nationality: string | null;
  photo: string | null;
  photos: string | null;
  bio: string | null;
  discipline: string;
  achievements: string | null;
  icf_ranking: number | null;
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

const disciplineLabels: Record<string, string> = {
  race: '竞速', surf: '冲浪', distance: '长距离', technical: '技巧',
};

const resultIcon = (result: string, highlight?: boolean) => {
  if (highlight) return '🥇';
  if (result.includes('冠军') || result.includes('金牌') || result.includes('第一') || result.toLowerCase().includes('gold') || result.toLowerCase().includes('champion')) return '🥇';
  if (result.includes('亚军') || result.includes('银牌') || result.includes('第二') || result.toLowerCase().includes('silver') || result.toLowerCase().includes('2nd')) return '🥈';
  if (result.includes('季军') || result.includes('铜牌') || result.includes('第三') || result.toLowerCase().includes('bronze') || result.toLowerCase().includes('3rd')) return '🥉';
  if (result.includes('世界纪录') || result.includes('记录') || result.toLowerCase().includes('record')) return '⚡';
  return '🏅';
};

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

marked.setOptions({ breaks: true });

export default async function AthleteDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const athleteId = parseInt(id);
  if (isNaN(athleteId)) notFound();

  const athlete = await getAthlete(athleteId);
  if (!athlete) notFound();

  const rawAchievements = Array.isArray(athlete.achievements)
    ? athlete.achievements
    : (athlete.achievements ? JSON.parse(String(athlete.achievements)) : []);
  const achievements: Achievement[] = rawAchievements;

  const socialLinks = typeof athlete.social_links === 'object' && athlete.social_links !== null
    ? athlete.social_links
    : (athlete.social_links ? JSON.parse(String(athlete.social_links)) : {});

  const references: { title: string; url: string }[] = (socialLinks as Record<string, unknown>).references as { title: string; url: string }[] || [];

  // 按年份排序
  const sortedAchievements = [...achievements].sort((a, b) => b.year - a.year);

  const bioHtml = athlete.bio ? marked.parse(athlete.bio) as string : '';

  // 多张照片
  const extraPhotos: string[] = Array.isArray(athlete.photos)
    ? athlete.photos
    : (athlete.photos ? JSON.parse(String(athlete.photos)) : []);

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '40px 24px' }}>
      {/* Breadcrumb */}
      <nav style={{ marginBottom: 28, fontSize: 13, color: '#8A8078' }}>
        <Link href="/" style={{ color: '#8A8078', textDecoration: 'none' }}>首页</Link>
        {' / '}
        <Link href="/athletes" style={{ color: '#8A8078', textDecoration: 'none' }}>运动员</Link>
        {' / '}
        <span style={{ color: '#2E2118' }}>{athlete.name}</span>
      </nav>

      {/* ── 运动员头部卡片 ─────────────────────────────────────── */}
      <div style={{ background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 16, overflow: 'hidden', marginBottom: 32, display: 'flex', flexWrap: 'wrap' }}>
        {/* 照片 */}
        <div style={{ width: 260, minHeight: 260, background: '#F5EDE4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {athlete.photo ? (
            <img src={athlete.photo} alt={athlete.name} style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: 260 }} />
          ) : (
            <span style={{ fontSize: 72 }}>🏆</span>
          )}
        </div>

        {/* 基本信息 */}
        <div style={{ flex: 1, padding: '28px 32px', minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 400, color: '#2E2118', margin: 0 }}>
              {athlete.name}
            </h1>
            {athlete.icf_ranking && (
              <span style={{ fontSize: 12, background: '#EBF5FB', color: '#1A5276', border: '1px solid #AED6F1', borderRadius: 12, padding: '2px 10px' }}>
                <Tooltip tip="国际皮划艇联合会 (International Canoe Federation) 世界排名">ICF #{athlete.icf_ranking}</Tooltip>
              </span>
            )}
          </div>

          {athlete.name_en && (
            <div style={{ fontSize: 16, color: '#8A8078', marginBottom: 16, fontStyle: 'italic' }}>{athlete.name_en}</div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {athlete.nationality && (
              <span style={{ fontSize: 13, color: '#655D56', background: '#F0EAE0', padding: '3px 10px', borderRadius: 20 }}>
                🌏 {athlete.nationality}
              </span>
            )}
            <span style={{ fontSize: 13, color: '#7A6145', background: '#F0EAE0', border: '1px solid #EDE5D8', padding: '3px 10px', borderRadius: 20 }}>
              {disciplineLabels[athlete.discipline] || athlete.discipline}
            </span>
            {achievements.length > 0 && (
              <span style={{ fontSize: 13, color: '#B7470A', background: '#FDF2E9', padding: '3px 10px', borderRadius: 20 }}>
                🏅 {achievements.length} 项荣誉记录
              </span>
            )}
          </div>

          {/* 社交链接 */}
          {(Object.keys(socialLinks).length > 0) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(socialLinks as Record<string, string>).instagram && (
                <a href={(socialLinks as Record<string, string>).instagram} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#fff', background: '#C13584', padding: '4px 12px', borderRadius: 6, textDecoration: 'none' }}>Instagram</a>
              )}
              {(socialLinks as Record<string, string>).youtube && (
                <a href={(socialLinks as Record<string, string>).youtube} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#fff', background: '#FF0000', padding: '4px 12px', borderRadius: 6, textDecoration: 'none' }}>YouTube</a>
              )}
              {(socialLinks as Record<string, string>).weibo && (
                <a href={(socialLinks as Record<string, string>).weibo} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#fff', background: '#E6162D', padding: '4px 12px', borderRadius: 6, textDecoration: 'none' }}>微博</a>
              )}
              {(socialLinks as Record<string, string>).website && (
                <a href={(socialLinks as Record<string, string>).website} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#7A6145', background: '#F0EAE0', border: '1px solid #EDE5D8', padding: '4px 12px', borderRadius: 6, textDecoration: 'none' }}>官网 ↗</a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 更多照片 ─────────────────────────────────────────── */}
      {extraPhotos.length > 0 && (
        <div style={{ background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 14, padding: '20px 24px', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 3, height: 18, background: '#7A6145', borderRadius: 2 }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400, color: '#2E2118', margin: 0 }}>照片</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {extraPhotos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', borderRadius: 8, overflow: 'hidden', border: '1px solid #EDE5D8', aspectRatio: '1', background: '#F5EDE4' }}>
                <img src={url} alt={`${athlete.name} ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── 生平介绍（Markdown 渲染）─────────────────────────── */}
      {bioHtml && (
        <div style={{ background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 14, padding: '28px 32px', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 3, height: 20, background: '#7A6145', borderRadius: 2 }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: '#2E2118', margin: 0 }}>生平介绍</h2>
          </div>
          <div
            className="article-guide-body"
            dangerouslySetInnerHTML={{ __html: bioHtml }}
            style={{ fontSize: 15, lineHeight: 1.85, color: '#3D3730' }}
          />
        </div>
      )}

      {/* ── 职业时间线 ──────────────────────────────────────── */}
      {sortedAchievements.length > 0 && (
        <div style={{ background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 14, padding: '28px 32px', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{ width: 3, height: 20, background: '#7A6145', borderRadius: 2 }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: '#2E2118', margin: 0 }}>职业时间线</h2>
          </div>

          <div style={{ position: 'relative' }}>
            {/* 竖线 */}
            <div style={{ position: 'absolute', left: 36, top: 8, bottom: 8, width: 2, background: '#EDE5D8' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {sortedAchievements.map((ach, idx) => {
                const icon = resultIcon(ach.result, ach.highlight);
                const isGold = icon === '🥇';
                return (
                  <div key={idx} style={{ display: 'flex', gap: 0, position: 'relative' }}>
                    {/* 年份+图标 */}
                    <div style={{ width: 74, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 14 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: isGold ? '#F5E4A0' : '#F0EAE0',
                        border: `2px solid ${isGold ? '#C4A320' : '#EDE5D8'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, zIndex: 1, flexShrink: 0,
                      }}>
                        {icon}
                      </div>
                      <div style={{ fontSize: 11, color: '#8A8078', marginTop: 4, fontWeight: 600 }}>{ach.year}</div>
                    </div>

                    {/* 内容卡片 */}
                    <div style={{
                      flex: 1, marginLeft: 12, marginBottom: 12,
                      background: isGold ? '#FFFDF0' : '#FAFAF9',
                      border: `1px solid ${isGold ? '#EDD97A' : '#EDE5D8'}`,
                      borderRadius: 10, padding: '12px 16px',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#2E2118', marginBottom: 3 }}>
                        {ach.event}
                        {ach.location && <span style={{ fontSize: 12, color: '#8A8078', marginLeft: 8, fontWeight: 400 }}>📍 {ach.location}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: isGold ? '#8B6F00' : '#5E4A33', marginBottom: ach.story ? 6 : 0 }}>
                        {icon} {ach.result}
                      </div>
                      {ach.story && (
                        <div style={{ fontSize: 12, color: '#655D56', lineHeight: 1.65, background: '#F5F5F0', padding: '8px 10px', borderRadius: 6, marginTop: 8, borderLeft: '3px solid #C4A882' }}>
                          💬 {ach.story}
                        </div>
                      )}
                      {ach.source_url && (
                        <a href={ach.source_url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: '#A08060', textDecoration: 'none', display: 'inline-block', marginTop: 6 }}>
                          来源：{ach.source_title || ach.source_url.split('/')[2]} ↗
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
