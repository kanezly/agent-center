/**
 * Inbox Dropdown Component
 * 收件箱下拉面板
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInboxItems, deleteInboxItem } from '@/lib/api/inbox';
import { getProjects } from '@/lib/api/projects';
import { InboxCard } from './InboxCard';

interface InboxDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onInboxConvert?: (data: {
    id: number;
    prompt: string;
    projectId?: number | null;
    mode?: 'execute' | 'plan';
    dependsOnTaskIds?: number[];
    forkFromTaskId?: number | null;
    isIsolated?: boolean;
    autoApprove?: boolean;
  }) => void;
}

export function InboxDropdown({ isOpen, onClose, onInboxConvert }: InboxDropdownProps) {
  const { t } = useTranslation();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 获取 Inbox 列表
  const { data: inboxItems = [] } = useQuery({
    queryKey: ['inbox', selectedProjectId],
    queryFn: () => getInboxItems(selectedProjectId || undefined),
    enabled: isOpen,
    staleTime: 10000,
  });

  // 获取项目列表（用于筛选）
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    staleTime: Infinity,
  });

  // 删除 Inbox 记录
  const deleteMutation = useMutation({
    mutationFn: deleteInboxItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inboxCount'] });
    },
  });

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleConvertClick = (item: (typeof inboxItems)[0]) => {
    onInboxConvert?.({
      id: item.id,
      prompt: item.prompt,
      projectId: item.project_id,
      mode: item.mode,
      dependsOnTaskIds: item.depends_on_task_ids,
      forkFromTaskId: item.fork_from_task_id,
      isIsolated: item.is_isolated,
      autoApprove: item.auto_approve,
    });
    onClose(); // 关闭待办清单
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 - 点击关闭 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          zIndex: 9998,
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      >
        {/* 内部容器 - 阻止点击冒泡到遮罩层 */}
        <div
          onClick={(e) => e.stopPropagation()}
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '420px',
            maxWidth: '90vw',
            background: '#FFFEF9',
            border: '1px solid rgba(45, 41, 38, 0.08)',
            borderRadius: '12px',
            boxShadow: '0 8px 48px rgba(45, 41, 38, 0.15)',
            padding: '16px',
            zIndex: 9999,
            maxHeight: '500px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              gap: '8px',
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#2D2926', margin: 0 }}>
              {t('ui:inbox.title', '待办清单')}
            </h3>

            {/* 项目筛选 */}
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
              onClick={(e) => e.stopPropagation()}
              style={{
                padding: '6px 10px',
                fontSize: '13px',
                color: '#5C5651',
                backgroundColor: 'white',
                border: '1px solid rgba(45, 41, 38, 0.15)',
                borderRadius: '6px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="">{t('ui:filters.allProjects', '全部项目')}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Divider */}
        <div style={{ height: '1px', backgroundColor: 'rgba(45, 41, 38, 0.08)', marginBottom: '12px' }} />

        {/* Inbox List */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          {inboxItems.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px 0',
                color: '#8B837B',
                fontSize: '13px',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '8px' }}>
                <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <span>{t('ui:inbox.empty', '暂无待办记录')}</span>
            </div>
          ) : (
            inboxItems.map((item) => (
              <InboxCard
                key={item.id}
                id={item.id}
                prompt={item.prompt}
                prompt_short={item.prompt.length > 50 ? item.prompt.slice(0, 50) + '...' : item.prompt}
                project_name={item.project_name}
                mode={item.mode}
                depends_on_task_ids={item.depends_on_task_ids}
                is_isolated={item.is_isolated}
                auto_approve={item.auto_approve}
                created_at={item.created_at}
                onConvert={() => handleConvertClick(item)}
                onDelete={() => handleDelete(item.id)}
              />
            ))
          )}
        </div>
        </div>
      </div>
    </>
  );
}
