/**
 * Tooltip Component
 * 简约提示工具 - 用于显示帮助信息
 *
 * 设计特点:
 * - 悬停显示
 * - 淡入淡出动画
 * - 圆角设计
 * - 温暖色调
 */

'use client';

import { useState, ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
  delay?: number;
}

export function Tooltip({ content, children, position = 'top', delay = 200 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    const id = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    setTimeoutId(id);
  };

  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    setIsVisible(false);
  };

  // 根据位置计算偏移
  const positionStyles: Record<string, React.CSSProperties> = {
    top: {
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: '8px',
    },
    right: {
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginLeft: '8px',
    },
    bottom: {
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginTop: '8px',
    },
    left: {
      right: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginRight: '8px',
    },
  };

  // 箭头位置
  const arrowStyles: Record<string, React.CSSProperties> = {
    top: {
      bottom: '-4px',
      left: '50%',
      transform: 'translateX(-50%) rotate(45deg)',
    },
    right: {
      left: '-4px',
      top: '50%',
      transform: 'translateY(-50%) rotate(45deg)',
    },
    bottom: {
      top: '-4px',
      left: '50%',
      transform: 'translateX(-50%) rotate(45deg)',
    },
    left: {
      right: '-4px',
      top: '50%',
      transform: 'translateY(-50%) rotate(45deg)',
    },
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}

      {/* Tooltip 内容 */}
      {isVisible && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            zIndex: 1000,
            maxWidth: '280px',
            padding: '8px 12px',
            backgroundColor: '#2D2926',
            color: '#FFFEF9',
            fontSize: '12px',
            fontWeight: 500,
            lineHeight: 1.5,
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(45, 41, 38, 0.25)',
            animation: 'tooltipFadeIn 150ms ease-out',
            pointerEvents: 'none',
            ...positionStyles[position],
          }}
        >
          {content}
          {/* 箭头 */}
          <div
            style={{
              position: 'absolute',
              width: '8px',
              height: '8px',
              backgroundColor: '#2D2926',
              ...arrowStyles[position],
            }}
          />
        </div>
      )}

      {/* 内联样式用于动画 */}
      <style>{`
        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * InfoIcon 组件 - 用于帮助提示图标
 */
interface InfoIconProps {
  content: string;
  size?: number;
  color?: string;
}

export function InfoIcon({ content, size = 16, color = 'var(--text-muted)' }: InfoIconProps) {
  return (
    <Tooltip content={content}>
      <button
        type="button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${size}px`,
          height: `${size}px`,
          padding: 0,
          marginLeft: '6px',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: '50%',
          cursor: 'help',
          color: color,
          transition: 'all 150ms ease-out',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(45, 41, 38, 0.06)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = color;
        }}
        aria-label="帮助"
      >
        <svg
          width={size * 0.7}
          height={size * 0.7}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
      </button>
    </Tooltip>
  );
}
