"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api/client';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
        silent: true,  // 登录页面自己处理错误显示
      });

      // 登录成功，刷新页面
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || t('login.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form onSubmit={handleLogin} className="w-full max-w-md p-6 rounded-lg border bg-card">
        <h1 className="text-2xl font-bold mb-2 text-center">{t('login.title')}</h1>
        <p className="text-muted-foreground text-center mb-6 text-sm">
          {t('login.subtitle')}
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('login.placeholder')}
          className="w-full p-3 border border-input bg-background rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
          autoFocus
        />
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive text-destructive text-sm rounded-md">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full p-3 bg-primary text-primary-foreground rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          {loading ? t('login.loggingIn') : t('login.button')}
        </button>
      </form>
    </div>
  );
}
