/**
 * Advanced Options Modal
 * 高级选项 - 响应式模态框
 *
 * 设计理念:
 * - 响应式布局：桌面端 Modal / 移动端 BottomSheet
 * - 现代化卡片设计
 * - 增强提示系统
 * - 优雅的交互体验
 */

'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { BottomSheet } from './BottomSheet';
import { ModernToggle } from './ModernToggle';
import { InfoIcon } from './Tooltip';
import { useIsDesktop } from '@/lib/hooks/useMediaQuery';
import { useQuery } from '@tanstack/react-query';
import { getTasks } from '@/lib/api/tasks';
import { getStatusColor, getStatusBgColor, taskStatusLabels } from '@/lib/constants/status';
import type { TaskStatus } from '@/types/task';

interface AdvancedOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;

  // 依赖任务相关
  dependsOnTaskIds: number[];
  onDependsOnChange: (taskIds: number[]) => void;

  // 继承上下文相关
  forkFromTaskId: number | null;
  onForkFromChange: (taskId: number | null) => void;

  // 当前项目 ID，用于过滤同项目任务
  currentProjectId?: number | null;

  // 排除的任务 ID（当前任务本身）
  excludedTaskIds?: number[];

  // 任务隔离相关
  isIsolated?: boolean;
  onIsolatedChange?: (checked: boolean) => void;
  isGitProject?: boolean;
}

export function AdvancedOptionsModal({
  isOpen,
  onClose,
  dependsOnTaskIds,
  onDependsOnChange,
  forkFromTaskId,
  onForkFromChange,
  currentProjectId = null,
  excludedTaskIds = [],
  isIsolated = false,
  onIsolatedChange,
  isGitProject = false,
}: AdvancedOptionsModalProps) {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();

  // 展开/收起状态
  const [expandedSection, setExpandedSection] = useState<'depends' | 'fork' | null>(null);

  // 可选状态：未完成 + 待检视（用户可以依赖待检视的任务）
  const nonTerminalStatuses = ['running', 'queued', 'pending', 'reviewing'];

  // 只有已完成的任务才能被 fork（必须有 session_id）
  const forkableStatuses = ['completed'];

  // 获取所有任务
  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => getTasks(),
    staleTime: 0, // 总是认为数据过期，确保实时性
    refetchInterval: 3000, // 每 3 秒轮询一次
  });

  // 过滤可选择的依赖任务（未完成）
  const selectableDependencyTasks = useMemo(() => {
    return tasks?.filter((task) => {
      if (excludedTaskIds.includes(task.id)) return false;
      if (!nonTerminalStatuses.includes(task.status)) return false;
      if (currentProjectId != null) {
        return (task.project_id ?? null) === currentProjectId;
      }
      return true;
    }) || [];
  }, [tasks, currentProjectId, excludedTaskIds]);

  // 过滤可 Fork 的任务（已完成且有 session_id）
  const forkableTasks = useMemo(() => {
    return tasks?.filter((task) => {
      if (excludedTaskIds.includes(task.id)) return false;
      if (!forkableStatuses.includes(task.status)) return false;
      if (!task.session_id) return false;
      if (currentProjectId != null) {
        return (task.project_id ?? null) === currentProjectId;
      }
      return true;
    }) || [];
  }, [tasks, currentProjectId, excludedTaskIds]);

  // 切换依赖任务选择
  const toggleDependencyTask = (taskId: number) => {
    if (dependsOnTaskIds.includes(taskId)) {
      onDependsOnChange(dependsOnTaskIds.filter(id => id !== taskId));
    } else {
      onDependsOnChange([...dependsOnTaskIds, taskId]);
    }
  };

  // 获取任务标题（用于 title 显示）
  const getTaskTitle = (task: NonNullable<typeof tasks>[number]) => {
    return task?.initial_prompt || task?.prompt || '';
  };

  // 渲染依赖任务列表
  const renderDependsTaskList = () => {
    if (selectableDependencyTasks.length === 0) {
      return (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '13px',
          }}
        >
          {t('ui:advancedOptions.noDependentTasks', '没有可依赖的任务')}
        </div>
      );
    }
    return selectableDependencyTasks.map((task) => {
      const isSelected = dependsOnTaskIds.includes(task.id);
      const statusColor = getStatusColor(task.status);
      const statusBgColor = getStatusBgColor(task.status);
      const statusLabel = taskStatusLabels[task.status];

      return (
        <button
          key={task.id}
          type="button"
          onClick={() => toggleDependencyTask(task.id)}
          title={getTaskTitle(task)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            padding: '12px 16px',
            backgroundColor: isSelected ? 'var(--bg-secondary)' : 'transparent',
            border: 'none',
            borderBottom: isSelected ? 'none' : '1px solid var(--border-subtle)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 150ms ease',
            borderBottomLeftRadius: isSelected ? '0' : '0',
            borderBottomRightRadius: isSelected ? '0' : '0',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isSelected
              ? 'var(--bg-tertiary)'
              : 'var(--bg-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isSelected
              ? 'var(--bg-secondary)'
              : 'transparent';
          }}
        >
          {/* 复选框 */}
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '6px',
              border: `2px solid ${isSelected ? '#8B7D6B' : 'var(--border-visible)'}`,
              backgroundColor: isSelected ? '#8B7D6B' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 150ms ease',
            }}
          >
            {isSelected && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>

          {/* 任务信息 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '14px',
                fontWeight: isSelected ? 600 : 500,
                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}
            >
              {task.initial_prompt || task.prompt}
            </div>
          </div>

          {/* 状态标签 */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: '22px',
              padding: '0 10px',
              fontSize: '11px',
              fontWeight: 500,
              color: statusColor,
              backgroundColor: statusBgColor,
              borderRadius: '6px',
              flexShrink: 0,
            }}
          >
            {statusLabel}
          </span>
        </button>
      );
    });
  };

  // 渲染继承上下文任务列表
  const renderForkTaskList = () => {
    if (forkableTasks.length === 0) {
      return (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '13px',
          }}
        >
          {t('ui:advancedOptions.noForkTasks', '没有可继承上下文的任务')}
        </div>
      );
    }
    return forkableTasks.map((task) => {
      const isSelected = forkFromTaskId === task.id;
      const statusColor = getStatusColor(task.status);
      const statusBgColor = getStatusBgColor(task.status);
      const statusLabel = taskStatusLabels[task.status];

      return (
        <button
          key={task.id}
          type="button"
          onClick={() => onForkFromChange(task.id)}
          title={getTaskTitle(task)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            padding: '12px 16px',
            backgroundColor: isSelected ? 'var(--bg-secondary)' : 'transparent',
            border: 'none',
            borderBottom: isSelected ? 'none' : '1px solid var(--border-subtle)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isSelected
              ? 'var(--bg-tertiary)'
              : 'var(--bg-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isSelected
              ? 'var(--bg-secondary)'
              : 'transparent';
          }}
        >
          {/* 单选框 */}
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: `2px solid ${isSelected ? '#8B7D6B' : 'var(--border-visible)'}`,
              backgroundColor: isSelected ? '#8B7D6B' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 150ms ease',
            }}
          >
            {isSelected && (
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>

          {/* 任务信息 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '14px',
                fontWeight: isSelected ? 600 : 500,
                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}
            >
              {task.initial_prompt || task.prompt}
            </div>
          </div>

          {/* 状态标签 */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: '22px',
              padding: '0 10px',
              fontSize: '11px',
              fontWeight: 500,
              color: statusColor,
              backgroundColor: statusBgColor,
              borderRadius: '6px',
              flexShrink: 0,
            }}
          >
            {statusLabel}
          </span>
        </button>
      );
    });
  };

  // 渲染内容
  const renderContent = () => (
    <div style={{ padding: isDesktop ? '24px' : '0' }}>
      {/* 桌面端 Header */}
      {isDesktop && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            {t('ui:advancedOptions.title', '高级选项')}
          </h2>
        </div>
      )}

      {/* 选项卡片组 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Group 1: 依赖任务 */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: dependsOnTaskIds.length > 0 ? '1.5px solid #8B7D6B' : '1px solid var(--border-subtle)',
            borderRadius: '16px',
            overflow: 'hidden',
            transition: 'all 200ms ease',
            boxShadow: 'var(--shadow-ios-sm)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              cursor: 'pointer',
              backgroundColor: 'var(--bg-primary)',
              transition: 'all 150ms ease',
            }}
            onClick={() => setExpandedSection(expandedSection === 'depends' ? null : 'depends')}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {t('ui:advancedOptions.dependsOn', '依赖任务')}
              </span>
              <InfoIcon
                content={t('ui:advancedOptions.dependsOnDesc', '选择未完成的任务作为前置依赖，新任务会等待依赖任务完成后再执行。适用于有先后顺序的任务流程。')}
                size={16}
              />
              {dependsOnTaskIds.length > 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '22px',
                    height: '22px',
                    padding: '0 7px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#fff',
                    backgroundColor: '#8B7D6B',
                    borderRadius: '11px',
                  }}
                >
                  {dependsOnTaskIds.length}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                {dependsOnTaskIds.length > 0 ? t('ui:advancedOptions.selected', '已选任务') : t('ui:advancedOptions.notSelected', '未选择')}
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transition: 'transform 200ms ease',
                  transform: expandedSection === 'depends' ? 'rotate(180deg)' : 'rotate(0deg)',
                  color: 'var(--text-muted)',
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* 展开的任务列表 */}
          {expandedSection === 'depends' && (
            <div style={{ backgroundColor: '#FFFFFF' }}>
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {renderDependsTaskList()}
              </div>
            </div>
          )}
        </div>

        {/* Group 2: 继承上下文 */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: forkFromTaskId ? '1.5px solid #8B7D6B' : '1px solid var(--border-subtle)',
            borderRadius: '16px',
            overflow: 'hidden',
            transition: 'all 200ms ease',
            boxShadow: 'var(--shadow-ios-sm)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              cursor: 'pointer',
              backgroundColor: 'var(--bg-primary)',
              transition: 'all 150ms ease',
            }}
            onClick={() => setExpandedSection(expandedSection === 'fork' ? null : 'fork')}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {t('ui:advancedOptions.forkFrom', '继承上下文')}
              </span>
              <InfoIcon
                content={t('ui:advancedOptions.forkFromDesc', '选择已完成的任务继承其对话上下文，新任务将延续之前任务的对话内容，就像从未中断过一样。')}
                size={16}
              />
              {forkFromTaskId && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '22px',
                    height: '22px',
                    padding: '0 7px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#fff',
                    backgroundColor: '#8B7D6B',
                    borderRadius: '11px',
                  }}
                >
                  {t('ui:advancedOptions.selected', '已选')}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                {forkFromTaskId ? t('ui:advancedOptions.selected', '已选任务') : t('ui:advancedOptions.notSelected', '未选择')}
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transition: 'transform 200ms ease',
                  transform: expandedSection === 'fork' ? 'rotate(180deg)' : 'rotate(0deg)',
                  color: 'var(--text-muted)',
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* 展开的任务列表 */}
          {expandedSection === 'fork' && (
            <div style={{ backgroundColor: '#FFFFFF' }}>
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {renderForkTaskList()}
              </div>
            </div>
          )}
        </div>

        {/* Group 3: 任务隔离 */}
        {onIsolatedChange && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-subtle)',
              borderRadius: '16px',
              padding: '16px',
              boxShadow: 'var(--shadow-ios-sm)',
              opacity: !isGitProject ? 0.6 : 1,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {t('ui:advancedOptions.isolatedMode', '任务隔离')}
                  </span>
                  <InfoIcon
                    content={t('ui:advancedOptions.isolatedModeDesc', '在 Git worktree 隔离环境中执行任务，每个任务在独立的工作目录中运行，适合需要修改文件且避免冲突的场景。')}
                    size={16}
                  />
                  {isIsolated && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '22px',
                        height: '22px',
                        padding: '0 7px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#fff',
                        backgroundColor: '#8B7D6B',
                        borderRadius: '11px',
                      }}
                    >
                      {t('ui:advancedOptions.enabled', '已启用')}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    color: !isGitProject ? 'var(--color-error)' : 'var(--text-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  {!isGitProject ? (
                    <span>
                      {t('ui:advancedOptions.notGitProject', '当前项目不是 Git 仓库，无法使用任务隔离功能。')}
                      <br />
                      {t('ui:advancedOptions.initGitProject', '如需使用，请先将项目初始化为 Git 仓库。')}
                    </span>
                  ) : isIsolated ? (
                    t('ui:advancedOptions.isolatedModeActive', '任务将在独立工作区（git worktree）执行，互不干扰')
                  ) : (
                    t('ui:advancedOptions.isolatedModeInactive', '启用后，每个任务在独立的工作目录中运行，避免文件冲突')
                  )}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <ModernToggle
                  checked={isIsolated}
                  onChange={onIsolatedChange}
                  disabled={!isGitProject}
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );

  // 桌面端：Modal
  if (isDesktop) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} maxWidth="md" showCloseButton>
        {renderContent()}
      </Modal>
    );
  }

  // 移动端：BottomSheet
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t('ui:advancedOptions.title', '高级选项')} size="md" maxHeight="75vh">
      {renderContent()}
    </BottomSheet>
  );
}
