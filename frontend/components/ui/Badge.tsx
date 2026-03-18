/**
 * Badge Component
 * 统一状态标签组件 - 替代所有内联状态映射
 */

import { useTranslation } from 'react-i18next';
import { taskStatusColors, planStatusColors, workerStatusColors } from '@/lib/constants/status';
import type { TaskStatus } from '@/types/task';
import type { PlanStatus } from '@/types/plan';

export type WorkerStatus = 'idle' | 'busy';

// ============================================================================
// Types (类型定义)
// ============================================================================

export interface BadgeProps {
  status: TaskStatus | PlanStatus | WorkerStatus | string;
  type?: 'task' | 'plan' | 'worker' | 'custom';
  colorClass?: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

// ============================================================================
// Component (组件)
// ============================================================================

export function Badge({
  status,
  type = 'custom',
  colorClass,
  label,
  className = '',
  size = 'sm',
}: BadgeProps) {
  const { t } = useTranslation();

  // 自动获取颜色和标签
  let finalColorClass = colorClass;
  let finalLabel = label;

  if (!finalColorClass) {
    switch (type) {
      case 'task':
        finalColorClass = taskStatusColors[status as TaskStatus] || 'bg-neutral/10 text-text-muted';
        finalLabel = finalLabel || t(`status:task.${status}`, status);
        break;
      case 'plan':
        finalColorClass = planStatusColors[status as PlanStatus] || 'bg-neutral/10 text-text-muted';
        finalLabel = finalLabel || t(`status:plan.${status}`, status);
        break;
      case 'worker':
        finalColorClass = workerStatusColors[status as WorkerStatus] || 'bg-neutral/10 text-text-muted';
        finalLabel = finalLabel || t(`status:worker.${status}`, status);
        break;
      default:
        finalColorClass = 'bg-neutral/10 text-text-muted';
        finalLabel = finalLabel || status;
    }
  }

  const sizeClasses = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses} ${finalColorClass} ${className}`}
    >
      {finalLabel}
    </span>
  );
}

// ============================================================================
// Convenience Components (便捷组件)
// ============================================================================

interface TaskBadgeProps {
  status: TaskStatus;
  className?: string;
}

export function TaskBadge({ status, className }: TaskBadgeProps) {
  return <Badge status={status} type="task" className={className} />;
}

interface PlanBadgeProps {
  status: PlanStatus;
  className?: string;
}

export function PlanBadge({ status, className }: PlanBadgeProps) {
  return <Badge status={status} type="plan" className={className} />;
}

interface WorkerBadgeProps {
  status: WorkerStatus;
  className?: string;
}

export function WorkerBadge({ status, className }: WorkerBadgeProps) {
  return <Badge status={status} type="worker" className={className} size="md" />;
}

// ============================================================================
// Status Dot Component (状态点组件)
// ============================================================================

export interface StatusDotProps {
  status: 'online' | 'offline' | 'busy' | 'error';
  className?: string;
  pulse?: boolean;
}

const statusDotColors = {
  online: 'bg-success',
  offline: 'bg-neutral',
  busy: 'bg-warning',
  error: 'bg-error',
};

export function StatusDot({ status, className = '', pulse = false }: StatusDotProps) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${statusDotColors[status]} ${pulse ? 'animate-pulse' : ''} ${className}`}
    />
  );
}
