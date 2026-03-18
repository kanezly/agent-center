/**
 * Worker and Status API functions
 */

import { apiFetch } from './client';
import type { Worker, Status } from '@/types/worker';

export async function getStatus(): Promise<Status> {
  return apiFetch<Status>('/api/status');
}

export async function getWorkers(): Promise<Worker[]> {
  return apiFetch<Worker[]>('/api/workers');
}
