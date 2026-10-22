import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface DropdownMenuContextType {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const DropdownMenuContext = createContext<DropdownMenuContextType | undefined>(undefined);

// FIX: Made children prop optional to resolve TypeScript error.
export const DropdownMenu = ({ children }: { children?: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  return <DropdownMenuContext.Provider value={{ isOpen, setIsOpen }}>{children}</DropdownMenuContext.Provider>;
};

function useDropdownMenu() {
    const context = useContext(DropdownMenuContext);
    if (!context) {
        throw new Error('useDropdownMenu must be used within a DropdownMenu');
    }
    return context;
}

// FIX: Made children prop optional to resolve TypeScript error.
// FIX: Added `asChild` prop to type definition to fix type error.
export const DropdownMenuTrigger = ({ children, asChild }: { children?: React.ReactNode, asChild?: boolean }) => {
  const { setIsOpen } = useDropdownMenu();
  if (React.isValidElement(children)) {
      // @ts-ignore
    return React.cloneElement(children, { onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsOpen(prev => !prev);
        // @ts-ignore
        if (children.props.onClick) children.props.onClick(e);
    }});
  }
  return null;
};

// FIX: Made children prop optional to resolve TypeScript error.
// FIX: Added `align` prop to support alignment positioning and fix "Property 'align' does not exist" error.
export const DropdownMenuContent = ({ children, className, align = 'end' }: { children?: React.ReactNode, className?: string, align?: 'start' | 'center' | 'end' }) => {
  const { isOpen, setIsOpen } = useDropdownMenu();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // PREVENT CLOSE ON ALT-TAB: Only process click if the document has focus.
      if (!document.hasFocus()) {
        return;
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen]);
  
  if (!isOpen) return null;

  const alignClasses = {
    start: 'left-0 origin-top-left',
    center: 'left-1/2 -translate-x-1/2 origin-top',
    end: 'right-0 origin-top-right',
  };

  return (
    <div ref={menuRef} className={`absolute z-[70] mt-2 w-56 bg-brand-dark-900 border border-gray-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none animate-in fade-in-0 zoom-in-95 ${alignClasses[align]} ${className}`}>
        <div className="py-1">
            {children}
        </div>
    </div>
  );
};

// FIX: Made children prop optional to resolve TypeScript error.
// FIX: Added `className` prop to allow custom styling of menu items.
export const DropdownMenuItem = ({ children, onSelect, className }: { children?: React.ReactNode, onSelect?: () => void, className?: string }) => {
    const { setIsOpen } = useDropdownMenu();
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                if (onSelect) onSelect();
                setIsOpen(false);
            }}
            className={`w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/80 hover:text-white transition-colors ${className}`}
        >
            {children}
        </button>
    );
};

export const DropdownMenuSeparator = () => <div className="h-px my-1 bg-gray-700" />;

// Other components are placeholders for now
export const DropdownMenuCheckboxItem = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
export const DropdownMenuRadioItem = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
export const DropdownMenuLabel = ({ children }: { children?: React.ReactNode }) => <div className="px-4 py-2 text-xs font-semibold text-gray-500">{children}</div>;
export const DropdownMenuShortcut = ({ children }: { children?: React.ReactNode }) => <span className="ml-auto text-xs tracking-widest text-gray-500">{children}</span>;
export const DropdownMenuGroup = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
export const DropdownMenuPortal = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const DropdownMenuSub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
export const DropdownMenuSubContent = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
export const DropdownMenuSubTrigger = ({ children }: { children?: React.ReactNode }) => <button>{children}</button>;
export const DropdownMenuRadioGroup = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;