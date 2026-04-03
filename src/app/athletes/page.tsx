import Link from 'next/link';
import { Suspense } from 'react';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import FilterBar from '@/components/FilterBar';

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

async function getAthletes(discipline?: string, nationality?: string) {
  try {
    const conditions: string[] = ["status = 'published'"];
    const params: string[] = [];

    if (discipline) { conditions.push('discipline = ?'); params.push(discipline); }
    if (nationality) { conditions.push('nationality = ?'); params.push(nationality); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [athletes] = await pool.execute<AthleteRow[]>(
      `SELECT * FROM sup_athletes ${where}
       ORDER BY COALESCE(icf_ranking, 9999) ASC, name ASC`,
      params
    );
    return athletes;
  } catch (error) {
    console.error('获取运动员列表失败:', error);
    return [];
  }
}

const filters = [
  {
    key: 'discipline',
    placeholder: '全部项目',
    options: [
      { label: '竞速', value: 'race' },
      { label: '冲浪', value: 'surf' },
      { label: '长距离', value: 'distance' },
      { label: '技巧', value: 'technical' },
    ],
  },
  {
    key: 'nationality',
    placeholder: '全部国籍',
    options: [
      { label: '中国', value: '中国' },
      { label: '澳大利亚', value: '澳大利亚' },
      { label: '美国', value: '美国' },
      { label: '法国', value: '法国' },
      { label: '夏威夷', value: '夏威夷' },
    ],
  },
];

export default async function AthletesPage({
  searchParams,
}: {
  searchParams: Promise<{ discipline?: string; nationality?: string }>;
}) {
  const { discipline, nationality } = await searchParams;
  const athletes = await getAthletes(discipline, nationality);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brown-800 mb-2">运动员</h1>
        <p className="text-warm-gray-500">世界顶尖桨板运动员档案，ICF 排名和荣誉成就</p>
      </div>

      <Suspense>
        <FilterBar filters={filters} />
      </Suspense>

      {athletes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {athletes.map((athlete) => (
            <Link
              key={athlete.athlete_id}
              href={`/athletes/${athlete.athlete_id}`}
              className="bg-cream-50 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-cream-200 group"
            >
              <div className="h-56 bg-[#F5EDE4] flex items-center justify-center">
                {athlete.photo ? (
                  <img src={athlete.photo} alt={athlete.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl text-[#D4C4B0]" style={{ fontFamily: 'var(--font-display)' }}>
                    {athlete.name.slice(0, 1)}
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-lg font-semibold text-brown-800 group-hover:text-brown-500 transition-colors">
                  {athlete.name}
                </h3>
                {athlete.name_en && (
                  <p className="text-sm text-warm-gray-400">{athlete.name_en}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs px-2 py-1 bg-[#F5EDE4] text-[#8B6F4E] rounded">
                    {disciplineLabels[athlete.discipline] || athlete.discipline}
                  </span>
                  {athlete.icf_ranking && (
                    <span className="text-sm font-medium text-brown-500">ICF #{athlete.icf_ranking}</span>
                  )}
                </div>
                {athlete.nationality && (
                  <div className="mt-2 text-sm text-warm-gray-400">{athlete.nationality}</div>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-warm-gray-500">暂无符合条件的运动员</p>
        </div>
      )}
    </div>
  );
}
