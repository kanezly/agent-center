/**
 * Smart Filter Component
 * 智能筛选组件 - 温暖人文主义设计
 *
 * Design:
 * - 带边框的圆角按钮
 * - 选中时浅色背景 + 可见边框
 * - hover 时背景变化
 */

'use client';

import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface FilterOption<T extends string = string> {
  value: T;
  label: string | ReactNode;
  count?: number;
  icon?: ReactNode;
}

export interface SmartFilterProps<T extends string = string> {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

const filterButtonStyle = (isActive: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  // 移动端优化：最小触摸目标 44px
  height: '36px',
  padding: '0 10px',
  fontSize: '12px',
  fontWeight: isActive ? 600 : 500,
  color: isActive ? '#2D2926' : '#5C5651',
  backgroundColor: isActive ? 'rgba(45, 41, 38, 0.08)' : 'transparent',
  border: isActive ? '1px solid rgba(45, 41, 38, 0.15)' : '1px solid rgba(45, 41, 38, 0.08)',
  borderRadius: '12px',
  cursor: 'pointer',
  transition: 'all 150ms ease-out',
  whiteSpace: 'nowrap' as const,
  // 触摸优化
  minHeight: '44px',
});

export function SmartFilter<T extends string = string>({
  options,
  value,
  onChange,
  className = '',
}: SmartFilterProps<T>) {
  return (
    <>
      {/* 移动端：2x2 网格布局 */}
      <div
        className={`mobile-filter-row ${className}`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px',
          padding: '4px',
          width: '100%',
        }}
      >
        {options.map((option) => {
          const isActive = value === option.value;

          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              style={{
                ...filterButtonStyle(isActive),
                height: '44px',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#F3EDE5';
                  e.currentTarget.style.color = '#2D2926';
                  e.currentTarget.style.borderColor = 'rgba(45, 41, 38, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#5C5651';
                  e.currentTarget.style.borderColor = 'rgba(45, 41, 38, 0.08)';
                }
              }}
            >
              {option.icon && (
                <span style={{ opacity: 0.7, display: 'flex', alignItems: 'center' }}>
                  {option.icon}
                </span>
              )}
              <span style={{ flex: 1, textAlign: 'center' }}>{option.label}</span>
              {option.count !== undefined && (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '0 6px',
                    borderRadius: '4px',
                    backgroundColor: isActive ? 'rgba(45, 41, 38, 0.1)' : '#F3EDE5',
                    color: isActive ? '#2D2926' : '#8B837B',
                    marginLeft: '4px',
                  }}
                >
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 桌面端：水平布局 */}
      <div
        className={`desktop-filter-row ${className}`}
        style={{
          display: 'none',
          padding: '4px',
        }}
      >
        {options.map((option) => {
          const isActive = value === option.value;

          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              style={filterButtonStyle(isActive)}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#F3EDE5';
                  e.currentTarget.style.color = '#2D2926';
                  e.currentTarget.style.borderColor = 'rgba(45, 41, 38, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#5C5651';
                  e.currentTarget.style.borderColor = 'rgba(45, 41, 38, 0.08)';
                }
              }}
            >
              {option.icon && (
                <span style={{ opacity: 0.7, display: 'flex', alignItems: 'center' }}>
                  {option.icon}
                </span>
              )}
              <span>{option.label}</span>
              {option.count !== undefined && (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '0 4px',
                    borderRadius: '4px',
                    backgroundColor: isActive ? 'rgba(45, 41, 38, 0.1)' : '#F3EDE5',
                    color: isActive ? '#2D2926' : '#8B837B',
                  }}
                >
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ============================================================================
// Convenience Components (便捷组件)
// ============================================================================

export interface TaskFilterProps {
  value: string;
  onChange: (value: string) => void;
  counts?: {
    all?: number;
    queued?: number;
    running?: number;
    completed?: number;
    failed?: number;
    cancelled?: number;
  };
}

export function TaskFilter({ value, onChange, counts = {} }: TaskFilterProps) {
  const { t } = useTranslation();
  const options: FilterOption[] = [
    { value: 'all', label: t('status:filterGroup.all', '全部'), count: counts.all },
    { value: 'queued', label: t('status:task.queued', '排队中'), count: counts.queued },
    { value: 'running', label: t('status:task.running', '执行中'), count: counts.running, icon: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )},
    { value: 'completed', label: t('status:task.completed', '已完成'), count: counts.completed },
    { value: 'failed', label: t('status:task.failed', '失败'), count: counts.failed },
    { value: 'cancelled', label: t('status:task.cancelled', '已取消'), count: counts.cancelled },
  ];

  return <SmartFilter options={options} value={value} onChange={onChange} />;
}

export interface PlanFilterProps {
  value: string;
  onChange: (value: string) => void;
  counts?: {
    all?: number;
    planning?: number;
    discussing?: number;
    reviewing?: number;
    approved?: number;
    executing?: number;
    completed?: number;
  };
}

export function PlanFilter({ value, onChange, counts = {} }: PlanFilterProps) {
  const { t } = useTranslation();
  const options: FilterOption[] = [
    { value: 'all', label: t('status:filterGroup.all', '全部'), count: counts.all },
    { value: 'planning', label: t('status:plan.generating', '生成中'), count: counts.planning },
    { value: 'discussing', label: t('status:plan.generating', '生成中'), count: counts.discussing },
    { value: 'reviewing', label: t('status:plan.reviewing', '待检视'), count: counts.reviewing },
    { value: 'approved', label: t('status:plan.approved', '已批准'), count: counts.approved },
    { value: 'executing', label: t('status:plan.executing', '执行中'), count: counts.executing },
    { value: 'completed', label: t('status:plan.completed', '已完成'), count: counts.completed },
  ];

  return <SmartFilter options={options} value={value} onChange={onChange} />;
}

// ============================================================================
// Unified Filter (统一筛选 - 合并任务和计划)
// ============================================================================

import type { FilterGroup } from '@/types/task';
import type { ProjectFilter } from '@/lib/state/atoms';
import { useState, useRef, useEffect } from 'react';

export interface UnifiedFilterProps {
  value: FilterGroup;
  onChange: (value: FilterGroup) => void;
  counts?: {
    all?: number;
    'todo-agent'?: number;
    'todo-human'?: number;
    done?: number;
  };
  // 项目筛选相关
  selectedProjectId?: ProjectFilter;
  onProjectChange?: (projectId: ProjectFilter) => void;
  projectOptions?: FilterOption<string>[];
}

export function UnifiedFilter({
  value,
  onChange,
  counts = {},
  selectedProjectId,
  onProjectChange,
  projectOptions,
}: UnifiedFilterProps) {
  const { t } = useTranslation();
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAllClick = () => {
    // 如果已经选择"全部"状态，则切换项目下拉菜单
    if (value === 'all') {
      setShowProjectDropdown(!showProjectDropdown);
    } else {
      // 否则切换到"全部"状态
      onChange('all');
    }
  };

  const handleProjectSelect = (projectValue: string) => {
    let projectId: ProjectFilter;
    if (projectValue === 'all') {
      projectId = 'all';
    } else if (projectValue === 'none') {
      projectId = null;
    } else {
      projectId = parseInt(projectValue, 10);
    }
    onProjectChange?.(projectId);
    setShowProjectDropdown(false);
  };

  // 获取当前选中项目的标签
  const getProjectLabel = () => {
    if (!projectOptions || selectedProjectId === 'all') {
      return t('ui:projectFilter.allProjects', '全部项目');
    }
    if (selectedProjectId === null) {
      return t('ui:projectFilter.noProject', '无项目');
    }
    const option = projectOptions.find((opt) => opt.value === String(selectedProjectId));
    return option?.label || t('ui:projectFilter.allProjects', '全部项目');
  };

  const options: FilterOption<FilterGroup>[] = [
    {
      value: 'all',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>{getProjectLabel()}</span>
          {showProjectDropdown && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          )}
        </div>
      ),
      count: counts.all,
    },
    {
      value: 'todo-agent',
      label: t('status:filterGroup.todo-agent', 'TODO-Agent'),
      count: counts['todo-agent'],
    },
    {
      value: 'todo-human',
      label: t('status:filterGroup.todo-human', 'TODO-Human'),
      count: counts['todo-human'],
    },
    { value: 'done', label: t('status:filterGroup.done', '已完成'), count: counts.done },
  ];

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* 主筛选按钮 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px',
          padding: '4px',
          width: '100%',
        }}
        className="mobile-filter-row"
      >
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              onClick={() => {
                if (option.value === 'all') {
                  handleAllClick();
                } else {
                  onChange(option.value);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '44px',
                padding: '0 10px',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#2D2926' : '#5C5651',
                backgroundColor: isActive ? 'rgba(45, 41, 38, 0.08)' : 'transparent',
                border: isActive ? '1px solid rgba(45, 41, 38, 0.15)' : '1px solid rgba(45, 41, 38, 0.08)',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 150ms ease-out',
                whiteSpace: 'nowrap' as const,
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#F3EDE5';
                  e.currentTarget.style.color = '#2D2926';
                  e.currentTarget.style.borderColor = 'rgba(45, 41, 38, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#5C5651';
                  e.currentTarget.style.borderColor = 'rgba(45, 41, 38, 0.08)';
                }
              }}
            >
              <span style={{ flex: 1, textAlign: 'center' }}>{option.label}</span>
              {option.count !== undefined && (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '0 6px',
                    borderRadius: '4px',
                    backgroundColor: isActive ? 'rgba(45, 41, 38, 0.1)' : '#F3EDE5',
                    color: isActive ? '#2D2926' : '#8B837B',
                    marginLeft: '4px',
                  }}
                >
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 桌面端：水平布局 */}
      <div
        style={{
          display: 'none',
          padding: '4px',
        }}
        className="desktop-filter-row"
      >
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              onClick={() => {
                if (option.value === 'all') {
                  handleAllClick();
                } else {
                  onChange(option.value);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '36px',
                padding: '0 10px',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#2D2926' : '#5C5651',
                backgroundColor: isActive ? 'rgba(45, 41, 38, 0.08)' : 'transparent',
                border: isActive ? '1px solid rgba(45, 41, 38, 0.15)' : '1px solid rgba(45, 41, 38, 0.08)',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 150ms ease-out',
                whiteSpace: 'nowrap' as const,
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#F3EDE5';
                  e.currentTarget.style.color = '#2D2926';
                  e.currentTarget.style.borderColor = 'rgba(45, 41, 38, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#5C5651';
                  e.currentTarget.style.borderColor = 'rgba(45, 41, 38, 0.08)';
                }
              }}
            >
              {option.label}
              {option.count !== undefined && (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '0 4px',
                    borderRadius: '4px',
                    backgroundColor: isActive ? 'rgba(45, 41, 38, 0.1)' : '#F3EDE5',
                    color: isActive ? '#2D2926' : '#8B837B',
                  }}
                >
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 项目选择下拉菜单 */}
      {showProjectDropdown && projectOptions && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            backgroundColor: '#fff',
            border: '1px solid rgba(45, 41, 38, 0.15)',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            minWidth: '160px',
            maxHeight: '280px',
            overflowY: 'auto',
          }}
        >
          {projectOptions.map((option) => {
            const isSelected =
              (option.value === 'all' && selectedProjectId === 'all') ||
              (option.value === 'none' && selectedProjectId === null) ||
              (option.value !== 'all' && option.value !== 'none' && selectedProjectId !== null && selectedProjectId !== 'all' && String(selectedProjectId) === option.value);

            return (
              <button
                key={option.value}
                onClick={() => handleProjectSelect(option.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: isSelected ? '#2D2926' : '#5C5651',
                  backgroundColor: isSelected ? 'rgba(45, 41, 38, 0.08)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 150ms ease-out',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = '#F3EDE5';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span>{option.label}</span>
                {isSelected && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2D2926" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sort Control Component (排序控制)
// ============================================================================

type SortBy = 'updated' | 'created';
type SortOrder = 'desc' | 'asc';

export interface SortControlProps {
  value: SortBy;
  order: SortOrder;
  onChange: (by: SortBy, order: SortOrder) => void;
}

export function SortControl({ value, order, onChange }: SortControlProps) {
  const { t } = useTranslation();
  const options: { by: SortBy; label: string }[] = [
    { by: 'updated', label: t('ui:filters.updatedTime') },
    { by: 'created', label: t('ui:filters.createdTime') },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {/* 排序方式 */}
      {options.map((option) => {
        const isActive = value === option.by;
        return (
          <button
            key={option.by}
            onClick={() => onChange(option.by, order)}
            style={filterButtonStyle(isActive)}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = '#F3EDE5';
                e.currentTarget.style.color = '#2D2926';
                e.currentTarget.style.borderColor = 'rgba(45, 41, 38, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#5C5651';
                e.currentTarget.style.borderColor = 'rgba(45, 41, 38, 0.08)';
              }
            }}
          >
            {option.label}
          </button>
        );
      })}

      {/* 排序顺序切换 - 触摸优化 */}
      <button
        onClick={() => onChange(value, order === 'desc' ? 'asc' : 'desc')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          color: '#5C5651',
          backgroundColor: 'transparent',
          border: '1px solid rgba(45, 41, 38, 0.08)',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 150ms ease-out',
          minHeight: '44px',
        }}
        title={order === 'desc' ? t('ui:filters.desc') : t('ui:filters.asc')}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#F3EDE5';
          e.currentTarget.style.color = '#2D2926';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = '#5C5651';
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
          style={{ transform: order === 'asc' ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease-out' }}
        >
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}
