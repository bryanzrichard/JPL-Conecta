import React, { createContext, useContext } from 'react';
import { useMediaQuery } from '../../hooks/use-media-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './Dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from './Sheet';

const ResponsiveModalContext = createContext<{ isDesktop: boolean } | undefined>(undefined);

export function useResponsiveModal() {
  const context = useContext(ResponsiveModalContext);
  if (context === undefined) {
    throw new Error('useResponsiveModal must be used within a ResponsiveModal');
  }
  return context;
}

export function ResponsiveModal({ children, open, isOpen, onOpenChange }: { children: React.ReactNode, open?: boolean, isOpen?: boolean, onOpenChange?: (open: boolean) => void }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const actualOpen = open !== undefined ? open : isOpen;
  
  return (
    <ResponsiveModalContext.Provider value={{ isDesktop }}>
      {isDesktop ? (
        <Dialog open={actualOpen} onOpenChange={onOpenChange}>{children}</Dialog>
      ) : (
        <Sheet open={actualOpen} onOpenChange={onOpenChange}>{children}</Sheet>
      )}
    </ResponsiveModalContext.Provider>
  );
}

export function ResponsiveModalContent({ children, className, preventOutsideClose = true }: { children: React.ReactNode, className?: string, preventOutsideClose?: boolean }) {
  const { isDesktop } = useResponsiveModal();
  
  const handleInteractOutside = (e: React.MouseEvent) => {
    if (preventOutsideClose) {
      e.preventDefault();
    }
  };

  if (isDesktop) {
    const hasCustomMaxWidth = className && /\bmax-w-/.test(className);
    return (
      <DialogContent onInteractOutside={handleInteractOutside} className={`${hasCustomMaxWidth ? '' : 'max-w-2xl '}p-0 overflow-hidden flex flex-col max-h-[90vh] ${className || ''}`}>
        {children}
      </DialogContent>
    );
  }

  return (
    <SheetContent onInteractOutside={handleInteractOutside} side="bottom" className={`max-h-[90vh] p-0 flex flex-col ${className}`}>
      <div className="w-full flex justify-center pt-3 pb-2 shrink-0">
        <div className="h-1.5 w-12 rounded-full bg-gray-600" />
      </div>
      <div className="flex-1 w-full flex flex-col min-h-0 overflow-hidden">
        {children}
      </div>
    </SheetContent>
  );
}

export function ResponsiveModalHeader({ children, className }: { children: React.ReactNode, className?: string }) {
  const { isDesktop } = useResponsiveModal();
  if (isDesktop) return <DialogHeader className={`p-6 border-b border-gray-800 text-left mb-0 ${className}`}>{children}</DialogHeader>;
  return <SheetHeader className={className}>{children}</SheetHeader>;
}

export function ResponsiveModalTitle({ children, className }: { children: React.ReactNode, className?: string }) {
  const { isDesktop } = useResponsiveModal();
  if (isDesktop) return <DialogTitle className={className}>{children}</DialogTitle>;
  return <SheetTitle className={className}>{children}</SheetTitle>;
}

export function ResponsiveModalDescription({ children, className }: { children: React.ReactNode, className?: string }) {
  const { isDesktop } = useResponsiveModal();
  if (isDesktop) return <DialogDescription className={className}>{children}</DialogDescription>;
  return <SheetDescription className={className}>{children}</SheetDescription>;
}

export function ResponsiveModalFooter({ children, className }: { children: React.ReactNode, className?: string }) {
  const { isDesktop } = useResponsiveModal();
  if (isDesktop) return <DialogFooter className={`p-6 border-t border-gray-800 mt-0 ${className}`}>{children}</DialogFooter>;
  return <SheetFooter className={`pb-safe ${className}`}>{children}</SheetFooter>;
}
