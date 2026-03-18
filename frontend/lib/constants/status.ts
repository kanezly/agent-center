/**
 * Unified Status Configuration
 * 统一的状态配置 - 消除重复代码，提供单一数据源
 */

import type { TaskStatus, PlanStatus, UnifiedStatus, FilterGroup } from '@/types';

// ============================================================================
// Unified Status (统一状态 - 合并任务和计划)
// ============================================================================

export const UNIFIED_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  REVIEWING: 'reviewing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

// 统一状态标签
export const unifiedStatusLabels: Record<UnifiedStatus, string> = {
  queued: '排队中',
  running: '执行中',
  reviewing: '待审核',
  post_processing: '代码合并中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

// 统一状态颜色 (Tailwind 类名)
export const unifiedStatusColors: Record<UnifiedStatus, string> = {
  queued: 'bg-info/10 text-info border border-info/20',
  running: 'bg-warning/10 text-warning border border-warning/20',
  reviewing: 'bg-amber/10 text-amber border border-amber/20',
  post_processing: 'bg-purple/10 text-purple border border-purple/20',
  completed: 'bg-success/10 text-success border border-success/20',
  failed: 'bg-error/10 text-error border border-error/20',
  cancelled: 'bg-neutral/10 text-text-muted border border-border-subtle',
};

// ============================================================================
// Filter Groups (筛选分组)
// ============================================================================

export const FILTER_GROUP = {
  ALL: 'all',
  TODO_AGENT: 'todo-agent',
  TODO_HUMAN: 'todo-human',
  DONE: 'done',
} as const;

// 筛选分组标签
export const filterGroupLabels: Record<FilterGroup, string> = {
  'all': '全部',
  'todo-agent': 'TODO-Agent',
  'todo-human': 'TODO-Human',
  'done': '已完成',
};

// 筛选分组对应的状态
export const filterGroupStatuses: Record<FilterGroup, UnifiedStatus[]> = {
  'all': ['queued', 'running', 'reviewing', 'post_processing', 'completed', 'failed', 'cancelled'],
  'todo-agent': ['queued', 'running'],
  'todo-human': ['reviewing', 'post_processing'],
  'done': ['completed', 'failed', 'cancelled'],
};

// ============================================================================
// Task Status (任务状态)
// ============================================================================

export const TASK_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PENDING: 'pending',
  REVIEWING: 'reviewing',
} as const;

// 任务状态标签
export const taskStatusLabels: Record<TaskStatus, string> = {
  queued: '排队中',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  pending: '挂起',
  reviewing: '待检视',
  post_processing: '代码合并中',
};

// 任务状态颜色 (Tailwind 类名) - 三色方案
export const taskStatusColors: Record<TaskStatus, string> = {
  queued: 'bg-info/10 text-info border border-info/20',
  running: 'bg-info/10 text-info border border-info/20',
  completed: 'bg-neutral/10 text-neutral border border-neutral/20',
  failed: 'bg-neutral/10 text-neutral border border-neutral/20',
  cancelled: 'bg-neutral/10 text-neutral border border-neutral/20',
  pending: 'bg-amber/10 text-amber border border-amber/20',
  reviewing: 'bg-amber/10 text-amber border border-amber/20',
  post_processing: 'bg-purple/10 text-purple border border-purple/20',
};

// ============================================================================
// Plan Status (计划状态)
// ============================================================================

export const PLAN_STATUS = {
  GENERATING: 'generating',
  REVIEWING: 'reviewing',
  APPROVED: 'approved',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RUNNING: 'running',
  QUEUED: 'queued',
} as const;

// 计划状态标签 - 新的交互式 Plan Mode 状态
export const planStatusLabels: Record<PlanStatus, string> = {
  generating: '生成中',
  reviewing: '待检视',
  approved: '已批准',
  executing: '执行中',
  completed: '已完成',
  failed: '失败',
  running: '运行中',
  queued: '排队中',
};

// 计划状态颜色 (Tailwind 类名) - 温暖柔和配色
export const planStatusColors: Record<PlanStatus, string> = {
  generating: 'bg-amber/10 text-amber border border-amber/20',
  reviewing: 'bg-warning/10 text-warning border border-warning/20',
  approved: 'bg-success/10 text-success border border-success/20',
  executing: 'bg-info/10 text-info border border-info/20',
  completed: 'bg-success/10 text-success border border-success/20',
  failed: 'bg-error/10 text-error border border-error/20',
  running: 'bg-info/10 text-info border border-info/20',
  queued: 'bg-neutral/10 text-neutral border border-neutral/20',
};

// ============================================================================
// Worker Status (Worker状态)
// ============================================================================

export const WORKER_STATUS = {
  IDLE: 'idle',
  BUSY: 'busy',
} as const;

export type WorkerStatus = (typeof WORKER_STATUS)[keyof typeof WORKER_STATUS];

// Worker状态标签
export const workerStatusLabels: Record<WorkerStatus, string> = {
  idle: '空闲',
  busy: '忙碌',
};

// Worker状态颜色 (Tailwind 类名) - 温暖柔和配色
export const workerStatusColors: Record<WorkerStatus, string> = {
  idle: 'bg-success/10 text-success border border-success/20',
  busy: 'bg-warning/10 text-warning border border-warning/20',
};

// ============================================================================
// Log Event Types (日志事件类型)
// ============================================================================

export const LOG_EVENT_TYPE = {
  ASSISTANT: 'assistant',
  TOOL_USE: 'tool_use',
  TOOL_RESULT: 'tool_result',
  RESULT: 'result',
  ERROR: 'error',
  SYSTEM: 'system',
} as const;

export type LogEventType = (typeof LOG_EVENT_TYPE)[keyof typeof LOG_EVENT_TYPE];

// 日志事件边框颜色 (Tailwind 类名)
export const logEventBorderColors: Record<LogEventType, string> = {
  assistant: 'border-l-info',
  tool_use: 'border-l-warning',
  tool_result: 'border-l-success',
  result: 'border-l-purple',
  error: 'border-l-error',
  system: 'border-l-muted',
};

// ============================================================================
// Helper Functions (辅助函数)
// ============================================================================

/**
 * 获取任务状态配置
 */
export function getTaskStatus(status: TaskStatus) {
  return {
    label: taskStatusLabels[status],
    colorClass: taskStatusColors[status],
  };
}

/**
 * 获取计划状态配置
 */
export function getPlanStatus(status: PlanStatus) {
  return {
    label: planStatusLabels[status],
    colorClass: planStatusColors[status],
  };
}

/**
 * 获取Worker状态配置
 */
export function getWorkerStatus(status: WorkerStatus) {
  return {
    label: workerStatusLabels[status],
    colorClass: workerStatusColors[status],
  };
}

/**
 * 检查任务是否可以取消
 */
export function canCancelTask(status: TaskStatus): boolean {
  return status === TASK_STATUS.QUEUED || status === TASK_STATUS.RUNNING;
}

/**
 * 检查计划是否可以批准
 */
export function canApprovePlan(status: PlanStatus): boolean {
  return status === PLAN_STATUS.REVIEWING;
}

/**
 * 获取任务状态颜色（用于内联样式）
 * 三色方案：
 * - 蓝色：Agent 处理中（queued/running）
 * - 琥珀色：等待中（pending/reviewing）
 * - 紫色：后处理中（post_processing）
 * - 灰色：已完成/结束（completed/failed/cancelled）
 */
export function getStatusColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    queued: '#7BB3D0',      // 蓝色 - Agent 队列
    running: '#7BB3D0',     // 蓝色 - Agent 执行
    completed: '#8E8E93',   // 灰色 - 已完成
    failed: '#8E8E93',      // 灰色 - 失败
    cancelled: '#8E8E93',   // 灰色 - 已取消
    pending: '#F59E0B',     // 琥珀色 - 等待依赖
    reviewing: '#F59E0B',   // 琥珀色 - 等待人工检视
    post_processing: '#A855F7', // 紫色 - 后处理中
  };
  return colors[status] || '#8E8E93';
}

/**
 * 获取任务状态背景颜色（用于内联样式）
 */
export function getStatusBgColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    queued: 'rgba(123, 179, 208, 0.12)',    // 蓝色
    running: 'rgba(123, 179, 208, 0.12)',   // 蓝色
    completed: 'rgba(142, 142, 147, 0.12)', // 灰色
    failed: 'rgba(142, 142, 147, 0.12)',    // 灰色
    cancelled: 'rgba(142, 142, 147, 0.12)', // 灰色
    pending: 'rgba(245, 158, 11, 0.12)',    // 琥珀色
    reviewing: 'rgba(245, 158, 11, 0.12)',  // 琥珀色
    post_processing: 'rgba(168, 85, 247, 0.12)', // 紫色
  };
  return colors[status] || 'rgba(142, 142, 147, 0.12)';
}

// ============================================================================
// Unified Status Helpers (统一状态辅助函数)
// ============================================================================

/**
 * 获取统一状态配置
 */
export function getUnifiedStatus(status: UnifiedStatus) {
  return {
    label: unifiedStatusLabels[status],
    colorClass: unifiedStatusColors[status],
  };
}

/**
 * 计算统一状态（基于任务状态和计划状态）
 */
export function computeUnifiedStatus(
  taskStatus: TaskStatus,
  planStatus?: PlanStatus | null
): UnifiedStatus {
  // 如果有关联的计划状态
  if (planStatus) {
    switch (planStatus) {
      case 'generating':
      case 'running':
        return 'running';
      case 'reviewing':
        return 'reviewing';
      case 'approved':
      case 'queued':
        return 'queued';
      case 'executing':
        return 'running';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
    }
  }

  // 基于任务状态
  switch (taskStatus) {
    case 'queued':
    case 'pending':
      return 'queued';
    case 'running':
      return 'running';
    case 'post_processing':
      return 'post_processing';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'queued';
  }
}

/**
 * 判断是否为"需要人工处理"的状态
 */
export function isHumanTodo(status: UnifiedStatus): boolean {
  return status === 'reviewing';
}

/**
 * 判断是否为"Agent自动处理"的状态
 */
export function isAgentTodo(status: UnifiedStatus): boolean {
  return status === 'queued' || status === 'running';
}

/**
 * 判断是否为"已完成"类状态
 */
export function isDoneStatus(status: UnifiedStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
