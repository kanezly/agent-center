/**
 * Project API functions
 */

import { apiFetch } from './client';
import type { Project, ProjectCreateRequest, ProjectUpdateRequest } from '@/types/project';

export async function getProjects(): Promise<Project[]> {
  return apiFetch<Project[]>('/api/projects');
}

export async function getProject(id: number): Promise<Project> {
  return apiFetch<Project>(`/api/projects/${id}`);
}

export async function createProject(data: ProjectCreateRequest): Promise<{ id: number; project: Project }> {
  return apiFetch<{ id: number; project: Project }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProject(id: number, data: ProjectUpdateRequest): Promise<Project> {
  return apiFetch<Project>(`/api/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: number): Promise<{ deleted: boolean; id: number }> {
  return apiFetch<{ deleted: boolean; id: number }>(`/api/projects/${id}`, {
    method: 'DELETE',
  });
}

export async function refreshProjectBranch(id: number): Promise<Project> {
  return apiFetch<Project>(`/api/projects/${id}/refresh`, {
    method: 'POST',
  });
}
