import Link from 'next/link';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

interface AthleteRow extends RowDataPacket {
  athlete_id: number;
  name: string;
  name_en: string | null;
  nationality: string | null;
  photo: string | null;
  discipline: string;
  icf_ranking: number | null;
}

const disciplineLabels: Record<string, string> = {
  race: '竞速',
  surf: '冲浪',
  distance: '长距离',
  technical: '技巧',
};

async function getAthletes() {
  try {
    const [athletes] = await pool.execute<AthleteRow[]>(
      `SELECT * FROM sup_athletes ORDER BY COALESCE(icf_ranking, 9999) ASC, name ASC`
    );
    return athletes;
  } catch (error) {
    console.error('获取运动员列表失败:', error);
    return [];
  }
}

export default async function AthletesPage() {
  const athletes = await getAthletes();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">运动员</h1>
        <p className="text-gray-600">世界顶尖桨板运动员档案，ICF 排名和荣誉成就</p>
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-wrap gap-4">
        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">全部项目</option>
          <option value="race">竞速</option>
          <option value="surf">冲浪</option>
          <option value="distance">长距离</option>
          <option value="technical">技巧</option>
        </select>
        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">全部国籍</option>
          <option value="中国">中国</option>
          <option value="澳大利亚">澳大利亚</option>
          <option value="美国">美国</option>
          <option value="法国">法国</option>
        </select>
      </div>

      {/* Athletes Grid */}
      {athletes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {athletes.map((athlete) => (
            <Link
              key={athlete.athlete_id}
              href={`/athletes/${athlete.athlete_id}`}
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-100 group"
            >
              {/* Photo */}
              <div className="h-56 bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center">
                {athlete.photo ? (
                  <img
                    src={athlete.photo}
                    alt={athlete.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-6xl">🏆</span>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {athlete.name}
                </h3>
                {athlete.name_en && (
                  <p className="text-sm text-gray-500">{athlete.name_en}</p>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded">
                    {disciplineLabels[athlete.discipline] || athlete.discipline}
                  </span>
                  {athlete.icf_ranking && (
                    <span className="text-sm font-medium text-blue-600">
                      ICF #{athlete.icf_ranking}
                    </span>
                  )}
                </div>

                {athlete.nationality && (
                  <div className="mt-2 text-sm text-gray-500">
                    🏳️ {athlete.nationality}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <span className="text-6xl mb-4 block">🏆</span>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无运动员数据</h3>
          <p className="text-gray-600 mb-4">成为第一个贡献运动员信息的人吧！</p>
          <Link
            href="/contribute"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            贡献内容
          </Link>
        </div>
      )}
    </div>
  );
}
