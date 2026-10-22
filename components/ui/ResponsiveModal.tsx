import React, { createContext, useContext } from 'react';
import { useMediaQuery } from '../../hooks/use-media-query';
import { Dialog, DialogContent } from './Dialog';
import { Sheet, SheetContent } from './Sheet';

/**
 * DESIGN SYSTEM DE MODAIS (App Shell)
 *
 * Tipos de exibição (displayMode):
 *  - 'dialog' : formulários e confirmações (centralizado no desktop)
 *  - 'drawer' : filtros e visualização de detalhes (gaveta lateral direita no desktop)
 *  - Mobile   : sempre bottom sheet.
 *
 * Tamanhos padronizados (size) - inferidos do className legado quando não informados:
 *  - 'sm' : confirmações e filtros  (max-w-md)
 *  - 'md' : formulários simples     (max-w-2xl)
 *  - 'xl' : formulários complexos / detalhes (max-w-5xl dialog | max-w-4xl drawer)
 *
 * Header, Title, Description e Footer possuem estilo único: classes de
 * tamanho, cor e fonte passadas pelos consumidores são descartadas.
 */

export type ModalSize = 'sm' | 'md' | 'xl';
export type ModalDisplayMode = 'dialog' | 'drawer';

interface ResponsiveModalContextType {
  isDesktop: boolean;
  displayMode: ModalDisplayMode;
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
  displayMode?: ModalDisplayMode;
}

export function ResponsiveModal({ children, open, isOpen, onOpenChange, displayMode = 'dialog' }: ResponsiveModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
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

// Remove tokens de estilo legados (tamanho, cor, borda, layout) para forçar o padrão.
const STYLE_TOKEN = /^(?:[a-z]+:)*(?:max-w-|min-w-|w-|h-|max-h-|min-h-|bg-|border|p-|px-|py-|overflow|flex|shadow|rounded)/;
const stripStyle = (className?: string) =>
  (className || '').split(/\s+/).filter(t => t && !STYLE_TOKEN.test(t)).join(' ');

const stripTypography = (className?: string) =>
  (className || '').split(/\s+/).filter(t => t && !/^(?:[a-z]+:)*(?:text-|font-|tracking-|mt-|mb-)/.test(t)).join(' ');

const inferSize = (className?: string): ModalSize => {
  const matches = (className || '').match(/max-w-(?:\[[^\]]+\]|[a-z0-9]+)/g) || [];
  let rank = 0;
  for (const m of matches) {
    const v = m.replace('max-w-', '');
    if (v.startsWith('[') || ['4xl', '5xl', '6xl', '7xl'].includes(v)) rank = Math.max(rank, 2);
    else if (['2xl', '3xl'].includes(v)) rank = Math.max(rank, 1);
  }
  return (['sm', 'md', 'xl'] as ModalSize[])[rank];
};

const DIALOG_WIDTH: Record<ModalSize, string> = { sm: 'max-w-md', md: 'max-w-2xl', xl: 'max-w-5xl' };
const DRAWER_WIDTH: Record<ModalSize, string> = { sm: 'max-w-md', md: 'max-w-xl', xl: 'max-w-4xl' };

// Estilo padrão dos campos dentro de qualquer modal
const BODY_STANDARD = [
  '[&_label]:text-xs [&_label]:font-medium [&_label]:text-gray-300',
  '[&_input]:text-sm [&_select]:text-sm [&_textarea]:text-sm',
  '[&_input:not([type=checkbox]):not([type=radio]):not([type=file])]:h-9 [&_select]:h-9',
  '[&_input:not([type=checkbox]):not([type=radio]):not([type=file])]:bg-brand-dark-950 [&_select]:bg-brand-dark-950 [&_textarea]:bg-brand-dark-950',
  '[&_input:not([type=checkbox]):not([type=radio]):not([type=file])]:border-gray-800 [&_select]:border-gray-800 [&_textarea]:border-gray-800',
].join(' ');

export function ResponsiveModalContent({
  children,
  className,
  size,
  fullHeight = false,
  preventOutsideClose = true,
}: {
  children: React.ReactNode;
  className?: string;
  size?: ModalSize;
  fullHeight?: boolean;
  preventOutsideClose?: boolean;
}) {
  const { isDesktop, displayMode } = useResponsiveModal();

  const handleInteractOutside = (e: React.MouseEvent) => {
    if (preventOutsideClose) e.preventDefault();
  };

  const resolvedSize = size ?? inferSize(className);
  const base = `bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col text-white ${BODY_STANDARD}`;

  if (isDesktop && displayMode === 'drawer') {
    return (
      <SheetContent
        onInteractOutside={handleInteractOutside}
        side="right"
        className={`${base} h-full w-full ${DRAWER_WIDTH[resolvedSize]} border-l`}
      >
        {children}
      </SheetContent>
    );
  }

  if (isDesktop) {
    const height =
      resolvedSize === 'sm' && !fullHeight
        ? 'max-h-[90vh]'
        : fullHeight
        ? 'h-[90vh]'
        : 'h-[90vh] md:h-auto md:max-h-[90vh]';
    return (
      <DialogContent
        onInteractOutside={handleInteractOutside}
        className={`${base} rounded-2xl ${DIALOG_WIDTH[resolvedSize]} ${height}`}
      >
        {children}
      </DialogContent>
    );
  }

  return (
    <SheetContent
      onInteractOutside={handleInteractOutside}
      side="bottom"
      className={`${base} max-h-[92vh] ${resolvedSize === 'sm' ? '' : 'h-[92vh]'}`}
    >
      <div className="w-full flex justify-center pt-3 pb-2 shrink-0 bg-brand-dark-900">
        <div className="h-1.5 w-12 rounded-full bg-gray-700" />
      </div>
      <div className="flex-1 w-full flex flex-col min-h-0 overflow-hidden">{children}</div>
    </SheetContent>
  );
}

export function ResponsiveModalHeader({ children }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="px-6 py-4 pr-14 border-b border-gray-800 bg-brand-dark-900 shrink-0 text-left">
      {children}
    </div>
  );
}

export function ResponsiveModalTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-base font-semibold text-white tracking-tight ${stripTypography(className)}`}>{children}</h2>
  );
}

export function ResponsiveModalDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  const hidden = /\bhidden\b/.test(className || '') ? 'hidden' : '';
  return <p className={`text-xs text-gray-400 mt-0.5 ${hidden}`}>{children}</p>;
}

export function ResponsiveModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  const justify = /\bjustify-between\b/.test(className || '') ? 'justify-between' : 'justify-end';
  return (
    <div className={`px-6 py-4 border-t border-gray-800 bg-brand-dark-900 shrink-0 pb-safe flex flex-row items-center ${justify} gap-3 [&>button]:h-9 [&>button]:text-sm [&>button]:px-4 [&>button]:w-auto`}>
      {children}
    </div>
  );
}

export { stripStyle };
