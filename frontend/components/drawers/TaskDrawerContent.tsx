/**
 * TaskDrawerContent Component
 * 任务详情内容 - 共享组件，用于 Modal 和 BottomSheet
 *
 * Layout:
 * - Header: 任务 ID + 状态徽章 + 元数据行 + 操作按钮
 * - Conversation History: 对话历史气泡
 * - Description Card: 当前任务描述
 * - Result Card: 当前执行结果
 * - Logs Section: 执行过程日志
 */

'use client';

import { useRef, useState, ReactNode, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { UseMutationResult } from '@tanstack/react-query';
import { TaskBadge, Button, DecisionCard } from '@/components/ui';
import { ConversationHistory } from './ConversationHistory';
import { DependencySection } from '@/components/ui/DependencySection';
import { canCancelTask, getStatusColor, getStatusBgColor } from '@/lib/constants/status';
import { useManagerStore } from '@/lib/state/atoms';
import type { TaskDetail, TaskLog } from '@/types/task';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { formatTime } from '@/lib/utils/time';

import 'highlight.js/styles/github.css';

// ============================================================================
// Types
// ============================================================================

export interface TaskDrawerContentProps {
  task: TaskDetail;
  logs: TaskLog[];
  wsConnected: boolean;
  cancelMutation: UseMutationResult<{ status: string }, Error, void, unknown>;
  approveMutation?: UseMutationResult<{ status: string; task_id: number }, Error, void, unknown>;
  continueMutation?: UseMutationResult<{ status: string; task_id: number }, Error, { prompt: string }, unknown>;
  retryMutation?: UseMutationResult<{ status: string; task_id: number }, Error, void, unknown>;
  isDesktop?: boolean;
  // Plan mode 专用
  answers?: Record<number, string[]>;
  setAnswers?: React.Dispatch<React.SetStateAction<Record<number, string[]>>>;
  answerMutation?: UseMutationResult<any, Error, Record<number, string[]>, unknown>;
}

// ============================================================================
// Main Component
// ============================================================================

export function TaskDrawerContent({
  task,
  logs,
  wsConnected,
  cancelMutation,
  approveMutation,
  continueMutation,
  retryMutation,
  isDesktop = false,
  answers = {},
  setAnswers = () => {},
  answerMutation,
}: TaskDrawerContentProps) {
  const { t } = useTranslation();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [continuePrompt, setContinuePrompt] = useState('');
  const [showContinueInput, setShowContinueInput] = useState(false);
  const [showPlanAdjustInput, setShowPlanAdjustInput] = useState(false);  // 计划模式：是否显示调整输入框
  const [showLogs, setShowLogs] = useState(false);
  const addToast = useManagerStore((state) => state.addToast);

  // 任务运行时默认展开日志区域
  useEffect(() => {
    setShowLogs(task.status === 'running' || task.status === 'queued');
  }, [task.status]);

  // 新日志到来时自动滚动到底部
  useEffect(() => {
    if (showLogs && logsEndRef.current && logs.length > 0) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length, showLogs]);

  const canCancel = canCancelTask(task.status);
  const isReviewing = task.status === 'reviewing';
  const isPostProcessing = task.status === 'post_processing';
  const isFailed = task.status === 'failed';
  const statusColor = getStatusColor(task.status);
  const statusBgColor = getStatusBgColor(task.status);

  // 从 task 中获取 questions（Plan mode）
  const questions = (task as any).questions || [];
  const hasQuestions = questions.length > 0;
  const planStatus = (task as any).plan_status;

  // 修正 isPlanMode 判断：只检查 mode
  const isPlanMode = task.mode === 'plan';

  // 添加 plan_status 派生状态
  // 注意：任务已取消/失败/完成时，不显示生成中/审核中等状态
  const isCancelled = task.status === 'cancelled';
  const isCompleted = task.status === 'completed';
  const isTerminalState = isCancelled || isFailed || isCompleted;

  const planGenerating = planStatus === 'generating' && !isTerminalState;
  const planReviewing = planStatus === 'reviewing' && !isTerminalState;
  const planApproved = planStatus === 'approved' && !isTerminalState;
  const planExecuting = planStatus === 'executing' && !isTerminalState;

  // 计算未回答的问题数量
  const unansweredQuestions = questions.filter((q: any) => !q.user_answer || q.user_answer.length === 0);
  const hasUnansweredQuestions = unansweredQuestions.length > 0;
  const answeredCount = questions.length - unansweredQuestions.length;
  const allQuestionsAnswered = hasQuestions && !hasUnansweredQuestions;

  // 获取对话历史
  const conversations: TaskDetail['conversations'] = task.conversations || [];

  // 处理依赖任务点击 - 跳转到对应任务详情
  const router = useRouter();
  const handleDependencyTaskClick = useCallback((clickedTaskId: number) => {
    // 更新 URL 参数切换到新任务，用户可通过浏览器后退按钮返回
    const newUrl = `/?view=tasks&drawer=task-${clickedTaskId}`;
    router.replace(newUrl, { scroll: false });
  }, [router]);

  // 复制 Session ID
  const copySessionId = async (sessionId: string) => {
    try {
      await navigator.clipboard.writeText(sessionId);
      addToast({
        type: 'success',
        message: t('ui:toast.sessionIdCopied', 'Session ID 已复制到剪贴板'),
      });
    } catch (err) {
      addToast({
        type: 'error',
        message: t('ui:toast.copyFailed', '复制失败，请手动复制'),
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header Section */}
      <div
        style={{
          padding: isDesktop ? '24px 56px 16px 24px' : '20px 20px 12px',
          borderBottom: '1px solid rgba(45, 41, 38, 0.06)',
        }}
      >
        {/* Row 1: Task prompt + Status + Real-time indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'nowrap' }}>
          <span
            style={{
              fontSize: isDesktop ? '20px' : '18px',
              fontWeight: 700,
              color: '#2D2926',
              letterSpacing: '-0.3px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: '1 1 auto',
              minWidth: 0,
            }}
            title={task.initial_prompt || task.prompt_short || task.prompt}
          >
            {task.initial_prompt || task.prompt_short || task.prompt}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <TaskBadge status={task.status} />
            {task.mode === 'plan' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: '24px',
                  padding: '0 10px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#5C5651',
                  backgroundColor: 'rgba(45, 41, 38, 0.08)',
                  borderRadius: '12px',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('ui:common.planTag', '计划')}
              </span>
            )}
          </div>
          {/* Real-time indicator */}
          {wsConnected && task.status === 'running' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#7CB882',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  backgroundColor: '#7CB882',
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite',
                }}
              />
              {t('ui:status.realtime', '实时')}
            </span>
          )}
        </div>

        {/* Row 2: Prompt subtitle - 已移除，任务描述现在显示在 Row 4 */}

        {/* Row 3: Meta info - 已移除，不再显示统计信息 */}

        {/* Row 4: Task Description - 只在没有对话历史时显示 */}
        {conversations.length === 0 && (task.prompt_short || task.prompt || task.plan_goal) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              padding: '8px 12px',
              marginTop: '12px',
              backgroundColor: '#F9F6F1',
              borderRadius: '8px',
              border: '1px solid rgba(45, 41, 38, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', overflow: 'hidden' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#8B837B',
                  flexShrink: 0,
                }}
              >
                {isPlanMode ? t('ui:labels.planGoal', '计划目标：') : t('ui:labels.taskDescription', '任务描述：')}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color: '#5C5651',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: isDesktop ? '500px' : '300px',
                }}
                title={task.plan_goal || task.prompt_short || task.prompt}
              >
                {task.plan_goal || task.prompt_short || task.prompt}
              </span>
            </div>
          </div>
        )}

        {/* Row 5: Session ID (如果有) */}
        {task.session_id && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              marginTop: '12px',
              backgroundColor: '#F9F6F1',
              borderRadius: '8px',
              border: '1px solid rgba(45, 41, 38, 0.08)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#8B837B',
                }}
              >
                {t('ui:labels.sessionId', 'Session ID')}：
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color: '#5C5651',
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: isDesktop ? '400px' : '200px',
                }}
                title={task.session_id}
              >
                {task.session_id}
              </span>
            </div>
            <button
              onClick={() => copySessionId(task.session_id!)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 500,
                color: '#7BB3D0',
                backgroundColor: 'rgba(123, 179, 208, 0.08)',
                border: '1px solid rgba(123, 179, 208, 0.2)',
                borderRadius: '6px',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 150ms ease-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(123, 179, 208, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(123, 179, 208, 0.08)';
              }}
            >
              {t('ui:actions.copy', '复制')}
            </button>
          </div>
        )}

        {/* Row 6: 项目信息 */}
        {(task.project_name || task.project_path) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              marginTop: '12px',
              backgroundColor: '#F9F6F1',
              borderRadius: '8px',
              border: '1px solid rgba(45, 41, 38, 0.08)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                overflow: 'hidden',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: '#8B837B', flexShrink: 0 }}
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span
                style={{
                  fontSize: '12px',
                  color: '#5C5651',
                  fontWeight: 500,
                }}
                title={task.project_path ? `${task.project_name}: ${task.project_path}` : task.project_name}
              >
                {task.project_name}{task.project_path && <span style={{ color: '#8B837B', marginLeft: '4px' }}>{task.project_path}</span>}
              </span>
            </div>
          </div>
        )}

        {/* Row 7: Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>

          {/* Reviewing actions - 仅非计划模式显示 */}
          {isReviewing && !isPlanMode && (
            <>
              {approveMutation && (
                <button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending || isPostProcessing}
                  style={{
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#7BB3D0',
                    backgroundColor: 'rgba(123, 179, 208, 0.08)',
                    border: '1px solid rgba(123, 179, 208, 0.2)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 150ms ease-out',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(123, 179, 208, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(123, 179, 208, 0.08)';
                  }}
                >
                  {approveMutation.isPending ? t('ui:messages.processing', '处理中...') : t('ui:actions.approve', '✅ 完成')}
                </button>
              )}
              {continueMutation && (
                <button
                  onClick={() => setShowContinueInput(!showContinueInput)}
                  disabled={continueMutation.isPending}
                  style={{
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#7BB3D0',
                    backgroundColor: 'rgba(123, 179, 208, 0.08)',
                    border: '1px solid rgba(123, 179, 208, 0.2)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 150ms ease-out',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(123, 179, 208, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(123, 179, 208, 0.08)';
                  }}
                >
                  {t('ui:actions.addInstruction', '➕ 追加指令')}
                </button>
              )}
            </>
          )}

          {/* Retry button - for failed tasks */}
          {isFailed && retryMutation && (
            <button
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#7BB3D0',
                backgroundColor: 'rgba(123, 179, 208, 0.08)',
                border: '1px solid rgba(123, 179, 208, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 150ms ease-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(123, 179, 208, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(123, 179, 208, 0.08)';
              }}
            >
              {t('ui:actions.retry', '🔄 重试')}
            </button>
          )}

          {/* Cancel button */}
          {canCancel && (
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#E57373',
                backgroundColor: 'rgba(229, 115, 115, 0.08)',
                border: '1px solid rgba(229, 115, 115, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 150ms ease-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(229, 115, 115, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(229, 115, 115, 0.08)';
              }}
            >
              {cancelMutation.isPending ? t('ui:messages.cancelling', '取消中...') : t('ui:actions.cancelTask', '取消任务')}
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Dependency Section - 显示前序依赖和后置依赖 */}
        <DependencySection taskId={task.id} onTaskClick={handleDependencyTaskClick} />

        {/* Conversation History */}
        <ConversationHistory
          conversations={conversations}
          currentPrompt={task.prompt}
          currentRoundNumber={task.round_number}
          currentStatus={task.status}
          isPlanMode={isPlanMode}
        />

        {/* ========== 计划模式专用卡片 ========== */}

        {/* 阶段 1: Claude 正在生成计划 */}
        {isPlanMode && planGenerating && (
          <ContentCard title={t('ui:planStatus.generating', '计划生成中')} accentColor="#7BB3D0" isDesktop={isDesktop}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid #7BB3D0',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              <span style={{ fontSize: '14px', color: '#5C5651' }}>
                {t('ui:planStatus.generatingMessage', 'Claude 正在分析并生成计划...')}
              </span>
            </div>
          </ContentCard>
        )}

        {/* 阶段 2: 等待用户回答决策问题 */}
        {isPlanMode && planReviewing && hasQuestions && (
          <ContentCard
            title={`${t('ui:planStatus.questionsTitle', '需要确认的决策项')} (${unansweredQuestions.length} ${t('ui:planStatus.pendingAnswers', '个待回答')})`}
            accentColor="#7BB3D0"
            isDesktop={isDesktop}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {questions.map((question: any) => (
                <DecisionCard
                  key={question.id}
                  question={question}
                  value={answers[question.id] || []}
                  onChange={(qid: number, val: string[]) => setAnswers({ ...answers, [qid]: val })}
                />
              ))}
            </div>
            {allQuestionsAnswered && answerMutation && (
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => answerMutation.mutate(answers)}
                  disabled={answerMutation.isPending}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#fff',
                    backgroundColor: answerMutation.isPending ? 'rgba(123, 179, 208, 0.5)' : '#7BB3D0',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: answerMutation.isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {answerMutation.isPending ? t('ui:messages.submitting', '提交中...') : t('ui:plan.submitAnswer', '提交答案')} ({answeredCount}/{questions.length})
                </button>
              </div>
            )}
          </ContentCard>
        )}

        {/* 阶段 3: 计划已完善，等待批准执行（仅在 reviewing 状态显示） */}
        {isPlanMode && planApproved && isReviewing && (
          <ContentCard title={t('ui:planStatus.approved', '计划已完善')} accentColor="#7BB3D0" isDesktop={isDesktop}>
            <p style={{ fontSize: '14px', color: '#5C5651', lineHeight: 1.6 }}>
              {t('ui:planStatus.approvedMessage', '计划已生成完毕，没有需要确认的问题。')}
            </p>

            {/* 批准执行按钮 - 主操作 (绿色表示成功/完成) */}
            {approveMutation && (
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#fff',
                    backgroundColor: approveMutation.isPending ? 'rgba(124, 184, 130, 0.5)' : '#7CB882',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: approveMutation.isPending ? 'not-allowed' : 'pointer',
                    transition: 'all 150ms ease-out',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#6CA878';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = approveMutation.isPending ? 'rgba(124, 184, 130, 0.5)' : '#7CB882';
                  }}
                >
                  {approveMutation.isPending ? t('ui:messages.processing', '处理中...') : t('ui:actions.approveExecute', '批准执行')}
                </button>
              </div>
            )}

            {/* 调整计划 - 次要操作，点击展开 (蓝色) */}
            {continueMutation && (
              <div style={{ marginTop: '12px' }}>
                {!showPlanAdjustInput ? (
                  <button
                    onClick={() => setShowPlanAdjustInput(true)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#7BB3D0',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 150ms ease-out',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(123, 179, 208, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {t('ui:planActions.adjustPlan', '需要调整计划？')}
                  </button>
                ) : (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(45, 41, 38, 0.08)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <textarea
                        value={continuePrompt}
                        onChange={(e) => setContinuePrompt(e.target.value)}
                        placeholder={t('ui:planActions.adjustPlanPlaceholder', '输入您想调整的内容，或补充说明您的需求...')}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '12px',
                          fontSize: '14px',
                          color: '#2D2926',
                          backgroundColor: '#F9F6F1',
                          border: '1px solid rgba(45, 41, 38, 0.1)',
                          borderRadius: '8px',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            if (continuePrompt.trim()) {
                              continueMutation.mutate({ prompt: continuePrompt.trim() });
                              setContinuePrompt('');
                            }
                          }}
                          disabled={continueMutation.isPending || !continuePrompt.trim()}
                          style={{
                            padding: '8px 16px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#fff',
                            backgroundColor: continueMutation.isPending || !continuePrompt.trim()
                              ? 'rgba(123, 179, 208, 0.5)'
                              : '#7BB3D0',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: continueMutation.isPending || !continuePrompt.trim() ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {continueMutation.isPending ? t('ui:messages.sending', '执行中...') : t('ui:actions.send', '发送')}
                        </button>
                        <button
                          onClick={() => {
                            setShowPlanAdjustInput(false);
                            setContinuePrompt('');
                          }}
                          style={{
                            padding: '8px 16px',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#5C5651',
                            backgroundColor: 'rgba(45, 41, 38, 0.08)',
                            border: '1px solid rgba(45, 41, 38, 0.15)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                          }}
                        >
                          {t('ui:actions.cancel', '取消')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ContentCard>
        )}

        {/* 阶段 4: 计划执行中 */}
        {isPlanMode && planExecuting && (
          <ContentCard title={t('ui:planStatus.executing', '计划执行中')} accentColor="#7BB3D0" isDesktop={isDesktop}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid #7BB3D0',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              <span style={{ fontSize: '14px', color: '#5C5651' }}>
                {t('ui:planStatus.executingMessage', '正在根据批准的计划执行...')}
              </span>
            </div>
          </ContentCard>
        )}

        {/* 用户追加指令输入框（普通模式 review 状态专用） */}
        {!isPlanMode && isReviewing && continueMutation && showContinueInput && (
          <ContentCard
            title={t('ui:actions.addInstruction', '追加指令')}
            accentColor="#7BB3D0"
            isDesktop={isDesktop}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <textarea
                value={continuePrompt}
                onChange={(e) => setContinuePrompt(e.target.value)}
                placeholder={t('ui:actions.addInstructionPlaceholder', '输入您想追加的指令...')}
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  color: '#2D2926',
                  backgroundColor: '#F9F6F1',
                  border: '1px solid rgba(45, 41, 38, 0.1)',
                  borderRadius: '8px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    if (continuePrompt.trim()) {
                      continueMutation.mutate({ prompt: continuePrompt.trim() });
                      setContinuePrompt('');
                      setShowContinueInput(false);
                    }
                  }}
                  disabled={continueMutation.isPending || !continuePrompt.trim()}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#fff',
                    backgroundColor: continueMutation.isPending || !continuePrompt.trim()
                      ? 'rgba(123, 179, 208, 0.5)'
                      : '#7BB3D0',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: continueMutation.isPending || !continuePrompt.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {continueMutation.isPending ? t('ui:messages.sending', '执行中...') : t('ui:actions.send', '发送')}
                </button>
                <button
                  onClick={() => {
                    setShowContinueInput(false);
                    setContinuePrompt('');
                  }}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#5C5651',
                    backgroundColor: 'rgba(45, 41, 38, 0.08)',
                    border: '1px solid rgba(45, 41, 38, 0.15)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  {t('ui:actions.cancel', '取消')}
                </button>
              </div>
            </div>
          </ContentCard>
        )}

        {/* 用户提问输入框（计划模式 review 状态专用） */}
        {isPlanMode && planReviewing && isReviewing && continueMutation && (
          <ContentCard
            title={t('ui:planActions.questionAboutPlan', '对计划有疑问？')}
            accentColor="#7BB3D0"
            isDesktop={isDesktop}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <textarea
                value={continuePrompt}
                onChange={(e) => setContinuePrompt(e.target.value)}
                placeholder={t('ui:planActions.questionPlaceholder', '输入您对计划的疑问，或补充说明您的需求...')}
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  color: '#2D2926',
                  backgroundColor: '#F9F6F1',
                  border: '1px solid rgba(45, 41, 38, 0.1)',
                  borderRadius: '8px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    if (continuePrompt.trim()) {
                      continueMutation.mutate({ prompt: continuePrompt.trim() });
                      setContinuePrompt('');
                    }
                  }}
                  disabled={continueMutation.isPending || !continuePrompt.trim()}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#fff',
                    backgroundColor: continueMutation.isPending || !continuePrompt.trim()
                      ? 'rgba(123, 179, 208, 0.5)'
                      : '#7BB3D0',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: continueMutation.isPending || !continuePrompt.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {continueMutation.isPending ? t('ui:messages.sending', '执行中...') : t('ui:actions.send', '发送')}
                </button>
                {continuePrompt && (
                  <button
                    onClick={() => {
                      setContinuePrompt('');
                    }}
                    style={{
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#5C5651',
                      backgroundColor: 'rgba(45, 41, 38, 0.08)',
                      border: '1px solid rgba(45, 41, 38, 0.15)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    {t('ui:actions.cancel', '取消')}
                  </button>
                )}
              </div>
            </div>
          </ContentCard>
        )}

        {/* Logs Section - Collapsible */}
        <ContentCard
          title={t('ui:logs.title', '执行过程日志')}
          isDesktop={isDesktop}
          extra={
            <button
              onClick={() => setShowLogs(!showLogs)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#7BB3D0',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              {showLogs ? t('ui:actions.collapse', '收起') : t('ui:actions.expand', '展开')} ({logs.length})
            </button>
          }
        >
          {showLogs && (
            <div
              style={{
                backgroundColor: '#2D2926',
                borderRadius: '12px',
                padding: '12px',
                maxHeight: isDesktop ? '400px' : '300px',
                overflow: 'auto',
              }}
            >
              {logs.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '80px',
                    color: '#8B837B',
                    fontSize: '13px',
                  }}
                >
                  {t('ui:logs.empty', '暂无日志')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {logs.map((log, index) => (
                    <LogEntry key={log.id || index} log={log} />
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          )}
        </ContentCard>
      </div>

      {/* Animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface ContentCardProps {
  title: string;
  isDesktop: boolean;
  extra?: ReactNode;
  children: ReactNode;
  accentColor?: string; // 左侧装饰条颜色
}

function ContentCard({ title, isDesktop, extra, children, accentColor }: ContentCardProps) {
  return (
    <div style={{ padding: isDesktop ? '0 24px 20px' : '0 16px 16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Left accent bar */}
          <div
            style={{
              width: '4px',
              height: '18px',
              backgroundColor: accentColor || '#7BB3D0',
              borderRadius: '2px',
            }}
          />
          <span
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#2D2926',
              letterSpacing: '-0.2px',
            }}
          >
            {title}
          </span>
        </div>
        {extra}
      </div>
      <div
        style={{
          backgroundColor: '#FDFBFA',
          border: '1px solid rgba(45, 41, 38, 0.05)',
          borderRadius: '14px',
          padding: '16px',
          boxShadow: 'inset 0 1px 2px rgba(45, 41, 38, 0.02)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Log Entry
// ============================================================================

const eventColors: Record<string, string> = {
  assistant: '#7BB3D0',
  tool_use: '#E5A55D',
  tool_result: '#7CB882',
  result: '#5C5651',
  error: '#E57373',
  system: '#8E8E93',
  user_continue: '#D4A574',
};

interface LogEntryProps {
  log: TaskLog;
}

function LogEntry({ log }: LogEntryProps) {
  const [expanded, setExpanded] = useState(false);

  // 提取日志内容
  let content: string;
  try {
    const payload = JSON.parse(log.payload);

    if (log.event_type === 'assistant') {
      // assistant 类型：提取 text 和 thinking 字段
      const parts: string[] = [];
      if (payload.text && typeof payload.text === 'string') {
        parts.push(payload.text);
      }
      if (payload.thinking && typeof payload.thinking === 'string') {
        parts.push(`[思考] ${payload.thinking}`);
      }
      content = parts.join('\n\n') || JSON.stringify(payload, null, 2);
    } else {
      // result/error 类型：显示完整内容
      content = JSON.stringify(payload, null, 2);
    }
  } catch {
    content = log.payload;
  }

  const borderColor = eventColors[log.event_type] || '#8E8E93';

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        borderLeft: `3px solid ${borderColor}`,
        paddingLeft: '10px',
        paddingTop: '8px',
        paddingBottom: '8px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '0 8px 8px 0',
        cursor: 'pointer',
        transition: 'background-color 150ms ease-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '11px',
          marginBottom: '4px',
        }}
      >
        <span style={{ fontWeight: 600, color: borderColor }}>
          {log.event_type.toUpperCase()}
        </span>
        <span style={{ color: '#8B837B' }}>
          {formatTime(log.ts)}
        </span>
      </div>
      <pre
        style={{
          fontSize: '11px',
          color: '#B8ACA3',
          margin: 0,
          fontFamily: 'JetBrains Mono, monospace',
          overflow: 'hidden',
          display: expanded ? 'block' : '-webkit-box',
          WebkitLineClamp: expanded ? undefined : 2,
          WebkitBoxOrient: 'vertical' as const,
          whiteSpace: expanded ? 'pre-wrap' : undefined,
        }}
      >
        {content}
      </pre>
    </div>
  );
}
