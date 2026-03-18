/**
 * URL Sync Hook
 * URL参数同步钩子 - 支持深层链接和浏览器导航
 */

import { useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// ============================================================================
// Types (类型定义)
// ============================================================================

export type ViewType = 'tasks' | 'projects' | 'progress';
export type DrawerType = 'task' | 'plan' | null;

export interface UrlState {
  view: ViewType;
  drawerOpen: boolean;
  drawerType: DrawerType;
  drawerId: number | null;
  createMode: boolean;
}

// ============================================================================
// Hook (钩子)
// ============================================================================

interface UseUrlSyncOptions {
  onViewChange?: (view: ViewType) => void;
  onDrawerChange?: (open: boolean, type: DrawerType, id: number | null) => void;
  onCreateModeChange?: (createMode: boolean) => void;
}

export function useUrlSync(options: UseUrlSyncOptions = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { onViewChange, onDrawerChange, onCreateModeChange } = options;

  // 从URL读取当前状态
  const getUrlState = useCallback((): UrlState => {
    const viewParam = searchParams.get('view');
    // 兼容旧的 'plans' 参数，映射到 'tasks'
    const view: ViewType = (viewParam === 'plans' ? 'tasks' : viewParam === 'progress' || viewParam === 'projects' ? viewParam : 'tasks') as ViewType;
    const drawer = searchParams.get('drawer');
    const create = searchParams.get('create') === 'true';

    let drawerType: DrawerType = null;
    let drawerId: number | null = null;

    if (drawer) {
      // drawer 参数格式: task-{id} 或 plan-{id} 或直接 {id}
      if (drawer.startsWith('plan-')) {
        const id = parseInt(drawer.replace('plan-', ''), 10);
        if (!isNaN(id)) {
          drawerType = 'plan';
          drawerId = id;
        }
      } else if (drawer.startsWith('task-')) {
        const id = parseInt(drawer.replace('task-', ''), 10);
        if (!isNaN(id)) {
          drawerType = 'task';
          drawerId = id;
        }
      } else {
        const id = parseInt(drawer, 10);
        if (!isNaN(id)) {
          drawerType = 'task';
          drawerId = id;
        }
      }
    }

    return {
      view,
      drawerOpen: drawerId !== null,
      drawerType,
      drawerId,
      createMode: create,
    };
  }, [searchParams]);

  // 更新URL参数
  const updateUrl = useCallback((params: {
    view?: ViewType;
    drawer?: string | null;
    create?: boolean | null;
  }) => {
    const currentParams = new URLSearchParams(searchParams.toString());

    // 更新view参数
    if (params.view !== undefined) {
      currentParams.set('view', params.view);
    }

    // 更新drawer参数
    if (params.drawer !== undefined) {
      if (params.drawer === null) {
        currentParams.delete('drawer');
      } else {
        currentParams.set('drawer', params.drawer);
      }
    }

    // 更新create参数
    if (params.create !== undefined) {
      if (params.create === false) {
        currentParams.delete('create');
      } else {
        currentParams.set('create', 'true');
      }
    }

    // 构建新URL
    const newUrl = `/?${currentParams.toString()}`;
    router.replace(newUrl, { scroll: false });
  }, [searchParams, router]);

  // 切换视图
  const setView = useCallback((view: ViewType) => {
    updateUrl({ view });
    onViewChange?.(view);
  }, [updateUrl, onViewChange]);

  // 打开抽屉
  const openDrawer = useCallback((type: DrawerType, id: number) => {
    const drawerParam = type === 'plan' ? `plan-${id}` : `task-${id}`;
    updateUrl({ drawer: drawerParam });
    onDrawerChange?.(true, type, id);
  }, [updateUrl, onDrawerChange]);

  // 关闭抽屉
  const closeDrawer = useCallback(() => {
    updateUrl({ drawer: null });
    onDrawerChange?.(false, null, null);
  }, [updateUrl, onDrawerChange]);

  // 切换创建模式
  const setCreateMode = useCallback((create: boolean) => {
    updateUrl({ create });
    onCreateModeChange?.(create);
  }, [updateUrl, onCreateModeChange]);

  // 初始化：同步URL状态到回调
  useEffect(() => {
    const state = getUrlState();

    if (onViewChange) onViewChange(state.view);
    if (onDrawerChange) {
      onDrawerChange(state.drawerOpen, state.drawerType, state.drawerId);
    }
    if (onCreateModeChange) onCreateModeChange(state.createMode);
  }, []); // 只在挂载时执行一次

  return {
    // 当前状态
    ...getUrlState(),

    // 操作方法
    setView,
    openDrawer,
    closeDrawer,
    setCreateMode,
  };
}

// ============================================================================
// Utility Functions (工具函数)
// ============================================================================

/**
 * 生成深层链接URL
 */
export function createDeepLink(view: ViewType, itemId?: number, itemType?: DrawerType): string {
  const params = new URLSearchParams();
  params.set('view', view);
  if (itemId && itemType) {
    params.set('drawer', itemType === 'plan' ? `plan-${itemId}` : `task-${itemId}`);
  }
  return `/?${params.toString()}`;
}

/**
 * 解析旧URL格式并转换为新格式
 */
export function convertLegacyUrl(pathname: string): string | null {
  // /tasks/123 -> /?view=tasks&drawer=task-123
  const taskMatch = pathname.match(/^\/tasks\/(\d+)$/);
  if (taskMatch) {
    return `/?view=tasks&drawer=task-${taskMatch[1]}`;
  }

  // /plans/456 -> /?view=tasks&drawer=plan-456
  const planMatch = pathname.match(/^\/plans\/(\d+)$/);
  if (planMatch) {
    return `/?view=tasks&drawer=plan-${planMatch[1]}`;
  }

  // /tasks/new -> /?view=tasks&create=true
  if (pathname === '/tasks/new') {
    return '/?view=tasks&create=true';
  }

  // /plans/new -> /?view=tasks&create=true (计划模式在输入框切换)
  if (pathname === '/plans/new') {
    return '/?view=tasks&create=true';
  }

  // /tasks -> /?view=tasks
  if (pathname === '/tasks') {
    return '/?view=tasks';
  }

  // /plans -> /?view=tasks (合并后都指向工作视图)
  if (pathname === '/plans') {
    return '/?view=tasks';
  }

  // /progress -> /?view=progress
  if (pathname === '/progress') {
    return '/?view=progress';
  }

  return null;
}
