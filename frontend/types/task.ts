/**
 * Task Types for AgentCenter
 */

import type { PlanStatus } from './plan';

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'pending' | 'reviewing' | 'post_processing';
export type TaskMode = 'execute' | 'plan';

// 统一状态 - 用于合并后的任务/计划列表
export type UnifiedStatus = 'queued' | 'running' | 'reviewing' | 'post_processing' | 'completed' | 'failed' | 'cancelled';

// 筛选分组
export type FilterGroup = 'all' | 'todo-agent' | 'todo-human' | 'done';

/**
 * 计划模式决策问题
 */
export interface PlanQuestion {
  id: number;
  task_id: number;
  question: string;
  header: string;
  options: string[];
  user_answer?: string[];
  status: 'pending' | 'answered' | 'submitted';
}

export interface Task {
  id: number;
  prompt: string;
  prompt_short?: string;  // 别名，指向 initial_prompt（第一条指令）
  initial_prompt?: string;  // 第一条指令（后端返回）
  status: TaskStatus;
  mode: TaskMode;
  priority: number;
  worktree_id: number | null;
  cwd: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  result_text: string | null;
  cost_usd: number;
  session_id?: string;  // Claude session ID（用于 --resume）
  fork_from_task_id?: number | null;  // Fork 的前序任务 ID
  plan_status?: PlanStatus;
  plan_goal?: string;
  unified_status?: UnifiedStatus;
  project_id?: number | null;  // 所属项目 ID
  project_name?: string;       // 项目名称（通过 JOIN 获取）
  project_path?: string;       // 项目路径（通过 JOIN 获取）
  round_number?: number;       // 当前对话轮次
  is_isolated?: boolean;       // 新增：是否进行任务隔离
  auto_approve?: boolean;      // 新增：自动批准（跳过 reviewing）
}

export interface TaskConversation {
  id: number;
  task_id: number;
  round_number: number;
  user_prompt: string;
  session_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  cost_usd: number;
  result_text: string | null;
  metadata_parsed?: {
    type: 'plan_answer';
    questions: Array<{
      header: string;
      question: string;
      answer: string[];
    }>;
  };
}

export interface TaskDetail extends Task {
  conversations: TaskConversation[];  // 对话历史
  logs: TaskLog[];                     // 原始日志（用于调试）
  questions: PlanQuestion[];           // 决策问题（Plan mode）
}

export interface TaskLog {
  id: number;
  event_type: 'assistant' | 'tool_use' | 'tool_result' | 'result' | 'error' | 'system' | 'user_continue';
  payload: string;
  ts: string;
}

export interface TaskCreateRequest {
  prompt: string;
  priority?: number;
  mode?: TaskMode;
  cwd?: string;
  project_id?: number | null;  // 所属项目 ID
  depends_on_task_ids?: number[];  // 依赖的任务 ID 列表
  fork_from_task_id?: number | null;  // Fork 的前序任务 ID
  is_isolated?: boolean;  // 新增：是否进行任务隔离
  auto_approve?: boolean; // 新增：自动批准（跳过 reviewing）
}
