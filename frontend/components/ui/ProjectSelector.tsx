/**
 * Project Selector Component
 * 项目选择器 - 用于任务创建时选择所属项目，支持新建项目
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProjects, createProject, deleteProject } from '@/lib/api/projects';
import type { Project, ProjectCreateRequest } from '@/types/project';
import { FolderPicker } from './FolderPicker';

interface ProjectSelectorProps {
  onChange: (projectId: number | null) => void;
  disabled?: boolean;
}

const STORAGE_KEY = 'ccm-last-selected-project';

export function ProjectSelector({ onChange, disabled = false }: ProjectSelectorProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);

  // 获取项目列表
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    staleTime: Infinity,
  });

  // 创建项目 mutation
  const createMutation = useMutation({
    mutationFn: (data: ProjectCreateRequest) => createProject(data),
    onSuccess: (result) => {
      // 刷新项目列表
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      // 自动选中新创建的项目
      const newId = result.id;
      setSelectedId(newId);
      onChange(newId);
      localStorage.setItem(STORAGE_KEY, newId.toString());
      // 关闭对话框
      setShowCreateDialog(false);
      setIsOpen(false);
    },
  });

  // 删除项目 mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProject(id),
    onSuccess: (result) => {
      // 刷新项目列表
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      // 如果删除的是当前选中的项目，清空选择
      if (result.id === selectedId) {
        setSelectedId(null);
        onChange(null);
        localStorage.removeItem(STORAGE_KEY);
      }
      setDeletingProjectId(null);
    },
  });

  // 从 localStorage 恢复上次选择
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const id = parseInt(saved, 10);
      if (!isNaN(id)) {
        setSelectedId(id);
        onChange(id);
      }
    }
  }, []);

  // 保存选择到 localStorage
  const handleSelect = (id: number | null) => {
    setSelectedId(id);
    onChange(id);
    if (id !== null) {
      localStorage.setItem(STORAGE_KEY, id.toString());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setIsOpen(false);
  };

  const selectedProject = projects?.find(p => p.id === selectedId);

  return (
    <div style={{ position: 'relative' }}>
      {/* 选择器按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        title={selectedProject ? `当前项目：${selectedProject.display_name || selectedProject.name}` : t('ui:taskConfig.selectProject')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0 12px',
          height: '32px',
          fontSize: '13px',
          fontWeight: 500,
          color: selectedProject ? '#2D2926' : '#5C5651',
          backgroundColor: selectedProject ? 'rgba(45, 41, 38, 0.08)' : 'transparent',
          border: '1px solid rgba(45, 41, 38, 0.15)',
          borderRadius: '10px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 150ms ease',
          opacity: disabled ? 0.6 : 1,
          boxShadow: 'var(--shadow-ios-sm)',
        }}
        onMouseEnter={(e) => {
          if (!disabled && !isOpen) {
            e.currentTarget.style.backgroundColor = '#F3EDE5';
            e.currentTarget.style.boxShadow = 'var(--shadow-ios-md)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isOpen) {
            e.currentTarget.style.backgroundColor = selectedProject ? 'rgba(45, 41, 38, 0.08)' : 'transparent';
            e.currentTarget.style.boxShadow = 'var(--shadow-ios-sm)';
          }
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
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        {isLoading ? (
          <span>{t('ui:project.loading')}</span>
        ) : (
          <span>{t('ui:project.linkProject')}</span>
        )}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: 'transform 150ms ease' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 50,
            minWidth: '200px',
            maxHeight: '300px',
            overflowY: 'auto',
            backgroundColor: 'rgba(255, 254, 249, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(45, 41, 38, 0.15)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-ios-lg)',
            padding: '6px',
          }}
        >
          {/* 无项目选项 */}
          <button
            onClick={() => handleSelect(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 10px',
              fontSize: '13px',
              fontWeight: selectedId === null ? 600 : 500,
              color: selectedId === null ? '#2D2926' : '#5C5651',
              backgroundColor: selectedId === null ? 'rgba(45, 41, 38, 0.08)' : 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => {
              if (selectedId !== null) {
                e.currentTarget.style.backgroundColor = '#F3EDE5';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedId !== null) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
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
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {t('ui:project.noProject')}
          </button>

          {/* 项目列表 */}
          {projects?.map((project) => (
            <div
              key={project.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '2px',
              }}
            >
              <button
                onClick={() => handleSelect(project.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  flex: 1,
                  padding: '8px 10px',
                  fontSize: '13px',
                  fontWeight: selectedId === project.id ? 600 : 500,
                  color: selectedId === project.id ? '#2D2926' : '#5C5651',
                  backgroundColor: selectedId === project.id ? 'rgba(45, 41, 38, 0.08)' : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={(e) => {
                  if (selectedId !== project.id) {
                    e.currentTarget.style.backgroundColor = '#F3EDE5';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedId !== project.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
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
                  style={{ marginTop: '2px', flexShrink: 0 }}
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, marginBottom: '2px' }}>
                    {project.display_name || project.name}
                  </div>
                  {project.description && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#8B837B',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {project.description}
                    </div>
                  )}
                </div>
              </button>
              {/* 删除按钮 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`${t('ui:project.confirmDelete')} "${project.display_name || project.name}" ${t('ui:project.deleteConfirm')}`)) {
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

          {/* 分隔线 */}
          <div
            style={{
              margin: '8px 0',
              height: '1px',
              backgroundColor: 'rgba(45, 41, 38, 0.08)',
            }}
          />

          {/* 新建项目按钮 */}
          <button
            onClick={() => {
              setShowCreateDialog(true);
              setIsOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 10px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#2D2926',
              backgroundColor: 'transparent',
              border: '1px dashed rgba(45, 41, 38, 0.25)',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 150ms ease',
              marginTop: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F3EDE5';
              e.currentTarget.style.borderColor = 'rgba(45, 41, 38, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(45, 41, 38, 0.25)';
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t('ui:project.createProject')}
          </button>
        </div>
      )}

      {/* 点击外部关闭 */}
      {isOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 创建项目对话框 */}
      {showCreateDialog && (
        <CreateProjectDialog
          onClose={() => setShowCreateDialog(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isPending={createMutation.isPending}
        />
      )}
    </div>
  );
}

// ============================================================================
// Create Project Dialog
// ============================================================================

interface CreateProjectDialogProps {
  onClose: () => void;
  onSubmit: (data: ProjectCreateRequest) => void;
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
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.3)', zIndex: 100 }}
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
          zIndex: 101,
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
          {t('ui:project.newProject')}
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
                {t('ui:project.nameLabel')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('ui:project.namePlaceholder')}
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
                {t('ui:project.pathLabel')}
              </label>
              <FolderPicker
                value={path}
                onChange={setPath}
                placeholder={t('ui:project.pathPlaceholder')}
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
                {t('ui:project.displayNameLabel')}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('ui:project.displayNamePlaceholder')}
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
                {t('ui:project.descriptionLabel')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('ui:project.descriptionPlaceholder')}
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
              {t('ui:project.cancel')}
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
              {isPending ? t('ui:project.creating') : t('ui:project.create')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
