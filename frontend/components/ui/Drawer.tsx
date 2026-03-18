/**
 * Drawer Component
 * 响应式抽屉组件 - 桌面端从右侧滑入，移动端全屏模态
 *
 * Responsive:
 * - Desktop (>=768px): 侧边抽屉，max-w-{size}
 * - Mobile (<768px): 全屏或 95vw 宽度，从底部滑入
 */

import { useEffect, useCallback, ReactNode } from 'react';

// ============================================================================
// Types (类型定义)
// ============================================================================

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
  position?: 'right' | 'left';
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
}

// ============================================================================
// Component (组件)
// ============================================================================

export function Drawer({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  position = 'right',
  closeOnOverlayClick = true,
  closeOnEsc = true,
}: DrawerProps) {
  // 处理 ESC 键关闭
  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (closeOnEsc && e.key === 'Escape') {
      onClose();
    }
  }, [closeOnEsc, onClose]);

  // 添加/移除键盘事件监听
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      // 阻止背景滚动
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEsc]);

  if (!isOpen) return null;

  // 抽屉宽度
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    full: 'max-w-full',
  };

  return (
    <>
      {/* 遮罩层 - 温暖半透明 */}
      <div
        className={`fixed inset-0 bg-bg-primary/80 z-40 transition-opacity duration-250 backdrop-blur-sm md:backdrop-blur-md ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={closeOnOverlayClick ? onClose : undefined}
      />

      {/* 抽屉容器 - 移动端全屏优化 */}
      <div
        className={`
          fixed inset-y-0 ${position}-0 z-50
          transition-transform duration-250 ease-out
          /* 移动端：全屏宽度，桌面端：自适应宽度 */
          w-full md:w-auto
          max-w-full md:max-w-lg
          bg-bg-elevated shadow-xl
          ${isOpen ? 'translate-x-0' : position === 'right' ? 'translate-x-full' : '-translate-x-full'}
          /* 移动端底部圆角 */
          rounded-t-2xl md:rounded-none
          /* 移动端安全区域支持 */
          pb-safe
        `}
        style={{
          maxWidth: size === 'full' ? '100vw' : size === 'lg' ? 'max(90vw, 512px)' : size === 'md' ? 'max(85vw, 384px)' : 'max(75vw, 320px)',
        }}
      >
        {/* 抽屉头部 - 移动端优化 */}
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-border-subtle">
          {title && (
            <h2 className="text-base md:text-lg font-semibold text-text-primary">{title}</h2>
          )}
          <button
            onClick={onClose}
            className="p-2 md:p-2 hover:bg-bg-secondary rounded-lg transition-colors ml-auto touch-target"
            aria-label="关闭"
          >
            <svg className="w-5 h-5 md:w-5 md:h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 抽屉内容 */}
        <div className="overflow-y-auto h-full pb-safe">
          {children}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Convenience Components (便捷组件)
// ============================================================================

export interface TaskDrawerProps extends Omit<DrawerProps, 'size'> {
  taskId: number | null;
}

export function TaskDrawer({ taskId, ...props }: TaskDrawerProps) {
  return (
    <Drawer {...props} size="lg">
      {props.children}
    </Drawer>
  );
}

export interface PlanDrawerProps extends Omit<DrawerProps, 'size'> {
  planId: number | null;
}

export function PlanDrawer({ planId, ...props }: PlanDrawerProps) {
  return (
    <Drawer {...props} size="lg">
      {props.children}
    </Drawer>
  );
}
