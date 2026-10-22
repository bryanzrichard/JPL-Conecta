import React, { createContext, useContext } from 'react';
import { useMediaQuery } from '../../hooks/use-media-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './Dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from './Sheet';

interface ResponsiveModalContextType {
  isDesktop: boolean;
  displayMode: 'dialog' | 'drawer';
}

const ResponsiveModalContext = createContext<ResponsiveModalContextType | undefined>(undefined);

export function useResponsiveModal() {
  const context = useContext(ResponsiveModalContext);
  if (context === undefined) {
    throw new Error('useResponsiveModal must be used within a ResponsiveModal');
  }
  return context;
}

interface ResponsiveModalProps {
  children: React.ReactNode;
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  displayMode?: 'dialog' | 'drawer';
}

export function ResponsiveModal({ 
  children, 
  open, 
  isOpen, 
  onOpenChange,
  displayMode = 'dialog'
}: ResponsiveModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const actualOpen = open !== undefined ? open : isOpen;
  
  return (
    <ResponsiveModalContext.Provider value={{ isDesktop, displayMode }}>
      {isDesktop && displayMode === 'dialog' ? (
        <Dialog open={actualOpen} onOpenChange={onOpenChange}>{children}</Dialog>
      ) : (
        <Sheet open={actualOpen} onOpenChange={onOpenChange}>{children}</Sheet>
      )}
    </ResponsiveModalContext.Provider>
  );
}

export function ResponsiveModalContent({ 
  children, 
  className, 
  preventOutsideClose = true 
}: { 
  children: React.ReactNode, 
  className?: string, 
  preventOutsideClose?: boolean 
}) {
  const { isDesktop, displayMode } = useResponsiveModal();
  
  const handleInteractOutside = (e: React.MouseEvent) => {
    if (preventOutsideClose) {
      e.preventDefault();
    }
  };

  const hasCustomMaxWidth = className && /\bmax-w-/.test(className);

  if (isDesktop && displayMode === 'drawer') {
    return (
      <SheetContent 
        onInteractOutside={handleInteractOutside} 
        side="right" 
        className={`h-full ${hasCustomMaxWidth ? '' : 'max-w-2xl '}p-0 overflow-hidden flex flex-col border-l border-gray-800 ${className || ''}`}
      >
        {children}
      </SheetContent>
    );
  }

  if (isDesktop && displayMode === 'dialog') {
    return (
      <DialogContent 
        onInteractOutside={handleInteractOutside} 
        className={`${hasCustomMaxWidth ? '' : 'max-w-2xl '}p-0 overflow-hidden flex flex-col max-h-[92vh] ${className || ''}`}
      >
        {children}
      </DialogContent>
    );
  }

  return (
    <SheetContent 
      onInteractOutside={handleInteractOutside} 
      side="bottom" 
      className={`max-h-[92vh] p-0 flex flex-col border-t border-gray-800 ${className || ''}`}
    >
      <div className="w-full flex justify-center pt-3 pb-2 shrink-0">
        <div className="h-1.5 w-12 rounded-full bg-gray-700" />
      </div>
      <div className="flex-1 w-full flex flex-col min-h-0 overflow-hidden">
        {children}
      </div>
    </SheetContent>
  );
}

export function ResponsiveModalHeader({ children, className }: { children: React.ReactNode, className?: string }) {
  const { isDesktop, displayMode } = useResponsiveModal();
  if (isDesktop && displayMode === 'dialog') {
    return <DialogHeader className={`px-6 py-4 border-b border-gray-800 text-left mb-0 bg-brand-dark-900 ${className || ''}`}>{children}</DialogHeader>;
  }
  return <SheetHeader className={`px-5 py-4 border-b border-gray-800 text-left mb-0 bg-brand-dark-900 ${className || ''}`}>{children}</SheetHeader>;
}

export function ResponsiveModalTitle({ children, className }: { children: React.ReactNode, className?: string }) {
  const { isDesktop, displayMode } = useResponsiveModal();
  if (isDesktop && displayMode === 'dialog') {
    return <DialogTitle className={`text-lg font-semibold text-white tracking-tight ${className || ''}`}>{children}</DialogTitle>;
  }
  return <SheetTitle className={`text-base font-semibold text-white tracking-tight ${className || ''}`}>{children}</SheetTitle>;
}

export function ResponsiveModalDescription({ children, className }: { children: React.ReactNode, className?: string }) {
  const { isDesktop, displayMode } = useResponsiveModal();
  if (isDesktop && displayMode === 'dialog') {
    return <DialogDescription className={`text-xs text-gray-400 mt-0.5 ${className || ''}`}>{children}</DialogDescription>;
  }
  return <SheetDescription className={`text-xs text-gray-400 mt-0.5 ${className || ''}`}>{children}</SheetDescription>;
}

export function ResponsiveModalFooter({ children, className }: { children: React.ReactNode, className?: string }) {
  const { isDesktop, displayMode } = useResponsiveModal();
  if (isDesktop && displayMode === 'dialog') {
    return <DialogFooter className={`px-6 py-4 border-t border-gray-800 bg-brand-dark-900/90 mt-0 flex items-center justify-end gap-3 ${className || ''}`}>{children}</DialogFooter>;
  }
  return <SheetFooter className={`px-5 py-3 border-t border-gray-800 bg-brand-dark-900/95 pb-safe flex items-center justify-end gap-3 ${className || ''}`}>{children}</SheetFooter>;
}
