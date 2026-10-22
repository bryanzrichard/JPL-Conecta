import React from 'react';
import { XIcon } from '../../lib/icons';
import { ToastAction, ToastProps } from '../../contexts/ToastContext';

const variants = {
  default: 'bg-brand-dark-900 border-gray-700 text-white',
  destructive: 'bg-red-900/80 border-red-500/50 text-red-100',
};

export const Toast = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'destructive' }>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full sm:data-[state=open]:slide-in-from-bottom-full mt-4 ${variants[variant]} ${className}`}
        {...props}
      />
    );
  }
);

export const ToastActionElement: React.FC<{ action: ToastAction }> = ({ action }) => (
  <button onClick={action.onClick} className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue-500">
    {action.label}
  </button>
);

export const ToastClose = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={`absolute right-2 top-2 rounded-md p-1 text-gray-400 transition-opacity hover:text-white focus:outline-none focus:ring-2 ${className}`}
        {...props}
      >
        <XIcon className="h-4 w-4" />
      </button>
    );
  }
);

export const ToastTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={`text-sm font-semibold ${className}`} {...props} />
  )
);

export const ToastDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={`text-sm opacity-90 ${className}`} {...props} />
  )
);