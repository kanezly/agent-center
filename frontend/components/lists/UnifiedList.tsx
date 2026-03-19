/**
 * Unified List Component
 * 统一列表组件 - 合并任务和计划的显示
 *
 * Features:
 * - 统一状态筛选（全部、TODO-Agent、TODO-Human、已完成）
 * - 支持任务和计划模式切换
 * - 项目筛选（全部项目或特定项目）
 * - 根据 mode 判断打开哪个抽屉
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTasks, deleteTask, createTask } from '@/lib/api/tasks';
import { getProjects } from '@/lib/api/projects';
import { convertInboxToTask } from '@/lib/api/inbox';
import { useGlobalEvents } from '@/lib/hooks/useWebSocket';
import { useManagerStore, type ProjectFilter } from '@/lib/state/atoms';
import { Card, TaskInput } from '@/components/ui';
import { UnifiedFilter, type FilterOption } from '@/components/layout/SmartFilter';
import {
  computeUnifiedStatus,
  getStatusColor,
  getStatusBgColor,
} from '@/lib/constants/status';
import type { Task, FilterGroup, TaskMode } from '@/types/task';
import type { InboxConvertRequest } from '@/types/inbox';
import { formatTime } from '@/lib/utils/time';
import { useTranslation } from 'react-i18next';

// ============================================================================
// Unified List Component
// ============================================================================

interface UnifiedListProps {
  onTaskClick: (id: number) => void;
  onPlanClick: (id: number) => void;
}

export function UnifiedList({ onTaskClick, onPlanClick }: UnifiedListProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const unifiedFilter = useManagerStore((state) => state.unifiedFilter);
  const setUnifiedFilter = useManagerStore((state) => state.setUnifiedFilter);
  const selectedProjectId = useManagerStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useManagerStore((state) => state.setSelectedProjectId);
  const addToast = useManagerStore((state) => state.addToast);
  const inboxConvertData = useManagerStore((state) => state.inboxConvertData);
  const setInboxConvertData = useManagerStore((state) => state.setInboxConvertData);

  // WebSocket 实时更新
  useGlobalEvents();

  // 获取项目列表（用于项目筛选器）
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    staleTime: Infinity,
  });

  // 获取当前项目下的全部任务（用于计数） - 不受状态筛选影响，但受项目筛选影响
  const { data: projectTasks } = useQuery({
    queryKey: ['tasks-count', selectedProjectId],
    queryFn: () => {
      const projectId = selectedProjectId === 'all' ? undefined : (selectedProjectId ?? -1);
      return getTasks(undefined, undefined, projectId);
    },
    staleTime: 0, // 总是认为数据过期，确保 WebSocket 事件触发时立即 refetch
    refetchInterval: 3000, // 每 3 秒轮询一次作为兜底
  });

  // 获取任务列表（带项目和状态筛选） - 用于显示
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', unifiedFilter, selectedProjectId],
    queryFn: () => {
      // projectId: 'all' 不传参数（显示全部），number 传具体 ID，null 传 -1（无项目）
      const projectId = selectedProjectId === 'all' ? undefined : (selectedProjectId ?? -1);
      const filterGroupParam = unifiedFilter === 'all' ? undefined : unifiedFilter;
      return getTasks(undefined, filterGroupParam, projectId);
    },
    staleTime: 0, // 总是认为数据过期，确保 WebSocket 事件触发时立即 refetch
    refetchInterval: 3000, // 每 3 秒轮询一次作为兜底
  });

  // 删除任务
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      addToast({ type: 'info', message: t('ui:unifiedList.taskDeleted', '任务已删除') });
    },
  });

  // 创建任务/计划
  const createMutation = useMutation({
    mutationFn: (data: { prompt: string; mode: TaskMode; depends_on_task_ids?: number[]; project_id?: number | null; fork_from_task_id?: number | null; is_isolated?: boolean; auto_approve?: boolean }) =>
      createTask(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      const typeLabel = data.type === 'plan' ? t('ui:unifiedList.planTag', '计划') : t('ui:taskInput.toastTaskCreated', '任务');
      addToast({ type: 'success', message: `${typeLabel} ${t('ui:common.confirm', '已创建')}` });
    },
  });

  // 转换 inbox 为任务
  const convertInboxMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: InboxConvertRequest }) =>
      convertInboxToTask(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inboxCount'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setInboxConvertData(null);
      addToast({ type: 'success', message: t('ui:taskInput.toastTaskCreated', '任务已创建') });
    },
  });

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    deleteMutation.mutate(id);
  };

  const handleFilterChange = (value: FilterGroup) => {
    setUnifiedFilter(value);
  };

  // 项目筛选 change
  const handleProjectChange = (projectId: ProjectFilter) => {
    setSelectedProjectId(projectId);
  };

  // 取消 inbox 转换
  const handleCancelInboxConvert = () => {
    setInboxConvertData(null);
  };

  const handleCreate = (prompt: string, mode: TaskMode, dependsOnTaskIds?: number[], projectId?: number | null, forkFromTaskId?: number | null, isIsolated?: boolean, autoApprove?: boolean) => {
    if (inboxConvertData) {
      // 调用转换 API
      convertInboxMutation.mutate({
        id: inboxConvertData.id,
        data: {
          prompt,
          mode,
          is_isolated: isIsolated,
          auto_approve: autoApprove,
          depends_on_task_ids: dependsOnTaskIds,
          fork_from_task_id: forkFromTaskId,
          project_id: projectId ?? inboxConvertData.projectId,  // 使用用户选择的项目或 inbox 原有一项目
        },
      });
    } else {
      // 普通任务创建逻辑
      createMutation.mutate({ prompt, mode, depends_on_task_ids: dependsOnTaskIds, project_id: projectId, fork_from_task_id: forkFromTaskId, is_isolated: isIsolated, auto_approve: autoApprove });
    }
  };

  const handleCardClick = (task: Task) => {
    // 根据 mode 判断打开 TaskDrawer 还是 PlanDrawer
    if (task.mode === 'plan') {
      onPlanClick(task.id);
    } else {
      onTaskClick(task.id);
    }
  };

  // 按更新时间降序排序
  const sortedTasks = tasks ? sortTasksByUpdated(tasks) : [];

  // 计算筛选计数（基于当前项目下的全部任务，不受状态筛选影响）
  const counts = projectTasks ? computeCounts(projectTasks) : {};

  // 构建项目筛选选项
  const projectOptions: FilterOption<string>[] = [
    { value: 'all', label: t('ui:projectFilter.allProjects', '全部项目') },
    { value: 'none', label: t('ui:projectFilter.noProject', '无项目') },
    ...(projects || []).map((p) => ({
      value: String(p.id),
      label: p.display_name || p.name,
    })),
  ];

  return (
    <div className="space-y-4 px-4 md:px-6">
      {/* Task Input */}
      <TaskInput
        onAdd={handleCreate}
        inboxConvertData={inboxConvertData ? {
          ...inboxConvertData,
          onCancel: handleCancelInboxConvert,
        } : undefined}
        placeholder={t('ui:unifiedList.placeholder', '添加新任务或计划...')}
        disabled={createMutation.isPending || convertInboxMutation.isPending}
      />

      {/* Unified Status Filter with built-in project selector */}
      <UnifiedFilter
        value={unifiedFilter}
        onChange={handleFilterChange}
        counts={counts}
        selectedProjectId={selectedProjectId}
        onProjectChange={handleProjectChange}
        projectOptions={projectOptions}
      />

      {/* Task List */}
      {isLoading ? (
        <UnifiedListSkeleton />
      ) : sortedTasks.length === 0 ? (
        <EmptyState filter={unifiedFilter} selectedProjectId={selectedProjectId} />
      ) : (
        <div className="unified-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {sortedTasks.map((task) => (
            <UnifiedCard
              key={task.id}
              task={task}
              onClick={() => handleCardClick(task)}
              onDelete={(e) => handleDelete(e, task.id)}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sort Functions
// ============================================================================

function sortTasksByUpdated(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const dateA = a.finished_at || a.started_at || a.created_at;
    const dateB = b.finished_at || b.started_at || b.created_at;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });
}

// ============================================================================
// Count Functions
// ============================================================================

function computeCounts(tasks: Task[]): Record<string, number> {
  const counts = {
    all: tasks.length,
    'todo-agent': 0,
    'todo-human': 0,
    done: 0,
  };

  for (const task of tasks) {
    // 使用 task.status 判断，因为 pending 状态在 unified_status 中会被映射为 queued
    const status = task.status;

    // pending (挂起) 状态也属于 TODO-Agent（等待依赖完成）
    if (status === 'queued' || status === 'running' || status === 'pending') {
      counts['todo-agent']++;
    } else if (status === 'reviewing') {
      counts['todo-human']++;
    } else {
      counts.done++;
    }
  }

  return counts;
}

// ============================================================================
// Unified Card (统一卡片)
// ============================================================================

interface UnifiedCardProps {
  task: Task;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  isDeleting: boolean;
}

function UnifiedCard({ task, onClick, onDelete, isDeleting }: UnifiedCardProps) {
  const { t } = useTranslation();
  // 使用原始 task.status 获取颜色和标签，确保 pending 显示为"挂起"
  const statusColor = getStatusColor(task.status);
  const statusBgColor = getStatusBgColor(task.status);

  // 根据 task.status 获取标签（使用翻译函数）
  const statusLabel = t(`ui:task.${task.status}`, task.status);

  // 获取更新时间
  const updateTime = task.finished_at || task.started_at || task.created_at;

  return (
    <Card hover clickable onClick={onClick}>
      {/* Header: Status + Mode Tag + Delete Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {/* Status Badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: '24px',
              padding: '0 8px',
              fontSize: '11px',
              fontWeight: 600,
              color: statusColor,
              backgroundColor: statusBgColor,
              borderRadius: '12px',
              flexShrink: 0,
            }}
            className="xs:text-[10px]"
          >
            {statusLabel}
          </span>

          {/* Mode Tag */}
          {task.mode === 'plan' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: '24px',
                padding: '0 8px',
                fontSize: '11px',
                fontWeight: 500,
                color: '#5C5651',
                backgroundColor: 'rgba(45, 41, 38, 0.08)',
                borderRadius: '12px',
                flexShrink: 0,
              }}
              className="xs:text-[10px]"
            >
              {t('ui:unifiedList.planTag', '计划')}
            </span>
          )}
        </div>

        {/* Delete Button - 始终显示，hover 变红 */}
        <button
          onClick={onDelete}
          disabled={isDeleting}
          title={t('ui:actions.delete', '删除任务')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            flexShrink: 0,
            color: '#8B837B',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 150ms ease-out',
            opacity: 0.7,
          }}
          className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
          onMouseEnter={(e) => {
            e.stopPropagation();
            e.currentTarget.style.backgroundColor = 'rgba(229, 115, 115, 0.1)';
            e.currentTarget.style.color = '#E57373';
            e.currentTarget.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#8B837B';
            e.currentTarget.style.opacity = '0.7';
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </div>

      {/* Content: Prompt */}
      <p
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: '#2D2926',
          lineHeight: 1.5,
          margin: '10px 0 0 0',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}
        className="xs:text-[13px]"
      >
        {task.plan_goal || task.prompt_short || task.prompt}
      </p>

      {/* Footer: Time */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#8B837B',
          marginTop: '10px',
          flexWrap: 'wrap',
          gap: '4px',
        }}
        className="xs:text-[10px]"
      >
        <div />
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{formatTime(updateTime, t)}</span>
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// Empty State (空状态)
// ============================================================================

interface EmptyStateProps {
  filter: FilterGroup;
  selectedProjectId: ProjectFilter;
}

function EmptyState({ filter, selectedProjectId }: EmptyStateProps) {
  const { t } = useTranslation();

  // 根据项目筛选状态显示不同提示
  const hasProjectFilter = selectedProjectId !== 'all';

  const messages: Record<FilterGroup, { title: string; desc: string }> = {
    'all': hasProjectFilter
      ? { title: t('ui:projectFilter.noTasksInProject', '该项目下暂无任务'), desc: t('ui:projectFilter.noTasksInProjectDesc', '尝试切换到其他项目或全部项目') }
      : { title: t('ui:unifiedList.noTasks', '暂无任务'), desc: t('ui:unifiedList.noTasksDesc', '输入任务描述开始执行') },
    'todo-agent': { title: t('ui:unifiedList.noPendingTasks', '无待处理任务'), desc: t('ui:unifiedList.noPendingTasksDesc', 'Agent 正在空闲中') },
    'todo-human': { title: t('ui:unifiedList.noReviewTasks', '无待审核任务'), desc: t('ui:unifiedList.noReviewTasksDesc', '没有需要人工处理的任务') },
    'done': { title: t('ui:unifiedList.noDoneTasks', '无已完成任务'), desc: t('ui:unifiedList.noDoneTasksDesc', '完成的任务会显示在这里') },
  };

  const { title, desc } = messages[filter];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', textAlign: 'center' }}>
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: 'rgba(45, 41, 38, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8B837B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <div style={{ fontSize: '16px', fontWeight: 600, color: '#2D2926', marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '13px', color: '#8B837B' }}>{desc}</div>
    </div>
  );
}

// ============================================================================
// Skeleton (骨架屏)
// ============================================================================

function UnifiedListSkeleton() {
  return (
    <div className="unified-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          style={{
            padding: '16px',
            backgroundColor: '#FFFEF9',
            border: '1px solid rgba(45, 41, 38, 0.08)',
            borderRadius: '16px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div style={{ height: '24px', width: '64px', backgroundColor: 'rgba(45, 41, 38, 0.06)', borderRadius: '12px' }} />
            <div style={{ height: '24px', width: '48px', backgroundColor: 'rgba(45, 41, 38, 0.06)', borderRadius: '12px' }} />
          </div>
          <div style={{ height: '14px', backgroundColor: 'rgba(45, 41, 38, 0.06)', borderRadius: '4px', marginBottom: '8px' }} />
          <div style={{ height: '14px', backgroundColor: 'rgba(45, 41, 38, 0.06)', borderRadius: '4px', width: '66%' }} />
        </div>
      ))}
    </div>
  );
}
