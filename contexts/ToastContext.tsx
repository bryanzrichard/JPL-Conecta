import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastAction = {
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

export type ToastProps = {
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: 'default' | 'destructive';
  action?: ToastAction;
  // FIX: Add duration property to allow for custom toast timeouts.
  duration?: number;
};

interface ToastContextType {
  toast: (props: ToastProps) => void;
  toasts: (ToastProps & { id: string })[];
  dismiss: (toastId: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<(ToastProps & { id: string })[]>([]);

  const dismiss = useCallback((toastId: string) => {
    setToasts((prevToasts) => prevToasts.filter((t) => t.id !== toastId));
  }, []);

  const toast = useCallback(({ id, ...props }: ToastProps) => {
    // Suprime pop outs / toasts de sucesso em todas as páginas (mantém apenas erros destrutivos)
    if (props.variant !== 'destructive') {
      return;
    }
    const newId = id || String(Date.now());
    setToasts((prevToasts) => [...prevToasts, { id: newId, ...props }]);

    setTimeout(() => {
      dismiss(newId);
    }, props.duration || 5000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast, toasts, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};