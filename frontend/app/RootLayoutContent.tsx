/**
 * Root Layout Content (Client)
 * 根布局内容 - 客户端组件
 */

'use client';

import { Providers } from "@/lib/api/client";
import { AppLayout } from "./AppLayout";
import { AuthGuard } from "@/components/auth/AuthGuard";

export function RootLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AuthGuard>
        <AppLayout>{children}</AppLayout>
      </AuthGuard>
    </Providers>
  );
}
