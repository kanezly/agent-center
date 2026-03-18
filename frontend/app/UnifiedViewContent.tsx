/**
 * Unified View Content - Client Component
 * 统一视图内容 - 客户端组件
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { UnifiedList } from '@/components/lists/UnifiedList';
import { TaskDrawer, PlanDrawer } from '@/components/drawers';

export function UnifiedViewContent() {
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [drawerType, setDrawerType] = useState<'task' | 'plan' | null>(null);

  // 从 URL 参数同步抽屉状态
  useEffect(() => {
    const drawer = searchParams.get('drawer');

    if (drawer) {
      // drawer 参数格式：task-{id} 或 plan-{id} 或直接 {id}
      if (drawer.startsWith('plan-')) {
        const planId = parseInt(drawer.replace('plan-', ''), 10);
        if (!isNaN(planId)) {
          setDrawerId(planId);
          setDrawerType('plan');
          setDrawerOpen(true);
        }
      } else if (drawer.startsWith('task-')) {
        const taskId = parseInt(drawer.replace('task-', ''), 10);
        if (!isNaN(taskId)) {
          setDrawerId(taskId);
          setDrawerType('task');
          setDrawerOpen(true);
        }
      } else {
        const id = parseInt(drawer, 10);
        if (!isNaN(id)) {
          setDrawerId(id);
          setDrawerType('task');
          setDrawerOpen(true);
        }
      }
    } else {
      setDrawerOpen(false);
      setDrawerId(null);
      setDrawerType(null);
    }
  }, [searchParams]);

  // 处理任务点击
  const handleTaskClick = (id: number) => {
    setDrawerId(id);
    setDrawerType('task');
    setDrawerOpen(true);
  };

  // 处理计划点击
  const handlePlanClick = (id: number) => {
    setDrawerId(id);
    setDrawerType('plan');
    setDrawerOpen(true);
  };

  // 关闭抽屉
  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setDrawerId(null);
    setDrawerType(null);
  };

  return (
    <>
      {/* Content */}
      <UnifiedList onTaskClick={handleTaskClick} onPlanClick={handlePlanClick} />

      {/* Task Drawer */}
      <TaskDrawer
        isOpen={drawerOpen && drawerType === 'task'}
        onClose={handleCloseDrawer}
        taskId={drawerId}
      />

      {/* Plan Drawer */}
      <PlanDrawer
        isOpen={drawerOpen && drawerType === 'plan'}
        onClose={handleCloseDrawer}
        planId={drawerId}
      />
    </>
  );
}
