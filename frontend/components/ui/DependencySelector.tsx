/**
 * Dependency Selector Component
 * 依赖任务选择器 - 允许用户选择前序依赖任务
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTasks } from '@/lib/api/tasks';
import { getStatusColor, getStatusBgColor } from '@/lib/constants/status';
import type { Task, TaskStatus } from '@/types/task';
import { useTranslation } from 'react-i18next';

interface DependencySelectorProps {
  excludedTaskIds?: number[]; // 排除的任务 ID（避免选择自己）
  currentProjectId?: number | null; // 当前项目 ID，用于过滤同项目任务
  onChange?: (taskIds: number[]) => void;
}

export function DependencySelector({
  excludedTaskIds = [],
  currentProjectId = null,
  onChange,
}: DependencySelectorProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 可选状态：未完成 + 待检视（用户可以依赖待检视的任务）
  const nonTerminalStatuses = ['running', 'queued', 'pending', 'reviewing'];

  // 获取所有任务作为候选
  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => getTasks(),
    staleTime: 30000,
  });

  // 为已选中的任务单独获取最新状态（实时刷新）
  const { data: selectedTasksData } = useQuery({
    queryKey: ['selected-dependency-tasks', selectedTaskIds],
    queryFn: async () => {
      if (selectedTaskIds.length === 0) return [];
      const allTasks = await getTasks();
      return allTasks.filter(t => selectedTaskIds.includes(t.id));
    },
    enabled: selectedTaskIds.length > 0,
    staleTime: 10000,
  });

  // 使用实时刷新的已选任务数据，如果加载中则回退到普通列表
  const selectedTasks = selectedTasksData || (tasks?.filter(t => selectedTaskIds.includes(t.id)) || []);

  // 过滤可用的依赖任务
  const selectableTasks = tasks?.filter((task) => {
    if (excludedTaskIds.includes(task.id)) return false;
    if (!nonTerminalStatuses.includes(task.status)) return false;
    if (currentProjectId != null) {
      return (task.project_id ?? null) === currentProjectId;
    }
    return true;
  }) || [];

  // 不可选的任务（已完成）：仅用于展示
  const unselectableTasks = tasks?.filter((task) => {
    if (excludedTaskIds.includes(task.id)) return false;
    if (nonTerminalStatuses.includes(task.status)) return false;
    if (currentProjectId != null) {
      return (task.project_id ?? null) === currentProjectId;
    }
    return true;
  }) || [];

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
    onChange?.(selectedTaskIds);
  }, [selectedTaskIds, onChange]);

  const toggleTask = (taskId: number) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const removeTask = (taskId: number) => {
    setSelectedTaskIds((prev) => prev.filter((id) => id !== taskId));
  };

  const getSelectedTasks = () => {
    return selectedTasks;
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'block' }}>
      {/* 触发按钮 - 优化设计 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '6px',
          padding: '12px 14px',
          width: '100%',
          fontSize: '12px',
          fontWeight: selectedTaskIds.length > 0 ? 600 : 500,
          color: selectedTaskIds.length > 0 ? '#fff' : 'var(--text-secondary)',
          backgroundColor: selectedTaskIds.length > 0 ? 'var(--color-success)' : 'var(--bg-tertiary)',
          border: selectedTaskIds.length > 0 ? '1px solid var(--color-success)' : '1px solid var(--border-visible)',
          borderRadius: '10px',
          cursor: 'pointer',
          transition: 'var(--transition-fast)',
          boxShadow: selectedTaskIds.length > 0 ? '0 2px 8px rgba(124, 184, 130, 0.25)' : 'var(--shadow-ios-sm)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = selectedTaskIds.length > 0
            ? '#6FAF76'
            : 'var(--bg-tertiary)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = selectedTaskIds.length > 0
            ? 'var(--color-success)'
            : 'var(--bg-tertiary)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              borderRadius: '6px',
              backgroundColor: selectedTaskIds.length > 0 ? 'rgba(255,255,255,0.2)' : 'rgba(124, 184, 130, 0.15)',
              flexShrink: 0,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke={selectedTaskIds.length > 0 ? '#fff' : 'var(--color-success)'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2" />
            </svg>
          </div>
          <span style={{ flex: 1, textAlign: 'left' }}>
            {selectedTaskIds.length > 0
              ? `${t('dependency.selector.selectedCount')} ${selectedTaskIds.length} ${t('dependency.selector.dependOn')}`
              : t('dependency.selector.dependOn')}
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: 'transform 150ms ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0, opacity: 0.5 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        {selectedTaskIds.length > 0 && (
          <div style={{
            fontSize: '11px',
            color: selectedTaskIds.length > 0 ? 'rgba(255,255,255,0.9)' : 'var(--text-muted)',
            textAlign: 'left',
            width: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {getSelectedTasks().slice(0, 2).map(t => t.initial_prompt || t.prompt).join(', ')}
            {selectedTaskIds.length > 2 && '...'}
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
            <span>{t('dependency.selector.title')}</span>
            {selectedTaskIds.length > 0 && (
              <button
                onClick={() => setSelectedTaskIds([])}
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
                {t('dependency.selector.clear')}
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
            <span style={{ fontWeight: 600, color: 'var(--color-warning)', opacity: 1, marginBottom: '4px', display: 'block' }}>{t('dependency.selector.usageScenario')}：</span>
            {t('dependency.selector.usageDescription')}
            <br />
            {t('dependency.selector.waitingMessage')}
          </div>

          {selectableTasks.length === 0 && unselectableTasks.length === 0 ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}
            >
              {t('dependency.selector.noTasksAvailable')}
              <div style={{ marginTop: '4px', fontSize: '12px' }}>
                {t('dependency.selector.noTasksHint')}
              </div>
            </div>
          ) : (
            <div>
              {/* 可选任务列表 */}
              <div style={{ padding: '8px' }}>
                {selectableTasks.length > 0 && (
                  <div
                    style={{
                      padding: '6px 12px',
                      marginBottom: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-warning)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {t('dependency.selector.unfinishedSection')} ({selectableTasks.length})
                  </div>
                )}
                {selectableTasks.map((task) => {
                  const isSelected = selectedTaskIds.includes(task.id);
                  const statusColor = getStatusColor(task.status);
                  const statusBgColor = getStatusBgColor(task.status);

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '12px 14px',
                        backgroundColor: isSelected ? 'var(--color-success)' : 'transparent',
                        opacity: isSelected ? 0.2 : 1,
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isSelected
                          ? 'var(--color-success)'
                          : 'var(--bg-secondary)';
                        e.currentTarget.style.opacity = isSelected ? '0.3' : '1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isSelected
                          ? 'var(--color-success)'
                          : 'transparent';
                        e.currentTarget.style.opacity = isSelected ? '0.2' : '1';
                      }}
                    >
                      {/* 复选框 */}
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '5px',
                          border: '2px solid var(--border-visible)',
                          backgroundColor: isSelected ? 'var(--bg-dark)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isSelected && (
                          <svg
                            width="11"
                            height="11"
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
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 不可选任务列表（仅展示） */}
              {unselectableTasks.length > 0 && (
                <div
                  style={{
                    borderTop: '1px solid var(--border-visible)',
                    padding: '8px',
                  }}
                >
                  <div
                    style={{
                      padding: '6px 12px',
                      marginBottom: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-success)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    {t('dependency.selector.finishedSection')} ({unselectableTasks.length})
                  </div>
                  {unselectableTasks.map((task) => {
                    const statusColor = getStatusColor(task.status);
                    const statusBgColor = getStatusBgColor(task.status);

                    return (
                      <div
                        key={task.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          width: '100%',
                          padding: '10px 14px',
                          backgroundColor: 'var(--bg-secondary)',
                          borderRadius: '8px',
                          cursor: 'not-allowed',
                          opacity: 0.6,
                        }}
                      >
                        {/* 禁用图标 */}
                        <div
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '5px',
                            border: '2px dashed var(--border-visible)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
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
                                color: 'var(--text-muted)',
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
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
