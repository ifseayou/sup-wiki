'use client';

import { useState } from 'react';
import { CUSTOMER_SERVICE_WECHAT } from '@/lib/constants';

export default function WechatContactCard() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(CUSTOMER_SERVICE_WECHAT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 降级：选中文本
    }
  }

  return (
    <div style={{
      background: '#F0FFF4',
      border: '1px solid #C6F6D5',
      borderRadius: 12,
      padding: '20px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>💬</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#276749', letterSpacing: '0.02em' }}>微信咨询购买</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        {/* 左侧：微信号 + 复制 + 说明 */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 500,
              color: '#2E2118',
              letterSpacing: '0.04em',
            }}>
              {CUSTOMER_SERVICE_WECHAT}
            </span>
            <button
              onClick={handleCopy}
              style={{
                fontSize: 11,
                color: copied ? '#276749' : '#7A6145',
                background: copied ? '#C6F6D5' : '#EDF2F7',
                border: 'none',
                borderRadius: 6,
                padding: '4px 10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: 500,
              }}
            >
              {copied ? '已复制 ✓' : '复制'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#4A5568', lineHeight: 1.6, margin: 0 }}>
            所有商品通过微信沟通成交，支持发货全国。<br />
            添加客服微信后备注商品名称即可咨询。
          </p>
        </div>

        {/* 右侧：二维码 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/wechat-qr.jpg"
          alt="客服微信二维码"
          style={{ width: 88, height: 88, borderRadius: 8, border: '1px solid #C6F6D5', objectFit: 'cover', flexShrink: 0 }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    </div>
  );
}
