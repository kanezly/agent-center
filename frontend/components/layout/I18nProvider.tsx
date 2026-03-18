/**
 * i18n Provider
 * 国际化提供者组件
 */

'use client';

import { ReactNode, useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { InitOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import { defaultLocale, i18nOptions } from '@/i18n';

const LOCALE_STORAGE_KEY = 'agentcenter_locale';

interface I18nProviderProps {
  children: ReactNode;
}

// 创建 i18n 实例
function createI18n() {
  const instance = i18n.createInstance();
  return instance;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [i18nInstance, setI18nInstance] = useState<typeof i18n | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 获取保存的语言设置
    const savedLocale = typeof window !== 'undefined'
      ? (localStorage.getItem(LOCALE_STORAGE_KEY) as string) || defaultLocale
      : defaultLocale;

    // 设置 html lang 属性
    if (typeof document !== 'undefined') {
      document.documentElement.lang = savedLocale;
    }

    // 创建并初始化 i18n 实例
    const instance = createI18n();

    instance
      .use(Backend)
      .use(initReactI18next)
      .init({
        ...i18nOptions,
        lng: savedLocale,
      } as InitOptions);

    setI18nInstance(instance);
    setMounted(true);
  }, []);

  if (!mounted || !i18nInstance) {
    return null;
  }

  return (
    <I18nextProvider i18n={i18nInstance}>
      {children}
    </I18nextProvider>
  );
}
