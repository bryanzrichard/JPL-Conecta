import React from 'react';
import { Project, Collaborator } from '../../types';
import { Button } from '../ui/Button';
import { TarefasFilters } from './types';
import { TarefasTab, TarefasCounts, initialFilters } from '../../hooks/useTarefasListas';
import {
  PlusIcon,
  XIcon,
  CalendarIcon,
  ConstructionIcon,
  FilterIcon,
} from '../../lib/icons';
import { formatDateBR } from '../../lib/utils';

export interface TarefasBarraAbasProps {
  activeTab: TarefasTab;
  onTabChange: (tab: TarefasTab) => void;
  counts: TarefasCounts;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  activeFiltersCount: number;
  onOpenFilterDrawer: () => void;
  onOpenNewTaskDrawer: () => void;
  filters: TarefasFilters;
  setFilters: React.Dispatch<React.SetStateAction<TarefasFilters>>;
  projects: Project[];
  projectsMap: Map<string, Project>;
  collaboratorsMap: Map<string, Collaborator>;
  todayStr: string;
  tomorrowStr: string;
}

export const TarefasBarraAbas: React.FC<TarefasBarraAbasProps> = ({
  activeTab,
  onTabChange,
  counts,
  searchTerm,
  onSearchChange,
  activeFiltersCount,
  onOpenFilterDrawer,
  onOpenNewTaskDrawer,
  filters,
  setFilters,
  projects,
  projectsMap,
  collaboratorsMap,
  todayStr,
  tomorrowStr,
}) => {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-t-xl px-4 py-3 shadow-xs">
        {/* Abas */}
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-brand-dark-900 p-1 border border-slate-200/80 dark:border-gray-800 text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => onTabChange('today')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'today'
                ? 'bg-white dark:bg-[#1F2937] text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
            }`}
          >
            <span>📅 Hoje & Amanhã</span>
            {counts.today > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 text-[10px]">
                {counts.today}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange('upcoming')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'upcoming'
                ? 'bg-white dark:bg-[#1F2937] text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
            }`}
          >
            <span>🗓️ Programadas</span>
            {counts.upcoming > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 text-[10px]">
                {counts.upcoming}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange('purchases')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'purchases'
                ? 'bg-white dark:bg-[#1F2937] text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
            }`}
          >
            <span>🛒 Lista de Compras</span>
            {counts.purchases > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 text-[10px]">
                {counts.purchases}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange('completed')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'completed'
                ? 'bg-white dark:bg-[#1F2937] text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
            }`}
          >
            <span>✅ Concluídas</span>
            {counts.completed > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 dark:bg-gray-800 dark:text-gray-300 text-[10px]">
                {counts.completed}
              </span>
            )}
          </button>
        </div>

        {/* Direita: Busca, Filtros e Nova Tarefa */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-48 sm:w-56">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filtrar pendências..."
              className="w-full h-8 pl-8 pr-7 text-xs bg-slate-50 dark:bg-brand-dark-800/80 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <FilterIcon className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-400" />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Botão Filtros */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenFilterDrawer}
            className="h-8 px-3 text-xs font-semibold border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-brand-dark-800 text-slate-700 dark:text-gray-300 gap-1.5 cursor-pointer"
          >
            <FilterIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="ml-1 flex items-center justify-center h-4.5 min-w-[18px] px-1 text-[10px] font-bold rounded-full bg-emerald-600 text-white">
                {activeFiltersCount}
              </span>
            )}
          </Button>

          {/* Botão Nova Tarefa */}
          <Button
            size="sm"
            onClick={onOpenNewTaskDrawer}
            className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs cursor-pointer"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span>+ Nova Tarefa</span>
          </Button>
        </div>
      </div>

      {/* Barra de Filtros Rápidos (Obra & Data) */}
      <div className="bg-slate-50/80 dark:bg-[#111827] border-x border-b border-slate-200/80 dark:border-gray-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          {/* 1. Filtro Rápido de Obra */}
          <div className="flex items-center gap-1.5">
            <ConstructionIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold text-slate-600 dark:text-gray-300 text-[11px] uppercase tracking-wider">
              Obra:
            </span>
            <select
              value={filters.project_id || ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  project_id: e.target.value ? e.target.value : null,
                }))
              }
              className="h-7 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-800 dark:text-gray-100 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer max-w-[210px] truncate"
            >
              <option value="">Todas as Obras ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-gray-700" />

          {/* 2. Filtro Rápido de Data */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <CalendarIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold text-slate-600 dark:text-gray-300 text-[11px] uppercase tracking-wider">
              Prazo:
            </span>

            {/* Atalhos Rápidos */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, start_date: null, end_date: null }))
                }
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  !filters.start_date && !filters.end_date
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-300/50'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-gray-400 hover:bg-slate-100 border border-slate-200 dark:border-gray-700'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, start_date: todayStr, end_date: todayStr }))
                }
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  filters.start_date === todayStr && filters.end_date === todayStr
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-300/50'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-gray-400 hover:bg-slate-100 border border-slate-200 dark:border-gray-700'
                }`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, start_date: tomorrowStr, end_date: tomorrowStr }))
                }
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  filters.start_date === tomorrowStr && filters.end_date === tomorrowStr
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-300/50'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-gray-400 hover:bg-slate-100 border border-slate-200 dark:border-gray-700'
                }`}
              >
                Amanhã
              </button>
            </div>

            {/* Seletor Específico de Data */}
            <div className="flex items-center gap-1.5 ml-1">
              <span className="text-slate-400 text-[11px]">ou até:</span>
              <input
                type="date"
                value={filters.end_date || ''}
                onChange={(e) => {
                  const val = e.target.value || null;
                  setFilters((prev) => ({
                    ...prev,
                    start_date: null,
                    end_date: val,
                  }));
                }}
                className="h-7 px-2 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-800 dark:text-gray-100 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                title="Filtrar tarefas até esta data limite"
              />
            </div>
          </div>
        </div>

        {/* Botão Limpar Filtros Rápidos (quando algum ativo) */}
        {(filters.project_id || filters.start_date || filters.end_date) && (
          <button
            type="button"
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                project_id: null,
                start_date: null,
                end_date: null,
              }))
            }
            className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer shrink-0 flex items-center gap-1"
          >
            <XIcon className="h-3 w-3" />
            <span>Limpar filtros rápidos</span>
          </button>
        )}
      </div>

      {/* Faixa de Filtros Ativos (se houver) */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center justify-between gap-3 bg-emerald-50/60 dark:bg-emerald-950/20 border-x border-b border-emerald-200/80 dark:border-emerald-900/40 px-4 py-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <FilterIcon className="h-3.5 w-3.5" /> Filtros ativos ({activeFiltersCount}):
            </span>
            {filters.project_id && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                Obra: {projectsMap.get(filters.project_id)?.name || 'Obra'}
              </span>
            )}
            {filters.responsavel_id && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                Responsável: {collaboratorsMap.get(filters.responsavel_id)?.name || 'Responsável'}
              </span>
            )}
            {filters.prioridade !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                Prioridade: {filters.prioridade}
              </span>
            )}
            {(filters.start_date || filters.end_date) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                Período: {filters.start_date ? formatDateBR(filters.start_date) : 'Início'} até{' '}
                {filters.end_date ? formatDateBR(filters.end_date) : 'Hoje'}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters(initialFilters)}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline h-7 px-2 font-semibold cursor-pointer"
          >
            Limpar todos
          </Button>
        </div>
      )}
    </>
  );
};
