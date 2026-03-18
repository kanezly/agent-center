/**
 * Inbox API functions
 */

import { apiFetch } from './client';
import type { Inbox, InboxCreateRequest, InboxConvertRequest } from '@/types/inbox';

export async function getInboxItems(projectId?: number): Promise<Inbox[]> {
  let endpoint = '/api/inbox';
  if (projectId) {
    endpoint += `?project_id=${projectId}`;
  }
  return apiFetch<Inbox[]>(endpoint);
}

export async function getInboxItem(id: number): Promise<Inbox> {
  return apiFetch<Inbox>(`/api/inbox/${id}`);
}

export async function createInboxItem(data: InboxCreateRequest): Promise<{ id: number }> {
  return apiFetch<{ id: number }>('/api/inbox', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function convertInboxToTask(id: number, data: InboxConvertRequest): Promise<{ task_id: number }> {
  return apiFetch<{ task_id: number }>(`/api/inbox/${id}/convert`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteInboxItem(id: number): Promise<{ deleted: boolean; id: number }> {
  return apiFetch<{ deleted: boolean; id: number }>(`/api/inbox/${id}`, {
    method: 'DELETE',
  });
}

export async function getInboxUnreadCount(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>('/api/inbox/count/unread');
}
