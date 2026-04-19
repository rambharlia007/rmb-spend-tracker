import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastVariant = 'default' | 'success' | 'error';
type Toast = { id: number; message: string; variant: ToastVariant };

const ToastContext = createContext<{ toast: (msg: string, v?: ToastVariant) => void } | null>(null);

const ICONS = {
  default: <Info className="h-4 w-4 text-primary shrink-0" />,
  success: <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />,
  error: <XCircle className="h-4 w-4 text-destructive shrink-0" />,
};

const STYLES = {
  default: 'border-l-primary bg-card',
  success: 'border-l-emerald-500 bg-card',
  error: 'border-l-destructive bg-card',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = 'default') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-20 right-4 z-[300] flex flex-col gap-2 max-w-xs md:bottom-6 md:right-6 md:max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border border-l-4 px-4 py-3 shadow-lg',
              'animate-in slide-in-from-right-5 fade-in duration-200',
              STYLES[t.variant]
            )}
          >
            {ICONS[t.variant]}
            <span className="text-sm leading-snug flex-1">{t.message}</span>
            <button
              onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
              className="p-0.5 rounded opacity-50 hover:opacity-100 transition-opacity shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
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
