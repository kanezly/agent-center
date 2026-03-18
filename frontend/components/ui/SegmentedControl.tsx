/**
 * Segmented Control Component
 * 胶囊滑块设计 - 温暖极简风格
 *
 * 设计理念：
 * - 浅米色背景容器 + 白色滑块
 * - 柔和阴影营造立体感
 * - 平滑的滑块移动动画
 */

'use client';

interface SegmentedControlProps {
  options: readonly [string, string]; // 二元选项，如 ['执行', '计划']
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: 'compact' | 'standard';
}

export function SegmentedControl({
  options,
  value,
  onChange,
  disabled = false,
  size = 'compact',
}: SegmentedControlProps) {
  const selectedIndex = options.indexOf(value);
  // 统一高度：32px，圆角：10px
  const height = 32;
  const fontSize = size === 'compact' ? 13 : 14;

  const handleSegmentClick = (index: number) => {
    if (!disabled) {
      onChange(options[index]);
    }
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        userSelect: 'none',
      }}
      onClick={(e) => e.stopPropagation()}
      role="tablist"
      aria-orientation="horizontal"
    >
      {/* 容器 */}
      <div
        style={{
          display: 'flex',
          position: 'relative',
          height: `${height}px`,
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '3px',
          boxShadow: 'inset 0 1px 2px rgba(45, 41, 38, 0.04)',
        }}
      >
        {/* 选中滑块 - 白色胶囊 */}
        <div
          style={{
            position: 'absolute',
            top: '3px',
            left: '3px',
            width: `calc(50% - 3px)`,
            height: `calc(100% - 6px)`,
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(45, 41, 38, 0.12), 0 1px 2px rgba(45, 41, 38, 0.08)',
            transform: `translateX(${selectedIndex * 100}%)`,
            transition: 'transform 200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
            pointerEvents: 'none',
          }}
        />

        {/* 选项文字 */}
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;

          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => handleSegmentClick(index)}
              disabled={disabled}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                minWidth: size === 'compact' ? '56px' : '72px',
                height: `${height - 6}px`,
                border: 'none',
                backgroundColor: 'transparent',
                cursor: disabled ? 'not-allowed' : 'pointer',
                padding: '0 16px',
                fontSize: `${fontSize}px`,
                fontWeight: isSelected ? 600 : 500,
                fontFamily: 'inherit',
                color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'color 150ms ease-out',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                if (!disabled && !isSelected) {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled && !isSelected) {
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
