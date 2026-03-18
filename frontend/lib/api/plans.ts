/**
 * Plan API functions - Interactive Plan Mode
 */

import { apiFetch } from './client';
import type {
  PlanTask,
  PlanMarkdownResponse,
  AnswerQuestionsRequest,
  AnswerQuestionsResponse,
  ApprovePlanResponse,
} from '@/types/plan';

/**
 * List all plan tasks (mode='plan')
 */
export async function getPlans(): Promise<PlanTask[]> {
  return apiFetch<PlanTask[]>('/api/plans');
}

/**
 * Get plan task detail with questions
 */
export async function getPlan(id: number): Promise<PlanTask> {
  return apiFetch<PlanTask>(`/api/tasks/${id}`);
}

/**
 * Submit answers to decision questions
 * Creates a new Plan Refine task for the next round
 */
export async function answerQuestions(
  taskId: number,
  answers: Record<number, string[]>
): Promise<AnswerQuestionsResponse> {
  return apiFetch<AnswerQuestionsResponse>(`/api/tasks/${taskId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}

/**
 * Approve plan and convert to execution task
 */
export async function approvePlan(taskId: number): Promise<ApprovePlanResponse> {
  return apiFetch<ApprovePlanResponse>(`/api/tasks/${taskId}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * Continue a plan task with new prompt (adjust plan)
 */
export async function continueTask(
  taskId: number,
  prompt: string
): Promise<{ status: string; task_id: number }> {
  return apiFetch<{ status: string; task_id: number }>(`/api/tasks/${taskId}/continue`, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}
