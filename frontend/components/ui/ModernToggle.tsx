/**
 * Modern Toggle Component
 * 现代精致开关组件 - 用于任务隔离等二元切换
 *
 * 设计规格:
 * - 视觉尺寸：52x28px (精致比例)
 * - 触摸区域：52x48px (符合 WCAG 可访问性)
 * - 关闭态：#E5E5E7 + 内阴影增强立体感
 * - 开启态：温暖棕色渐变 #8B7D6B → #6F6355
 * - 圆钮：24px 直径，多层阴影 + 光泽效果
 * - 动画：200ms cubic-bezier(0.34, 1.56, 0.64, 1) 弹性曲线
 * - 交互：hover 微缩放 (1.02), active 微缩放 (0.98)
 */

'use client';

interface ModernToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}

export function ModernToggle({ checked, onChange, disabled = false, label, id }: ModernToggleProps) {
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
        gap: '12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
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
        tabIndex={disabled ? -1 : 0}
        onClick={handleChange}
        onKeyDown={handleKeyDown}
        style={{
          // 轨道尺寸
          width: '52px',
          height: '28px',

          // 轨道样式 - 现代精致设计
          borderRadius: '14px',
          background: checked
            ? 'var(--toggle-bg-on, linear-gradient(135deg, #8B7D6B 0%, #6F6355 100%))'
            : 'var(--toggle-bg-off, #E5E5E7)',

          // 阴影效果
          boxShadow: checked
            ? '0 2px 8px rgba(139, 125, 107, 0.4)'
            : 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',

          // 布局
          position: 'relative',
          display: 'flex',
          alignItems: 'center',

          // 交互
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',

          // 确保最小触摸区域
          minWidth: '52px',
          minHeight: '48px',
          padding: '10px 12px',
          boxSizing: 'border-box',
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.transform = 'scale(1.02)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.currentTarget.style.transform = 'scale(1)';
          }
        }}
        onMouseDown={(e) => {
          if (!disabled) {
            e.currentTarget.style.transform = 'scale(0.98)';
          }
        }}
        onMouseUp={(e) => {
          if (!disabled) {
            e.currentTarget.style.transform = 'scale(1.02)';
          }
        }}
      >
        {/* 开关圆钮 (Knob) */}
        <div
          style={{
            // 圆钮尺寸
            width: '24px',
            height: '24px',

            // 圆钮样式
            borderRadius: '50%',
            backgroundColor: 'var(--toggle-knob, #FFFFFF)',

            // 位置动画
            transform: `translateX(${checked ? '24px' : '0'})`,
            transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',

            // 多层阴影 + 光泽效果
            boxShadow: `
              0 2px 6px rgba(0, 0, 0, 0.15),
              0 1px 3px rgba(0, 0, 0, 0.1),
              inset 0 1px 1px rgba(255, 255, 255, 0.9)
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
            userSelect: 'none',
          }}
        >
          {label}
        </span>
      )}
    </label>
  );
}
