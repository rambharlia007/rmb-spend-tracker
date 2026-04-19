import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ToastVariant = 'default' | 'success' | 'error';
type Toast = { id: number; message: string; variant: ToastVariant };

const ToastContext = createContext<{ toast: (msg: string, v?: ToastVariant) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = 'default') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-20 right-4 z-[300] flex flex-col gap-2 max-w-sm md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'rounded-md border px-4 py-3 shadow-md text-sm bg-card animate-in slide-in-from-right',
              t.variant === 'success' && 'border-green-500 bg-green-50 text-green-900',
              t.variant === 'error' && 'border-destructive bg-red-50 text-destructive'
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
