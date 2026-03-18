/**
 * App Layout Component (Client)
 * 新布局架构 - 顶部导航 + 主内容区 + 底部抽屉
 *
 * Responsive:
 * - Desktop: 标准布局，两侧留白
 * - Mobile: 全宽布局，优化内边距
 */

'use client';

import { Suspense } from "react";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { ToastContainer } from "@/components/shared/Toast";
import { TopNavigation } from "@/components/layout/TopNavigation";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { InboxDropdown } from "@/components/inbox/InboxDropdown";
import { useManagerStore } from "@/lib/state/atoms";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const inboxOpen = useManagerStore((state) => state.inboxDrawerOpen);
  const setInboxDrawerOpen = useManagerStore((state) => state.setInboxDrawerOpen);
  const setInboxConvertData = useManagerStore((state) => state.setInboxConvertData);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Top Navigation - Desktop */}
      <Suspense fallback={<TopNavigationSkeleton />}>
        <div className="desktop-only">
          <TopNavigation />
        </div>
      </Suspense>

      {/* Mobile Top Bar - Mobile only */}
      <div className="mobile-only">
        <MobileTopBar />
      </div>

      {/* Main Content - Responsive padding */}
      <main className="pt-2 md:pt-4 pb-4 md:pb-8">
        <div className="max-w-7xl mx-auto px-3 md:px-4 sm:px-6 lg:px-8">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>

      {/* Toast Container */}
      <ToastContainer />

      {/* Inbox Dropdown - 桌面端和移动端共享 */}
      <InboxDropdown
        isOpen={inboxOpen}
        onClose={() => setInboxDrawerOpen(false)}
        onInboxConvert={(data) => {
          setInboxConvertData({
            ...data,
            mode: data.mode ?? 'execute',
            isIsolated: data.isIsolated ?? false,
            autoApprove: data.autoApprove ?? false,
          });
          setInboxDrawerOpen(false);
        }}
      />
    </div>
  );
}

function TopNavigationSkeleton() {
  return (
    <header className="h-16 bg-bg-card border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-start">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-bg-hover rounded animate-pulse" />
          <div className="w-24 h-4 bg-bg-hover rounded animate-pulse" />
        </div>
      </div>
    </header>
  );
}
