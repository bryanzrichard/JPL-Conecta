import React, { useState, useMemo, useEffect } from 'react';
import { ObraCategoriaRow, ObraResumoRow } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { Skeleton } from '../ui/Skeleton';

interface PrevistoRealizadoProps {
  categorias?: ObraCategoriaRow[];
  obrasResumo?: ObraResumoRow[];
  isLoading?: boolean;
}

export const PrevistoRealizado: React.FC<PrevistoRealizadoProps> = ({
  categorias = [],
  obrasResumo = [],
  isLoading,
}) => {
  // Lista de todas as obras disponíveis para seleção
  const projectsList = useMemo(() => {
    if (obrasResumo.length > 0) {
      return obrasResumo.map((o) => ({
        id: o.project_id,
        nome: o.nome,
        isConcluida: o.status === 'Concluído' || o.status === 'Concluido',
      }));
    }
    // Fallback derivado das categorias se obrasResumo estiver vazio
    const map = new Map<string, string>();
    categorias.forEach((c) => map.set(c.project_id, c.obra));
    return Array.from(map.entries()).map(([id, nome]) => ({
      id,
      nome,
      isConcluida: false,
    }));
  }, [obrasResumo, categorias]);

  // Obra padrão: primeira obra NÃO concluída
  const defaultProjectId = useMemo(() => {
    const active = projectsList.find((p) => !p.isConcluida);
    return active ? active.id : projectsList[0]?.id || '';
  }, [projectsList]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(defaultProjectId);

  useEffect(() => {
    if (!selectedProjectId && defaultProjectId) {
      setSelectedProjectId(defaultProjectId);
    }
  }, [defaultProjectId, selectedProjectId]);

  // Categorias da obra selecionada
  const selectedCategorias = useMemo(() => {
    if (!selectedProjectId) return [];
    return categorias
      .filter((c) => c.project_id === selectedProjectId)
      .sort((a, b) => {
        // Ordena por maior realizado ou maior orçado
        const maxA = Math.max(a.realizado_material, a.orcado_material);
        const maxB = Math.max(b.realizado_material, b.orcado_material);
        return maxB - maxA;
      });
  }, [categorias, selectedProjectId]);

  // Escala máxima da obra para comparar as barras na mesma proporção
  const maxScale = useMemo(() => {
    let max = 0;
    selectedCategorias.forEach((c) => {
      if (c.orcado_material > max) max = c.orcado_material;
      if (c.realizado_material > max) max = c.realizado_material;
    });
    return max > 0 ? max : 1;
  }, [selectedCategorias]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="space-y-3 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-gray-200">
            Previsto vs Realizado de Material por Obra
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-gray-400">
            Comparação na mesma escala métrica para identificar desvios de orçamento.
          </p>
        </div>

        {/* Seletor de Obra */}
        <div className="flex items-center gap-2">
          <label htmlFor="obra-select-previsto" className="text-xs font-semibold text-slate-600 dark:text-gray-300 shrink-0">
            Obra:
          </label>
          <select
            id="obra-select-previsto"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="h-9 text-xs bg-slate-50 dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 rounded-lg px-2.5 font-medium text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-blue-500"
          >
            {projectsList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} {p.isConcluida ? '(Concluída)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedCategorias.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 dark:text-gray-400">
          Nenhuma categoria de material registrada para esta obra.
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {/* Legenda das barras */}
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-gray-400 pb-1 border-b border-slate-100 dark:border-gray-800">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded bg-slate-300 dark:bg-slate-700" />
              <span>Previsto (Orçado)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded bg-emerald-500" />
              <span>Realizado (Gasto)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded bg-rose-500" />
              <span>Estouro (&gt; 10%)</span>
            </span>
          </div>

          <div className="space-y-3.5">
            {selectedCategorias.map((c) => {
              const orcado = Number(c.orcado_material || 0);
              const realiz = Number(c.realizado_material || 0);
              const pctOrcadoWidth = Math.min((orcado / maxScale) * 100, 100);
              const pctRealizWidth = Math.min((realiz / maxScale) * 100, 100);

              const isSemPrevisao = orcado === 0 && realiz > 0;
              const desvioPct = c.desvio_pct !== null && c.desvio_pct !== undefined ? c.desvio_pct : 0;
              const hasEstouroCritico = !isSemPrevisao && desvioPct > 10;
              const hasEstouroAlerta = !isSemPrevisao && desvioPct > 0 && desvioPct <= 10;
              const isAbaixoOuIgual = !isSemPrevisao && desvioPct <= 0;

              // Cor da barra de realizado
              let realizBarColor = 'bg-emerald-500 dark:bg-emerald-600';
              if (hasEstouroCritico) {
                realizBarColor = 'bg-rose-500 dark:bg-rose-600';
              } else if (hasEstouroAlerta || isSemPrevisao) {
                realizBarColor = 'bg-amber-500 dark:bg-amber-600';
              }

              return (
                <div key={c.categoria} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="font-semibold text-slate-800 dark:text-gray-200 truncate">
                      {c.categoria}
                    </span>

                    {/* Badge de desvio */}
                    <div className="shrink-0 font-mono text-[11px] font-bold">
                      {isSemPrevisao ? (
                        <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/60">
                          sem previsão
                        </span>
                      ) : hasEstouroCritico ? (
                        <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/60">
                          +{Math.round(desvioPct)}%
                        </span>
                      ) : hasEstouroAlerta ? (
                        <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/60">
                          +{Math.round(desvioPct)}%
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-gray-500">
                          {isAbaixoOuIgual && orcado > 0 ? `${Math.round(desvioPct)}%` : '0%'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Barras comparativas alinhadas */}
                  <div className="space-y-1 bg-slate-50/60 dark:bg-brand-dark-900/40 p-2 rounded-xl border border-slate-100 dark:border-gray-800/60">
                    {/* Barra Previsto */}
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="w-14 text-slate-400 dark:text-gray-500 shrink-0 font-medium">
                        Previsto:
                      </span>
                      <div className="flex-1 h-2 bg-slate-200 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-400 dark:bg-slate-600 rounded-full transition-all"
                          style={{ width: `${pctOrcadoWidth}%` }}
                        />
                      </div>
                      <span className="font-mono text-slate-600 dark:text-gray-300 w-24 text-right shrink-0">
                        {formatCurrency(orcado)}
                      </span>
                    </div>

                    {/* Barra Realizado */}
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="w-14 text-slate-500 dark:text-gray-400 shrink-0 font-semibold">
                        Realizado:
                      </span>
                      <div className="flex-1 h-2 bg-slate-200 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${realizBarColor}`}
                          style={{ width: `${pctRealizWidth}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-slate-800 dark:text-white w-24 text-right shrink-0">
                        {formatCurrency(realiz)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PrevistoRealizado;
