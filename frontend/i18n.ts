/**
 * i18n Configuration
 * 国际化配置 - 简化版本
 */

import { InitOptions } from 'i18next';

export const defaultLocale = 'zh-CN' as const;
export const locales = ['zh-CN', 'en'] as const;
export type Locale = (typeof locales)[number];

// 支持的语言
export const localeNames: Record<Locale, string> = {
  'zh-CN': '简体中文',
  'en': 'English',
};

// i18n 配置选项
export const i18nOptions: InitOptions = {
  debug: false,
  fallbackLng: 'zh-CN',
  supportedLngs: ['zh-CN', 'en'],
  defaultNS: 'ui',
  ns: ['ui', 'status', 'common'],
  interpolation: {
    escapeValue: false, // React 已经处理了 XSS
  },
  react: {
    useSuspense: false,
  },
  backend: {
    loadPath: '/locales/{{lng}}/{{ns}}.json',
  },
};

export default i18nOptions;
