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

  const achievements = athlete.achievements ? JSON.parse(athlete.achievements) : [];
  const socialLinks = athlete.social_links ? JSON.parse(athlete.social_links) : {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm">
        <ol className="flex items-center space-x-2">
          <li>
            <Link href="/" className="text-gray-500 hover:text-gray-700">首页</Link>
          </li>
          <li className="text-gray-400">/</li>
          <li>
            <Link href="/athletes" className="text-gray-500 hover:text-gray-700">运动员</Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-900">{athlete.name}</li>
        </ol>
      </nav>

      {/* Athlete Header */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="md:flex">
          {/* Photo */}
          <div className="md:w-80 h-80 bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center">
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
              <h1 className="text-3xl font-bold text-gray-900">{athlete.name}</h1>
              {athlete.icf_ranking && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  ICF #{athlete.icf_ranking}
                </span>
              )}
            </div>

            {athlete.name_en && (
              <p className="text-lg text-gray-500 mb-4">{athlete.name_en}</p>
            )}

            <div className="flex flex-wrap gap-4 mb-4 text-sm">
              {athlete.nationality && (
                <span className="text-gray-600">🏳️ {athlete.nationality}</span>
              )}
              <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full">
                {disciplineLabels[athlete.discipline] || athlete.discipline}
              </span>
            </div>

            {athlete.bio && (
              <p className="text-gray-700 leading-relaxed mb-6">{athlete.bio}</p>
            )}

            {/* Social Links */}
            {Object.keys(socialLinks).length > 0 && (
              <div className="flex flex-wrap gap-3">
                {socialLinks.instagram && (
                  <a
                    href={socialLinks.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
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
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">荣誉成就</h2>
          <div className="space-y-4">
            {achievements.map((achievement: { year: number; event: string; result: string }, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl"
              >
                <div className="text-2xl font-bold text-blue-600">{achievement.year}</div>
                <div>
                  <div className="font-medium text-gray-900">{achievement.event}</div>
                  <div className="text-sm text-gray-600">{achievement.result}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contribute Button */}
      <div className="fixed bottom-8 right-8">
        <Link
          href={`/contribute?type=athlete&entity_id=${athlete.athlete_id}`}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          贡献修正
        </Link>
      </div>
    </div>
  );
}
