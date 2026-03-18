/**
 * Toggle Component
 * iOS 风格开关组件 - 用于计划模式、任务隔离等二元切换
 *
 * 设计规格 (Refined 2026):
 * - 视觉尺寸：42x24px (优雅紧凑比例)
 * - 触摸区域：44x44px (--toggle-touch)
 * - 颜色：关闭 #E5E5E7, 开启 #2D2926 (温暖深棕)
 * - 圆钮：20px 直径，白色带柔和阴影
 * - 动画：200ms cubic-bezier(0.34, 1.56, 0.64, 1) 弹性曲线
 */

'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}

export function Toggle({ checked, onChange, disabled = false, label, id }: ToggleProps) {
  const handleChange = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <label
      id={id}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        userSelect: 'none',
      }}
    >
      {/* 隐藏的原生 checkbox，保持表单兼容性 */}
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: '0',
        }}
      />

      {/* 可视化开关轨道 */}
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={disabled ? undefined : 0}
        onClick={handleChange}
        onKeyDown={handleKeyDown}
        style={{
          // 轨道尺寸
          width: 'var(--toggle-width)',
          height: 'var(--toggle-height)',

          // 轨道样式
          borderRadius: '999px',
          backgroundColor: checked ? 'var(--toggle-bg-on)' : 'var(--toggle-bg-off)',

          // 布局
          position: 'relative',
          display: 'flex',
          alignItems: 'center',

          // 交互
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background-color 200ms var(--ios-spring)',

          // 确保最小触摸区域
          minWidth: 'var(--toggle-touch)',
          minHeight: 'var(--toggle-touch)',
          padding: '10px', // (44 - 24) / 2
          boxSizing: 'border-box',
        }}
      >
        {/* 开关圆钮 (Knob) */}
        <div
          style={{
            // 圆钮尺寸
            width: 'var(--toggle-knob-size)',
            height: 'var(--toggle-knob-size)',

            // 圆钮样式
            borderRadius: '50%',
            backgroundColor: 'var(--toggle-knob)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.1)',

            // 位置动画 - 计算移动距离
            transform: `translateX(${checked ? 'calc(var(--toggle-width) - var(--toggle-knob-size) - 8px)' : '0'})`,
            transition: 'transform 200ms var(--ios-spring)',

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
    </label>
  );
}
