import React from 'react';
import { BuscaGlobalTipo, ROTULOS_BUSCA } from '../../lib/buscaGlobal';
import { Button } from '../ui/Button';
import { SearchIcon, XIcon, FilterIcon, SparklesIcon } from '../../lib/icons';
import { formatCurrency } from '../../lib/utils';

export interface BuscaHeaderProps {
  termoLocal: string;
  onChangeTermo: (val: string) => void;
  onClearTermo: () => void;
  onToggleFiltros: () => void;
  filtrosAbertos: boolean;
  activeFiltersCount: number;
  isDesktop: boolean;
  tipoParam: BuscaGlobalTipo | null;
  rawRowsCount: number;
  totalTipo: number;
  somaTipo: number | null;
  gruposCount: number;
  visibleRowsCount: number;
}

export const BuscaHeader: React.FC<BuscaHeaderProps> = ({
  termoLocal,
  onChangeTermo,
  onClearTermo,
  onToggleFiltros,
  filtrosAbertos,
  activeFiltersCount,
  isDesktop,
  tipoParam,
  rawRowsCount,
  totalTipo,
  somaTipo,
  gruposCount,
  visibleRowsCount,
}) => {
  return (
    <header className="px-4 py-2.5 sm:px-6 bg-white dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between gap-3 shrink-0 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
          <SparklesIcon className="h-4.5 w-4.5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-[#F8FAFC] tracking-tight leading-none">
            Busca
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5">
            Auditoria e conferência unificada de registros
          </p>
        </div>
      </div>

      {/* Campo de Busca Compacto e Botão Filtros */}
      <div className="flex items-center gap-2 flex-1 max-w-xl min-w-[240px]">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToggleFiltros}
          className={`h-9 px-3 text-xs font-semibold gap-1.5 cursor-pointer ${
            (isDesktop ? filtrosAbertos : false) || activeFiltersCount > 0
              ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
              : 'text-slate-700 dark:text-gray-300 border-slate-300 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-brand-dark-800'
          }`}
        >
          <FilterIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros</span>
          {activeFiltersCount > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </Button>

        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <SearchIcon className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={termoLocal}
            onChange={(e) => onChangeTermo(e.target.value)}
            placeholder="Buscar em notas, itens, serviços, pagamentos, tarefas, cadastros..."
            className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm font-normal shadow-2xs"
          />
          {termoLocal && (
            <button
              type="button"
              onClick={onClearTermo}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Contadores da barra do topo */}
      <div className="hidden sm:flex items-center gap-2 text-xs">
        {tipoParam ? (
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg">
            {ROTULOS_BUSCA[tipoParam] || tipoParam}: {rawRowsCount} de {Math.max(totalTipo, rawRowsCount)}
            {somaTipo !== null && ` · ${formatCurrency(somaTipo)}`}
          </span>
        ) : (
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {gruposCount} {gruposCount === 1 ? 'grupo' : 'grupos'} · {visibleRowsCount} itens
          </span>
        )}
      </div>
    </header>
  );
};

export default BuscaHeader;
