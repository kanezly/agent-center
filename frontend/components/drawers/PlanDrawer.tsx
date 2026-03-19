/**
 * Plan Drawer Component
 * 计划详情弹框 - 与 TaskDrawer 使用相同组件，保持样式统一
 *
 * Desktop: 居中模态框 (Modal)
 * Mobile: 底部抽屉 (BottomSheet)
 */

'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getPlan, answerQuestions, approvePlan, continueTask } from '@/lib/api/plans';
import { retryTask } from '@/lib/api/tasks';
import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { TaskDrawerContent } from './TaskDrawerContent';
import { useIsDesktop } from '@/lib/hooks/useMediaQuery';
import type { PlanTask } from '@/types/plan';
import type { TaskLog, TaskDetail, TaskStatus } from '@/types/task';

// 将 PlanTask 转换为 TaskDetail 格式
function convertPlanToTask(plan: PlanTask): TaskDetail {
  return {
    ...plan,
    mode: plan.mode as 'plan' | 'execute',
    status: plan.status as TaskStatus,
    logs: (plan.logs || []) as TaskLog[],
    // 添加缺失的字段
    priority: 0,
    worktree_id: null,
    cwd: null,
    conversations: plan.conversations || [],  // 使用 API 返回的对话历史
    questions: (plan.questions || []) as any,  // 类型转换（PlanQuestion 类型来自 task.ts）
    // 保留 plan_status 以便 TaskDrawerContent 判断是否为计划模式
    plan_status: plan.plan_status,
  };
}

interface PlanDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  planId: number | null;
}

export function PlanDrawer({ isOpen, onClose, planId }: PlanDrawerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();
  const [logs, setLogs] = useState<TaskLog[]>([]);

  // 获取计划详情
  const { data: plan, isLoading, error } = useQuery<PlanTask>({
    queryKey: ['plan', planId],
    queryFn: () => getPlan(planId!),
    enabled: !!planId && isOpen,
    staleTime: 0, // 总是认为数据过期，确保 WebSocket 事件触发时立即 refetch
    refetchInterval: 2000, // 每 2 秒轮询一次
  });

  // 将 PlanTask 转换为 TaskDetail
  const task = plan ? convertPlanToTask(plan) : null;

  // 提交答案 → 使用 --resume 继续原任务
  const answerMutation = useMutation({
    mutationFn: async (answers: Record<number, string[]>) => {
      const result = await answerQuestions(planId!, answers);
      return result;
    },
    onSuccess: () => {
      setAnswers({});
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // 批准计划 → 转为执行任务 / 完成任务
  const approveMutation = useMutation({
    mutationFn: () => approvePlan(planId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
  });

  // 取消（计划不需要取消，用空函数）
  // 重试任务（Plan 模式失败后重试）
  const retryMutation = useMutation({
    mutationFn: () => retryTask(planId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => Promise.resolve({ status: 'cancelled' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
    },
  });

  // 继续任务（用于用户直接输入调整指令）
  const continueMutation = useMutation({
    mutationFn: (data: { prompt: string }) => continueTask(planId!, data.prompt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
    },
  });

  // 答案状态（用于 Plan 模式的问题回答）
  const [answers, setAnswers] = useState<Record<number, string[]>>({});

  // 初始化日志
  useEffect(() => {
    if (task?.logs) {
      setLogs(task.logs);
    }
  }, [task?.logs]);

  // 关闭时清理
  useEffect(() => {
    if (!isOpen) {
      setLogs([]);
    }
  }, [isOpen]);

  if (!planId) return null;

  // 渲染内容
  const renderContent = () => {
    if (isLoading) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '300px',
            color: '#8B837B',
            fontSize: '14px',
          }}
        >
          {t('ui:planDrawer.loading', '加载中...')}
        </div>
      );
    }

    if (error || !task) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '300px',
            gap: '16px',
          }}
        >
          <div style={{ color: '#E57373', fontSize: '14px' }}>{t('ui:planDrawer.loadFailed', '加载失败')}</div>
          <Button variant="secondary" onClick={onClose}>
            {t('ui:actions.close', '关闭')}
          </Button>
        </div>
      );
    }

    return (
      <TaskDrawerContent
        task={task}
        logs={logs}
        wsConnected={false}
        cancelMutation={cancelMutation}
        approveMutation={approveMutation}
        continueMutation={continueMutation}
        retryMutation={retryMutation}
        isDesktop={isDesktop}
        answers={answers}
        setAnswers={setAnswers}
        answerMutation={answerMutation}
      />
    );
  };

  // 桌面端：居中模态框
  if (isDesktop) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} maxWidth="xl" showCloseButton>
        {renderContent()}
      </Modal>
    );
  }

  // 移动端：底部抽屉
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} size="xl">
      {renderContent()}
    </BottomSheet>
  );
}
