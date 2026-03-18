/**
 * Plan Types - Interactive Plan Mode with AskUserQuestion
 */

import type { PlanQuestion, TaskConversation, TaskLog } from './task';

export type PlanStatus = 'generating' | 'reviewing' | 'approved' | 'executing' | 'completed' | 'failed' | 'running' | 'queued';

export interface PlanQuestionOption {
  key?: string;
  label: string;
  description?: string;
}

// PlanQuestion is now imported from './task' to avoid duplicate exports

export interface PlanStep {
  title: string;
  description: string;
  prompt: string;
}

/**
 * Plan task response from GET /api/tasks/{task_id}
 */
export interface PlanTask {
  id: number;
  prompt: string;
  status: string;
  mode: 'execute' | 'plan';
  plan_status: PlanStatus;
  result_text: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  cost_usd: number;
  parent_task_id?: number;
  round_number: number;
  questions: PlanQuestion[];
  conversations?: TaskConversation[];
  logs?: TaskLog[];
}

export interface PlanCreateRequest {
  goal: string;
}

export interface PlanMarkdownResponse {
  markdown: string;
}

export interface AnswerQuestionsRequest {
  answers: Record<number, string[]>;  // question_id -> list of selected option labels
}

export interface AnswerQuestionsResponse {
  task_id: number;
  round: number;
  status: string;
}

export interface ApprovePlanResponse {
  status: string;
  task_id: number;
}

/**
 * PlanAnswerMetadata - 计划模式答案的元数据结构
 */
export interface PlanAnswerMetadata {
  type: 'plan_answer';
  questions: Array<{
    header: string;
    question: string;
    answer: string[];
  }>;
}
