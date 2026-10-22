import React, { createContext, useContext, useState, cloneElement, isValidElement } from 'react';
import { XIcon } from '../../lib/icons';

interface SheetContextType {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const SheetContext = createContext<SheetContextType | undefined>(undefined);

interface SheetProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Sheet({ children, open, onOpenChange }: SheetProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const isOpen = isControlled ? open : internalIsOpen;

  const setIsOpen: React.Dispatch<React.SetStateAction<boolean>> = (value) => {
    if (isControlled) {
      onOpenChange(typeof value === 'function' ? value(open) : value);
    } else {
      setInternalIsOpen(value);
    }
  };

  return <SheetContext.Provider value={{ isOpen, setIsOpen }}>{children}</SheetContext.Provider>;
}

function useSheet() {
  const context = useContext(SheetContext);
  if (!context) throw new Error('useSheet must be used within a Sheet');
  return context;
}

// FIX: Added `asChild` prop to support rendering a child component with forwarded props.
// FIX: Made children prop optional to fix type error when using asChild.
export function SheetTrigger({ children, asChild }: { children?: React.ReactNode, asChild?: boolean }) {
  const { setIsOpen } = useSheet();
  
  if (asChild) {
      if (!isValidElement(children)) {
        return null;
      }
      const child = children as React.ReactElement<any>;
      return cloneElement(child, {
        onClick: (e: React.MouseEvent) => {
          if (child.props.onClick) child.props.onClick(e);
          setIsOpen(true);
        },
      });
  }

  return <button onClick={() => setIsOpen(true)}>{children}</button>;
}

export function SheetContent({ children, className, side = 'right', onInteractOutside }: { children?: React.ReactNode; className?: string; side?: 'top' | 'right' | 'bottom' | 'left'; onInteractOutside?: (e: React.MouseEvent) => void }) {
  const { isOpen, setIsOpen } = useSheet();
  if (!isOpen) return null;

  const hasCustomMax = className && /\bmax-w-/.test(className);

  const sideClasses = {
    top: 'inset-x-0 top-0 border-b border-gray-800 animate-in slide-in-from-top-full',
    bottom: 'inset-x-0 bottom-0 w-full rounded-t-2xl border-t border-gray-800 animate-in slide-in-from-bottom-full',
    left: `inset-y-0 left-0 h-full w-full ${hasCustomMax ? '' : 'max-w-sm '}border-r border-gray-800 animate-in slide-in-from-left-full`,
    right: `inset-y-0 right-0 h-full w-full ${hasCustomMax ? '' : 'max-w-sm '}border-l border-gray-800 animate-in slide-in-from-right-full`,
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (onInteractOutside) {
        onInteractOutside(e);
        if (e.isDefaultPrevented()) {
            return;
        }
    }
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in-0" onClick={handleBackdropClick} />
      <div 
        className={`absolute bg-brand-dark-900 shadow-2xl shadow-black/80 flex flex-col duration-300 ${sideClasses[side]} ${className || ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
        <SheetClose className="absolute top-4 right-4 z-20 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-brand-dark-800/80 transition-colors">
            <XIcon className="h-5 w-5" />
        </SheetClose>
      </div>
    </div>
  );
}

export const SheetHeader = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <div className={`p-6 border-b border-gray-800 ${className}`}>{children}</div>
);

export const SheetTitle = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <h2 className={`text-lg font-semibold text-white ${className}`}>{children}</h2>
);

export const SheetDescription = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <p className={`text-sm text-gray-400 ${className}`}>{children}</p>
);

export const SheetFooter = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <div className={`mt-auto p-6 border-t border-gray-800 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0 ${className}`}>{children}</div>
);

// FIX: Added `asChild` prop to support rendering a child component with forwarded props.
export function SheetClose({ children, className, asChild }: { children?: React.ReactNode; className?: string; asChild?: boolean }) {
    const { setIsOpen } = useSheet();

    if (asChild) {
        if (!isValidElement(children)) {
            return null;
        }
        const child = children as React.ReactElement<any>;
        return cloneElement(child, {
            onClick: (e: React.MouseEvent) => {
                if (child.props.onClick) {
                    child.props.onClick(e);
                }
                setIsOpen(false);
            },
        });
    }

    return (
        <button onClick={() => setIsOpen(false)} className={`text-gray-400 hover:text-white transition-colors ${className}`}>
            {children}
        </button>
    )
}