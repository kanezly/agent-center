/**
 * Worker Types for AgentCenter
 */

export interface Worker {
  id: number;
  status: 'idle' | 'busy';
  task_id: number | null;
  task_prompt: string;
  worktree: string;
}

export interface Status {
  tasks: Record<string, number>;
  max_concurrent: number;
  workers: Worker[];
}
