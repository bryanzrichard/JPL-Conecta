import React, { createContext, useContext, useState, cloneElement, isValidElement, useRef, useEffect } from 'react';

interface PopoverContextType {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const PopoverContext = createContext<PopoverContextType | undefined>(undefined);

interface PopoverProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Popover = ({ children, open, onOpenChange }: PopoverProps) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const isOpen = isControlled ? open : internalIsOpen;
  const popoverRef = useRef<HTMLDivElement>(null);

  const setIsOpen: React.Dispatch<React.SetStateAction<boolean>> = (value) => {
    if (isControlled) {
      onOpenChange(typeof value === 'function' ? value(open) : value);
    } else {
      setInternalIsOpen(value);
    }
  };
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // PREVENT CLOSE ON ALT-TAB: Only process click if the document has focus.
      if (!document.hasFocus()) {
        return;
      }
      if (isOpen && popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  return (
    <PopoverContext.Provider value={{ isOpen, setIsOpen }}>
        <div className="relative" ref={popoverRef}>
            {children}
        </div>
    </PopoverContext.Provider>
  );
};


function usePopover() {
    const context = useContext(PopoverContext);
    if (!context) {
        throw new Error('usePopover must be used within a Popover');
    }
    return context;
}

interface PopoverTriggerProps {
  children?: React.ReactNode;
  asChild?: boolean;
}

export const PopoverTrigger = ({ children, asChild = false }: PopoverTriggerProps) => {
  const { setIsOpen } = usePopover();

  if (asChild && isValidElement(children)) {
    const child = children as React.ReactElement<any>;
    return cloneElement(child, {
      ...child.props,
      onClick: (e: React.MouseEvent) => {
        if (child.props.onClick) child.props.onClick(e);
        setIsOpen(prev => !prev);
      },
    });
  }

  return <button onClick={() => setIsOpen(prev => !prev)}>{children}</button>;
};

export const PopoverContent = ({ children, className, align = 'start' }: { children?: React.ReactNode, className?: string, align?: 'start' | 'center' | 'end' }) => {
  const { isOpen } = usePopover();

  if (!isOpen) return null;
  
  const stopPropagation = (e: React.SyntheticEvent) => {
      e.stopPropagation();
  };

  const alignClasses = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  };

  return (
    <div 
        className={`absolute z-[70] w-full top-full mt-1 bg-brand-dark-900 border border-gray-700 rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95 ${alignClasses[align]} ${className}`}
        onClick={stopPropagation}
        onMouseDown={stopPropagation}
    >
      {children}
    </div>
  );
};