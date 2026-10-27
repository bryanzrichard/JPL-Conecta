import React, { useCallback } from 'react';
import { BuscaGlobalTipo, ROTULOS_BUSCA } from '../../lib/buscaGlobal';
import { formatDateYMD } from '../../lib/utils';
import {
  FilterIcon,
  CalendarIcon,
  BuildingIcon,
  XIcon,
  CheckIcon,
} from '../../lib/icons';

export const TIPOS_ORDEM: BuscaGlobalTipo[] = [
  'nota',
  'item',
  'servico',
  'adiantamento',
  'tarefa',
  'compra',
  'fornecedor',
  'colaborador',
  'obra',
  'cartorio',
  'etapa',
  'orcamento_item',
];

export interface ProjectOption {
  id: string;
  name: string;
}

export interface BuscaFiltrosProps {
  tipoSelecionado: BuscaGlobalTipo | null;
  onSelectTipo: (tipo: BuscaGlobalTipo | null) => void;
  tipoCounts: Record<string, number>;
  obraSelecionada: string | null;
  onSelectObra: (obraId: string | null) => void;
  obras: ProjectOption[];
  dataInicio: string | null;
  dataFim: string | null;
  onSelectPeriodo: (inicio: string | null, fim: string | null) => void;
  onLimparFiltros: () => void;
  activeFiltersCount: number;
  isMobileDrawer?: boolean;
  onCloseDrawer?: () => void;
}

export function calcularDatasPreset(preset: string): {
  inicio: string | null;
  fim: string | null;
} {
  const now = new Date();
  if (preset === 'este-mes') {
    const inicio = formatDateYMD(new Date(now.getFullYear(), now.getMonth(), 1));
    const fim = formatDateYMD(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    return { inicio, fim };
  }
  if (preset === 'mes-passado') {
    const inicio = formatDateYMD(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const fim = formatDateYMD(new Date(now.getFullYear(), now.getMonth(), 0));
    return { inicio, fim };
  }
  if (preset === 'ultimos-90') {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    const inicio = formatDateYMD(d);
    const fim = formatDateYMD(now);
    return { inicio, fim };
  }
  if (preset === 'este-ano') {
    const inicio = formatDateYMD(new Date(now.getFullYear(), 0, 1));
    const fim = formatDateYMD(new Date(now.getFullYear(), 11, 31));
    return { inicio, fim };
  }
  return { inicio: null, fim: null };
}

export function identificarPreset(
  inicio: string | null,
  fim: string | null
): string {
  if (!inicio && !fim) return 'todos';
  const presets = ['este-mes', 'mes-passado', 'ultimos-90', 'este-ano'];
  for (const p of presets) {
    const res = calcularDatasPreset(p);
    if (res.inicio === inicio && res.fim === fim) return p;
  }
  return 'personalizado';
}

export const BuscaFiltros: React.FC<BuscaFiltrosProps> = ({
  tipoSelecionado,
  onSelectTipo,
  tipoCounts,
  obraSelecionada,
  onSelectObra,
  obras,
  dataInicio,
  dataFim,
  onSelectPeriodo,
  onLimparFiltros,
  activeFiltersCount,
  isMobileDrawer = false,
  onCloseDrawer,
}) => {
  const presetAtivo = identificarPreset(dataInicio, dataFim);

  const handlePresetClick = useCallback(
    (preset: string) => {
      if (preset === 'todos') {
        onSelectPeriodo(null, null);
      } else if (preset === 'personalizado') {
        if (!dataInicio && !dataFim) {
          const res = calcularDatasPreset('este-mes');
          onSelectPeriodo(res.inicio, res.fim);
        }
      } else {
        const res = calcularDatasPreset(preset);
        onSelectPeriodo(res.inicio, res.fim);
      }
    },
    [dataInicio, dataFim, onSelectPeriodo]
  );

  return (
    <div className="flex flex-col gap-5 text-sm text-slate-700 dark:text-slate-300">
      {/* Cabeçalho do Drawer Mobile */}
      {isMobileDrawer && (
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FilterIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Filtros da Busca</h2>
            {activeFiltersCount > 0 && (
              <span className="bg-indigo-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onCloseDrawer}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Botão Limpar Filtros quando houver algum ativo */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro ativo' : 'filtros ativos'}
          </span>
          <button
            type="button"
            onClick={onLimparFiltros}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
          >
            Limpar todos
          </button>
        </div>
      )}

      {/* Seção 1: Tipo de Registro */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Tipo de Registro
        </label>
        <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => onSelectTipo(null)}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
              tipoSelecionado === null
                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <span>Todos os tipos</span>
            {tipoSelecionado === null && <CheckIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
          </button>

          {TIPOS_ORDEM.map((tipo) => {
            const rotulo = ROTULOS_BUSCA[tipo] || tipo;
            const count = tipoCounts[tipo] || 0;
            const isSelected = tipoSelecionado === tipo;

            return (
              <button
                key={tipo}
                type="button"
                onClick={() => onSelectTipo(tipo)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : count > 0
                    ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    : 'text-slate-400 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                }`}
              >
                <span className="truncate pr-2">{rotulo}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full shrink-0 ${
                    isSelected
                      ? 'bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-200 font-bold'
                      : count > 0
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      : 'text-slate-300 dark:text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Seção 2: Obra */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
          <BuildingIcon className="h-3.5 w-3.5" />
          <span>Obra / Projeto</span>
        </label>
        <select
          value={obraSelecionada || ''}
          onChange={(e) => onSelectObra(e.target.value || null)}
          className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="">Todas as obras</option>
          {obras.map((obra) => (
            <option key={obra.id} value={obra.id}>
              {obra.name}
            </option>
          ))}
        </select>
      </div>

      {/* Seção 3: Período */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5" />
          <span>Período</span>
        </label>

        <div className="grid grid-cols-2 gap-1.5 mb-2.5">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'este-mes', label: 'Este mês' },
            { id: 'mes-passado', label: 'Mês passado' },
            { id: 'ultimos-90', label: 'Últimos 90 d' },
            { id: 'este-ano', label: 'Este ano' },
            { id: 'personalizado', label: 'Personalizado' },
          ].map((preset) => {
            const isSelected = presetAtivo === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetClick(preset.id)}
                className={`px-2 py-1.5 rounded-md text-[11px] font-medium border text-center transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Campos de data customizada quando for Personalizado ou com datas preenchidas */}
        {presetAtivo === 'personalizado' && (
          <div className="flex flex-col gap-2 p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-800">
            <div>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">De</span>
              <input
                type="date"
                value={dataInicio || ''}
                onChange={(e) => onSelectPeriodo(e.target.value || null, dataFim)}
                className="w-full text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">Até</span>
              <input
                type="date"
                value={dataFim || ''}
                onChange={(e) => onSelectPeriodo(dataInicio, e.target.value || null)}
                className="w-full text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>
        )}
      </div>

      {/* Botão fechar drawer no mobile */}
      {isMobileDrawer && (
        <button
          type="button"
          onClick={onCloseDrawer}
          className="mt-2 w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg shadow-sm"
        >
          Aplicar Filtros
        </button>
      )}
    </div>
  );
};
