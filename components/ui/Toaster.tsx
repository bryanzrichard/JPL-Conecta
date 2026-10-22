import React from 'react';
import { useToast } from '../../contexts/ToastContext';
import { Toast, ToastClose, ToastDescription, ToastTitle, ToastActionElement } from './Toast';

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px] pointer-events-none">
      {toasts.map(function ({ id, title, description, variant, action, ...props }) {
        return (
          <Toast key={id} variant={variant} className="pointer-events-auto" {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action && <ToastActionElement action={action} />}
            <ToastClose onClick={() => dismiss(id)} />
          </Toast>
        );
      })}
    </div>
  );
}