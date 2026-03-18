/**
 * WebSocket Hook for real-time updates
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useManagerStore } from '@/lib/state/atoms';
import { WS_BASE_URL } from '@/lib/api/client';

const debugLog = (...args: unknown[]) => {
  // Debug logging disabled in production
};

interface UseWebSocketOptions {
  onMessage?: (data: unknown) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export function useWebSocket(path: string, options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const setWsConnected = useManagerStore((state) => state.setWsConnected);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = `${WS_BASE_URL}${path}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      debugLog(`Connected to ${path}`);
      setWsConnected(true);
      reconnectCountRef.current = 0;
      onConnect?.();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage?.(data);
      } catch {
        // Parse error - silently ignore malformed messages
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      onDisconnect?.();

      // Attempt reconnect
      if (reconnectCountRef.current < reconnectAttempts) {
        reconnectCountRef.current++;
        setTimeout(connect, reconnectInterval);
      }
    };

    ws.onerror = () => {
      setWsConnected(false);
    };

    wsRef.current = ws;
  }, [path, onMessage, onConnect, onDisconnect, reconnectAttempts, reconnectInterval, setWsConnected]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);
  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);
  return { send, disconnect, reconnect: connect };
}

/**
 * Hook for task log streaming
 */
export function useTaskLogs(taskId: number | null) {
  const updateTask = useManagerStore((state) => state.updateTask);
  const handleMessage = useCallback((data: unknown) => {
    if (!taskId) return;
    const msg = data as { task_id: number; event_type: string; payload: unknown };
    if (msg.task_id === taskId) {
      // Handle different event types
      if (msg.event_type === 'result') {
        const payload = msg.payload as { result?: string; cost_usd?: number };
        updateTask(taskId, {
          status: 'completed',
          result_text: payload.result,
          cost_usd: payload.cost_usd,
        });
      } else if (msg.event_type === 'error') {
        updateTask(taskId, { status: 'failed' });
      }
    }
  }, [taskId, updateTask]);
  return useWebSocket(taskId ? `/ws/logs/${taskId}` : '', {
    onMessage: handleMessage,
  });
}

// Global singleton for WebSocket connection
interface GlobalWsRef {
  ws: WebSocket | null;
  listeners: Set<(data: unknown) => void>;
  isReconnecting: boolean;
}

let globalWsRef: GlobalWsRef | null = null;

/**
 * Initialize global WebSocket connection (singleton)
 * Call this once at app startup
 */
export function initGlobalWebSocket() {
  if (globalWsRef?.ws?.readyState === WebSocket.OPEN) {
    return globalWsRef.listeners; // Already connected
  }

  // Prevent multiple reconnection attempts
  if (globalWsRef?.isReconnecting) {
    return globalWsRef.listeners;
  }

  const listeners = new Set<(data: unknown) => void>();
  globalWsRef = {
    ws: null,
    listeners,
    isReconnecting: false,
  };

  const url = `${WS_BASE_URL}/ws/events`;
  const ws = new WebSocket(url);

  ws.onopen = () => {
    debugLog('Global connected');
    if (globalWsRef) {
      globalWsRef.isReconnecting = false;
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      // Notify all listeners
      listeners.forEach((listener) => listener(data));
    } catch {
      // Parse error - silently ignore malformed messages
    }
  };

  ws.onclose = () => {
    if (globalWsRef) {
      globalWsRef.ws = null;
      globalWsRef.isReconnecting = true;
    }
    // Attempt reconnect after 3 seconds
    setTimeout(() => {
      if (!globalWsRef?.ws || globalWsRef.ws.readyState !== WebSocket.OPEN) {
        initGlobalWebSocket();
      }
    }, 3000);
  };

  globalWsRef = { ws, listeners, isReconnecting: false };
}

/**
 * Hook for global event streaming (scheduler status + task events)
 * Use this hook to listen for task state changes and invalidate queries accordingly.
 * This replaces polling for task lists and status.
 */
export function useGlobalEvents() {
  const queryClient = useQueryClient();
  const setWorkers = useManagerStore((state) => state.setWorkers);
  const setStatus = useManagerStore((state) => state.setStatus);

  useEffect(() => {
    // Initialize connection on mount
    initGlobalWebSocket();
    const handleMessage = (data: unknown) => {
      // Handle new format: { type: "task_created" | "task_updated" | "task_cancelled", data: {...} }
      const msg = data as { type?: string; data?: unknown; task_id?: number; event_type?: string; payload?: unknown };
      // New format: global events with { type, data }
      if (msg.type) {
        const eventType = msg.type;
        if (['task_created', 'task_updated', 'task_cancelled'].includes(eventType)) {
          // Invalidate task-related queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['status'] });
          debugLog(`Received ${eventType}, invalidated queries`);
        }
        return;
      }
      // Legacy format: task-specific events with { task_id, event_type, payload }
      if (msg.event_type === 'scheduler') {
        const payload = msg.payload as { type: string; workers: unknown[] };
        if (payload.type === 'scheduler_status') {
          setWorkers(payload.workers as Parameters<typeof setWorkers>[0]);
        }
      }
    };
    // Register listener
    if (!globalWsRef) {
      initGlobalWebSocket();
    }
    if (globalWsRef) {
      globalWsRef.listeners.add(handleMessage);
      return () => {
        // Cleanup listener on unmount
        globalWsRef?.listeners.delete(handleMessage);
      };
    }
    return () => {};
  }, [setWorkers, setStatus, queryClient]);
}
