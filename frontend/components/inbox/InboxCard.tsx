/**
 * Inbox Card Component
 * 收件箱卡片组件
 */

'use client';

import { useTranslation } from 'react-i18next';
import { formatRelativeTime } from '@/lib/utils/time';

interface InboxCardProps {
  id: number;
  prompt: string;
  prompt_short?: string;
  project_name?: string;
  mode?: 'execute' | 'plan';
  depends_on_task_ids?: number[];
  is_isolated?: boolean;
  auto_approve?: boolean;
  created_at: string;
  onConvert: () => void;
  onDelete: () => void;
}

export function InboxCard({
  id,
  prompt,
  prompt_short,
  project_name,
  mode,
  depends_on_task_ids,
  is_isolated,
  auto_approve,
  created_at,
  onConvert,
  onDelete,
}: InboxCardProps) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid rgba(45, 41, 38, 0.06)',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '8px',
        transition: 'box-shadow 150ms ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(45, 41, 38, 0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Content */}
      <div style={{ marginBottom: '10px' }}>
        <p
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: '#2D2926',
            lineHeight: 1.5,
            margin: '0 0 4px 0',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '42px',
          }}
        >
          {prompt_short || prompt}
        </p>
      </div>

      {/* Config Tags */}
      {(mode === 'plan' || depends_on_task_ids?.length || is_isolated || auto_approve) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '10px',
          }}
        >
          {mode === 'plan' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 500,
                color: '#007AFF',
                backgroundColor: 'rgba(0, 122, 255, 0.1)',
                borderRadius: '4px',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              {t('ui:task.mode.plan', '计划模式')}
            </span>
          )}
          {depends_on_task_ids && depends_on_task_ids.length > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 500,
                color: '#8B5CF6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                borderRadius: '4px',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2" />
              </svg>
              {t('ui:task.dependencies', '依赖任务')} {depends_on_task_ids.length}
            </span>
          )}
          {is_isolated && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 500,
                color: '#059669',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                borderRadius: '4px',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {t('ui:task.isolation.enabled', '隔离执行')}
            </span>
          )}
          {auto_approve && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 500,
                color: '#D97706',
                backgroundColor: 'rgba(217, 119, 6, 0.1)',
                borderRadius: '4px',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              {t('ui:task.auto_approve.enabled', '自动批准')}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#8B837B',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {project_name && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {project_name}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConvert();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'white',
              backgroundColor: '#2D2926',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background 150ms ease',
              minHeight: '36px',
            }}
            className="sm:min-h-0"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#4A4543';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2D2926';
            }}
          >
            {t('ui:actions.execute', '执行')}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '36px',
              height: '36px',
              color: '#8B837B',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(229, 115, 115, 0.1)';
              e.currentTarget.style.color = '#E57373';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#8B837B';
            }}
            title={t('ui:actions.delete', '删除')}
            aria-label={t('ui:actions.delete', '删除')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
