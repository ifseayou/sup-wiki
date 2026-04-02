import Link from 'next/link';
import { notFound } from 'next/navigation';
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

const platformLabels: Record<string, { name: string; color: string; icon: string }> = {
  douyin: { name: '抖音', color: 'bg-black text-white', icon: '🎵' },
  xiaohongshu: { name: '小红书', color: 'bg-red-500 text-white', icon: '📕' },
  bilibili: { name: 'B站', color: 'bg-pink-400 text-white', icon: '📺' },
  youtube: { name: 'YouTube', color: 'bg-red-600 text-white', icon: '▶️' },
  weibo: { name: '微博', color: 'bg-orange-500 text-white', icon: '📝' },
};

const styleLabels: Record<string, string> = {
  tutorial: '教学',
  review: '测评',
  vlog: 'Vlog',
  adventure: '探险',
};

const tierLabels: Record<string, string> = {
  '1k-10k': '1千-1万',
  '10k-100k': '1万-10万',
  '100k-1m': '10万-100万',
  '1m+': '100万+',
};

async function getCreator(id: number) {
  try {
    const [creators] = await pool.execute<CreatorRow[]>(
      'SELECT * FROM sup_creators WHERE creator_id = ?',
      [id]
    );
    if (creators.length === 0) return null;
    return creators[0];
  } catch (error) {
    console.error('获取博主详情失败:', error);
    return null;
  }
}

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const creatorId = parseInt(id);

  if (isNaN(creatorId)) {
    notFound();
  }

  const creator = await getCreator(creatorId);

  if (!creator) {
    notFound();
  }

  const platform = platformLabels[creator.platform] || { name: creator.platform, color: 'bg-gray-500 text-white', icon: '📱' };

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
            <Link href="/creators" className="text-gray-500 hover:text-gray-700">博主</Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-900">{creator.nickname}</li>
        </ol>
      </nav>

      {/* Creator Card */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* Banner */}
        <div className="h-48 bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400"></div>

        {/* Avatar & Info */}
        <div className="px-8 pb-8">
          <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-16">
            {/* Avatar */}
            <div className="shrink-0">
              {creator.avatar ? (
                <img
                  src={creator.avatar}
                  alt={creator.nickname}
                  className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-100 border-4 border-white shadow-lg flex items-center justify-center text-5xl">
                  📱
                </div>
              )}
            </div>

            {/* Name & Tags */}
            <div className="flex-1 pt-4 md:pt-0">
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                {creator.nickname}
              </h1>
              <div className="flex flex-wrap gap-3">
                <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${platform.color}`}>
                  {platform.icon} {platform.name}
                </span>
                <span className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm">
                  {styleLabels[creator.content_style] || creator.content_style}
                </span>
                <span className="px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm">
                  粉丝 {tierLabels[creator.follower_tier] || creator.follower_tier}
                </span>
              </div>
            </div>

            {/* Profile Link */}
            {creator.profile_url && (
              <a
                href={creator.profile_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`px-6 py-3 rounded-full text-sm font-medium ${platform.color} hover:opacity-90 transition-opacity shrink-0`}
              >
                访问主页 →
              </a>
            )}
          </div>

          {/* Bio */}
          {creator.bio && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">简介</h2>
              <p className="text-gray-700 leading-relaxed">{creator.bio}</p>
            </div>
          )}
        </div>
      </div>

      {/* Placeholder for future content */}
      <div className="mt-8 bg-gray-50 rounded-2xl p-8 text-center">
        <span className="text-4xl mb-4 block">🎬</span>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">更多内容即将推出</h3>
        <p className="text-gray-600">我们正在整理该博主的精选内容...</p>
      </div>

      {/* Contribute Button */}
      <div className="fixed bottom-8 right-8">
        <Link
          href={`/contribute?type=creator&entity_id=${creator.creator_id}`}
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
