/**
 * Fork Selector Component
 * 继承上下文选择器 - 允许用户选择已完成且有对话记录的任务来继承上下文
 */

'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTasks } from '@/lib/api/tasks';
import { getProjects } from '@/lib/api/projects';
import { getStatusColor, getStatusBgColor } from '@/lib/constants/status';
import type { Task } from '@/types/task';
import { useTranslation } from 'react-i18next';

interface ForkSelectorProps {
  selectedProjectId?: number | null; // 当前选中的项目 ID，用于过滤
  excludedTaskIds?: number[]; // 排除的任务 ID
  onChange?: (taskId: number | null, project?: number | null) => void; // 第二个参数用于项目继承
  disabled?: boolean; // 是否禁用
}

export function ForkSelector({
  selectedProjectId = null,
  excludedTaskIds = [],
  onChange,
  disabled = false,
}: ForkSelectorProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 只有已完成的任务才能被 fork（必须有 session_id）
  const forkableStatuses = ['completed'];

  // 获取所有任务
  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => getTasks(),
    staleTime: 30000,
  });

  // 获取所有项目（用于显示项目名称）
  const { data: projects } = useQuery({
    queryKey: ['fork-projects'],
    queryFn: () => getProjects(),
    staleTime: 60000,
  });

  // 获取项目名称的辅助函数
  const getProjectName = (projectId: number | null | undefined): string => {
    if (!projectId) return '无项目';
    const project = projects?.find(p => p.id === projectId);
    return project?.name || `项目 #${projectId}`;
  };

  // 过滤可 fork 的任务：已完成且有 session_id
  const forkableTasks = useMemo(() => {
    return tasks?.filter((task) => {
      if (!forkableStatuses.includes(task.status)) return false;
      if (!task.session_id) return false;
      if (excludedTaskIds.includes(task.id)) return false;
      if (selectedProjectId != null) {
        return (task.project_id ?? null) === selectedProjectId;
      }
      return true;
    }) || [];
  }, [tasks, selectedProjectId, excludedTaskIds]);

  const selectedTask = tasks?.find(t => t.id === selectedTaskId);

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 通知父组件变更
  useEffect(() => {
    if (onChange) {
      const task = tasks?.find(t => t.id === selectedTaskId);
      onChange(selectedTaskId, task?.project_id ?? null);
    }
  }, [selectedTaskId, onChange, tasks]);

  // 监听项目选择变化，如果已选任务不属于新项目，清空选择
  useEffect(() => {
    if (selectedProjectId !== undefined && selectedProjectId !== null && selectedTaskId) {
      const task = tasks?.find(t => t.id === selectedTaskId);
      if (task && task.project_id !== selectedProjectId) {
        setSelectedTaskId(null);
      }
    }
  }, [selectedProjectId, selectedTaskId, tasks]);

  const handleSelectTask = (taskId: number) => {
    setSelectedTaskId(taskId);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedTaskId(null);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'block' }}>
      {/* 触发按钮 - 简化版，适配 Popover 内显示 */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '4px',
          padding: '10px 12px',
          width: '100%',
          fontSize: '12px',
          fontWeight: disabled ? 500 : (selectedTaskId ? 600 : 500),
          color: disabled ? 'var(--text-muted)' : (selectedTaskId ? 'var(--color-accent)' : 'var(--text-secondary)'),
          backgroundColor: disabled ? 'var(--bg-secondary)' : (selectedTaskId ? 'var(--color-accent-subtle)' : 'var(--bg-tertiary)'),
          border: `1px solid ${disabled ? 'var(--border-subtle)' : (selectedTaskId ? 'var(--color-accent-border)' : 'var(--border-visible)')}`,
          borderRadius: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'var(--transition-fast)',
          opacity: disabled ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = selectedTaskId
              ? 'var(--color-accent-subtle)'
              : 'var(--bg-tertiary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = selectedTaskId
              ? 'var(--color-accent-subtle)'
              : 'var(--bg-tertiary)';
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span style={{ flex: 1, textAlign: 'left' }}>
            {selectedTaskId
              ? t('dependency.forkSelector.selectedContext')
              : t('dependency.forkSelector.inheritContext')}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: 'transform 150ms ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        {selectedTaskId && selectedTask && (
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            textAlign: 'left',
            width: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {selectedTask.initial_prompt || selectedTask.prompt}
          </div>
        )}
      </button>

      {/* 下拉选择面板 */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            width: '280px',
            marginTop: '6px',
            backgroundColor: 'var(--bg-primary)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            boxShadow: 'var(--shadow-popover-sm)',
            maxHeight: '280px',
            overflow: 'auto',
            zIndex: 1001,
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{t('dependency.forkSelector.title')}</span>
            {selectedTaskId && (
              <button
                onClick={handleClear}
                style={{
                  fontSize: '12px',
                  color: 'var(--color-error)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                }}
              >
                {t('dependency.forkSelector.clear')}
              </button>
            )}
          </div>

          {/* 提示信息 */}
          <div
            style={{
              padding: '10px 16px',
              backgroundColor: 'var(--color-warning)',
              opacity: 0.2,
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--color-warning)', opacity: 1, marginBottom: '4px', display: 'block' }}>{t('dependency.forkSelector.usageScenario')}：</span>
            {t('dependency.forkSelector.usageDescription')}
            {selectedProjectId ? (
              <span style={{ marginTop: '8px', display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>
                {t('dependency.forkSelector.projectFilter')}「{getProjectName(selectedProjectId)}」
              </span>
            ) : null}
          </div>

          {forkableTasks.length === 0 ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}
            >
              {selectedProjectId ? (
                <>{t('dependency.forkSelector.noTasksProject')}</>
              ) : (
                <>{t('dependency.forkSelector.noTasks')}</>
              )}
            </div>
          ) : (
            <div style={{ padding: '8px' }}>
              {forkableTasks.map((task) => {
                const isSelected = selectedTaskId === task.id;
                const statusColor = getStatusColor(task.status);
                const statusBgColor = getStatusBgColor(task.status);

                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handleSelectTask(task.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '12px 14px',
                      backgroundColor: isSelected ? 'var(--color-accent-subtle)' : 'transparent',
                      border: `1px solid ${isSelected ? 'var(--color-accent-border)' : 'transparent'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isSelected
                        ? 'var(--color-accent-subtle)'
                        : 'var(--bg-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isSelected
                        ? 'var(--color-accent-subtle)'
                        : 'transparent';
                    }}
                  >
                    {/* 单选按钮 */}
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        border: '2px solid var(--border-visible)',
                        backgroundColor: isSelected ? 'var(--color-accent)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
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
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '4px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '240px',
                          }}
                          title={task.initial_prompt || task.prompt}
                        >
                          {task.initial_prompt || task.prompt}
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            height: '18px',
                            padding: '0 6px',
                            fontSize: '11px',
                            fontWeight: 500,
                            color: statusColor,
                            backgroundColor: statusBgColor,
                            borderRadius: '4px',
                            flexShrink: 0,
                          }}
                        >
                          {t(`task.${task.status}`)}
                        </span>
                        {task.project_id && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              backgroundColor: 'var(--bg-tertiary)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                            title={getProjectName(task.project_id)}
                          >
                            {t('dependency.forkSelector.project')}：{getProjectName(task.project_id)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
