import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ObraCategoriaRow } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { TrendingUpIcon, ChevronRightIcon, CheckCircle2Icon } from '../../lib/icons';
import { Skeleton } from '../ui/Skeleton';

interface EstourosPrevistoProps {
  categorias?: ObraCategoriaRow[];
  concludedProjectIds?: Set<string>;
  isLoading?: boolean;
  isError?: boolean;
}

export const EstourosPrevisto: React.FC<EstourosPrevistoProps> = ({
  categorias,
  concludedProjectIds,
  isLoading,
  isError,
}) => {
  const navigate = useNavigate();

  const items = useMemo(() => {
    if (!categorias) return [];

    return categorias
      .filter((c) => {
        // Ignora obras concluídas
        if (concludedProjectIds && concludedProjectIds.has(c.project_id)) {
          return false;
        }

        const realiz = c.realizado_material ?? 0;
        const orcado = c.orcado_material ?? 0;

        // Caso 1: realizado > orçado e orçado > 0
        if (realiz > orcado && orcado > 0) return true;

        // Caso 2: realizado > 0 e orçado == 0
        if (realiz > 0 && orcado === 0) return true;

        return false;
      })
      .sort((a, b) => (b.desvio_valor ?? 0) - (a.desvio_valor ?? 0))
      .slice(0, 5);
  }, [categorias, concludedProjectIds]);

  if (isLoading) {
    return (
      <section className="space-y-0">
        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-t-xl px-4 py-3 flex items-center justify-between shadow-xs">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="bg-white dark:bg-[#111827] border-x border-b border-[#E2E8F0] dark:border-[#1E293B] rounded-b-xl p-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="space-y-0">
        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-t-xl px-4 py-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
            Estourando o previsto
          </h2>
        </div>
        <div className="p-4 rounded-b-xl border-x border-b border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300">
          Não foi possível carregar os desvios de orçamento no momento.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-0">
      {/* FAIXA DE TÍTULO NO PADRÃO NOTAS */}
      <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-t-xl px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <TrendingUpIcon className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
            Estourando o previsto
          </h2>
        </div>
        <span className="text-[11px] font-semibold text-slate-500 dark:text-[#94A3B8]">
          Até 5 maiores desvios
        </span>
      </div>

      {/* CONTEÚDO COLADO ABAIXO DA FAIXA */}
      <div className="bg-white dark:bg-[#111827] border-x border-b border-[#E2E8F0] dark:border-[#1E293B] rounded-b-xl p-3 sm:p-4 shadow-xs">
        {items.length === 0 ? (
          <div className="py-6 px-4 text-center flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2Icon className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-[#F8FAFC]">
              Nenhuma categoria acima do previsto.
            </p>
            <p className="text-[11px] text-slate-400 dark:text-[#94A3B8]">
              Todos os gastos com materiais estão dentro do valor orçado.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B]">
            {items.map((item, idx) => {
              const orcado = item.orcado_material ?? 0;
              const desvioPct = item.desvio_pct !== null && item.desvio_pct !== undefined ? item.desvio_pct : 0;
              const isSemPrevisao = orcado === 0;
              const isHighDeviation = !isSemPrevisao && desvioPct > 10;

              return (
                <li
                  key={`${item.project_id}-${item.categoria}-${idx}`}
                  className="py-3 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-brand-dark-800/40 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-[#F8FAFC] truncate">
                      {item.categoria} <span className="text-slate-400 font-normal">·</span> {item.obra}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-[#94A3B8] mt-0.5 font-mono">
                      Gasto: {formatCurrency(item.realizado_material)}
                      {orcado > 0 ? ` de ${formatCurrency(orcado)}` : ' (sem orçamento para esta categoria)'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    {isSemPrevisao ? (
                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/[0.12] border border-amber-200/80 dark:border-amber-500/20 px-2 py-0.5 rounded-full">
                        sem previsão
                      </span>
                    ) : (
                      <span
                        className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full border ${
                          isHighDeviation
                            ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/[0.12] border-rose-200/80 dark:border-rose-500/20'
                            : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/[0.12] border-amber-200/80 dark:border-amber-500/20'
                        }`}
                      >
                        +{Math.round(desvioPct)}% ({formatCurrency(item.desvio_valor)})
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => navigate(`/orcamentos?obra=${item.project_id}`)}
                      className="text-xs font-semibold text-brand-blue-600 dark:text-[#818CF8] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      Ver orçamento
                      <ChevronRightIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default EstourosPrevisto;
