/**
 * Locale Switcher Component
 * 语言切换组件 - 地球图标 + CN/EN 文字
 */

'use client';

import { useState, useEffect } from 'react';
import { useLocale } from '@/lib/hooks/useLocale';

export function LocaleSwitcher() {
  const { locale, changeLocale } = useLocale();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleLocale = () => {
    changeLocale(locale === 'zh-CN' ? 'en' : 'zh-CN');
  };

  if (!mounted) {
    return null;
  }

  return (
    <button
      onClick={toggleLocale}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-subtle hover:border-border-visible hover:bg-bg-secondary transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-info/20"
      title={locale === 'zh-CN' ? 'Switch to English' : '切换到中文'}
      style={{
        minHeight: '36px',
      }}
    >
      {/* 地球图标 */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      {/* 语言标识 */}
      <span className="text-xs font-medium text-text-secondary" style={{ minWidth: '24px' }}>
        {locale === 'zh-CN' ? 'EN' : 'CN'}
      </span>
    </button>
  );
}
