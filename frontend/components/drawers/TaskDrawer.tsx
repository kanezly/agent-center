/**
 * Task Drawer Component
 * 任务详情弹框 - 响应式设计
 *
 * Desktop: 居中模态框 (Modal)
 * Mobile: 底部抽屉 (BottomSheet)
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getTask, cancelTask, approveTask, continueTask, retryTask } from '@/lib/api/tasks';
import { WS_BASE_URL } from '@/lib/api/client';
import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { TaskDrawerContent } from './TaskDrawerContent';
import { useIsDesktop } from '@/lib/hooks/useMediaQuery';
import type { TaskDetail, TaskLog } from '@/types/task';

interface TaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: number | null;
}

export function TaskDrawer({ isOpen, onClose, taskId }: TaskDrawerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // 获取任务详情
  const { data: task, isLoading, error } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => getTask(taskId!),
    enabled: !!taskId && isOpen,
    staleTime: 5000,  // 5 秒内使用缓存
    refetchInterval: (query) => {
      // 仅在 running 状态轮询
      const task = query.state.data as TaskDetail | undefined;
      return task?.status === 'running' ? 5000 : false;
    },
  });

  // 取消任务
  const cancelMutation = useMutation({
    mutationFn: () => cancelTask(taskId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  // 批准任务 (reviewing -> completed)
  const approveMutation = useMutation({
    mutationFn: () => approveTask(taskId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  // 继续任务 (reviewing -> running)
  const continueMutation = useMutation({
    mutationFn: (data: { prompt: string }) => continueTask(taskId!, data.prompt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  // 重试任务 (failed -> queued)
  const retryMutation = useMutation({
    mutationFn: () => retryTask(taskId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  // 日志同步 - 始终从数据库加载日志，并与 WebSocket 日志合并
  useEffect(() => {
    if (task?.logs) {
      setLogs((prevLogs) => {
        // 合并数据库日志和 WebSocket 日志，避免重复
        const dbLogIds = new Set(task.logs.map((log) => log.id));
        const wsLogs = prevLogs.filter((log) => !dbLogIds.has(log.id));
        return [...task.logs, ...wsLogs];
      });
    }
  }, [task?.logs]);

  // WebSocket 实时日志
  useEffect(() => {
    // 在 queued 和 running 状态下都建立 WebSocket 连接
    if (!task || !isOpen) return;
    if (task.status !== 'queued' && task.status !== 'running') return;

    const ws = new WebSocket(`${WS_BASE_URL}/ws/logs/${taskId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.task_id === taskId) {
          setLogs((prev) => [
            ...prev,
            {
              id: Date.now(),
              event_type: data.event_type,
              payload: JSON.stringify(data.payload),
              ts: new Date().toISOString(),
            },
          ]);
        }
      } catch {
        // Parse error - silently ignore malformed messages
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    ws.onerror = () => {
      setWsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [taskId, task?.status, isOpen]);

  // 关闭时清理
  useEffect(() => {
    if (!isOpen) {
      wsRef.current?.close();
      setLogs([]);
      setWsConnected(false);
    }
  }, [isOpen]);

  if (!taskId) return null;

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
          {t('ui:taskDrawer.loading', '加载中...')}
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
          <div style={{ color: '#E57373', fontSize: '14px' }}>{t('ui:taskDrawer.loadFailed', '加载失败')}</div>
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
        wsConnected={wsConnected}
        cancelMutation={cancelMutation}
        approveMutation={approveMutation}
        continueMutation={continueMutation}
        retryMutation={retryMutation}
        isDesktop={isDesktop}
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
