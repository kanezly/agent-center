/**
 * Task Input Component
 * 任务输入组件 - 优雅的输入界面，支持任务、计划模式和 Inbox 暂存
 */

'use client';

import { useState, KeyboardEvent, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProject } from '@/lib/api/projects';
import { getTasks } from '@/lib/api/tasks';
import { createInboxItem } from '@/lib/api/inbox';
import type { TaskMode } from '@/types/task';
import { TaskConfigBar } from './TaskConfigBar';
import { useManagerStore } from '@/lib/state/atoms';

interface TaskInputProps {
  onAdd: (prompt: string, mode: TaskMode, dependsOnTaskIds?: number[], projectId?: number | null, forkFromTaskId?: number | null, isIsolated?: boolean, autoApprove?: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
  inboxConvertData?: {
    id: number;
    prompt: string;
    projectId?: number | null;
    mode: 'execute' | 'plan';
    isIsolated?: boolean;
    autoApprove?: boolean;
    dependsOnTaskIds?: number[];
    forkFromTaskId?: number | null;
    onCancel: () => void;
  };
}

export function TaskInput({
  onAdd,
  placeholder,
  disabled = false,
  inboxConvertData,
}: TaskInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [taskMode, setTaskMode] = useState<'execute' | 'plan'>('execute');
  const [dependsOnTaskIds, setDependsOnTaskIds] = useState<number[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [forkFromTaskId, setForkFromTaskId] = useState<number | null>(null);
  const [isIsolated, setIsIsolated] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [mounted, setMounted] = useState(false);
  const prevProjectIdRef = useRef<number | null>(null);

  const queryClient = useQueryClient();
  const addToast = useManagerStore((state) => state.addToast);

  // 获取任务数据用于 TaskConfigBar 显示
  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => getTasks(),
    staleTime: 30000,
  });

  // 当 inboxConvertData 存在时，自动填充
  useEffect(() => {
    if (inboxConvertData) {
      setValue(inboxConvertData.prompt);
      setTaskMode(inboxConvertData.mode === 'plan' ? 'plan' : 'execute');
      setIsIsolated(inboxConvertData.isIsolated ?? false);
      setAutoApprove(inboxConvertData.autoApprove ?? false);
      if (inboxConvertData.projectId !== undefined && inboxConvertData.projectId !== null) {
        setSelectedProjectId(inboxConvertData.projectId);
      }
      if (inboxConvertData.dependsOnTaskIds) {
        setDependsOnTaskIds(inboxConvertData.dependsOnTaskIds);
      }
      if (inboxConvertData.forkFromTaskId !== undefined) {
        setForkFromTaskId(inboxConvertData.forkFromTaskId);
      }
    } else {
      setValue('');
      setDependsOnTaskIds([]);
      setForkFromTaskId(null);
    }
  }, [inboxConvertData]);

  // 创建 Inbox 记录
  const createInboxMutation = useMutation({
    mutationFn: createInboxItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboxCount'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      addToast({ type: 'success', message: t('ui:taskInput.toastInboxAdded', '已添加到待办清单') });
    },
  });

  // 获取当前选中项目的信息（用于判断是否为 Git 项目）
  const { data: selectedProject } = useQuery({
    queryKey: ['project', selectedProjectId],
    queryFn: () => selectedProjectId ? getProject(selectedProjectId) : null,
    enabled: selectedProjectId !== null,
    staleTime: Infinity,
  });

  // 检查项目是否为 Git 仓库
  const isGitProject = selectedProject?.is_git ?? false;

  // 当项目改变时，如果不是 Git 项目，重置 isIsolated 为 false
  useEffect(() => {
    const prevProjectId = prevProjectIdRef.current;
    if (prevProjectId !== selectedProjectId) {
      // 项目改变，检查新选中的项目是否为 Git 项目
      if (selectedProjectId !== null && selectedProject) {
        if (!selectedProject.is_git && isIsolated) {
          setIsIsolated(false);
        }
      }
      prevProjectIdRef.current = selectedProjectId;
    }
  }, [selectedProjectId, selectedProject, isIsolated]);

  // 当 fork 任务改变时，自动关联项目（用户未选择项目时）
  useEffect(() => {
    if (forkFromTaskId && selectedProjectId === null) {
      const task = tasks?.find(t => t.id === forkFromTaskId);
      if (task?.project_id) {
        setSelectedProjectId(task.project_id);
      }
    }
  }, [forkFromTaskId, selectedProjectId, tasks, setSelectedProjectId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      onAdd(trimmed, taskMode, dependsOnTaskIds.length > 0 ? dependsOnTaskIds : undefined, selectedProjectId, forkFromTaskId, isIsolated, autoApprove);
      setValue('');
      setDependsOnTaskIds([]);
      setForkFromTaskId(null);
      // 保持 isIsolated 和 autoApprove 状态，让用户可以连续创建
    }
  };

  const handleSaveToInbox = () => {
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      createInboxMutation.mutate({
        prompt: trimmed,
        project_id: selectedProjectId,
        mode: taskMode,
        depends_on_task_ids: dependsOnTaskIds.length > 0 ? dependsOnTaskIds : undefined,
        fork_from_task_id: forkFromTaskId,
        is_isolated: isIsolated,
        auto_approve: autoApprove,
      });
      setValue('');
      setDependsOnTaskIds([]);
      setForkFromTaskId(null);
      setAutoApprove(false); // Inbox 暂存时重置 auto_approve
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-primary)',
        border: inboxConvertData
          ? '2px solid #007AFF'
          : '1px solid var(--border-subtle)',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: inboxConvertData
          ? '0 4px 16px rgba(0, 122, 255, 0.15)'
          : 'var(--shadow-ios-sm)',
        transition: 'all var(--transition-base)',
      }}
      className="mobile-task-input"
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = inboxConvertData
          ? '0 4px 16px rgba(0, 122, 255, 0.15)'
          : 'var(--shadow-ios-md)';
        e.currentTarget.style.borderColor = inboxConvertData
          ? '#007AFF'
          : 'var(--border-visible)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = inboxConvertData
          ? '0 4px 16px rgba(0, 122, 255, 0.15)'
          : 'var(--shadow-ios-sm)';
        e.currentTarget.style.borderColor = inboxConvertData
          ? '#007AFF'
          : 'var(--border-subtle)';
      }}
    >
      {/* Inbox 转换提示 - 仅在转换模式下显示 */}
      {inboxConvertData && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          marginBottom: '12px',
          backgroundColor: 'rgba(0, 122, 255, 0.06)',
          borderRadius: '12px',
          border: '1px solid rgba(0, 122, 255, 0.15)',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            backgroundColor: 'rgba(0, 122, 255, 0.1)',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#007AFF',
            border: '1px solid rgba(0, 122, 255, 0.2)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M4 6h16a1 1 0 011 1v2.5a1.5 1.5 0 01-1 1.414l-7.5 2.25a2 2 0 01-1 0L4 10.914A1.5 1.5 0 013 9.5V7a1 1 0 011-1z"/>
              <path d="M4 13v4a2 2 0 002 2h12a2 2 0 002-2v-4"/>
            </svg>
            <span style={{ whiteSpace: 'nowrap' }}>{t('ui:taskInput.executingInbox', '正在执行待办任务')}</span>
          </div>
          <button
            onClick={inboxConvertData.onCancel}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-error)',
              backgroundColor: 'rgba(229, 115, 115, 0.12)',
              border: '1px solid rgba(229, 115, 115, 0.25)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
              marginLeft: '12px',
              minHeight: '36px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(229, 115, 115, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(229, 115, 115, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(229, 115, 115, 0.12)';
              e.currentTarget.style.borderColor = 'rgba(229, 115, 115, 0.25)';
            }}
          >
            {t('ui:taskInput.cancel', '取消')}
          </button>
        </div>
      )}

      {/* 任务配置栏 - 移动端垂直堆叠，桌面端水平排列 */}
      <div style={{ marginBottom: '8px' }}>
        <TaskConfigBar
          projectId={selectedProjectId}
          onProjectChange={setSelectedProjectId}
          dependsOnTaskIds={dependsOnTaskIds}
          onDependsChange={setDependsOnTaskIds}
          forkFromTaskId={forkFromTaskId}
          onForkFromChange={setForkFromTaskId}
          isIsolated={isIsolated}
          onIsolatedChange={setIsIsolated}
          isGitProject={isGitProject}
          autoApprove={autoApprove}
          onAutoApproveChange={setAutoApprove}
          taskMode={taskMode}
          onTaskModeChange={setTaskMode}
        />
      </div>

      {/* 分隔线 */}
      <div style={{
        height: '1px',
        backgroundColor: 'var(--border-subtle)',
        margin: '0 0 8px 0',
      }} />

      {/* 输入区域 - 移动端加大输入框视觉比重 */}
      <div style={{ marginBottom: '12px' }}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            mounted && taskMode === 'plan'
              ? t('ui:taskInput.placeholderPlan', '描述目标，生成详细计划后再执行')
              : (placeholder || t('ui:taskInput.placeholderExecute', '描述目标，执行任务'))
          }
          disabled={disabled}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '16px',
            fontWeight: 500,
            color: '#2D2926',
            padding: '12px 0',
            minHeight: '28px',
            lineHeight: '1.5',
          }}
          className="mobile-input-enhanced placeholder:text-text-muted disabled:opacity-50"
        />
      </div>

      {/* 按钮区域 - 移动端垂直排列，桌面端水平排列 */}
      <div className="mobile-button-stack" style={{ display: 'flex', gap: '10px' }}>
        {!inboxConvertData && (
          <button
            onClick={handleSaveToInbox}
            disabled={!value.trim() || disabled || createInboxMutation.isPending}
            className="mobile-action-button"
            style={{
              flex: '1 1 auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 16px',
              height: '40px',
              borderRadius: '10px',
              border: '1px solid var(--border-visible)',
              cursor: value.trim() && !disabled ? 'pointer' : 'not-allowed',
              transition: 'var(--transition-fast)',
              opacity: value.trim() && !disabled ? 1 : 0.5,
              background: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              minWidth: '120px',
            }}
            title={t('ui:taskInput.stash', '暂存到待办清单')}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
              e.currentTarget.style.borderColor = 'var(--border-visible)';
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: '6px' }}
            >
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <path d="M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {t('ui:taskInput.stash', '暂存')}
          </button>
        )}

        <button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled || createInboxMutation.isPending}
          className="mobile-action-button"
          style={{
            flex: '1 1 auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 20px',
            height: '40px',
            borderRadius: '10px',
            border: 'none',
            cursor: value.trim() && !disabled ? 'pointer' : 'not-allowed',
            transition: 'var(--transition-fast)',
            opacity: value.trim() && !disabled ? 1 : 0.5,
            background: inboxConvertData ? '#007AFF' : 'var(--bg-dark)',
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: value.trim() && !disabled
              ? 'var(--shadow-ios-md)'
              : 'none',
            minWidth: '140px',
          }}
          title={inboxConvertData ? t('ui:taskInput.execute', '执行') : (taskMode === 'plan' ? t('ui:taskInput.placeholderPlan', '描述目标，生成详细计划后再执行') : t('ui:taskInput.executeTask', '执行任务'))}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.backgroundColor = inboxConvertData ? '#0063D1' : '#4A4543';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = inboxConvertData ? '#007AFF' : 'var(--bg-dark)';
          }}
        >
          {inboxConvertData ? (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: '6px' }}
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              {t('ui:taskInput.execute', '执行')}
            </>
          ) : (
            <>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: '6px' }}
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t('ui:taskInput.executeTask', '执行任务')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
