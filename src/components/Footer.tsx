import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-brown-800 text-cream-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo & Description */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-2xl">🏄</span>
              <span className="text-xl font-bold text-cream-50">SUP Wiki</span>
            </div>
            <p className="text-sm text-cream-300 max-w-md leading-relaxed">
              SUP Wiki 是一个桨板运动资讯平台，提供品牌、产品、运动员、博主和赛事信息。
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-cream-50 font-semibold mb-4">快速链接</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/brands" className="text-cream-300 hover:text-cream-50 transition-colors">品牌库</Link></li>
              <li><Link href="/products" className="text-cream-300 hover:text-cream-50 transition-colors">产品库</Link></li>
              <li><Link href="/athletes" className="text-cream-300 hover:text-cream-50 transition-colors">运动员</Link></li>
              <li><Link href="/creators" className="text-cream-300 hover:text-cream-50 transition-colors">博主</Link></li>
              <li><Link href="/events" className="text-cream-300 hover:text-cream-50 transition-colors">赛事</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-brown-700 mt-8 pt-8 text-center text-sm text-cream-300 opacity-60">
          <p>&copy; {new Date().getFullYear()} SUP Wiki. 由运动骇客团队维护。</p>
        </div>
      </div>
    </footer>
  );
}
