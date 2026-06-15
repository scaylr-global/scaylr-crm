import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastCtx {
  toast: (message: string, type?: ToastType) => void;
}

const Ctx = createContext<ToastCtx>(null as any);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = ++counter;
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80">
        {toasts.map((t) => {
          const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? XCircle : Info;
          const color =
            t.type === 'success' ? 'text-teal' : t.type === 'error' ? 'text-red-400' : 'text-blue-400';
          return (
            <div
              key={t.id}
              className="card px-4 py-3 flex items-start gap-3 shadow-xl animate-[slidein_0.2s_ease]"
              style={{ background: '#15151f' }}
            >
              <Icon size={18} className={`${color} mt-0.5 shrink-0`} />
              <span className="text-sm text-white flex-1">{t.message}</span>
              <button onClick={() => remove(t.id)} className="text-muted hover:text-white">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes slidein{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}`}</style>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx).toast;
