/**
 * Card Component
 * 统一卡片组件 - 温暖人文主义设计
 *
 * Design:
 * - 圆角 16px (rounded-xl)
 * - 微妙边框和阴影
 * - hover 时轻微上移、边框加深、阴影加深
 */

import { ReactNode } from 'react';

// ============================================================================
// Types (类型定义)
// ============================================================================

export interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}

export interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

// ============================================================================
// Components (组件)
// ============================================================================

export function Card({ children, className = '', hover = false, clickable = false, onClick }: CardProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        // 移动端优化 padding
        padding: '14px',
        backgroundColor: '#FFFEF9',
        border: '1px solid rgba(45, 41, 38, 0.08)',
        borderRadius: '16px',
        boxShadow: '0 1px 2px rgba(45, 41, 38, 0.04)',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'all 200ms ease-out',
      }}
      onMouseEnter={(e) => {
        if (hover) {
          e.currentTarget.style.backgroundColor = '#F3EDE5';
          e.currentTarget.style.borderColor = 'rgba(45, 41, 38, 0.15)';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(45, 41, 38, 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (hover) {
          e.currentTarget.style.backgroundColor = '#FFFEF9';
          e.currentTarget.style.borderColor = 'rgba(45, 41, 38, 0.08)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 1px 2px rgba(45, 41, 38, 0.04)';
        }
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div style={{ padding: '0 0 12px 0', borderBottom: '1px solid rgba(45, 41, 38, 0.08)' }} className={className}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }: CardBodyProps) {
  return <div className={className}>{children}</div>;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(45, 41, 38, 0.08)' }} className={className}>
      {children}
    </div>
  );
}

// ============================================================================
// Convenience Components (便捷组件)
// ============================================================================

export interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <h3
      className={className}
      style={{
        fontSize: '15px',
        fontWeight: 600,
        color: '#2D2926',
        margin: 0,
        lineHeight: 1.4,
      }}
    >
      {children}
    </h3>
  );
}

export interface CardSubtitleProps {
  children: ReactNode;
  className?: string;
}

export function CardSubtitle({ children, className = '' }: CardSubtitleProps) {
  return (
    <p className={className} style={{ fontSize: '13px', color: '#5C5651', margin: 0 }}>
      {children}
    </p>
  );
}

export interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function CardDescription({ children, className = '' }: CardDescriptionProps) {
  return (
    <p className={className} style={{ fontSize: '13px', color: '#8B837B', margin: 0, lineHeight: 1.5 }}>
      {children}
    </p>
  );
}
