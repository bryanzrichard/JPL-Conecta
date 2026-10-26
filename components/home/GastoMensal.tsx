import React, { useState, useMemo } from 'react';
import { GastoMensalRow } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { Skeleton } from '../ui/Skeleton';

interface GastoMensalProps {
  dados?: GastoMensalRow[];
  meses: number;
  onMesesChange: (meses: number) => void;
  isLoading?: boolean;
}

const PROJECT_PALETTE = [
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#F59E0B',
  '#EC4899',
  '#06B6D4',
  '#6366F1',
  '#14B8A6',
  '#F97316',
  '#84CC16',
];

function formatMonthAbbr(dateStr: string): string {
  try {
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = clean.split('-');
    if (parts.length >= 2) {
      const year = parts[0];
      const month = parts[1];
      const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const mIdx = parseInt(month, 10) - 1;
      const yy = year.slice(-2);
      return `${months[mIdx] || month}/${yy}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export const GastoMensal: React.FC<GastoMensalProps> = ({
  dados = [],
  meses,
  onMesesChange,
  isLoading,
}) => {
  const [selectedBar, setSelectedBar] = useState<GastoMensalRow | null>(null);

  // Mapeamento de cor fixa por obra
  const projectColors = useMemo(() => {
    const map = new Map<string, string>();
    let colorIdx = 0;
    dados.forEach((d) => {
      if (!map.has(d.project_id)) {
        map.set(d.project_id, PROJECT_PALETTE[colorIdx % PROJECT_PALETTE.length]);
        colorIdx++;
      }
    });
    return map;
  }, [dados]);

  // Agrupamento por mês (ordem cronológica crescente)
  const monthsData = useMemo(() => {
    const map = new Map<string, GastoMensalRow[]>();

    dados.forEach((d) => {
      const mesKey = d.mes.includes('T') ? d.mes.split('T')[0] : d.mes;
      if (!map.has(mesKey)) {
        map.set(mesKey, []);
      }
      map.get(mesKey)!.push(d);
    });

    const sortedMonths = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return sortedMonths.map(([mesKey, items]) => ({
      mesKey,
      mesLabel: formatMonthAbbr(mesKey),
      items,
      totalMes: items.reduce((acc, cur) => acc + (cur.total || 0), 0),
    }));
  }, [dados]);

  // Escala máxima compartilhada entre todas as barras
  const maxTotal = useMemo(() => {
    let max = 0;
    dados.forEach((d) => {
      if (d.total > max) max = d.total;
    });
    return max > 0 ? max : 1;
  }, [dados]);

  // Lista única de obras presentes no período para legenda
  const uniqueProjects = useMemo(() => {
    const map = new Map<string, string>();
    dados.forEach((d) => map.set(d.project_id, d.obra));
    return Array.from(map.entries()).map(([id, obra]) => ({ id, obra }));
  }, [dados]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl p-4 sm:p-5 space-y-4">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-800 dark:text-[#F8FAFC]">
          Evolução do Gasto Mensal por Obra
        </h3>

        {/* Seletor 6 ou 12 meses no estilo dos botões de Notas */}
        <div className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-[#162235] p-0.5 border border-[#E2E8F0] dark:border-[#1E293B] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onMesesChange(6)}
            className={`px-3 py-1 text-xs rounded-md transition-all cursor-pointer ${
              meses === 6
                ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold dark:bg-[#1E293B] dark:text-[#818CF8] shadow-xs'
                : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-white font-medium'
            }`}
          >
            6 meses
          </button>
          <button
            type="button"
            onClick={() => onMesesChange(12)}
            className={`px-3 py-1 text-xs rounded-md transition-all cursor-pointer ${
              meses === 12
                ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold dark:bg-[#1E293B] dark:text-[#818CF8] shadow-xs'
                : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-white font-medium'
            }`}
          >
            12 meses
          </button>
        </div>
      </div>

      {/* Detalhes ao tocar / clicar numa barra */}
      <div className="min-h-[42px] p-2.5 rounded-lg bg-slate-50 dark:bg-[#162235] border border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between text-xs">
        {selectedBar ? (
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: projectColors.get(selectedBar.project_id) || '#94A3B8' }}
            />
            <span className="font-bold text-slate-900 dark:text-white">{selectedBar.obra}</span>
            <span className="text-slate-400">·</span>
            <span className="font-semibold text-slate-700 dark:text-[#94A3B8]">
              {formatMonthAbbr(selectedBar.mes)}:
            </span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              Total {formatCurrency(selectedBar.total)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] font-mono">
              (Mat: {formatCurrency(selectedBar.material)} | M.O: {formatCurrency(selectedBar.mao_de_obra)} | Cart: {formatCurrency(selectedBar.cartorio)})
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 dark:text-[#94A3B8] italic">
            Toque em uma barra vertical para inspecionar a abertura de Material, Mão de Obra e Cartório.
          </span>
        )}
      </div>

      {monthsData.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500 dark:text-[#94A3B8]">
          Nenhum gasto registrado nos últimos {meses} meses.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Gráfico de barras verticais agrupadas por mês */}
          <div className="h-56 w-full pt-4 pb-2 px-2 border-b border-[#E2E8F0] dark:border-[#1E293B] flex items-end justify-between gap-2 overflow-x-auto custom-scrollbar">
            {monthsData.map((m) => (
              <div
                key={m.mesKey}
                className="flex-1 min-w-[50px] flex flex-col items-center justify-end h-full gap-1 group"
              >
                {/* Barras das obras no mês */}
                <div className="w-full flex items-end justify-center gap-1 h-full px-1">
                  {m.items.map((it) => {
                    const heightPct = Math.max(Math.min((it.total / maxTotal) * 100, 100), 4);
                    const color = projectColors.get(it.project_id) || '#94A3B8';
                    const isSelected =
                      selectedBar?.project_id === it.project_id && selectedBar?.mes === it.mes;

                    return (
                      <div
                        key={it.project_id}
                        onClick={() => setSelectedBar(it)}
                        onMouseEnter={() => setSelectedBar(it)}
                        style={{
                          height: `${heightPct}%`,
                          backgroundColor: color,
                        }}
                        className={`w-3.5 sm:w-5 rounded-t-sm transition-all cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-white dark:ring-gray-900 scale-105 opacity-100 z-10'
                            : 'opacity-85 hover:opacity-100'
                        }`}
                        title={`${it.obra} (${m.mesLabel}): ${formatCurrency(it.total)}`}
                      />
                    );
                  })}
                </div>

                {/* Rótulo do Mês */}
                <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-[#94A3B8] uppercase tracking-tighter shrink-0 pt-1">
                  {m.mesLabel}
                </span>
              </div>
            ))}
          </div>

          {/* Legenda das Obras */}
          <div className="pt-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#94A3B8] mb-2">
              Obras no período
            </p>
            <div className="flex flex-wrap gap-2.5">
              {uniqueProjects.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-[#94A3B8]">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: projectColors.get(p.id) || '#94A3B8' }}
                  />
                  <span>{p.obra}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GastoMensal;
