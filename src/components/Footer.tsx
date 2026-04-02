import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo & Description */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-2xl">🏄</span>
              <span className="text-xl font-bold text-white">SUP Wiki</span>
            </div>
            <p className="text-sm text-gray-400 max-w-md">
              SUP Wiki 是一个开放的桨板资讯平台，由社区共同维护。我们致力于为桨板爱好者提供最全面的品牌、产品、运动员和博主信息。
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">快速链接</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/brands" className="hover:text-white transition-colors">
                  品牌库
                </Link>
              </li>
              <li>
                <Link href="/products" className="hover:text-white transition-colors">
                  产品库
                </Link>
              </li>
              <li>
                <Link href="/athletes" className="hover:text-white transition-colors">
                  运动员
                </Link>
              </li>
              <li>
                <Link href="/creators" className="hover:text-white transition-colors">
                  博主
                </Link>
              </li>
            </ul>
          </div>

          {/* Contribute */}
          <div>
            <h3 className="text-white font-semibold mb-4">参与贡献</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/contribute" className="hover:text-white transition-colors">
                  如何贡献
                </Link>
              </li>
              <li>
                <Link href="/contribute" className="hover:text-white transition-colors">
                  提交内容
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} SUP Wiki. 由运动骇客团队维护。</p>
        </div>
      </div>
    </footer>
  );
}
