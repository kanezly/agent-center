/**
 * Dependency Section Component
 * 依赖关系展示组件 - 显示任务的前序依赖和后置依赖
 */

'use client';

import { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getDependencies, getTask } from '@/lib/api/tasks';
import { getStatusColor, getStatusBgColor, taskStatusLabels } from '@/lib/constants/status';
import type { Task, TaskStatus } from '@/types/task';

interface DependencySectionProps {
  taskId: number;
  onTaskClick?: (taskId: number) => void;
}

export function DependencySection({ taskId, onTaskClick }: DependencySectionProps) {
  const { t } = useTranslation();

  // 获取依赖关系
  const { data: deps, isLoading: depsLoading } = useQuery({
    queryKey: ['dependencies', taskId],
    queryFn: () => getDependencies(taskId),
    staleTime: 60000,  // 60 秒缓存
    enabled: !!taskId,
  });

  // 使用 useMemo 稳定查询配置
  const dependsOnQueryConfigs = useMemo(() => {
    if (!deps?.depends_on?.length) return [];
    return deps.depends_on.map((id) => ({
      queryKey: ['dependency-task', id],  // 区分查询键，避免与主任务查询冲突
      queryFn: () => getTask(id),
      staleTime: 30000,  // 30 秒缓存
      enabled: !!id,
    }));
  }, [deps?.depends_on]);

  const dependentQueryConfigs = useMemo(() => {
    if (!deps?.dependent_tasks?.length) return [];
    return deps.dependent_tasks.map((id) => ({
      queryKey: ['dependency-task', id],  // 区分查询键，避免与主任务查询冲突
      queryFn: () => getTask(id),
      staleTime: 30000,  // 30 秒缓存
      enabled: !!id,
    }));
  }, [deps?.dependent_tasks]);

  // 批量获取前序任务详情
  const dependsOnQueries = useQueries({
    queries: dependsOnQueryConfigs,
  });
  const dependsOnTasks = dependsOnQueries.map((q) => q.data).filter((t): t is NonNullable<typeof t> => t !== undefined);

  // 批量获取后置任务详情
  const dependentQueries = useQueries({
    queries: dependentQueryConfigs,
  });
  const dependentTasks = dependentQueries.map((q) => q.data).filter((t): t is NonNullable<typeof t> => t !== undefined);

  const hasDependencies = deps && (deps.depends_on.length > 0 || deps.dependent_tasks.length > 0);

  if (!hasDependencies) {
    return null;
  }

  return (
    <div
      style={{
        padding: '16px 24px',
        borderBottom: '1px solid rgba(45, 41, 38, 0.06)',
        backgroundColor: '#FDFBFA',
      }}
    >
      {/* 前序依赖 */}
      {deps.depends_on.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '10px',
            }}
          >
            <div
              style={{
                width: '4px',
                height: '16px',
                backgroundColor: '#7BB3D0',
                borderRadius: '2px',
              }}
            />
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#2D2926',
              }}
            >
              {t('ui:dependency.prerequisites', '前序依赖')} ({deps.depends_on.length})
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              paddingLeft: '12px',
            }}
          >
            {dependsOnTasks.map((task) => (
              <DependencyTaskBadge
                key={task.id}
                task={task}
                onClick={() => onTaskClick?.(task.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 后置依赖 */}
      {deps.dependent_tasks.length > 0 && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '10px',
            }}
          >
            <div
              style={{
                width: '4px',
                height: '16px',
                backgroundColor: '#7CB882',
                borderRadius: '2px',
              }}
            />
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#2D2926',
              }}
            >
              {t('ui:dependency.dependents', '后置依赖')} ({deps.dependent_tasks.length})
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              paddingLeft: '12px',
            }}
          >
            {dependentTasks.map((task) => (
              <DependencyTaskBadge
                key={task.id}
                task={task}
                onClick={() => onTaskClick?.(task.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Dependency Task Badge (依赖任务徽章)
// ============================================================================

interface DependencyTaskBadgeProps {
  task: Task;
  onClick?: () => void;
}

function DependencyTaskBadge({ task, onClick }: DependencyTaskBadgeProps) {
  const statusColor = getStatusColor(task.status);
  const statusBgColor = getStatusBgColor(task.status);
  const statusLabel = taskStatusLabels[task.status] || task.status;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        backgroundColor: statusBgColor,
        border: `1px solid ${statusColor}30`,
        borderRadius: '8px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 150ms ease',
        maxWidth: '280px',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.backgroundColor = `${statusBgColor}cc`;
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.backgroundColor = statusBgColor;
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      <span
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: '#5C5651',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '180px',
        }}
        title={task.initial_prompt || task.prompt}
      >
        {task.initial_prompt || task.prompt}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          height: '16px',
          padding: '0 4px',
          fontSize: '10px',
          fontWeight: 500,
          color: statusColor,
          backgroundColor: `${statusColor}20`,
          borderRadius: '3px',
          flexShrink: 0,
        }}
      >
        {statusLabel}
      </span>
    </button>
  );
}
