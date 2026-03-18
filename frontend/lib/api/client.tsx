/**
 * API Client Configuration for AgentCenter
 * React Query setup with optimized defaults
 */

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { useManagerStore } from '@/lib/state/atoms';

/**
 * API base URL - use relative path to leverage Next.js rewrites (no CORS issues)
 * For direct backend access, set NEXT_PUBLIC_API_DOMAIN in .env.local
 */
const isServer = typeof window === 'undefined';
// 注意：默认端口为 8010，与 next.config.js 保持一致
export const API_BASE_URL = isServer
  ? (process.env.NEXT_PUBLIC_API_DOMAIN ?? 'http://localhost:8010')  // Server-side: direct backend URL
  : '';  // Client-side: use relative path (Next.js rewrites will proxy)

/**
 * WebSocket base URL - always direct connection
 * 注意：默认端口为 9051，如需修改请在 .env.local 中配置 NEXT_PUBLIC_WS_DOMAIN
 */
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_DOMAIN ?? 'ws://localhost:8010';

/**
 * React Query client with optimized defaults
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 5,       // 5 seconds (shorter for real-time feel)
      gcTime: 1000 * 60 * 5,     // 5 minutes
      refetchOnWindowFocus: true,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // 优化 SSR 性能：禁用 SSR 时的 refetch
      refetchOnMount: 'always',
    },
    mutations: {
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

/**
 * Helper function to make API calls with error handling
 */
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit & { silent?: boolean }
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const silent = options?.silent ?? false;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      let errorMessage = `API Error: ${response.status}`;
      if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData && typeof errorData === 'object') {
        const err = errorData as Record<string, unknown>;
        errorMessage = (err.message || err.detail || err.error) as string ?? errorMessage;
      }

      throw new Error(errorMessage);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    if (!silent) {
      const addToast = useManagerStore.getState().addToast;

      let errorMessage = '网络错误 - 请检查服务器是否运行';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      } else if (error !== undefined) {
        errorMessage = String(error);
      }

      addToast({
        type: 'error',
        message: errorMessage,
      });
    }
    throw error;
  }
}

/**
 * Providers component that wraps the app with React Query
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => queryClient);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
