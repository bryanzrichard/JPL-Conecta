import React from 'react';

// FIX: Changed interface to type to resolve type inheritance issues.
// FIX: Added variant prop to fix type errors in consuming components.
export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'outline' | 'secondary' | 'destructive';
};

function Badge({ className, children, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-brand-dark-950 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export { Badge };