import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Simplified Warm Humanism Palette - 15 core colors
        bg: {
          primary: '#FFFEF9',      // 主背景
          secondary: '#F9F6F1',    // 次背景
          elevated: '#FDF9F2',     // 浮层
          tertiary: '#F3EDE5',     // 三级背景 - 沙色
          dark: '#2D2926',         // 深色（侧边栏/抽屉）
        },
        text: {
          primary: '#2D2926',
          secondary: '#5C5651',
          muted: '#B8ACA3',
        },
        border: {
          subtle: 'rgba(45, 41, 38, 0.08)',
          visible: 'rgba(45, 41, 38, 0.15)',
          focus: 'rgba(45, 41, 38, 0.3)',
        },
        // Semantic colors - 5 core colors
        info: '#7BB3D0',      // 蓝色 - 队列中/信息
        success: '#7CB882',   // 绿色 - 已完成/成功
        warning: '#E5A55D',   // 橙色 - 运行中/警告
        error: '#E57373',     // 红色 - 失败/错误
        neutral: '#8E8E93',   // 灰色 - 已取消/中性
        // Accent colors - 灰色强调系（用于激活状态、主要操作）
        accent: {
          DEFAULT: 'rgba(45, 41, 38, 0.08)',
          hover: 'rgba(45, 41, 38, 0.12)',
          active: 'rgba(45, 41, 38, 0.18)',
          subtle: 'rgba(45, 41, 38, 0.04)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Geist Mono', 'Courier New', 'monospace'],
      },
      // Unified border radius
      borderRadius: {
        DEFAULT: '12px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 250ms ease-out',
        'slide-in-right': 'slideInRight 250ms ease-out',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'card-lift': 'cardLift 200ms ease-out',
        'button-press': 'buttonPress 150ms ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        cardLift: {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(-2px)' },
        },
        buttonPress: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.97)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
