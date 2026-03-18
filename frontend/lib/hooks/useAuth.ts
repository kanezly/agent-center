"use client";

import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

interface AuthStatus {
  authenticated: boolean;
  auth_enabled: boolean;
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<AuthStatus>('/api/auth/status', { silent: true })
      .then((res) => {
        setIsAuthenticated(res.authenticated);
        setAuthEnabled(res.auth_enabled);
      })
      .catch((err) => {
        // 401 表示未登录但认证已启用
        if (err.message?.includes('401')) {
          setIsAuthenticated(false);
          setAuthEnabled(true);
        } else {
          // 其他错误表示认证未启用
          setIsAuthenticated(false);
          setAuthEnabled(false);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST', silent: true });
    setIsAuthenticated(false);
    window.location.reload();
  };

  return { isAuthenticated, authEnabled, loading, logout };
}
