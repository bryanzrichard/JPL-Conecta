import React from 'react';

// FIX: Changed component signatures to use React.ComponentProps<'div'> to properly handle props like `key`, `className`, and others, and spread extra props to the underlying div.
export function Card({ children, className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={`bg-brand-dark-900 p-8 rounded-2xl shadow-2xl border border-gray-800 ${className}`} {...props}>
      {children}
    </div>
  );
}

// FIX: Changed component signatures to use React.ComponentProps<'div'> to properly handle props like `key`, `className`, and others, and spread extra props to the underlying div.
export function CardHeader({ children, className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={`text-center mb-8 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3 className={`text-xl font-semibold leading-none tracking-tight text-white ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p className={`text-sm text-gray-400 ${className}`} {...props}>
      {children}
    </p>
  );
}

// FIX: Changed component signatures to use React.ComponentProps<'div'> to properly handle props like `key`, `className`, and others, and spread extra props to the underlying div.
export function CardContent({ children, className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={className} {...props}>{children}</div>
  );
}

// FIX: Changed component signatures to use React.ComponentProps<'div'> to properly handle props like `key`, `className`, and others, and spread extra props to the underlying div.
export function CardFooter({ children, className, ...props }: React.ComponentProps<'div'>) {
  return (
      <div className={`text-center mt-6 text-sm text-gray-400 ${className}`} {...props}>{children}</div>
  );
}