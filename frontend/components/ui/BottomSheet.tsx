/**
 * Bottom Sheet Component
 * 底部抽屉组件 - 温暖人文主义设计
 *
 * Design:
 * - 从底部滑入动画
 * - 支持拖拽关闭
 * - 支持 safe-area-inset
 * - Apple 风格弹性动画
 */

'use client';

import { useEffect, useCallback, ReactNode, useRef, useState } from 'react';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  maxHeight?: string;
  size?: 'md' | 'lg' | 'xl' | 'full';
  showDragHandle?: boolean;
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  maxHeight = '75vh',
  size = 'lg',
  showDragHandle = true,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // 处理 ESC 键关闭
  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // 添加/移除键盘事件监听
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
      // 延迟显示动画
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEsc]);

  // 拖拽处理
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setStartY(clientY);
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setCurrentY(Math.max(0, clientY - startY));
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // 如果拖动超过阈值，则关闭
    if (currentY > 100) {
      onClose();
    }
    setCurrentY(0);
  };

  if (!isOpen && !isVisible) return null;

  // 根据尺寸确定最大宽度
  const sizeMap = {
    md: '512px',
    lg: '640px',
    xl: '768px',
    full: '95vw',
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* 遮罩层 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(45, 41, 38, 0.4)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 350ms ease-out',
        }}
        onClick={onClose}
      />

      {/* 底部抽屉 */}
      <div
        ref={sheetRef}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxWidth: sizeMap[size],
          margin: '0 auto',
          marginBottom: '16px',
          backgroundColor: '#FFFEF9',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          boxShadow: '0 -10px 40px rgba(45, 41, 38, 0.15)',
          maxHeight,
          display: 'flex',
          flexDirection: 'column',
          transform: isVisible
            ? `translateY(${isDragging ? currentY : 0}px)`
            : 'translateY(100%)',
          transition: isDragging
            ? 'none'
            : 'transform 350ms cubic-bezier(0.16, 1, 0.3, 1)',
          // Safe area support
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
        }}
      >
        {/* 拖动条 */}
        {showDragHandle && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              paddingTop: '12px',
              paddingBottom: '8px',
              cursor: 'grab',
              touchAction: 'none',
            }}
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
          >
            <div
              style={{
                width: '36px',
                height: '4px',
                backgroundColor: 'rgba(45, 41, 38, 0.15)',
                borderRadius: '2px',
              }}
            />
          </div>
        )}

        {/* 头部（可选） */}
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 20px 16px',
              borderBottom: '1px solid rgba(45, 41, 38, 0.06)',
            }}
          >
            <h2
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#2D2926',
                margin: 0,
              }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#5C5651',
                transition: 'all 150ms ease-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F3EDE5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label="关闭"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* 内容区域 */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            overscrollBehavior: 'contain',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Convenience Components (便捷组件)
// ============================================================================

export interface TaskBottomSheetProps extends Omit<BottomSheetProps, 'title'> {
  taskId: number | null;
}

export function TaskBottomSheet({ taskId, ...props }: TaskBottomSheetProps) {
  return (
    <BottomSheet {...props} size="xl">
      {props.children}
    </BottomSheet>
  );
}

export interface PlanBottomSheetProps extends Omit<BottomSheetProps, 'title'> {
  planId: number | null;
}

export function PlanBottomSheet({ planId, ...props }: PlanBottomSheetProps) {
  return (
    <BottomSheet {...props} size="xl">
      {props.children}
    </BottomSheet>
  );
}
