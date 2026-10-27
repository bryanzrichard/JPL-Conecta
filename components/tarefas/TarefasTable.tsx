import React, { useMemo } from 'react';
import { EnrichedTask } from './types';
import { 
  CheckCircle2Icon, 
  ConstructionIcon, 
  UserIcon, 
  ClipboardListIcon
} from '../../lib/icons';
import { formatDateDM } from '../../lib/utils';
import { TaskPriority } from '../../types';
import { parseCompraItens, formatCompraItem } from '../../lib/compraItens';

interface TarefasTableProps {
  tasks: EnrichedTask[];
  selectedTaskId: string | null;
  onSelectTask: (task: EnrichedTask) => void;
  onToggleStatus: (task: EnrichedTask) => void;
  onRescheduleTomorrow?: (task: EnrichedTask) => void;
  isDetailOpen: boolean;
  emptyMessage?: string;
  emptySubtitle?: string;
  isTaskMutating?: (taskId: string) => boolean;
}

const getPriorityBadgeClass = (priority: TaskPriority) => {
  switch (priority) {
    case 'Alta':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40';
    case 'Média':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700';
  }
};

export const TarefasTable: React.FC<TarefasTableProps> = ({
  tasks,
  selectedTaskId,
  onSelectTask,
  onToggleStatus,
  onRescheduleTomorrow,
  isDetailOpen,
  emptyMessage = 'Nenhuma pendência encontrada',
  emptySubtitle = 'Nenhum registro corresponde aos filtros ou visão selecionada.',
  isTaskMutating,
}) => {
  // Ordenação por prazo crescente; tarefas sem prazo por último
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.data_fim_prevista && b.data_fim_prevista) {
        return a.data_fim_prevista.localeCompare(b.data_fim_prevista);
      }
      if (a.data_fim_prevista && !b.data_fim_prevista) return -1;
      if (!a.data_fim_prevista && b.data_fim_prevista) return 1;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  }, [tasks]);

  if (sortedTasks.length === 0) {
    return (
      <div className="text-center py-12 px-6 bg-slate-50/50 dark:bg-brand-dark-900/50 w-full rounded-xl border border-dashed border-slate-200 dark:border-gray-800">
        <div className="mx-auto p-3 bg-slate-100 dark:bg-gray-800 rounded-full w-fit mb-3">
          <ClipboardListIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">{emptyMessage}</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-gray-400 max-w-sm mx-auto">
          {emptySubtitle}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* ========================================================= */}
      {/* 1. VISÃO MOBILE: CARDS COMPACTOS                          */}
      {/* ========================================================= */}
      <div className="md:hidden space-y-2 p-2">
        {sortedTasks.map((task) => {
          const isSelected = selectedTaskId === task.id;
          const isMutating = isTaskMutating ? isTaskMutating(task.id) : false;
          return (
            <div
              key={task.id}
              onClick={() => onSelectTask(task)}
              className={`p-3 rounded-xl border transition-all cursor-pointer shadow-xs ${
                isSelected
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-500 font-semibold'
                  : 'bg-white dark:bg-[#111827] border-slate-200/80 dark:border-gray-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isMutating) return;
                      onToggleStatus(task);
                    }}
                    className="mt-0.5 text-slate-400 hover:text-emerald-600 cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={task.isCompleted ? 'Marcar como não concluída' : 'Marcar como concluída'}
                  >
                    {task.isCompleted ? (
                      <CheckCircle2Icon className="h-4 w-4 text-emerald-600 fill-emerald-100 dark:fill-emerald-950" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-slate-300 dark:border-gray-600 hover:border-emerald-500" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs break-words line-clamp-2 leading-snug ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-800 dark:text-gray-100 font-semibold'}`}>
                        {task.title}
                      </span>
                      {task.isPurchase && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                          Compra
                        </span>
                      )}
                    </div>

                    {/* Resumo de itens de compra abaixo do título */}
                    {task.isPurchase && (() => {
                      const itens = parseCompraItens(task.materiais_previstos);
                      if (itens.length === 0) return null;
                      const comprados = itens.filter((i) => i.comprado).length;
                      const pendentes = itens.filter((i) => !i.comprado);
                      return (
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                            {comprados} de {itens.length} comprados
                          </span>
                          {pendentes.slice(0, 3).map((item, idx) => (
                            <span key={idx} className="text-[10px] text-slate-600 dark:text-gray-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {formatCompraItem(item)}
                            </span>
                          ))}
                          {pendentes.length > 3 && (
                            <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500">
                              +{pendentes.length - 3}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <ConstructionIcon className="h-3 w-3 text-slate-400" />
                        {task.projectName}
                      </span>
                      {task.collaboratorName && (
                        <span className="flex items-center gap-1">
                          <UserIcon className="h-3 w-3 text-slate-400" />
                          {task.collaboratorName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-mono text-slate-600 dark:text-gray-300">
                      {formatDateDM(task.data_fim_prevista)}
                    </span>
                    {task.isDelayed ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
                        Atrasada
                      </span>
                    ) : task.isTodayTask ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300">
                        Hoje
                      </span>
                    ) : task.isTomorrowTask ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
                        Amanhã
                      </span>
                    ) : null}
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${getPriorityBadgeClass(task.prioridade)}`}>
                    {task.prioridade}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* 2. VISÃO DESKTOP: TABELA DE ALTA DENSIDADE (SEM SCROLL)   */}
      {/* ========================================================= */}
      <div className={`hidden md:block overflow-x-hidden ${isDetailOpen ? 'max-h-[calc(100vh-270px)] overflow-y-auto custom-scrollbar' : ''}`}>
        <table className="w-full table-fixed text-xs text-left text-slate-600 dark:text-gray-400">
          <thead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] bg-slate-50 dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#1E293B] sticky top-0 z-10">
            <tr>
              <th className="w-10 px-2.5 py-3 text-center">Status</th>
              <th className="px-3 sm:px-4 py-3 font-semibold">Tarefa</th>
              <th className="w-24 sm:w-28 px-2 sm:px-3 py-3 font-semibold whitespace-nowrap">Prazo</th>
              <th className="w-20 sm:w-24 px-2 py-3 font-semibold text-center whitespace-nowrap">Prioridade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-gray-800 bg-white dark:bg-[#111827]">
            {sortedTasks.map((task) => {
              const isSelected = selectedTaskId === task.id;
              const isMutating = isTaskMutating ? isTaskMutating(task.id) : false;
              return (
                <tr
                  id={`task-row-${task.id}`}
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className={`transition-colors cursor-pointer group ${
                    isSelected
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-l-4 border-emerald-600 font-semibold text-slate-800 dark:text-[#F8FAFC]'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {/* Status checkbox / button */}
                  <td className="w-10 px-2.5 py-2.5 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => {
                        if (isMutating) return;
                        onToggleStatus(task);
                      }}
                      className="text-slate-400 hover:text-emerald-600 cursor-pointer inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      title={task.isCompleted ? 'Reabrir tarefa' : 'Concluir tarefa'}
                    >
                      {task.isCompleted ? (
                        <CheckCircle2Icon className="h-4 w-4 text-emerald-600 fill-emerald-100 dark:fill-emerald-950" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-slate-300 dark:border-gray-600 group-hover:border-emerald-500" />
                      )}
                    </button>
                  </td>

                  {/* Tarefa & Selo Compra + Subtítulo Obra e Responsável */}
                  <td className="px-3 sm:px-4 py-2.5 min-w-0 align-middle">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <span
                          className={`text-xs break-words line-clamp-2 leading-snug ${
                            task.isCompleted
                              ? 'line-through text-slate-400'
                              : isSelected
                              ? 'font-bold text-emerald-700 dark:text-emerald-300'
                              : 'font-semibold text-slate-900 dark:text-white'
                          }`}
                          title={task.title}
                        >
                          {task.title}
                        </span>
                        {task.isPurchase && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider shrink-0 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                            Compra
                          </span>
                        )}
                      </div>

                      {/* Resumo de itens de compra abaixo do título */}
                      {task.isPurchase && (() => {
                        const itens = parseCompraItens(task.materiais_previstos);
                        if (itens.length === 0) return null;
                        const comprados = itens.filter((i) => i.comprado).length;
                        const pendentes = itens.filter((i) => !i.comprado);
                        return (
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                              {comprados} de {itens.length} comprados
                            </span>
                            {pendentes.slice(0, 3).map((item, idx) => (
                              <span key={idx} className="text-[10px] text-slate-600 dark:text-gray-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                {formatCompraItem(item)}
                              </span>
                            ))}
                            {pendentes.length > 3 && (
                              <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500">
                                +{pendentes.length - 3}
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Subtítulo integrado estilo Linear/Notion (Obra • Responsável) */}
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 dark:text-gray-400 flex-wrap">
                        <span className="inline-flex items-center gap-1 max-w-[180px] truncate" title={task.projectName}>
                          <ConstructionIcon className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{task.projectName}</span>
                        </span>
                        {task.collaboratorName && (
                          <>
                            <span className="text-slate-300 dark:text-gray-600">•</span>
                            <span className="inline-flex items-center gap-1 max-w-[140px] truncate" title={task.collaboratorName}>
                              <UserIcon className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{task.collaboratorName}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Prazo */}
                  <td className="w-24 sm:w-28 px-2 sm:px-3 py-2.5 whitespace-nowrap align-middle">
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="font-mono text-xs text-slate-700 dark:text-gray-300">
                        {formatDateDM(task.data_fim_prevista)}
                      </span>
                      {task.isDelayed ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40">
                          Atrasada
                        </span>
                      ) : task.isTodayTask ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                          Hoje
                        </span>
                      ) : task.isTomorrowTask ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                          Amanhã
                        </span>
                      ) : null}
                    </div>
                  </td>

                  {/* Prioridade */}
                  <td className="w-20 sm:w-24 px-2 py-2.5 whitespace-nowrap text-center align-middle">
                    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border ${getPriorityBadgeClass(task.prioridade)}`}>
                      {task.prioridade}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TarefasTable;
