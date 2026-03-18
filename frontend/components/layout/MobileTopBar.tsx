/**
 * Mobile Top Bar Component
 * 移动端顶部栏 - 与桌面端保持一致的视角
 */

'use client';

import { useManagerStore } from '@/lib/state/atoms';
import { useQuery } from '@tanstack/react-query';
import { getInboxUnreadCount } from '@/lib/api/inbox';
import { useAuth } from '@/lib/hooks/useAuth';
import { LocaleSwitcher } from './LocaleSwitcher';

export function MobileTopBar() {
  const setInboxDrawerOpen = useManagerStore((state) => state.setInboxDrawerOpen);
  const inboxOpen = useManagerStore((state) => state.inboxDrawerOpen);
  const { isAuthenticated, authEnabled, logout } = useAuth();

  // 获取未读 Inbox 数量 - 仅在已登录时获取
  const { data: inboxCount = { count: 0 } } = useQuery({
    queryKey: ['inboxCount-mobile'],
    queryFn: getInboxUnreadCount,
    refetchInterval: 5000,
    staleTime: Infinity,
    enabled: !!isAuthenticated, // 仅在已登录时获取
  });

  const hasUnread = inboxCount.count > 0;

  const toggleInbox = () => {
    setInboxDrawerOpen(!inboxOpen);
  };

  return (
    <header className="md:hidden sticky top-0 z-30 bg-bg-primary border-b border-border-subtle">
      <div className="flex items-center justify-between px-4 h-14">
        {/* Logo - 左上角，与桌面端一致 */}
        <div className="flex items-center gap-2 min-h-[44px] px-2">
          <div className="w-7 h-7 rounded-lg bg-text-primary flex items-center justify-center">
            <svg className="w-4 h-4 text-bg-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-base font-semibold text-text-primary">AgentCenter</span>
        </div>

        {/* 右侧按钮组 */}
        <div className="flex items-center gap-1">
          {/* 语言切换按钮 */}
          <LocaleSwitcher />

          {/* 退出按钮 - 仅在已登录时显示 */}
          {authEnabled && isAuthenticated && (
            <button
              onClick={logout}
              className="p-2 hover:bg-accent-subtle rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center relative"
              aria-label="退出登录"
              title="退出登录"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}

          {/* 待办清单入口 - 剪贴板清单图标 + 未读红点 */}
          <button
            onClick={toggleInbox}
            className="p-2 hover:bg-accent-subtle rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center relative"
            aria-label="待办清单"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {hasUnread && (
              <span
                className="absolute top-1 right-1 bg-error text-white text-[9px] font-bold min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center shadow-sm"
                style={{
                  backgroundColor: '#E57373',
                  boxShadow: '0 1px 3px rgba(229, 115, 115, 0.4)',
                }}
              >
                {inboxCount.count > 99 ? '99+' : inboxCount.count}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
