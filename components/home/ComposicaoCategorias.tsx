import React, { useState, useMemo } from 'react';
import { ObraCategoriaRow } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { Skeleton } from '../ui/Skeleton';

interface ComposicaoCategoriasProps {
  categorias?: ObraCategoriaRow[];
  isLoading?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Serviços Preliminares e Terraplenagem': '#F59E0B',
  'Estrutura e Fundação': '#4F46E5',
  'Carpintaria e Marcenaria': '#B45309',
  'Alvenaria e Vedação': '#E11D48',
  'Cobertura e Impermeabilização': '#0D9488',
  'Instalação Hidráulica': '#06B6D4',
  'Instalação Elétrica': '#EAB308',
  'Acabamento e Revestimento': '#10B981',
  'Esquadrias e Vidros': '#3B82F6',
  'Pintura': '#8B5CF6',
  'Gastos Gerais': '#64748B',
};

const getCategoryColor = (cat: string): string => {
  return CATEGORY_COLORS[cat] || '#94A3B8';
};

interface ActiveSegment {
  obra: string;
  categoria: string;
  pct: number;
  valor: number;
}

export const ComposicaoCategorias: React.FC<ComposicaoCategoriasProps> = ({
  categorias = [],
  isLoading,
}) => {
  const [activeSegment, setActiveSegment] = useState<ActiveSegment | null>(null);

  // Agrupa categorias por obra e filtra as obras com realizado > 0
  const obrasData = useMemo(() => {
    const map = new Map<string, { obra: string; total: number; itens: ObraCategoriaRow[] }>();

    categorias.forEach((item) => {
      const realiz = Number(item.realizado_material || 0);
      if (!map.has(item.project_id)) {
        map.set(item.project_id, {
          obra: item.obra,
          total: 0,
          itens: [],
        });
      }
      const entry = map.get(item.project_id)!;
      entry.total += realiz;
      if (realiz > 0) {
        entry.itens.push(item);
      }
    });

    return Array.from(map.values())
      .filter((entry) => entry.total > 0 && entry.itens.length > 0)
      .sort((a, b) => b.total - a.total);
  }, [categorias]);

  // Lista única de categorias presentes para a legenda
  const categoriasPresentes = useMemo(() => {
    const set = new Set<string>();
    obrasData.forEach((o) => o.itens.forEach((it) => set.add(it.categoria)));
    return Array.from(set);
  }, [obrasData]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl p-4 sm:p-5 space-y-4">
        <Skeleton className="h-6 w-56" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <h3 className="text-sm font-bold text-slate-800 dark:text-[#F8FAFC]">
          Composição do custo por categoria (Material)
        </h3>
        <span className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
          Toque para detalhes
        </span>
      </div>

      {/* Caixa de detalhes dinâmicos do segmento selecionado */}
      <div className="min-h-[38px] p-2 rounded-lg bg-slate-50 dark:bg-[#162235] border border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between text-xs">
        {activeSegment ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: getCategoryColor(activeSegment.categoria) }}
            />
            <span className="font-bold text-slate-900 dark:text-white">
              {activeSegment.categoria}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600 dark:text-[#94A3B8] font-medium">
              {activeSegment.obra}
            </span>
            <span className="text-slate-400">·</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(activeSegment.valor)}
            </span>
            <span className="text-[11px] font-mono text-slate-500 dark:text-[#94A3B8]">
              ({Math.round(activeSegment.pct)}% do material desta obra)
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 dark:text-[#94A3B8] italic">
            Toque ou passe o mouse em um segmento de cor para inspecionar valor e percentual.
          </span>
        )}
      </div>

      {obrasData.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-500 dark:text-[#94A3B8]">
          Nenhuma obra com gastos de material registrados até o momento.
        </div>
      ) : (
        <div className="space-y-3.5">
          {obrasData.map((obraEntry) => (
            <div key={obraEntry.obra} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-[#F8FAFC]">
                  {obraEntry.obra}
                </span>
                <span className="font-mono font-bold text-[11px] text-slate-600 dark:text-[#94A3B8]">
                  Total: {formatCurrency(obraEntry.total)}
                </span>
              </div>

              {/* Barra empilhada 100% */}
              <div className="h-6 w-full rounded-lg overflow-hidden flex bg-slate-100 dark:bg-[#1E293B] shadow-inner">
                {obraEntry.itens.map((item, idx) => {
                  const pct = Math.max(Number(item.pct_do_realizado_obra || 0), 0);
                  if (pct <= 0) return null;
                  const color = getCategoryColor(item.categoria);
                  const isHovered =
                    activeSegment?.obra === obraEntry.obra &&
                    activeSegment?.categoria === item.categoria;

                  return (
                    <div
                      key={`${item.categoria}-${idx}`}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: color,
                      }}
                      onMouseEnter={() =>
                        setActiveSegment({
                          obra: obraEntry.obra,
                          categoria: item.categoria,
                          pct,
                          valor: Number(item.realizado_material || 0),
                        })
                      }
                      onClick={() =>
                        setActiveSegment({
                          obra: obraEntry.obra,
                          categoria: item.categoria,
                          pct,
                          valor: Number(item.realizado_material || 0),
                        })
                      }
                      className={`h-full cursor-pointer transition-all ${
                        isHovered ? 'opacity-100 ring-2 ring-white dark:ring-gray-900 z-10 scale-y-110' : 'opacity-90 hover:opacity-100'
                      }`}
                      title={`${item.categoria}: ${formatCurrency(item.realizado_material)} (${Math.round(pct)}%)`}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Legenda única abaixo das barras */}
          <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#94A3B8] mb-2">
              Categorias
            </p>
            <div className="flex flex-wrap gap-2.5">
              {categoriasPresentes.map((cat) => (
                <div key={cat} className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-[#94A3B8]">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: getCategoryColor(cat) }}
                  />
                  <span>{cat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComposicaoCategorias;
