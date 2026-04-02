'use client';

import { useState } from 'react';
import Link from 'next/link';

type EntityType = 'brand' | 'product' | 'athlete' | 'creator';

const entityLabels: Record<EntityType, { name: string; icon: string; description: string }> = {
  brand: {
    name: '品牌',
    icon: '🏷️',
    description: '添加或修正品牌信息',
  },
  product: {
    name: '产品',
    icon: '🏄',
    description: '添加或修正产品信息',
  },
  athlete: {
    name: '运动员',
    icon: '🏆',
    description: '添加或修正运动员信息',
  },
  creator: {
    name: '博主',
    icon: '📱',
    description: '添加或修正博主信息',
  },
};

export default function ContributePage() {
  const [selectedType, setSelectedType] = useState<EntityType | null>(null);
  const [isLoggedIn] = useState(false); // TODO: 实现登录状态检查

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Page Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">贡献内容</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          SUP Wiki 是一个开放的社区项目，感谢你帮助我们完善内容。
          提交的内容将经过审核后合并到主数据库。
        </p>
      </div>

      {/* Login Notice */}
      {!isLoggedIn && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-yellow-800 mb-1">需要登录</h3>
              <p className="text-yellow-700 text-sm">
                提交贡献需要先登录微信账号。请在小程序中完成登录后再进行贡献。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">贡献流程</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              1
            </div>
            <h3 className="font-medium text-gray-900 mb-2">选择类型</h3>
            <p className="text-sm text-gray-600">选择你要贡献的内容类型</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              2
            </div>
            <h3 className="font-medium text-gray-900 mb-2">填写信息</h3>
            <p className="text-sm text-gray-600">填写详细的内容信息</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              3
            </div>
            <h3 className="font-medium text-gray-900 mb-2">等待审核</h3>
            <p className="text-sm text-gray-600">管理员审核通过后自动合并</p>
          </div>
        </div>
      </div>

      {/* Select Type */}
      <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">选择贡献类型</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.keys(entityLabels) as EntityType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`p-6 rounded-xl border-2 transition-all text-center ${
                selectedType === type
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-4xl block mb-3">{entityLabels[type].icon}</span>
              <span className="font-medium text-gray-900">{entityLabels[type].name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Form placeholder */}
      {selectedType && (
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            新增{entityLabels[selectedType].name}
          </h2>

          {selectedType === 'brand' && <BrandForm />}
          {selectedType === 'product' && <ProductForm />}
          {selectedType === 'athlete' && <AthleteForm />}
          {selectedType === 'creator' && <CreatorForm />}
        </div>
      )}

      {/* Guidelines */}
      <div className="mt-8 bg-gray-50 rounded-2xl p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">贡献指南</h2>
        <ul className="space-y-3 text-gray-600">
          <li className="flex items-start gap-3">
            <span className="text-green-500">✓</span>
            <span>确保提交的信息真实准确，尽量提供官方来源</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-500">✓</span>
            <span>图片请使用清晰的官方图片，避免侵权</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-500">✓</span>
            <span>品牌名称请使用官方中文名称，并提供英文名</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-red-500">✗</span>
            <span>请勿提交虚假信息或广告内容</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// Brand Form Component
function BrandForm() {
  return (
    <form className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            品牌名称 *
          </label>
          <input
            type="text"
            placeholder="如：红桨"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            英文名称
          </label>
          <input
            type="text"
            placeholder="如：Red Paddle Co"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Slug（URL 标识）*
          </label>
          <input
            type="text"
            placeholder="如：red-paddle-co"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            所属国家
          </label>
          <input
            type="text"
            placeholder="如：英国"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            定位
          </label>
          <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="entry">入门级</option>
            <option value="intermediate">进阶级</option>
            <option value="pro">专业级</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            官网
          </label>
          <input
            type="url"
            placeholder="https://..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          品牌简介
        </label>
        <textarea
          rows={4}
          placeholder="请简要介绍该品牌..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <button
        type="submit"
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        提交贡献
      </button>
    </form>
  );
}

// Product Form Component
function ProductForm() {
  return (
    <form className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            产品型号 *
          </label>
          <input
            type="text"
            placeholder="如：Ride 10'6"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            所属品牌 *
          </label>
          <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="">请选择品牌</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            产品类型
          </label>
          <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="inflatable">充气板</option>
            <option value="hardboard">硬板</option>
            <option value="race">竞速板</option>
            <option value="allround">全能板</option>
            <option value="yoga">瑜伽板</option>
            <option value="touring">巡游板</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            适合人群
          </label>
          <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="beginner">新手</option>
            <option value="intermediate">进阶</option>
            <option value="advanced">高级</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">长度 (cm)</label>
          <input type="number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">宽度 (cm)</label>
          <input type="number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">厚度 (cm)</label>
          <input type="number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">重量 (kg)</label>
          <input type="number" step="0.1" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">最低价格 (元)</label>
          <input type="number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">最高价格 (元)</label>
          <input type="number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <button
        type="submit"
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        提交贡献
      </button>
    </form>
  );
}

// Athlete Form Component
function AthleteForm() {
  return (
    <form className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">姓名 *</label>
          <input type="text" placeholder="中文名" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">英文名</label>
          <input type="text" placeholder="English Name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">国籍</label>
          <input type="text" placeholder="如：中国" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">主项</label>
          <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="race">竞速</option>
            <option value="surf">冲浪</option>
            <option value="distance">长距离</option>
            <option value="technical">技巧</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ICF 世界排名</label>
          <input type="number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">简介</label>
        <textarea rows={4} placeholder="运动员介绍..." className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
      </div>
      <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
        提交贡献
      </button>
    </form>
  );
}

// Creator Form Component
function CreatorForm() {
  return (
    <form className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">昵称 *</label>
          <input type="text" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">平台 *</label>
          <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="douyin">抖音</option>
            <option value="xiaohongshu">小红书</option>
            <option value="bilibili">B站</option>
            <option value="youtube">YouTube</option>
            <option value="weibo">微博</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">粉丝量级</label>
          <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="1k-10k">1k-10k</option>
            <option value="10k-100k">1万-10万</option>
            <option value="100k-1m">10万-100万</option>
            <option value="1m+">100万+</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">内容风格</label>
          <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="tutorial">教学</option>
            <option value="review">测评</option>
            <option value="vlog">Vlog</option>
            <option value="adventure">探险</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">主页链接</label>
          <input type="url" placeholder="https://..." className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">简介</label>
        <textarea rows={4} placeholder="博主介绍..." className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
      </div>
      <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
        提交贡献
      </button>
    </form>
  );
}
