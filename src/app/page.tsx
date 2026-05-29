import Link from 'next/link';
import pool from '@/lib/db';
import { localResultSourceCondition } from '@/lib/result-source-scope';
import type { RowDataPacket } from 'mysql2';

interface HomeStats {
  resultCount: number;
  pointCount: number;
  athleteCount: number;
  eventCount: number;
}

interface AthletePhotoRow extends RowDataPacket {
  athlete_id: number;
  name: string;
  photo: string | null;
}

async function getHomeData() {
  const stats: HomeStats = { resultCount: 0, pointCount: 0, athleteCount: 0, eventCount: 0 };
  let athletes: AthletePhotoRow[] = [];
  try {
    const [resultRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS result_count,
         COUNT(DISTINCT COALESCE(CAST(er.athlete_id AS CHAR), er.athlete_name_snapshot)) AS athlete_count,
         COUNT(DISTINCT er.event_id) AS event_count
       FROM sup_event_results er
       INNER JOIN sup_events e ON e.event_id = er.event_id
       INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
       WHERE e.status = 'published'
         AND e.event_status = 'completed'
         AND er.source_id IS NOT NULL
         AND ${localResultSourceCondition}
         AND er.review_status = 'confirmed'
         AND er.is_verified = 1`
    );
    const [pointRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM sup_annual_point_standings)
           + (SELECT COUNT(*) FROM sup_annual_club_point_standings) AS point_count`
    );
    const [athleteRows] = await pool.execute<AthletePhotoRow[]>(
      `SELECT athlete_id, name, photo
       FROM sup_athletes
       WHERE status = 'published' AND photo IS NOT NULL AND photo <> ''
       ORDER BY updated_at DESC, athlete_id DESC
       LIMIT 4`
    );
    stats.resultCount = Number(resultRows[0]?.result_count || 0);
    stats.athleteCount = Number(resultRows[0]?.athlete_count || 0);
    stats.eventCount = Number(resultRows[0]?.event_count || 0);
    stats.pointCount = Number(pointRows[0]?.point_count || 0);
    athletes = athleteRows;
  } catch (error) {
    console.error('获取首页数据失败:', error);
  }
  return { stats, athletes };
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[#E3D4C2] bg-white/78 px-5 py-4 shadow-[0_12px_30px_rgba(91,68,43,0.08)]">
      <div className="text-3xl font-black text-[#2E2118]">{value.toLocaleString('zh-CN')}</div>
      <div className="mt-2 text-sm font-semibold text-[#8A7B6B]">{label}</div>
    </div>
  );
}

export default async function Home() {
  const { stats, athletes } = await getHomeData();
  const features = [
    ['查比赛成绩', '按运动员、赛事、项目、组别快速检索公开比赛成绩。'],
    ['看年度积分', '查看年度积分榜、组别排名和运动员积分档案。'],
    ['运动员主页', '沉淀运动员公开头像、战绩、积分和个人资料。'],
    ['赛事档案', '浏览国内桨板赛事、成绩模块和赛事说明。'],
    ['俱乐部资料', '连接队伍、俱乐部和运动员参赛记录。'],
    ['系统学习', '通过题库、资料和课程建立桨板知识体系。'],
  ];

  return (
    <main className="min-h-screen bg-[#FBF7F1] text-[#2D261F]">
      <section className="relative overflow-hidden border-b border-[#E8DCCA] bg-[#F7F0E6]">
        <div className="absolute inset-y-0 right-0 hidden w-[44%] bg-[radial-gradient(circle_at_48%_40%,rgba(183,122,46,0.18),transparent_34%),linear-gradient(90deg,transparent,#EFE2D0)] lg:block" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-20">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.32em] text-[#A06D2C]">SUP Wiki</p>
            <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-tight text-[#241B14] md:text-7xl">桨板运动的成绩与档案平台</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#6F6255]">查比赛成绩、看年度积分、了解运动员和赛事，让桨板竞技信息更容易被看见和使用。</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/results" className="inline-flex h-12 items-center justify-center rounded-md bg-[#6B3E1E] px-7 text-sm font-bold text-white no-underline shadow-[0_14px_30px_rgba(107,62,30,0.24)] hover:bg-[#4F2D16]">查成绩</Link>
              <Link href="/events" className="inline-flex h-12 items-center justify-center rounded-md border border-[#CDBAA4] bg-white px-7 text-sm font-bold text-[#6B3E1E] no-underline hover:bg-[#F8EFE4]">浏览赛事</Link>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {athletes.length ? athletes.map((athlete, index) => (
              <Link key={athlete.athlete_id} href={`/athletes/${athlete.athlete_id}`} className={`group relative overflow-hidden rounded-lg border border-[#E3D4C2] bg-[#EFE3D2] shadow-[0_18px_42px_rgba(91,68,43,0.12)] ${index === 0 ? 'sm:row-span-2' : ''}`}>
                <img src={athlete.photo || ''} alt={athlete.name} className={`w-full object-cover transition duration-300 group-hover:scale-[1.03] ${index === 0 ? 'h-full min-h-[360px]' : 'h-44'}`} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4 text-white">
                  <div className="text-lg font-bold">{athlete.name}</div>
                  <div className="text-xs text-white/76">运动员档案</div>
                </div>
              </Link>
            )) : (
              <div className="col-span-2 min-h-[420px] rounded-lg border border-[#E3D4C2] bg-[linear-gradient(135deg,#F3E5D2,#DED0BA)] shadow-[0_18px_42px_rgba(91,68,43,0.12)]" />
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="公开成绩" value={stats.resultCount} />
          <Stat label="年度积分" value={stats.pointCount} />
          <Stat label="成绩运动员" value={stats.athleteCount} />
          <Stat label="赛事" value={stats.eventCount} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-[#2E2118]">你可以在这里做什么</h2>
            <p className="mt-2 text-sm text-[#8A7B6B]">围绕桨板竞技、学习和档案整理的常用入口。</p>
          </div>
          <Link href="/learn" className="hidden rounded-md border border-[#CDBAA4] bg-white px-4 py-2 text-sm font-bold text-[#6B3E1E] no-underline hover:bg-[#F8EFE4] sm:inline-flex">进入学习</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, desc]) => (
            <div key={title} className="border border-[#E3D4C2] bg-white px-6 py-6 shadow-[0_14px_34px_rgba(91,68,43,0.06)]">
              <div className="mb-4 h-1.5 w-10 rounded-full bg-[#8B5A2B]" />
              <h3 className="text-xl font-black text-[#2E2118]">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#746556]">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
