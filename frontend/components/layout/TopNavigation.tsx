/**
 * Top Navigation Component
 * 顶部导航栏 - 极简设计，包含 Logo 和 Inbox Badge
 *
 * Design:
 * - 毛玻璃效果 (backdrop-blur)
 * - 半透明背景
 * - 微妙的边框和阴影
 */

'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getInboxUnreadCount } from '@/lib/api/inbox';
import { useManagerStore } from '@/lib/state/atoms';
import { useAuth } from '@/lib/hooks/useAuth';
import { LocaleSwitcher } from './LocaleSwitcher';

export function TopNavigation() {
  const inboxOpen = useManagerStore((state) => state.inboxDrawerOpen);
  const setInboxDrawerOpen = useManagerStore((state) => state.setInboxDrawerOpen);
  const { isAuthenticated, authEnabled, logout } = useAuth();

  // 获取未读 Inbox 数量 - 仅在已登录时获取
  const { data: inboxCount = { count: 0 } } = useQuery({
    queryKey: ['inboxCount'],
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
    <>
      <header
        className="sticky top-0 z-30"
        style={{
          backgroundColor: 'rgba(255, 254, 249, 0.8)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          borderBottom: '1px solid rgba(45, 41, 38, 0.08)',
          boxShadow: '0 1px 2px rgba(45, 41, 38, 0.04)',
          height: '56px',
          transition: 'all 200ms ease-out',
        }}
      >
        <div
          className="flex items-center justify-between h-full"
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 24px',
          }}
        >
          {/* Logo - 左侧显示 */}
          <Link
            href="/"
            className="flex items-center gap-2.5"
          >
            <div
              className="flex items-center justify-center rounded-lg"
              style={{
                width: '28px',
                height: '28px',
                backgroundColor: '#2D2926',
              }}
            >
              <svg
                className="w-4 h-4"
                style={{ color: '#FFFEF9' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#2D2926',
                letterSpacing: '-0.01em',
              }}
            >
              AgentCenter
            </span>
          </Link>

          {/* Inbox Badge - 右侧 */}
          <div className="flex items-center gap-2">
            {/* 语言切换按钮 */}
            <LocaleSwitcher />

            {/* 退出按钮 - 仅在已登录时显示 */}
            {authEnabled && isAuthenticated && (
              <button
                onClick={logout}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
                title="退出登录"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(45, 41, 38, 0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#5C5651"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}

            <button
              onClick={toggleInbox}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: inboxOpen ? 'rgba(45, 41, 38, 0.06)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(45, 41, 38, 0.06)';
              }}
              onMouseLeave={(e) => {
                if (!inboxOpen) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {/* 剪贴板清单图标 */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke={inboxOpen ? '#2D2926' : '#5C5651'}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                <path d="M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {hasUnread && (
                <span
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    backgroundColor: '#E57373',
                    color: 'white',
                    fontSize: '9px',
                    fontWeight: 700,
                    minWidth: '16px',
                    height: '16px',
                    padding: '0 4px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
    </>
  );
}
