/**
 * @deprecated Use AdvancedOptionsModal instead
 *
 * 高级选项底部抽屉 - 已废弃
 * 请使用 AdvancedOptionsModal 替代，它提供更好的响应式支持和现代化设计
 */

'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from './BottomSheet';
import { Switch } from './Switch';
import { useQuery } from '@tanstack/react-query';
import { getTasks } from '@/lib/api/tasks';
import { getStatusColor, getStatusBgColor, taskStatusLabels } from '@/lib/constants/status';
import type { TaskStatus } from '@/types/task';

interface AdvancedOptionsBottomSheetProps {
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

export function AdvancedOptionsBottomSheet({
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
}: AdvancedOptionsBottomSheetProps) {
  const { t } = useTranslation();
  // 展开/收起状态
  const [expandedSection, setExpandedSection] = useState<'depends' | 'fork' | null>(null);
  // 非终端状态（未完成）- 可作为依赖
  const nonTerminalStatuses = ['running', 'queued', 'pending'];

  // 只有已完成的任务才能被 fork（必须有 session_id）
  const forkableStatuses = ['completed'];

  // 获取所有任务
  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => getTasks(),
    staleTime: 30000,
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

  // 清除所有依赖
  const clearAllDependencies = () => {
    onDependsOnChange([]);
  };

  // 获取任务标题（用于 title 显示）
  const getTaskTitle = (task: NonNullable<typeof tasks>[number]) => {
    return task?.initial_prompt || task?.prompt || '';
  };

  // 获取任务列表子组件（复用渲染逻辑）
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
            borderBottom: '1px solid var(--border-subtle)',
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
            borderBottom: '1px solid var(--border-subtle)',
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

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t('ui:advancedOptions.title', '高级选项')}
      size="md"
      maxHeight="80vh"
    >
      <div style={{ padding: '16px 0' }}>
        {/* iOS Settings 风格分组列表 */}
        <div style={{ padding: '0 16px' }}>

          {/* Group 1: 依赖任务 */}
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-primary)',
                borderTop: '1px solid var(--border-subtle)',
                borderLeft: '1px solid var(--border-subtle)',
                borderRight: '1px solid var(--border-subtle)',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedSection(expandedSection === 'depends' ? null : 'depends')}
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
                {dependsOnTaskIds.length > 0 && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '20px',
                      height: '20px',
                      padding: '0 6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#fff',
                      backgroundColor: '#8B7D6B',
                      borderRadius: '10px',
                    }}
                  >
                    {dependsOnTaskIds.length}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '13px',
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
              <div
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderBottomLeftRadius: '12px',
                  borderBottomRightRadius: '12px',
                  borderLeft: '1px solid var(--border-subtle)',
                  borderBottom: '1px solid var(--border-subtle)',
                  borderRight: '1px solid var(--border-subtle)',
                  borderTop: 'none',
                  overflow: 'hidden',
                }}
              >
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {renderDependsTaskList()}
                </div>
              </div>
            )}
          </div>

          {/* Group 2: 继承上下文 */}
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-primary)',
                borderTop: '1px solid var(--border-subtle)',
                borderLeft: '1px solid var(--border-subtle)',
                borderRight: '1px solid var(--border-subtle)',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedSection(expandedSection === 'fork' ? null : 'fork')}
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
                {forkFromTaskId && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '20px',
                      height: '20px',
                      padding: '0 6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#fff',
                      backgroundColor: '#8B7D6B',
                      borderRadius: '10px',
                    }}
                  >
                    {t('ui:advancedOptions.selected', '已选')}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '13px',
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
              <div
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderBottomLeftRadius: '12px',
                  borderBottomRightRadius: '12px',
                  borderLeft: '1px solid var(--border-subtle)',
                  borderBottom: '1px solid var(--border-subtle)',
                  borderRight: '1px solid var(--border-subtle)',
                  borderTop: 'none',
                  overflow: 'hidden',
                }}
              >
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {renderForkTaskList()}
                </div>
              </div>
            )}
          </div>

          {/* Group 3: 任务隔离 */}
          {onIsolatedChange && (
            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  cursor: !isGitProject ? 'not-allowed' : 'pointer',
                  opacity: !isGitProject ? 0.6 : 1,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                    {isIsolated && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '20px',
                          height: '20px',
                          padding: '0 6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#fff',
                          backgroundColor: '#8B7D6B',
                          borderRadius: '10px',
                        }}
                      >
                        {t('ui:advancedOptions.enabled', '已启用')}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {!isGitProject ? (
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {t('ui:advancedOptions.onlyGitProject', '只有 Git 项目才能启用任务隔离功能')}
                      </span>
                    ) : isIsolated ? (
                      t('ui:advancedOptions.isolatedModeActive', '任务将在独立工作区（git worktree）执行，互不干扰')
                    ) : (
                      t('ui:advancedOptions.isolatedModeInactive', '启用后，任务将在独立工作区执行，避免文件冲突')
                    )}
                  </span>
                </div>
                <Switch
                  checked={isIsolated}
                  onChange={onIsolatedChange}
                  disabled={!isGitProject}
                />
              </div>
            </div>
          )}

        </div>
      </div>
    </BottomSheet>
  );
}
