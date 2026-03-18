/**
 * Progress API functions
 */

import { apiFetch } from './client';

export interface ProgressEntry {
  id: number;
  task_id: number | null;
  project_id: number | null;  // 所属项目 ID
  summary: string;
  lessons: string;
  tags: string;
  created_at: string;
}

export interface ProgressCreateRequest {
  task_id?: number;
  project_id?: number;  // 所属项目 ID
  summary: string;
  lessons?: string;
  tags?: string;
}

export async function getProgressEntries(): Promise<ProgressEntry[]> {
  return apiFetch<ProgressEntry[]>('/api/progress');
}

export async function createProgress(data: ProgressCreateRequest): Promise<{ status: string }> {
  return apiFetch<{ status: string }>('/api/progress', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getProjectExperience(projectId: number, limit?: number): Promise<ProgressEntry[]> {
  const params = new URLSearchParams();
  if (limit) {
    params.set('limit', limit.toString());
  }
  return apiFetch<ProgressEntry[]>(`/api/progress/project/${projectId}?${params.toString()}`);
}
