/**
 * Button Component
 * 统一按钮组件
 */

import { ButtonHTMLAttributes, ReactNode } from 'react';

// ============================================================================
// Types (类型定义)
// ============================================================================

export type ButtonVariant =
  | 'primary'      // 主要操作 (深色背景)
  | 'secondary'    // 次要操作 (浅色背景)
  | 'ghost'        // 幽灵按钮 (无背景)
  | 'danger'       // 危险操作 (红色)
  | 'success'      // 成功操作 (绿色)
  | 'info'         // 信息操作 (蓝色)
  | 'warning';     // 警告操作 (橙色)

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

// ============================================================================
// Styles (样式)
// ============================================================================

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-text-primary text-bg-primary hover:bg-text-secondary transition-colors',
  secondary: 'bg-bg-secondary text-text-primary hover:bg-bg-elevated border border-border-subtle transition-colors',
  ghost: 'bg-transparent text-text-secondary hover:bg-bg-secondary transition-colors',
  danger: 'bg-error/10 text-error border border-error/20 hover:bg-error/20 transition-colors',
  success: 'bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors',
  info: 'bg-info/10 text-info border border-info/20 hover:bg-info/20 transition-colors',
  warning: 'bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20 transition-colors',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm min-h-[44px] sm:min-h-0',
  md: 'px-4 py-2 text-sm min-h-[44px] sm:min-h-0',
  lg: 'px-6 py-3 text-base min-h-[44px] sm:min-h-0',
};

// ============================================================================
// Component (组件)
// ============================================================================

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  const baseClasses = 'rounded-lg font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-border-focus disabled:opacity-50 disabled:cursor-not-allowed active:scale-95';
  const variantClass = variantClasses[variant];
  const sizeClass = sizeClasses[size];
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClass} ${sizeClass} ${widthClass} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          加载中...
        </span>
      ) : children}
    </button>
  );
}

// ============================================================================
// Convenience Components (便捷组件)
// ============================================================================

export function PrimaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="primary" {...props} />;
}

export function SecondaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="secondary" {...props} />;
}

export function GhostButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="ghost" {...props} />;
}

export function DangerButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="danger" {...props} />;
}

export function IconButton({
  children,
  className = '',
  ...props
}: Omit<ButtonProps, 'variant' | 'size'>) {
  return (
    <button
      type="button"
      className={`p-2 rounded-lg hover:bg-accent-subtle transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
