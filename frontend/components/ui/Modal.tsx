/**
 * Modal Component
 * 居中模态框 - 温暖人文主义设计
 *
 * Design:
 * - 居中显示，半透明遮罩 + 毛玻璃效果
 * - Apple 弹性动画: cubic-bezier(0.16, 1, 0.3, 1)
 * - 圆角 24px
 * - ESC 键关闭，点击遮罩关闭
 */

'use client';

import { ReactNode, useEffect, useCallback, useRef } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showCloseButton?: boolean;
}

const maxWidthMap: Record<string, string> = {
  sm: '400px',
  md: '512px',
  lg: '640px',
  xl: '768px',
  '2xl': '896px',
};

export function Modal({
  isOpen,
  onClose,
  children,
  maxWidth = 'xl',
  showCloseButton = false,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // ESC 键关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // 锁定背景滚动
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(45, 41, 38, 0.4)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'modalBackdropFadeIn 200ms ease-out',
        }}
        onClick={onClose}
      />

      {/* Modal Container - 移动端优化 padding */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
        }}
        className="sm:p-4 md:p-6"
      >
        {/* Modal Content - 响应式 maxWidth */}
        <div
          ref={modalRef}
          tabIndex={-1}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: maxWidthMap[maxWidth],
            backgroundColor: '#FFFEF9',
            borderRadius: '20px',
            border: '1px solid rgba(45, 41, 38, 0.06)',
            boxShadow: '0 25px 50px -12px rgba(45, 41, 38, 0.15)',
            maxHeight: 'calc(100vh - 48px)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'modalSlideIn 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="sm:max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button - 触摸优化 */}
          {showCloseButton && (
            <button
              onClick={onClose}
              className="touch-target sm:w-8 sm:h-8 w-10 h-10"
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#5C5651',
                transition: 'all 150ms ease-out',
                zIndex: 10,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F3EDE5';
                e.currentTarget.style.color = '#2D2926';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#5C5651';
              }}
            >
              <svg className="w-5 h-5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}

          {children}
        </div>
      </div>

      {/* Animation Keyframes */}
      <style>{`
        @keyframes modalBackdropFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Sub-components (子组件)
// ============================================================================

export interface ModalHeaderProps {
  children: ReactNode;
  className?: string;
}

export function ModalHeader({ children, className = '' }: ModalHeaderProps) {
  return (
    <div
      className={`sm:px-6 sm:py-5 ${className || ''}`}
      style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(45, 41, 38, 0.06)',
      }}
    >
      {children}
    </div>
  );
}

export interface ModalBodyProps {
  children: ReactNode;
  className?: string;
}

export function ModalBody({ children, className = '' }: ModalBodyProps) {
  return (
    <div
      className={className}
      style={{
        flex: 1,
        overflow: 'auto',
        overscrollBehavior: 'contain',
      }}
    >
      {children}
    </div>
  );
}

export interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div
      className={`sm:px-6 sm:py-4 ${className || ''}`}
      style={{
        padding: '12px 20px',
        borderTop: '1px solid rgba(45, 41, 38, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '12px',
        fontSize: '14px',
      }}
    >
      {children}
    </div>
  );
}
