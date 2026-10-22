import React from 'react';

// FIX: Add `size` prop to support different button sizes and resolve type errors.
// FIX: Add `ghost` and `destructive` to variant type.
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'link' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'icon';
  isLoading?: boolean;
  loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', isLoading = false, loadingText, children, ...props }, ref) => {
    // FIX: Refactor classes to separate base styles from size-specific styles.
    const baseClasses = "rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-dark-950 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer touch-manipulation select-none";
    
    const variantClasses = {
      primary: "bg-brand-blue-500 text-white hover:bg-brand-blue-600 focus:ring-brand-blue-500",
      link: "p-0 text-brand-blue-500 hover:underline",
      outline: "bg-transparent border border-gray-700 text-gray-300 hover:bg-gray-800 focus:ring-gray-500",
      ghost: "bg-transparent text-gray-300 hover:bg-gray-800 focus:ring-gray-500",
      destructive: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    };

    const sizeClasses = {
      default: "w-full px-4 py-3 text-sm",
      sm: "h-9 px-3 text-xs",
      icon: "h-9 w-9",
    };

    return (
      <button
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              {/* FIX: Use self-closing tags for SVG elements to be compliant with JSX syntax. */}
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {loadingText || 'Carregando...'}
          </>
        ) : children}
      </button>
    );
  }
);
Button.displayName = 'Button';