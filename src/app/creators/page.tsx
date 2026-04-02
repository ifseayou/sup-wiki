import Link from 'next/link';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

interface CreatorRow extends RowDataPacket {
  creator_id: number;
  nickname: string;
  avatar: string | null;
  bio: string | null;
  platform: string;
  follower_tier: string;
  content_style: string;
  profile_url: string | null;
}

const platformLabels: Record<string, { name: string; color: string }> = {
  douyin: { name: '抖音', color: 'bg-black text-white' },
  xiaohongshu: { name: '小红书', color: 'bg-red-500 text-white' },
  bilibili: { name: 'B站', color: 'bg-pink-400 text-white' },
  youtube: { name: 'YouTube', color: 'bg-red-600 text-white' },
  weibo: { name: '微博', color: 'bg-orange-500 text-white' },
};

const styleLabels: Record<string, string> = {
  tutorial: '教学',
  review: '测评',
  vlog: 'Vlog',
  adventure: '探险',
};

const tierLabels: Record<string, string> = {
  '1k-10k': '1k-10k',
  '10k-100k': '1w-10w',
  '100k-1m': '10w-100w',
  '1m+': '100w+',
};

async function getCreators() {
  try {
    const tierOrder = `CASE follower_tier
      WHEN '1m+' THEN 1
      WHEN '100k-1m' THEN 2
      WHEN '10k-100k' THEN 3
      WHEN '1k-10k' THEN 4
      ELSE 5
    END`;

    const [creators] = await pool.execute<CreatorRow[]>(
      `SELECT * FROM sup_creators WHERE status = 'published' ORDER BY ${tierOrder} ASC, nickname ASC`
    );
    return creators;
  } catch (error) {
    console.error('获取博主列表失败:', error);
    return [];
  }
}

export default async function CreatorsPage() {
  const creators = await getCreators();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brown-800 mb-2">博主</h1>
        <p className="text-warm-gray-500">关注桨板领域的内容创作者，获取教程和测评</p>
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-wrap gap-4">
        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brown-500 focus:border-brown-500">
          <option value="">全部平台</option>
          <option value="douyin">抖音</option>
          <option value="xiaohongshu">小红书</option>
          <option value="bilibili">B站</option>
          <option value="youtube">YouTube</option>
          <option value="weibo">微博</option>
        </select>
        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brown-500 focus:border-brown-500">
          <option value="">内容风格</option>
          <option value="tutorial">教学</option>
          <option value="review">测评</option>
          <option value="vlog">Vlog</option>
          <option value="adventure">探险</option>
        </select>
      </div>

      {/* Creators Grid */}
      {creators.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {creators.map((creator) => (
            <Link
              key={creator.creator_id}
              href={`/creators/${creator.creator_id}`}
              className="bg-cream-50 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-cream-200 group"
            >
              {/* Avatar */}
              <div className="h-48 bg-[#F5EDF2] flex items-center justify-center">
                {creator.avatar ? (
                  <img
                    src={creator.avatar}
                    alt={creator.nickname}
                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-cream-50 flex items-center justify-center text-5xl shadow-lg">
                    📱
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="text-lg font-semibold text-brown-800 group-hover:text-brown-500 transition-colors text-center">
                  {creator.nickname}
                </h3>

                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${platformLabels[creator.platform]?.color || 'bg-gray-100 text-warm-gray-500'}`}>
                    {platformLabels[creator.platform]?.name || creator.platform}
                  </span>
                  <span className="text-xs px-2 py-1 bg-cream-200 text-warm-gray-500 rounded">
                    {styleLabels[creator.content_style] || creator.content_style}
                  </span>
                </div>

                <div className="mt-2 text-center text-sm text-warm-gray-400">
                  粉丝 {tierLabels[creator.follower_tier] || creator.follower_tier}
                </div>

                {creator.bio && (
                  <p className="mt-3 text-sm text-warm-gray-500 text-center line-clamp-2">
                    {creator.bio}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <span className="text-6xl mb-4 block">📱</span>
          <h3 className="text-xl font-semibold text-brown-800 mb-2">暂无博主数据</h3>
          <p className="text-warm-gray-500">博主信息正在整理中，请稍后再来</p>
        </div>
      )}
    </div>
  );
}
