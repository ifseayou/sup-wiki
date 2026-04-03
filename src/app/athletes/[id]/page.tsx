import Link from 'next/link';
import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

interface AthleteRow extends RowDataPacket {
  athlete_id: number;
  name: string;
  name_en: string | null;
  nationality: string | null;
  photo: string | null;
  bio: string | null;
  discipline: string;
  achievements: string | null;
  icf_ranking: number | null;
  social_links: string | null;
}

const disciplineLabels: Record<string, string> = {
  race: '竞速',
  surf: '冲浪',
  distance: '长距离',
  technical: '技巧',
};

async function getAthlete(id: number) {
  try {
    const [athletes] = await pool.execute<AthleteRow[]>(
      'SELECT * FROM sup_athletes WHERE athlete_id = ?',
      [id]
    );
    if (athletes.length === 0) return null;
    return athletes[0];
  } catch (error) {
    console.error('获取运动员详情失败:', error);
    return null;
  }
}

export default async function AthleteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const athleteId = parseInt(id);

  if (isNaN(athleteId)) {
    notFound();
  }

  const athlete = await getAthlete(athleteId);

  if (!athlete) {
    notFound();
  }

  const achievements = Array.isArray(athlete.achievements) ? athlete.achievements : (athlete.achievements ? JSON.parse(athlete.achievements) : []);
  const socialLinks = typeof athlete.social_links === 'object' && athlete.social_links !== null ? athlete.social_links : (athlete.social_links ? JSON.parse(athlete.social_links) : {});

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm">
        <ol className="flex items-center space-x-2">
          <li>
            <Link href="/" className="text-warm-gray-400 hover:text-warm-gray-700">首页</Link>
          </li>
          <li className="text-warm-gray-400">/</li>
          <li>
            <Link href="/athletes" className="text-warm-gray-400 hover:text-warm-gray-700">运动员</Link>
          </li>
          <li className="text-warm-gray-400">/</li>
          <li className="text-brown-800">{athlete.name}</li>
        </ol>
      </nav>

      {/* Athlete Header */}
      <div className="bg-cream-50 rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="md:flex">
          {/* Photo */}
          <div className="md:w-80 h-80 bg-[#F5EDE4] flex items-center justify-center">
            {athlete.photo ? (
              <img
                src={athlete.photo}
                alt={athlete.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-8xl">🏆</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 p-8">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-brown-800">{athlete.name}</h1>
              {athlete.icf_ranking && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  ICF #{athlete.icf_ranking}
                </span>
              )}
            </div>

            {athlete.name_en && (
              <p className="text-lg text-warm-gray-400 mb-4">{athlete.name_en}</p>
            )}

            <div className="flex flex-wrap gap-4 mb-4 text-sm">
              {athlete.nationality && (
                <span className="text-warm-gray-500">🏳️ {athlete.nationality}</span>
              )}
              <span className="px-3 py-1 bg-[#F5EDE4] text-[#8B6F4E] rounded-full">
                {disciplineLabels[athlete.discipline] || athlete.discipline}
              </span>
            </div>

            {athlete.bio && (
              <p className="text-warm-gray-700 leading-relaxed mb-6">{athlete.bio}</p>
            )}

            {/* Social Links */}
            {Object.keys(socialLinks).length > 0 && (
              <div className="flex flex-wrap gap-3">
                {socialLinks.instagram && (
                  <a
                    href={socialLinks.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gradient-to-r [#8B7355] text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
                  >
                    Instagram
                  </a>
                )}
                {socialLinks.youtube && (
                  <a
                    href={socialLinks.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
                  >
                    YouTube
                  </a>
                )}
                {socialLinks.weibo && (
                  <a
                    href={socialLinks.weibo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
                  >
                    微博
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="bg-cream-50 rounded-2xl shadow-sm p-8">
          <h2 className="text-2xl font-bold text-brown-800 mb-6">荣誉成就</h2>
          <div className="space-y-4">
            {achievements.map((achievement: { year: number; event: string; result: string }, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-4 p-4 bg-cream-100 rounded-xl"
              >
                <div className="text-2xl font-bold text-brown-500">{achievement.year}</div>
                <div>
                  <div className="font-medium text-brown-800">{achievement.event}</div>
                  <div className="text-sm text-warm-gray-500">{achievement.result}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
