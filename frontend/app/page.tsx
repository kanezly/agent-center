/**
 * Unified View - AgentCenter Main Page
 * 统一视图 - 工作/经验两个视图
 */

import { Suspense } from 'react';
import { UnifiedViewContent } from './UnifiedViewContent';

// 强制动态渲染，避免静态生成时的 useSearchParams 问题
export const dynamic = 'force-dynamic';

export default function UnifiedView() {
  return (
    <Suspense fallback={<LoadingState />}>
      <UnifiedViewContent />
    </Suspense>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin w-8 h-8 border-4 border-text-muted border-t-text-primary rounded-full" />
    </div>
  );
}
