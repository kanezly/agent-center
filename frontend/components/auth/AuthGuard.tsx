"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';

// 公开路径（不需要认证）
const PUBLIC_PATHS = ['/login'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authEnabled, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    // 公开路径不需要认证
    if (PUBLIC_PATHS.includes(pathname)) return;
    // 只有当认证已启用且未登录时才重定向到登录页
    if (authEnabled && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authEnabled, loading, router, pathname]);

  // 加载中或等待重定向时显示 loading
  if (loading || (authEnabled && !isAuthenticated && !PUBLIC_PATHS.includes(pathname))) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-muted border-t-primary rounded-full" />
      </div>
    );
  }

  return <>{children}</>;
}
