/**
 * Task API functions
 */

import { apiFetch } from './client';
import type { Task, TaskDetail, TaskCreateRequest, FilterGroup } from '@/types/task';

export async function getTasks(status?: string, filterGroup?: FilterGroup, projectId?: number): Promise<Task[]> {
  let endpoint = '/api/tasks';
  const params = new URLSearchParams();

  if (status) {
    params.set('status', status);
  }
  if (filterGroup) {
    params.set('filter_group', filterGroup);
  }
  if (projectId !== undefined) {
    params.set('project_id', String(projectId));
  }

  const queryString = params.toString();
  if (queryString) {
    endpoint += `?${queryString}`;
  }

  return apiFetch<Task[]>(endpoint);
}

export async function getTask(id: number): Promise<TaskDetail> {
  return apiFetch<TaskDetail>(`/api/tasks/${id}`);
}

export async function createTask(data: TaskCreateRequest): Promise<{ id: number; status: string; type?: string }> {
  return apiFetch<{ id: number; status: string; type?: string }>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function cancelTask(id: number): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/api/tasks/${id}/cancel`, {
    method: 'POST',
  });
}

export async function deleteTask(id: number): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/api/tasks/${id}`, {
    method: 'DELETE',
  });
}

export async function createVoiceTask(data: TaskCreateRequest): Promise<{ id: number; status: string }> {
  return apiFetch<{ id: number; status: string }>('/api/tasks/voice', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Approve a task (reviewing → completed)
 */
export async function approveTask(taskId: number): Promise<{ status: string; task_id: number }> {
  return apiFetch<{ status: string; task_id: number }>(`/api/tasks/${taskId}/approve`, {
    method: 'POST',
  });
}

/**
 * Continue a task with new prompt (reviewing → running)
 */
export async function continueTask(taskId: number, prompt: string): Promise<{ status: string; task_id: number }> {
  return apiFetch<{ status: string; task_id: number }>(`/api/tasks/${taskId}/continue`, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

/**
 * Get task dependencies
 */
export async function getDependencies(taskId: number): Promise<{
  task_id: number;
  depends_on: number[];
  dependent_tasks: number[];
}> {
  return apiFetch<{
    task_id: number;
    depends_on: number[];
    dependent_tasks: number[];
  }>(`/api/tasks/${taskId}/dependencies`);
}

/**
 * Retry a failed task
 */
export async function retryTask(taskId: number): Promise<{ status: string; task_id: number }> {
  return apiFetch<{ status: string; task_id: number }>(`/api/tasks/${taskId}/retry`, {
    method: 'POST',
  });
}

/**
 * Submit answers for plan mode decision questions
 */
export async function submitAnswers(taskId: number, answers: Record<number, string[]>): Promise<{ task_id: number; round: number; status: string }> {
  return apiFetch<{ task_id: number; round: number; status: string }>(`/api/tasks/${taskId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}
