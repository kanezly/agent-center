/**
 * Switch Component
 * 温暖开关设计 - 暖色调极简风格
 *
 * 设计理念：
 * - 关闭态：浅米色背景 + 微妙内阴影增强立体感
 * - 开启态：温暖棕色渐变 #8B7D6B → #7A6D5A
 * - 圆钮：纯白色，细腻阴影和光泽
 * - 整体：柔和、温暖、有质感，iOS 风格
 */

'use client';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function Switch({ checked, onChange, disabled = false, label }: SwitchProps) {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        userSelect: 'none',
      }}
      onClick={(e) => {
        e.stopPropagation();
        handleClick();
      }}
    >
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        style={{
          // 轨道尺寸
          width: '44px',
          height: '24px',

          // 轨道样式 - 温暖色调，iOS 风格
          borderRadius: '12px',
          background: checked
            ? 'var(--toggle-bg-on)'
            : 'var(--bg-secondary)',
          border: checked ? 'none' : '1px solid var(--border-visible)',

          // 布局
          position: 'relative',
          display: 'flex',
          alignItems: 'center',

          // 交互
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 200ms ease-out',

          // 触摸区域优化
          minWidth: '44px',
          minHeight: '44px',
          padding: '10px',
          boxSizing: 'border-box',

          // 关闭态内阴影增强立体感
          boxShadow: checked ? 'none' : 'inset 0 1px 2px rgba(45, 41, 38, 0.08)',
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = checked
              ? 'linear-gradient(135deg, #9B8D7B 0%, #8A7D6A 100%)'  // hover 时稍浅
              : 'var(--bg-tertiary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = checked
              ? 'var(--toggle-bg-on)'
              : 'var(--bg-secondary)';
          }
        }}
      >
        {/* 圆钮 (Knob) */}
        <div
          style={{
            // 圆钮尺寸
            width: '20px',
            height: '20px',

            // 圆钮样式
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',

            // 位置动画
            transform: `translateX(${checked ? '20px' : '0'})`,
            transition: 'transform 200ms cubic-bezier(0.25, 0.1, 0.25, 1)',

            // 柔和阴影 - 多层阴影增强立体感
            boxShadow: `
              0 2px 4px rgba(45, 41, 38, 0.12),
              0 1px 2px rgba(45, 41, 38, 0.08),
              inset 0 1px 1px rgba(255, 255, 255, 0.8)
            `,

            // 禁用状态
            opacity: disabled ? 0.8 : 1,
          }}
        />
      </div>

      {/* 标签文字 */}
      {label && (
        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
