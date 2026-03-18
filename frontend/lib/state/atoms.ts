/**
 * Zustand Store for AgentCenter
 * Global state management with persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task, TaskStatus, FilterGroup } from '@/types/task';
import type { Worker, Status } from '@/types/worker';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

// 项目筛选状态：'all' 表示全部项目，number 表示具体项目 ID，null 表示未选择
export type ProjectFilter = 'all' | number | null;

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface ManagerStore {
  // Task state
  tasks: Task[];
  selectedTaskId: number | null;
  setTasks: (tasks: Task[]) => void;
  selectTask: (id: number | null) => void;
  updateTask: (id: number, updates: Partial<Task>) => void;

  // Worker state
  workers: Worker[];
  status: Status | null;
  setWorkers: (workers: Worker[]) => void;
  setStatus: (status: Status) => void;

  // WebSocket
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;

  // Toast notifications
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;

  // UI state (legacy - kept for backward compatibility)
  taskFilter: TaskStatus | 'all';
  setTaskFilter: (filter: TaskStatus | 'all') => void;

  // Unified UI state (new)
  unifiedFilter: FilterGroup;
  setUnifiedFilter: (filter: FilterGroup) => void;

  // Project filter state
  selectedProjectId: ProjectFilter;
  setSelectedProjectId: (projectId: ProjectFilter) => void;

  // Inbox drawer state
  inboxDrawerOpen: boolean;
  setInboxDrawerOpen: (open: boolean) => void;

  // Inbox convert data
  inboxConvertData: {
    id: number;
    prompt: string;
    projectId?: number | null;
    mode: 'execute' | 'plan';
    isIsolated?: boolean;
    autoApprove?: boolean;
    dependsOnTaskIds?: number[];
    forkFromTaskId?: number | null;
  } | null;
  setInboxConvertData: (data: {
    id: number;
    prompt: string;
    projectId?: number | null;
    mode: 'execute' | 'plan';
    isIsolated?: boolean;
    autoApprove?: boolean;
    dependsOnTaskIds?: number[];
    forkFromTaskId?: number | null;
  } | null) => void;
}

export const useManagerStore = create<ManagerStore>()(
  persist(
    (set, get) => ({
      // Initial state
      tasks: [],
      selectedTaskId: null,
      workers: [],
      status: null,
      wsConnected: false,
      toasts: [],
      taskFilter: 'all',
      unifiedFilter: 'all',
      selectedProjectId: 'all',
      inboxDrawerOpen: false,
      inboxConvertData: null,

      // Task actions
      setTasks: (tasks) => set({ tasks }),
      selectTask: (id) => set({ selectedTaskId: id }),
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, ...updates } : task
          ),
        })),

      // Worker actions
      setWorkers: (workers) => set({ workers }),
      setStatus: (status) => set({ status }),

      // WebSocket actions
      setWsConnected: (connected) => set({ wsConnected: connected }),

      // Toast actions
      addToast: (toast) => {
        const id = crypto.randomUUID();
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }],
        }));

        // Auto-remove toast after duration (default 3 seconds)
        const duration = toast.duration ?? 3000;
        setTimeout(() => {
          get().removeToast(id);
        }, duration);
      },
      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),
      clearToasts: () => set({ toasts: [] }),

      // UI actions
      setTaskFilter: (filter) => set({ taskFilter: filter }),
      setUnifiedFilter: (filter) => set({ unifiedFilter: filter }),
      setSelectedProjectId: (projectId) => set({ selectedProjectId: projectId }),
      setInboxDrawerOpen: (open) => set({ inboxDrawerOpen: open }),
      setInboxConvertData: (data) => set({ inboxConvertData: data }),
    }),
    {
      name: 'ccm-storage',
      partialize: (state) => ({
        taskFilter: state.taskFilter,
        unifiedFilter: state.unifiedFilter,
        selectedProjectId: state.selectedProjectId,
      }),
    }
  )
);

// Selectors
export const selectTasks = (state: ManagerStore) => state.tasks;
export const selectSelectedTask = (state: ManagerStore) =>
  state.tasks.find((t) => t.id === state.selectedTaskId) ?? null;
export const selectWorkers = (state: ManagerStore) => state.workers;
export const selectToasts = (state: ManagerStore) => state.toasts;
