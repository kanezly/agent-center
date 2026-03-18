/**
 * Pill Badge Component
 * 用于显示已选项的 Pill 标签（项目/依赖/Fork）
 */

'use client';

interface PillBadgeProps {
  icon: 'folder' | 'dependency' | 'fork';
  color: 'neutral' | 'info' | 'accent';
  label: string;
  onRemove: () => void;
}

const colorStyles = {
  neutral: {
    bg: 'var(--bg-tertiary)',
    bgSubtle: 'var(--bg-tertiary)',
    border: 'var(--border-visible)',
    text: 'var(--text-primary)',
  },
  info: {
    bg: 'var(--color-info)',
    bgSubtle: 'rgba(123, 179, 208, 0.15)',
    border: 'rgba(123, 179, 208, 0.3)',
    text: 'var(--text-primary)',
  },
  accent: {
    bg: 'var(--color-accent-subtle)',
    bgSubtle: 'var(--color-accent-subtle)',
    border: 'var(--color-accent-border)',
    text: 'var(--color-accent)',
  },
};

const icons = {
  folder: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  dependency: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  fork: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  ),
};

export function PillBadge({ icon, color, label, onRemove }: PillBadgeProps) {
  const styles = colorStyles[color];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        fontSize: '12px',
        fontWeight: 500,
        color: styles.text,
        backgroundColor: color === 'info' ? styles.bgSubtle : styles.bg,
        border: `1px solid ${styles.border}`,
        borderRadius: '12px',
        maxWidth: '200px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {icons[icon]}
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
      <button
        onClick={onRemove}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#8B837B',
          flexShrink: 0,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </span>
  );
}
