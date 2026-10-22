import React, { createContext, useContext, useState, cloneElement, isValidElement } from 'react';
import { XIcon } from '../../lib/icons';

interface DialogContextType {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

// FIX: Add `open` and `onOpenChange` props to support controlled component usage.
interface DialogProps {
  // FIX: Made children optional to resolve a TypeScript error where it was incorrectly reported as missing.
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// FIX: Changed from a const arrow function to a function declaration to resolve component typing errors.
export function Dialog({ children, open, onOpenChange }: DialogProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  const isControlled = open !== undefined && onOpenChange !== undefined;

  const isOpen = isControlled ? open : internalIsOpen;

  const setIsOpen: React.Dispatch<React.SetStateAction<boolean>> = (value) => {
    if (isControlled) {
      // Ensure we call onOpenChange with a boolean value.
      onOpenChange(typeof value === 'function' ? value(open) : value);
    } else {
      setInternalIsOpen(value);
    }
  };

  return <DialogContext.Provider value={{ isOpen, setIsOpen }}>{children}</DialogContext.Provider>;
}

// FIX: Changed from a const arrow function to a function declaration for consistency.
function useDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error('useDialog must be used within a Dialog');
  return context;
}

// FIX: Add `asChild` prop to match usage in `Registros.tsx`.
interface DialogTriggerProps {
  // FIX: Made children optional to resolve a TypeScript error where it was incorrectly reported as missing.
  children?: React.ReactNode;
  asChild?: boolean;
}

// FIX: Changed from a const arrow function to a function declaration to resolve component typing errors.
export function DialogTrigger({ children, asChild }: DialogTriggerProps) {
  const { setIsOpen } = useDialog();
  if (!isValidElement(children)) {
      return null;
  }
  // FIX: The `onClick` handler of the child component is now preserved and called before opening the dialog.
  // This resolves the type error with `cloneElement` by casting the child to `React.ReactElement<any>` 
  // to allow accessing its props and passing new ones.
  const child = children as React.ReactElement<any>;
  return cloneElement(child, {
    onClick: (e: React.MouseEvent) => {
      if (child.props.onClick) {
        child.props.onClick(e);
      }
      setIsOpen(true);
    },
  });
}

// FIX: Changed from a const arrow function to a function declaration to resolve component typing errors.
// FIX: Made children optional to resolve a TypeScript error where it was incorrectly reported as missing.
// FIX: Added the `onInteractOutside` prop to allow consumers to conditionally prevent the dialog from closing on an outside click.
export function DialogContent({ children, className, onInteractOutside }: { children?: React.ReactNode, className?: string, onInteractOutside?: (e: React.MouseEvent) => void }) {
  const { isOpen, setIsOpen } = useDialog();
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (onInteractOutside) {
        onInteractOutside(e);
        if (e.isDefaultPrevented()) {
            return;
        }
    }
    setIsOpen(false);
  };

  const hasCustomMax = className && /\bmax-w-/.test(className);
  const hasCustomPadding = className && /\bp-/.test(className);

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/75 backdrop-blur-sm animate-in fade-in-0 p-3 sm:p-6" 
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className={`relative bg-brand-dark-900 border border-gray-800 rounded-2xl shadow-2xl shadow-black/60 w-full ${hasCustomMax ? '' : 'max-w-md '}my-auto ${hasCustomPadding ? '' : 'p-6 '}animate-in fade-in-0 zoom-in-95 duration-200 ${className || ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
        <button 
          onClick={() => setIsOpen(false)} 
          className="absolute top-4 right-4 z-20 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-brand-dark-800/80 transition-colors"
          title="Fechar (Esc)"
        >
          <XIcon className="h-5 w-5" />
          <span className="sr-only">Fechar</span>
        </button>
      </div>
    </div>
  );
}

// FIX: Changed from a const arrow function to a function declaration to resolve component typing errors.
// FIX: Made children optional to resolve a TypeScript error where it was incorrectly reported as missing.
export function DialogHeader({ children, className }: { children?: React.ReactNode, className?: string }) {
  return <div className={`mb-4 text-center ${className}`}>{children}</div>;
}

// FIX: Changed from a const arrow function to a function declaration to resolve component typing errors.
// FIX: Made children optional to resolve a TypeScript error where it was incorrectly reported as missing.
export function DialogTitle({ children, className }: { children?: React.ReactNode, className?: string }) {
  return <h2 className={`text-xl font-semibold text-white ${className}`}>{children}</h2>;
}

// FIX: Changed from a const arrow function to a function declaration to resolve component typing errors.
// FIX: Made children optional to resolve a TypeScript error where it was incorrectly reported as missing.
export function DialogDescription({ children, className }: { children?: React.ReactNode, className?: string }) {
  return <p className={`text-sm text-gray-400 mt-1 ${className}`}>{children}</p>;
}

// FIX: Changed from a const arrow function to a function declaration to resolve component typing errors.
// FIX: Made children optional to resolve a TypeScript error where it was incorrectly reported as missing.
export function DialogFooter({ children, className }: { children?: React.ReactNode, className?: string }) {
  return <div className={`mt-6 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0 ${className}`}>{children}</div>;
}
