/**
 * Simple Popover Component
 * 极简弹出式下拉菜单 - 用于任务配置选择
 *
 * 设计哲学：
 * - 视觉静止：无动画，直接显示/隐藏
 * - 内容优先：无标题，纯列表
 * - 极简主义：仅保留必要元素
 */

'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';

interface SimplePopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  width?: number;
  maxHeight?: number;
  align?: 'left' | 'right';
}

export function SimplePopover({
  trigger,
  children,
  width = 280,
  maxHeight = 400,
  align = 'left',
}: SimplePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

  // ESC 键关闭
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  const handleTriggerClick = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // 在移动端使用屏幕宽度作为最大宽度限制
      const maxWidth = Math.min(width, viewportWidth - 16);

      // 计算水平位置，确保 Popover 不超出屏幕
      let leftPos = rect.left;

      // 如果靠右对齐
      if (align === 'right') {
        leftPos = rect.right - maxWidth;
        // 确保不超出左边界
        if (leftPos < 8) {
          leftPos = 8;
        }
      } else {
        // 靠左对齐，确保不超出右边界
        if (leftPos + maxWidth > viewportWidth - 8) {
          leftPos = viewportWidth - maxWidth - 8;
        }
      }

      // 确保 leftPos 不小于 8px（左侧安全边距）
      if (leftPos < 8) {
        leftPos = 8;
      }

      // 计算垂直位置，确保 Popover 不超出屏幕
      const spaceBelow = viewportHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;

      let topPos = rect.bottom + 8;

      // 如果下方空间不足且上方有足够空间，则向上显示
      if (spaceBelow < maxHeight && spaceAbove > spaceBelow) {
        topPos = rect.top - maxHeight - 8;
        // 确保不超出顶部
        if (topPos < 8) {
          topPos = 8;
        }
      }

      setPosition({
        top: topPos,
        left: leftPos,
      });
    }
    setIsOpen(true);
  };

  if (!isOpen) {
    return (
      <div ref={containerRef} onClick={handleTriggerClick} style={{ cursor: 'pointer' }}>
        {trigger}
      </div>
    );
  }

  // 在移动端使用屏幕宽度作为最大宽度限制
  const maxWidth = Math.min(width, typeof window !== 'undefined' ? window.innerWidth - 16 : width);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* 触发器 */}
      <div onClick={handleTriggerClick} style={{ cursor: 'pointer' }}>
        {trigger}
      </div>

      {/* Popover 内容 */}
      <div
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          width: maxWidth,
          maxWidth: 'calc(100vw - 16px)',
          maxHeight: maxHeight,
          overflow: 'auto',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(45, 41, 38, 0.1)',
          border: '1px solid var(--border-subtle)',
          zIndex: 9997,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Popover Item 组件
 */
interface PopoverItemProps {
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
}

export function PopoverItem({ children, onClick, selected = false, disabled = false }: PopoverItemProps) {
  return (
    <div
      onClick={() => !disabled && onClick?.()}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: selected ? 'var(--bg-secondary)' : 'transparent',
        transition: 'background-color 150ms ease',
        borderBottom: '1px solid var(--border-subtle)',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = selected ? 'var(--bg-tertiary)' : 'var(--bg-secondary)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = selected ? 'var(--bg-secondary)' : 'transparent';
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
