/**
 * MobileFab Component
 * 移动端浮动操作按钮 (Floating Action Button)
 */

import { ReactNode, useState } from 'react';

// ============================================================================
// Types (类型定义)
// ============================================================================

export type FabVariant = 'primary' | 'secondary' | 'danger';
export type FabSize = 'sm' | 'md' | 'lg';

export interface FabProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: FabVariant;
  size?: FabSize;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

// ============================================================================
// Styles (样式)
// ============================================================================

const variantClasses: Record<FabVariant, string> = {
  primary: 'bg-text-primary text-bg-primary shadow-lg',
  secondary: 'bg-white text-text-primary shadow-lg border border-border-subtle',
  danger: 'bg-error text-white shadow-lg',
};

const sizeClasses: Record<FabSize, string> = {
  sm: 'w-12 h-12',
  md: 'w-14 h-14',
  lg: 'w-16 h-16',
};

const iconSizeClasses: Record<FabSize, string> = {
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-7 h-7',
};

const positionClasses: Record<string, string> = {
  'bottom-right': 'bottom-6 right-6',
  'bottom-left': 'bottom-6 left-6',
  'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
};

// ============================================================================
// Component (组件)
// ============================================================================

export function MobileFab({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  position = 'bottom-right',
  disabled = false,
  className = '',
  ariaLabel,
}: FabProps) {
  const baseClasses = 'fixed z-50 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100';
  const variantClass = variantClasses[variant];
  const sizeClass = sizeClasses[size];
  const positionClass = positionClasses[position];

  // 判断children是否是图标
  const isIcon = typeof children === 'object' && children !== null && '$$typeof' in children;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClass} ${sizeClass} ${positionClass} ${className}`}
      aria-label={ariaLabel}
    >
      {isIcon ? (
        <div className={iconSizeClasses[size]}>
          {children}
        </div>
      ) : (
        <span className="text-sm font-medium">{children}</span>
      )}
    </button>
  );
}

// ============================================================================
// Convenience Components (便捷组件)
// ============================================================================

export function CreateFab(props: Omit<FabProps, 'variant' | 'ariaLabel'>) {
  return (
    <MobileFab
      {...props}
      variant="primary"
      ariaLabel="创建"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </MobileFab>
  );
}

export function AddFab(props: Omit<FabProps, 'variant' | 'ariaLabel'>) {
  return <CreateFab {...props} />;
}

// ============================================================================
// Speed Dial (快速拨号菜单 - 多个FAB)
// ============================================================================

export interface SpeedDialAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

export interface SpeedDialProps {
  actions: SpeedDialAction[];
  mainIcon?: ReactNode;
  position?: 'bottom-right' | 'bottom-left';
}

export function SpeedDial({
  actions,
  mainIcon,
  position = 'bottom-right',
}: SpeedDialProps) {
  const [open, setOpen] = useState(false);

  const positionClass = position === 'bottom-right' ? 'bottom-6 right-6' : 'bottom-6 left-6';

  return (
    <div className={`fixed ${positionClass} z-50 flex flex-col items-end gap-2`}>
      {/* 子按钮 */}
      {open && actions.map((action, index) => (
        <button
          key={index}
          onClick={() => {
            action.onClick();
            setOpen(false);
          }}
          className="flex items-center gap-2 pr-2 animate-fade-in"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <span className="bg-white px-2 py-1 rounded-md text-sm shadow-md whitespace-nowrap">
            {action.label}
          </span>
          <div className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center">
            {action.icon}
          </div>
        </button>
      ))}

      {/* 主按钮 */}
      <MobileFab
        variant="primary"
        onClick={() => setOpen(!open)}
        ariaLabel={open ? '关闭菜单' : '打开菜单'}
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : mainIcon || (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        )}
      </MobileFab>
    </div>
  );
}
