/**
 * API Client Configuration for AgentCenter
 * React Query setup with optimized defaults
 *
 * Uses runtime configuration - API_DOMAIN and WS_DOMAIN are read from
 * window.__RUNTIME_CONFIG__ which is injected at page load time.
 */

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { useManagerStore } from '@/lib/state/atoms';

/**
 * Runtime configuration
 * Injected at page load via /api/config endpoint
 */
interface RuntimeConfig {
  API_DOMAIN: string;
  WS_DOMAIN: string;
}

// Global config - will be populated from window.__RUNTIME_CONFIG__
let runtimeConfig: RuntimeConfig | null = null;

/**
 * Get runtime config from window object (client-side) or use defaults
 */
function getRuntimeConfig(): RuntimeConfig {
  if (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__) {
    runtimeConfig = (window as any).__RUNTIME_CONFIG__;
  }
  return runtimeConfig || {
    API_DOMAIN: 'http://localhost:8010',
    WS_DOMAIN: 'ws://localhost:8010',
  };
}

/**
 * API base URL - determined at runtime based on environment
 *
 * NOTE: We use a function to get the API base URL at runtime, not a constant.
 * This allows the same Docker image to be deployed to different environments
 * with different backend URLs specified via environment variables.
 */
const isServer = typeof window === 'undefined';

function getClientApiBaseUrl(): string {
  // Client-side: use full URL from runtime config
  if (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__) {
    return (window as any).__RUNTIME_CONFIG__.API_DOMAIN || '';
  }
  return '';
}

function getServerApiBaseUrl(): string {
  // Server-side: read from environment variables
  return process.env.API_DOMAIN || '';
}

/**
 * Get API base URL - uses runtime config on client side, env vars on server side
 */
export function getApiBaseUrl(): string {
  return isServer ? getServerApiBaseUrl() : getClientApiBaseUrl();
}

/**
 * Get WebSocket base URL from runtime config
 */
export function getWsBaseUrl(): string {
  return getRuntimeConfig().WS_DOMAIN;
}

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
  // Get API base URL at request time (not build time)
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
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
