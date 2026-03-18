/**
 * Task Config Bar
 * 任务配置栏 - 内联式配置组件
 *
 * 设计理念：
 * - 配置即输入：配置与输入融为一体
 * - 所见即所得：所有配置一目了然
 * - 零学习成本：直觉操作，无需解释
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProjects, createProject, deleteProject } from '@/lib/api/projects';
import { getTasks } from '@/lib/api/tasks';
import { SimplePopover, PopoverItem } from './SimplePopover';
import { getStatusColor, getStatusBgColor, taskStatusLabels } from '@/lib/constants/status';
import { FolderPicker } from './FolderPicker';
import { useTranslation } from 'react-i18next';

interface TaskConfigBarProps {
  projectId: number | null;
  onProjectChange: (id: number | null) => void;
  dependsOnTaskIds: number[];
  onDependsChange: (ids: number[]) => void;
  forkFromTaskId: number | null;
  onForkFromChange: (id: number | null) => void;
  isIsolated: boolean;
  onIsolatedChange: (checked: boolean) => void;
  isGitProject: boolean;
  autoApprove: boolean;
  onAutoApproveChange: (checked: boolean) => void;
  taskMode: 'execute' | 'plan';
  onTaskModeChange: (mode: 'execute' | 'plan') => void;
}

export function TaskConfigBar({
  projectId,
  onProjectChange,
  dependsOnTaskIds,
  onDependsChange,
  forkFromTaskId,
  onForkFromChange,
  isIsolated,
  onIsolatedChange,
  isGitProject,
  autoApprove,
  onAutoApproveChange,
  taskMode,
  onTaskModeChange,
}: TaskConfigBarProps) {
  const { t } = useTranslation();
  // 高级选项展开状态 (仅移动端使用)
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);
  // 客户端挂载状态
  const [mounted, setMounted] = useState(false);
  // 是否为桌面端 (>=769px)
  const [isDesktop, setIsDesktop] = useState(false);

  // 隔离开关 Ref（用于 Tooltip 定位）
  const isolatedToggleRef = useRef<HTMLDivElement>(null);
  // 隔离 Tooltip 状态
  const [showIsolatedTooltip, setShowIsolatedTooltip] = useState(false);
  // 隔离 Tooltip 位置状态
  const [isolatedTooltipPosition, setIsolatedTooltipPosition] = useState({ top: 0, left: 0, width: 0 });

  // 自动批准 Ref 和 Tooltip 状态
  const autoApproveRef = useRef<HTMLDivElement>(null);
  const [showAutoApproveTooltip, setShowAutoApproveTooltip] = useState(false);
  const [autoApproveTooltipPosition, setAutoApproveTooltipPosition] = useState({ top: 0, left: 0, width: 0 });

  // 依赖选择器的项目筛选状态
  const [dependencyProjectFilter, setDependencyProjectFilter] = useState<number | 'all'>('all');

  // 上下文选择器的项目筛选状态
  const [contextProjectFilter, setContextProjectFilter] = useState<number | 'all'>('all');

  // 获取项目列表
  const { data: projects } = useQuery({
    queryKey: ['config-projects'],
    queryFn: () => getProjects(),
    staleTime: 60000,
  });

  // 获取任务列表
  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => getTasks(),
    staleTime: 30000,
  });

  // 可进行中的任务（可作为依赖）- 先按状态过滤
  const allAvailableDependencyTasks = tasks?.filter(
    (t) => ['running', 'queued', 'pending', 'reviewing'].includes(t.status)
  ) || [];

  // 再按项目筛选
  const availableDependencyTasks = dependencyProjectFilter === 'all'
    ? allAvailableDependencyTasks
    : allAvailableDependencyTasks.filter((t) => (t.project_id ?? null) === dependencyProjectFilter);

  // 已完成的任务（可作为上下文来源）- 先按状态过滤
  const allCompletedTasks = tasks?.filter(
    (t) => t.status === 'completed' && t.session_id
  ) || [];

  // 再按项目筛选
  const completedTasks = contextProjectFilter === 'all'
    ? allCompletedTasks
    : allCompletedTasks.filter((t) => (t.project_id ?? null) === contextProjectFilter);

  // 切换依赖任务
  const toggleDependencyTask = (taskId: number) => {
    if (dependsOnTaskIds.includes(taskId)) {
      onDependsChange(dependsOnTaskIds.filter((id) => id !== taskId));
    } else {
      onDependsChange([...dependsOnTaskIds, taskId]);
    }
  };

  // 客户端挂载检测
  useEffect(() => {
    setMounted(true);
    // 检测是否为桌面端
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 769);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // 当用户选择项目后，自动更新 fork 选择器的过滤条件
  useEffect(() => {
    if (projectId !== null) {
      setContextProjectFilter(projectId);
      // 如果已选的 fork 任务不属于新项目，清空 fork 选择
      if (forkFromTaskId) {
        const selectedTask = tasks?.find(t => t.id === forkFromTaskId);
        if (selectedTask && selectedTask.project_id !== projectId) {
          onForkFromChange(null);
        }
      }
    } else {
      setContextProjectFilter('all');
    }
  }, [projectId, forkFromTaskId, tasks]);

  // 当 fork 任务改变时，如果未选择项目，自动关联项目
  useEffect(() => {
    if (forkFromTaskId && projectId === null) {
      const task = tasks?.find(t => t.id === forkFromTaskId);
      if (task?.project_id) {
        onProjectChange(task.project_id);
      }
    }
  }, [forkFromTaskId, projectId, tasks]);

  // 渲染项目选择器
  const renderProjectSelector = () => {
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);

    // 创建项目 mutation
    const createMutation = useMutation({
      mutationFn: (data: { name: string; path: string; display_name?: string; description?: string }) => createProject(data),
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: ['config-projects'] });
        onProjectChange(result.id);
        setShowCreateDialog(false);
      },
    });

    // 删除项目 mutation
    const deleteMutation = useMutation({
      mutationFn: (id: number) => deleteProject(id),
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: ['config-projects'] });
        if (projectId === result.id) {
          onProjectChange(null);
        }
        setDeletingProjectId(null);
      },
    });

    const queryClient = useQueryClient();

    return (
      <>
        <SimplePopover
          trigger={
            <div
              className="mobile-config-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: projectId ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                minHeight: '44px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = projectId ? 'var(--bg-tertiary)' : 'var(--bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-visible)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = projectId ? 'var(--bg-secondary)' : 'var(--bg-primary)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: projectId ? 'var(--text-primary)' : 'var(--text-muted)',
                  maxWidth: '150px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={projectId ? projects?.find((p) => p.id === projectId)?.name : undefined}
              >
                {projectId ? projects?.find((p) => p.id === projectId)?.name || t('ui:taskConfig.selectProject', '选择项目') : t('ui:taskConfig.selectProject', '选择项目')}
              </span>
              {projectId !== null && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: 'var(--text-primary)', flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          }
          width={280}
        >
          <div style={{ padding: '8px 0' }}>
            {/* 不关联项目 */}
            <div
              onClick={() => onProjectChange(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                cursor: 'pointer',
                backgroundColor: projectId === null ? 'var(--bg-secondary)' : 'transparent',
                transition: 'background-color 150ms ease',
                borderBottom: '1px solid var(--border-subtle)',
              }}
              onMouseEnter={(e) => {
                if (projectId !== null) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                if (projectId !== null) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span style={{ fontSize: '13px', fontWeight: projectId === null ? 600 : 500, color: projectId === null ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {t('ui:project.noProject', '不关联项目')}
              </span>
            </div>

            {/* 项目列表 */}
            {projects?.map((project) => (
              <div
                key={project.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                }}
              >
                <div
                  onClick={() => onProjectChange(project.id)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: projectId === project.id ? 'var(--bg-secondary)' : 'transparent',
                    transition: 'background-color 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    if (projectId !== project.id) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (projectId !== project.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span style={{ fontSize: '13px', fontWeight: projectId === project.id ? 600 : 500, color: projectId === project.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {project.name}
                  </span>
                </div>
                {/* 删除按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(t('ui:project.confirmDelete', '确定要删除项目') + `"${project.name}"` + t('ui:project.deleteConfirm', '吗？'))) {
                      deleteMutation.mutate(project.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    color: '#8B837B',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: deleteMutation.isPending ? 'not-allowed' : 'pointer',
                    opacity: deletingProjectId === project.id ? 0.5 : 0.7,
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(229, 115, 115, 0.1)';
                    e.currentTarget.style.color = '#E57373';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#8B837B';
                  }}
                >
                  {deleteMutation.isPending && deletingProjectId === project.id ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  )}
                </button>
              </div>
            ))}

            {/* 无项目提示 */}
            {projects?.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                {t('ui:project.noProject', '暂无项目')}
              </div>
            )}

            {/* 分隔线 */}
            {projects && projects.length > 0 && (
              <div style={{ margin: '8px 0', height: '1px', backgroundColor: 'var(--border-subtle)' }} />
            )}

            {/* 新建项目 */}
            <div
              onClick={() => setShowCreateDialog(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: '1px dashed var(--border-subtle)',
                borderRadius: '8px',
                margin: '0 8px',
                transition: 'background-color 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-visible)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                {t('ui:project.createProject', '新建项目...')}
              </span>
            </div>
          </div>
        </SimplePopover>

        {/* 新建项目对话框 */}
        {showCreateDialog && (
          <CreateProjectDialog
            onClose={() => setShowCreateDialog(false)}
            onSubmit={(data) => createMutation.mutate(data)}
            isPending={createMutation.isPending}
          />
        )}
      </>
    );
  };

  // 渲染依赖任务选择器
  const renderDependencySelector = () => (
    <SimplePopover
      trigger={
        <div
          className="mobile-config-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '10px',
            backgroundColor: dependsOnTaskIds.length > 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            minHeight: '44px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = dependsOnTaskIds.length > 0 ? 'var(--bg-tertiary)' : 'var(--bg-secondary)';
            e.currentTarget.style.borderColor = 'var(--border-visible)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = dependsOnTaskIds.length > 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)';
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span style={{ fontSize: '14px', fontWeight: dependsOnTaskIds.length > 0 ? 600 : 500, color: dependsOnTaskIds.length > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {t('ui:taskConfig.dependenciesLabel', '依赖任务')}
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
                fontSize: '12px',
                fontWeight: 600,
                color: '#fff',
                backgroundColor: '#8B7D6B',
                borderRadius: '10px',
              }}
            >
              {dependsOnTaskIds.length}
            </span>
          )}
          {dependsOnTaskIds.length > 0 && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: 'var(--text-primary)', flexShrink: 0 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      }
      width={300}
    >
      {/* 提示区 */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {t('ui:taskConfig.dependenciesLabel', '依赖任务')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {t('ui:taskConfig.dependenciesDesc', '选择未完成的任务作为前置依赖，新任务会等待依赖任务完成后再执行。')}
          </div>
        </div>
        {dependsOnTaskIds.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDependsChange([]);
            }}
            style={{
              fontSize: '12px',
              color: 'var(--color-error)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background-color 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(229, 115, 115, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {t('ui:actions.clear', '清空')}
          </button>
        )}
      </div>
      {/* 项目筛选器 */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <select
          value={dependencyProjectFilter}
          onChange={(e) => setDependencyProjectFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            padding: '6px 8px',
            fontSize: '13px',
            color: 'var(--text-primary)',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="all">{t('ui:filters.allProjects', '全部项目')}</option>
          {projects?.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>
      {/* 列表区 */}
      <div style={{ padding: '8px 0', maxHeight: '320px', overflow: 'auto' }}>
        {availableDependencyTasks.map((task) => (
          <PopoverItem
            key={task.id}
            selected={dependsOnTaskIds.includes(task.id)}
            onClick={() => toggleDependencyTask(task.id)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* 复选框 */}
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '4px',
                  border: `2px solid ${dependsOnTaskIds.includes(task.id) ? '#8B7D6B' : 'var(--border-visible)'}`,
                  backgroundColor: dependsOnTaskIds.includes(task.id) ? '#8B7D6B' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {dependsOnTaskIds.includes(task.id) && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              {/* 任务信息 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: dependsOnTaskIds.includes(task.id) ? 600 : 500,
                    color: dependsOnTaskIds.includes(task.id) ? 'var(--text-primary)' : 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={task.initial_prompt || task.prompt}
                >
                  {task.initial_prompt || task.prompt}
                </div>
              </div>
              {/* 状态标签 */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: '20px',
                  padding: '0 8px',
                  fontSize: '10px',
                  fontWeight: 500,
                  color: getStatusColor(task.status),
                  backgroundColor: getStatusBgColor(task.status),
                  borderRadius: '4px',
                  flexShrink: 0,
                }}
              >
                {taskStatusLabels[task.status]}
              </span>
            </div>
          </PopoverItem>
        ))}
        {availableDependencyTasks.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            {allAvailableDependencyTasks.length === 0 ? t('ui:taskConfig.noRunningTasks', '没有进行中的任务') : t('ui:taskConfig.noRunningTasksInProject', '该项目下没有进行中的任务')}
          </div>
        )}
      </div>
    </SimplePopover>
  );

  // 渲染上下文选择器
  const renderForkSelector = () => (
    <SimplePopover
      trigger={
        <div
          className="mobile-config-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '10px',
            backgroundColor: forkFromTaskId ? 'var(--bg-secondary)' : 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            minHeight: '44px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = forkFromTaskId ? 'var(--bg-tertiary)' : 'var(--bg-secondary)';
            e.currentTarget.style.borderColor = 'var(--border-visible)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = forkFromTaskId ? 'var(--bg-secondary)' : 'var(--bg-primary)';
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="3" />
            <path d="M6 6v.01C6 11 11.5 11.5 14 15c2.5 3.5 2 6.5-2 9" />
            <path d="M18 18v.01c0-5-5.5-5.5-8-9-2.5-3.5-2-6.5 2-9" />
          </svg>
          <span style={{ fontSize: '14px', fontWeight: forkFromTaskId ? 600 : 500, color: forkFromTaskId ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {t('ui:taskConfig.forkFromLabel', '继承上下文')}
          </span>
          {forkFromTaskId !== null && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: 'var(--text-primary)', flexShrink: 0 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      }
      width={300}
    >
      {/* 提示区 */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {t('ui:taskConfig.forkFromLabel', '继承上下文')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {t('ui:taskConfig.forkFromDescLong', '选择已完成的任务继承其对话上下文，新任务将延续之前任务的对话内容。')}
          </div>
        </div>
        {forkFromTaskId !== null && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onForkFromChange(null);
            }}
            style={{
              fontSize: '12px',
              color: 'var(--color-error)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background-color 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(229, 115, 115, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {t('ui:actions.clear', '清空')}
          </button>
        )}
      </div>
      {/* 项目筛选器 */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <select
          value={contextProjectFilter}
          onChange={(e) => setContextProjectFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            padding: '6px 8px',
            fontSize: '13px',
            color: 'var(--text-primary)',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="all">{t('ui:filters.allProjects', '全部项目')}</option>
          {projects?.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>
      {/* 列表区 */}
      <div style={{ padding: '8px 0', maxHeight: '320px', overflow: 'auto' }}>
        {completedTasks.map((task) => (
          <PopoverItem
            key={task.id}
            selected={forkFromTaskId === task.id}
            onClick={() => onForkFromChange(task.id)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* 单选框 */}
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: `2px solid ${forkFromTaskId === task.id ? '#8B7D6B' : 'var(--border-visible)'}`,
                  backgroundColor: forkFromTaskId === task.id ? '#8B7D6B' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {forkFromTaskId === task.id && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              {/* 任务信息 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: forkFromTaskId === task.id ? 600 : 500,
                    color: forkFromTaskId === task.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={task.initial_prompt || task.prompt}
                >
                  {task.initial_prompt || task.prompt}
                </div>
              </div>
              {/* 状态标签 */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: '20px',
                  padding: '0 8px',
                  fontSize: '10px',
                  fontWeight: 500,
                  color: getStatusColor(task.status),
                  backgroundColor: getStatusBgColor(task.status),
                  borderRadius: '4px',
                  flexShrink: 0,
                }}
              >
                {taskStatusLabels[task.status]}
              </span>
            </div>
          </PopoverItem>
        ))}
        {completedTasks.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            {allCompletedTasks.length === 0 ? t('ui:taskConfig.noCompletedTasks', '没有已完成的任务') : t('ui:taskConfig.noCompletedTasksInProject', '该项目下没有已完成的任务')}
          </div>
        )}
      </div>
    </SimplePopover>
  );

  // 渲染隔离开关
  const renderIsolatedToggle = () => {
    const handleMouseEnter = () => {
      if (isolatedToggleRef.current) {
        const rect = isolatedToggleRef.current.getBoundingClientRect();
        const tooltipWidth = 260;
        const viewportWidth = window.innerWidth;

        // 计算水平位置，确保 Tooltip 不超出屏幕
        let leftPos = rect.left + window.scrollX + (rect.width / 2);
        if (leftPos - tooltipWidth / 2 < 10) {
          leftPos = 10 + tooltipWidth / 2;
        } else if (leftPos + tooltipWidth / 2 > viewportWidth - 10) {
          leftPos = viewportWidth - 10 - tooltipWidth / 2;
        }

        setIsolatedTooltipPosition({
          top: rect.bottom + window.scrollY + 8,
          left: leftPos,
          width: rect.width,
        });
      }
      setShowIsolatedTooltip(true);
    };

    const handleMouseLeave = () => {
      setShowIsolatedTooltip(false);
    };

    return (
      <>
        <div
          ref={isolatedToggleRef}
          className="mobile-config-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '10px',
            backgroundColor: isIsolated ? 'var(--bg-secondary)' : 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
            transition: 'all 150ms ease',
            position: 'relative',
            minHeight: '44px',
          }}
          onClick={() => onIsolatedChange(!isIsolated)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 9h6v6H9z" />
          </svg>
          <span style={{ fontSize: '14px', fontWeight: isIsolated ? 600 : 500, color: isIsolated ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {t('ui:taskConfig.isolatedMode', '隔离')}
          </span>
          {isIsolated && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: 'var(--text-primary)' }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>

        {/* Tooltip 提示框 */}
        {showIsolatedTooltip && (
          <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
              position: 'fixed',
              top: isolatedTooltipPosition.top,
              left: isolatedTooltipPosition.left,
              transform: 'translateX(-50%)',
              padding: '10px 14px',
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              border: '1px solid var(--border-visible)',
              fontSize: '12px',
              color: 'var(--text-primary)',
              lineHeight: 1.5,
              maxWidth: '260px',
              textAlign: 'left',
              zIndex: 9996,
              whiteSpace: 'normal',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '12px' }}>
              {t('ui:taskConfig.isolatedMode', '任务隔离')}
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              {t('ui:taskConfig.isolatedModeTooltip', '在隔离环境中执行任务。关联 Git 项目时使用 Git worktree 独立分支（多任务并行避免冲突）；独立任务时在独立目录下执行（安全隔离）。')}
            </div>
          </div>
        )}
      </>
    );
  };

  // 渲染自动批准 checkbox
  const renderAutoApproveToggle = () => {
    const handleMouseEnter = () => {
      if (autoApproveRef.current) {
        const rect = autoApproveRef.current.getBoundingClientRect();
        const tooltipWidth = 280;
        const viewportWidth = window.innerWidth;

        // 计算水平位置，确保 Tooltip 不超出屏幕
        let leftPos = rect.left + window.scrollX + (rect.width / 2);
        if (leftPos - tooltipWidth / 2 < 10) {
          leftPos = 10 + tooltipWidth / 2;
        } else if (leftPos + tooltipWidth / 2 > viewportWidth - 10) {
          leftPos = viewportWidth - 10 - tooltipWidth / 2;
        }

        setAutoApproveTooltipPosition({
          top: rect.bottom + window.scrollY + 8,
          left: leftPos,
          width: rect.width,
        });
      }
      setShowAutoApproveTooltip(true);
    };

    const handleMouseLeave = () => {
      setShowAutoApproveTooltip(false);
    };

    return (
      <>
        <div
          ref={autoApproveRef}
          className="mobile-config-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '10px',
            backgroundColor: autoApprove ? 'var(--bg-secondary)' : 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            position: 'relative',
            minHeight: '44px',
          }}
          onClick={() => onAutoApproveChange(!autoApprove)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* 闪电图标 - 表示自动/快速 */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span style={{ fontSize: '14px', fontWeight: autoApprove ? 600 : 500, color: autoApprove ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {t('ui:taskConfig.autoApprove', '自动批准')}
          </span>
          {autoApprove && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: 'var(--text-primary)' }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>

        {/* Tooltip 提示框 */}
        {showAutoApproveTooltip && (
          <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
              position: 'fixed',
              top: autoApproveTooltipPosition.top,
              left: autoApproveTooltipPosition.left,
              transform: 'translateX(-50%)',
              padding: '10px 14px',
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              border: '1px solid var(--border-visible)',
              fontSize: '12px',
              color: 'var(--text-primary)',
              lineHeight: 1.5,
              maxWidth: '280px',
              textAlign: 'left',
              zIndex: 9996,
              whiteSpace: 'normal',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '12px' }}>
              {t('ui:taskConfig.autoApprove', '自动批准')}
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              {t('ui:taskConfig.autoApproveTooltip', '任务完成后自动批准，跳过检视状态直接进入下一环节。')}
            </div>
          </div>
        )}
      </>
    );
  };

  // 渲染计划模式选项
  const renderPlanModeToggle = () => (
    <div
      className="mobile-config-item"
      onClick={() => onTaskModeChange(taskMode === 'plan' ? 'execute' : 'plan')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '10px',
        backgroundColor: taskMode === 'plan' ? 'var(--bg-secondary)' : 'var(--bg-primary)',
        border: taskMode === 'plan' ? '1px solid var(--border-visible)' : '1px solid var(--border-subtle)',
        cursor: 'pointer',
        transition: 'all 150ms ease',
        minHeight: '44px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = taskMode === 'plan' ? 'var(--bg-tertiary)' : 'var(--bg-secondary)';
        e.currentTarget.style.borderColor = 'var(--border-visible)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = taskMode === 'plan' ? 'var(--bg-secondary)' : 'var(--bg-primary)';
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
      <span style={{ fontSize: '14px', fontWeight: taskMode === 'plan' ? 600 : 500, color: taskMode === 'plan' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        {t('ui:taskConfig.planMode', '计划模式')}
      </span>
      {taskMode === 'plan' && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: 'var(--text-primary)', flexShrink: 0 }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );

  // 渲染高级选项切换按钮 (仅移动端)
  const renderAdvancedOptionsToggle = () => (
    <button
      type="button"
      onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)}
      className="mobile-advanced-toggle mobile-config-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderRadius: '10px',
        backgroundColor: isAdvancedExpanded ? 'var(--bg-secondary)' : 'var(--bg-primary)',
        border: '1px solid var(--border-subtle)',
        cursor: 'pointer',
        transition: 'all 150ms ease',
        minHeight: '44px',
        width: '100%',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = isAdvancedExpanded ? 'var(--bg-tertiary)' : 'var(--bg-secondary)';
        e.currentTarget.style.borderColor = 'var(--border-visible)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isAdvancedExpanded ? 'var(--bg-secondary)' : 'var(--bg-primary)';
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
      }}
    >
      <span style={{ fontSize: '14px', fontWeight: isAdvancedExpanded ? 600 : 500, color: isAdvancedExpanded ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        {t('ui:taskConfig.advancedOptions', '高级选项')}
      </span>
      <svg
        width="16" height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          marginLeft: 'auto',
          color: 'var(--text-secondary)',
          flexShrink: 0,
          transition: 'transform 150ms ease',
          transform: isAdvancedExpanded ? 'rotate(180deg)' : 'none',
        }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );

  return (
    <div
      className="mobile-config-stack"
      style={{
        display: 'flex',
        gap: '6px',
        padding: '0',
        marginBottom: '8px',
      }}
    >
      {renderProjectSelector()}
      {renderPlanModeToggle()}
      {renderAdvancedOptionsToggle()}

      {/* 高级选项展开容器 - 桌面端始终显示，移动端由展开状态控制 */}
      {(isDesktop || isAdvancedExpanded) && (
        <>
          {renderDependencySelector()}
          {renderForkSelector()}
          {renderIsolatedToggle()}
          {renderAutoApproveToggle()}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Create Project Dialog
// ============================================================================

interface CreateProjectDialogProps {
  onClose: () => void;
  onSubmit: (data: { name: string; path: string; display_name?: string; description?: string }) => void;
  isPending: boolean;
}

function CreateProjectDialog({ onClose, onSubmit, isPending }: CreateProjectDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !path.trim()) {
      return;
    }
    onSubmit({
      name: name.trim(),
      path: path.trim(),
      display_name: displayName.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.3)', zIndex: 9998 }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#FFFEF9',
          borderRadius: '16px',
          padding: '24px',
          zIndex: 9999,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
      >
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#2D2926',
            margin: '0 0 20px 0',
          }}
        >
          {t('ui:project.newProject', '新建项目')}
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Name */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#2D2926',
                  marginBottom: '6px',
                }}
              >
                {t('ui:project.nameLabel', '项目名称 *')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('ui:project.namePlaceholder', 'my-project')}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  color: '#2D2926',
                  backgroundColor: '#F9F6F1',
                  border: '1px solid rgba(45, 41, 38, 0.1)',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'all 150ms ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(45, 41, 38, 0.25)';
                  e.currentTarget.style.backgroundColor = '#F3EDE5';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(45, 41, 38, 0.1)';
                  e.currentTarget.style.backgroundColor = '#F9F6F1';
                }}
              />
            </div>

            {/* Path with FolderPicker */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#2D2926',
                  marginBottom: '6px',
                }}
              >
                {t('ui:project.pathLabel', '项目路径 *')}
              </label>
              <FolderPicker
                value={path}
                onChange={setPath}
                placeholder={t('ui:project.pathPlaceholder', '选择项目文件夹路径')}
              />
            </div>

            {/* Display Name */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#2D2926',
                  marginBottom: '6px',
                }}
              >
                {t('ui:project.displayNameLabel', '显示名称')}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('ui:project.displayNamePlaceholder', '我的项目')}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  color: '#2D2926',
                  backgroundColor: '#F9F6F1',
                  border: '1px solid rgba(45, 41, 38, 0.1)',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'all 150ms ease',
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#2D2926',
                  marginBottom: '6px',
                }}
              >
                {t('ui:project.descriptionLabel', '项目描述')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('ui:project.descriptionPlaceholder', '项目描述...')}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  color: '#2D2926',
                  backgroundColor: '#F9F6F1',
                  border: '1px solid rgba(45, 41, 38, 0.1)',
                  borderRadius: '8px',
                  outline: 'none',
                  resize: 'vertical',
                  transition: 'all 150ms ease',
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#5C5651',
                backgroundColor: 'rgba(45, 41, 38, 0.08)',
                border: '1px solid rgba(45, 41, 38, 0.15)',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {t('ui:project.cancel', '取消')}
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim() || !path.trim()}
              style={{
                flex: 1,
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#fff',
                backgroundColor: isPending || (!name.trim() || !path.trim()) ? 'rgba(45, 41, 38, 0.5)' : '#2D2926',
                border: 'none',
                borderRadius: '10px',
                cursor: isPending || (!name.trim() || !path.trim()) ? 'not-allowed' : 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {isPending ? t('ui:project.creating', '创建中...') : t('ui:project.create', '创建项目')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
