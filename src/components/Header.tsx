'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl">🏄</span>
            <span className="text-xl font-bold text-gray-900">SUP Wiki</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/brands" className="text-gray-600 hover:text-gray-900 transition-colors">
              品牌
            </Link>
            <Link href="/products" className="text-gray-600 hover:text-gray-900 transition-colors">
              产品库
            </Link>
            <Link href="/athletes" className="text-gray-600 hover:text-gray-900 transition-colors">
              运动员
            </Link>
            <Link href="/creators" className="text-gray-600 hover:text-gray-900 transition-colors">
              博主
            </Link>
            <Link
              href="/contribute"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              贡献内容
            </Link>
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-4">
              <Link href="/brands" className="text-gray-600 hover:text-gray-900">
                品牌
              </Link>
              <Link href="/products" className="text-gray-600 hover:text-gray-900">
                产品库
              </Link>
              <Link href="/athletes" className="text-gray-600 hover:text-gray-900">
                运动员
              </Link>
              <Link href="/creators" className="text-gray-600 hover:text-gray-900">
                博主
              </Link>
              <Link
                href="/contribute"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center"
              >
                贡献内容
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
