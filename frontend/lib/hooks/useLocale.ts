/**
 * useLocale Hook
 * 语言切换 Hook - 用于在客户端切换语言
 */

'use client';

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Locale } from '@/i18n';

const LOCALE_STORAGE_KEY = 'agentcenter_locale';

export function useLocale() {
  const { i18n, t } = useTranslation();

  const changeLocale = useCallback((newLocale: Locale) => {
    i18n.changeLanguage(newLocale);
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    document.documentElement.lang = newLocale;
  }, [i18n]);

  return {
    i18n,
    t,
    locale: i18n.language as Locale,
    changeLocale,
  };
}
