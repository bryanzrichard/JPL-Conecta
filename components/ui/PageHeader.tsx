import React from 'react';

interface PageHeaderProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description?: string;
  /** Botões de ação primária (alinhados à direita no desktop) */
  actions?: React.ReactNode;
}

/**
 * Cabeçalho padrão de todas as páginas do App Shell.
 * Mobile: empilhado, ações em largura total. Desktop: título à esquerda, ações à direita.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ icon: Icon, title, description, actions }) => (
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-800/80">
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20 flex items-center justify-center text-brand-blue-400 shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-white tracking-tight truncate">{title}</h1>
        {description && <p className="text-sm text-gray-400 truncate">{description}</p>}
      </div>
    </div>
    {actions && (
      <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto [&>button]:w-full sm:[&>button]:w-auto [&>button]:h-9 [&>button]:text-sm">
        {actions}
      </div>
    )}
  </div>
);

export default PageHeader;
