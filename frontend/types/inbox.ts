/**
 * Inbox Types for AgentCenter
 */

export interface Inbox {
  id: number;
  prompt: string;
  project_id: number | null;
  project_name?: string;
  mode?: 'execute' | 'plan';
  status: 'pending' | 'converted' | 'archived';
  related_task_id: number | null;
  depends_on_task_ids?: number[];
  fork_from_task_id?: number | null;
  is_isolated?: boolean;
  auto_approve?: boolean;
  created_at: string;
  converted_at: string | null;
}

export interface InboxCreateRequest {
  prompt: string;
  project_id?: number | null;
  mode?: 'execute' | 'plan';
  depends_on_task_ids?: number[];
  fork_from_task_id?: number | null;
  is_isolated?: boolean;
  auto_approve?: boolean;
}

export interface InboxConvertRequest {
  prompt?: string;
  mode?: 'execute' | 'plan';
  is_isolated?: boolean;
  auto_approve?: boolean;
  project_id?: number | null;
  depends_on_task_ids?: number[];
  fork_from_task_id?: number | null;
}
