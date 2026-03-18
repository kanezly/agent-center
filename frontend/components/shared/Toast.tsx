/**
 * Toast 容器组件
 */

'use client';

import { useManagerStore } from '@/lib/state/atoms';

export function ToastContainer() {
  const toasts = useManagerStore((state) => state.toasts);
  const removeToast = useManagerStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            px-4 py-3 rounded-lg shadow-lg max-w-sm animate-slide-up
            ${toast.type === 'error' ? 'bg-semantic-error text-white' : ''}
            ${toast.type === 'success' ? 'bg-semantic-success text-white' : ''}
            ${toast.type === 'warning' ? 'bg-semantic-warning text-white' : ''}
            ${toast.type === 'info' ? 'bg-semantic-info text-white' : ''}
          `}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
