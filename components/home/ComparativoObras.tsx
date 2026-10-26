import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ObraResumoRow } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { Skeleton } from '../ui/Skeleton';
import { ChevronsUpDownIcon, ChevronUpIcon, ChevronDownIcon } from '../../lib/icons';

interface ComparativoObrasProps {
  obras?: ObraResumoRow[];
  isLoading?: boolean;
}

type SortField = 'custo_m2' | 'gasto_total';
type SortDirection = 'asc' | 'desc';

export const ComparativoObras: React.FC<ComparativoObrasProps> = ({ obras = [], isLoading }) => {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>('gasto_total');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedObras = useMemo(() => {
    return [...obras].sort((a, b) => {
      const valA = sortField === 'custo_m2' ? (a.custo_m2 ?? -1) : (a.gasto_total ?? 0);
      const valB = sortField === 'custo_m2' ? (b.custo_m2 ?? -1) : (b.gasto_total ?? 0);

      if (valA === valB) return 0;
      return sortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
  }, [obras, sortField, sortDirection]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-gray-200">
            Comparativo entre obras por m²
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-gray-400">
            Todas as obras cadastradas. Obras concluídas servem como referência de custo final.
          </p>
        </div>
        <span className="text-[11px] text-slate-400 dark:text-gray-500 shrink-0">
          Ordene clicando no cabeçalho
        </span>
      </div>

      {sortedObras.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 dark:text-gray-400">
          Nenhuma obra cadastrada.
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full text-xs text-left text-slate-600 dark:text-gray-300 min-w-[760px]">
            <thead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 bg-slate-50/80 dark:bg-brand-dark-900/60 border-y border-slate-200/80 dark:border-gray-800">
              <tr>
                <th className="px-3 py-2.5">Obra</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-right">Área (m²)</th>
                <th className="px-3 py-2.5 text-right">Orçado/m²</th>
                <th
                  onClick={() => handleSort('custo_m2')}
                  className="px-3 py-2.5 text-right cursor-pointer select-none hover:text-brand-blue-600 dark:hover:text-brand-blue-400 transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    Gasto/m²
                    {sortField === 'custo_m2' ? (
                      sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />
                    ) : (
                      <ChevronsUpDownIcon className="h-3 w-3 opacity-40" />
                    )}
                  </span>
                </th>
                <th className="px-3 py-2.5 text-right">Comprometido/m²</th>
                <th className="px-3 py-2.5 text-right">% gasto</th>
                <th className="px-3 py-2.5 text-right">% pronta</th>
                <th
                  onClick={() => handleSort('gasto_total')}
                  className="px-3 py-2.5 text-right cursor-pointer select-none hover:text-brand-blue-600 dark:hover:text-brand-blue-400 transition-colors"
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    Gasto total
                    {sortField === 'gasto_total' ? (
                      sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />
                    ) : (
                      <ChevronsUpDownIcon className="h-3 w-3 opacity-40" />
                    )}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800/80">
              {sortedObras.map((obra) => {
                const isConcluida = obra.status === 'Concluído' || obra.status === 'Concluido';
                const hasArea = obra.area_m2 !== null && obra.area_m2 !== undefined && Number(obra.area_m2) > 0;
                const hasOrcamento = obra.orcado_total > 0;

                return (
                  <tr
                    key={obra.project_id}
                    onClick={() => navigate(`/orcamentos?obra=${obra.project_id}`)}
                    className="hover:bg-slate-50/70 dark:hover:bg-brand-dark-900/40 transition-colors cursor-pointer"
                  >
                    {/* Nome da obra */}
                    <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-gray-100 whitespace-nowrap">
                      {obra.nome}
                    </td>

                    {/* Status ou Selo Referência */}
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      {isConcluida ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800">
                          Referência
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-slate-50 text-slate-600 border-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                          {obra.status}
                        </span>
                      )}
                    </td>

                    {/* Área */}
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                      {hasArea ? (
                        `${Number(obra.area_m2).toLocaleString('pt-BR')} m²`
                      ) : (
                        <span className="text-slate-400 dark:text-gray-500 italic">Informe a área</span>
                      )}
                    </td>

                    {/* Orçado/m² */}
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                      {!hasArea ? (
                        <span className="text-slate-400 dark:text-gray-500 italic">Informe a área</span>
                      ) : !hasOrcamento ? (
                        <span className="text-slate-400 dark:text-gray-500 italic">Sem orçamento</span>
                      ) : (
                        formatCurrency(obra.orcado_m2 || 0)
                      )}
                    </td>

                    {/* Gasto/m² */}
                    <td className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap">
                      {!hasArea ? (
                        <span className="text-slate-400 dark:text-gray-500 italic font-normal">Informe a área</span>
                      ) : (
                        formatCurrency(obra.custo_m2 || 0)
                      )}
                    </td>

                    {/* Comprometido/m² */}
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                      {!hasArea ? (
                        <span className="text-slate-400 dark:text-gray-500 italic">Informe a área</span>
                      ) : !hasOrcamento ? (
                        <span className="text-slate-400 dark:text-gray-500 italic">Sem orçamento</span>
                      ) : (
                        formatCurrency(obra.comprometido_m2 || 0)
                      )}
                    </td>

                    {/* % gasto */}
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                      {hasOrcamento && obra.pct_gasto !== null ? (
                        <span className={`font-semibold ${obra.pct_gasto > 100 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-gray-300'}`}>
                          {Math.round(obra.pct_gasto)}%
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-gray-500 italic">Sem orçamento</span>
                      )}
                    </td>

                    {/* % pronta */}
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                      {obra.pct_avanco !== null ? `${Math.round(obra.pct_avanco)}%` : '-'}
                    </td>

                    {/* Gasto total */}
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-white whitespace-nowrap">
                      {formatCurrency(obra.gasto_total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ComparativoObras;
