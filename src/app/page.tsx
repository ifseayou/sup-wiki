import Link from 'next/link';

export default function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 to-cyan-500 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              SUP Wiki
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-2xl mx-auto">
              发现桨板世界的一切 — 品牌、产品、运动员、博主
            </p>

            {/* Search Box */}
            <div className="max-w-xl mx-auto">
              <div className="flex bg-white rounded-full shadow-lg overflow-hidden">
                <input
                  type="text"
                  placeholder="搜索品牌、产品、运动员..."
                  className="flex-1 px-6 py-4 text-gray-900 focus:outline-none"
                />
                <button className="px-6 py-4 bg-blue-600 hover:bg-blue-700 transition-colors">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            探索内容
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Brands Card */}
            <Link href="/brands" className="group">
              <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
                <div className="h-40 bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                  <span className="text-6xl">🏷️</span>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    品牌库
                  </h3>
                  <p className="text-gray-600 text-sm">
                    收录国内外主流桨板品牌，了解品牌故事和定位
                  </p>
                </div>
              </div>
            </Link>

            {/* Products Card */}
            <Link href="/products" className="group">
              <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
                <div className="h-40 bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <span className="text-6xl">🏄</span>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    产品库
                  </h3>
                  <p className="text-gray-600 text-sm">
                    详细产品参数、价格对比，找到最适合你的板子
                  </p>
                </div>
              </div>
            </Link>

            {/* Athletes Card */}
            <Link href="/athletes" className="group">
              <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
                <div className="h-40 bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <span className="text-6xl">🏆</span>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    运动员
                  </h3>
                  <p className="text-gray-600 text-sm">
                    世界顶尖桨板运动员档案，ICF 排名和荣誉成就
                  </p>
                </div>
              </div>
            </Link>

            {/* Creators Card */}
            <Link href="/creators" className="group">
              <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
                <div className="h-40 bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                  <span className="text-6xl">📱</span>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    博主
                  </h3>
                  <p className="text-gray-600 text-sm">
                    关注桨板领域的内容创作者，获取教程和测评
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Contribute CTA */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            一起完善 SUP Wiki
          </h2>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
            SUP Wiki 是一个开放的社区项目，每个人都可以贡献内容。发现错误？有新的信息？来帮我们完善吧！
          </p>
          <Link
            href="/contribute"
            className="inline-flex items-center px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-full text-lg font-medium transition-colors"
          >
            开始贡献
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">15+</div>
              <div className="text-gray-600">品牌</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">50+</div>
              <div className="text-gray-600">产品</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">20+</div>
              <div className="text-gray-600">运动员</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">20+</div>
              <div className="text-gray-600">博主</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
