import React from 'react';
import { EnrichedTask } from './types';
import { Button } from '../ui/Button';
import { 
  ClipboardListIcon, ConstructionIcon, UserIcon, CalendarIcon, ClockIcon, 
  DollarSignIcon, PackageIcon, WrenchIcon, ShoppingBagIcon, EditIcon, 
  Trash2Icon, ChevronUpIcon, ChevronDownIcon, XIcon, CheckCircle2Icon
} from '../../lib/icons';
import { formatCurrency, formatDateBR } from '../../lib/utils';
import { TaskPriority, TaskStatus } from '../../types';
import { parseCompraItens } from '../../lib/compraItens';
import CompraItensChecklist from './CompraItensChecklist';

interface TaskDetailPanelProps {
  task: EnrichedTask;
  onClose: () => void;
  onEdit: (task: EnrichedTask) => void;
  onDelete: (task: EnrichedTask) => void;
  onToggleStatus: (task: EnrichedTask) => void;
  onRescheduleTomorrow: (task: EnrichedTask) => void;
  onPrevTask: () => void;
  onNextTask: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  currentIndex: number;
  totalCount: number;
  isMutating?: boolean;
}

type NamedItem = { nome?: unknown };

function extractNames(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const result: string[] = [];
  for (const item of items) {
    if (typeof item === 'string' && item.trim()) {
      result.push(item.trim());
    } else if (item && typeof item === 'object' && 'nome' in item) {
      const nomeVal = (item as NamedItem).nome;
      if (typeof nomeVal === 'string' && nomeVal.trim()) {
        result.push(nomeVal.trim());
      }
    }
  }
  return result;
}

function cleanObservacoesOrDescricao(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\[compra\]/gi, '').trim();
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

const getStatusBadgeClass = (status: TaskStatus) => {
  switch (status) {
    case 'Concluída':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
    case 'Atrasada':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
    case 'Em Execução':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
    default:
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
  }
};

export const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  task, onClose, onEdit, onDelete, onToggleStatus, onRescheduleTomorrow,
  onPrevTask, onNextTask, hasPrev, hasNext, currentIndex, totalCount,
  isMutating = false,
}) => {
  const materiais = extractNames(task.materiais_previstos);
  const compraItens = parseCompraItens(task.materiais_previstos);
  const equipamentos = extractNames(task.equipamentos_utilizados);
  const hasCustoReal = task.custo_real !== null && task.custo_real !== undefined && Number(task.custo_real) > 0;
  const cleanDescricao = cleanObservacoesOrDescricao(task.description);
  const cleanObservacoes = cleanObservacoesOrDescricao(task.observacoes);

  // Linha compacta para compras: informações separadas por " · "
  const compraInfoItems: React.ReactNode[] = [];
  if (task.projectName) {
    compraInfoItems.push(
      <span key="obra" className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-gray-200">
        <ConstructionIcon className="h-3 w-3 text-emerald-600 shrink-0" />
        {task.projectName}
      </span>
    );
  }

  // "Início Previsto" só aparece se for diferente do prazo
  if (task.data_inicio_prevista && (!task.data_fim_prevista || task.data_inicio_prevista !== task.data_fim_prevista)) {
    compraInfoItems.push(
      <span key="inicio" className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-gray-200">
        <CalendarIcon className="h-3 w-3 text-indigo-500 shrink-0" />
        Início: {formatDateBR(task.data_inicio_prevista)}
      </span>
    );
  }

  if (task.data_fim_prevista) {
    compraInfoItems.push(
      <span key="prazo" className="inline-flex items-center gap-1.5 flex-wrap">
        <ClockIcon className="h-3 w-3 text-amber-500 shrink-0" />
        <span className="font-semibold text-slate-800 dark:text-gray-200">
          Prazo: {formatDateBR(task.data_fim_prevista)}
        </span>
        {task.isDelayed ? (
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40">
            Atrasada
          </span>
        ) : task.isTodayTask ? (
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            Hoje
          </span>
        ) : task.isTomorrowTask ? (
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
            Amanhã
          </span>
        ) : null}
      </span>
    );
  }

  if (task.collaboratorName) {
    compraInfoItems.push(
      <span key="resp" className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-gray-200">
        <UserIcon className="h-3 w-3 text-blue-500 shrink-0" />
        {task.collaboratorName}
      </span>
    );
  }

  compraInfoItems.push(
    <span
      key="prio"
      className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded border ${getPriorityBadgeClass(task.prioridade)}`}
    >
      {task.prioridade}
    </span>
  );

  if (hasCustoReal) {
    compraInfoItems.push(
      <span key="custo" className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-gray-200">
        <DollarSignIcon className="h-3 w-3 text-emerald-600 shrink-0" />
        Custo: <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(task.custo_real)}</span>
      </span>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm select-text">
      {/* 1. TOPBAR DE CONTROLE E NAVEGAÇÃO SEQUENCIAL */}
      <div className="p-3.5 sm:px-4 border-b border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-[#111827] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            task.isPurchase
              ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800'
              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800'
          }`}>
            {task.isPurchase ? <ShoppingBagIcon className="h-4 w-4" /> : <ClipboardListIcon className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-800 dark:text-[#F8FAFC] text-xs truncate max-w-[160px] sm:max-w-[220px]" title={task.title}>
                {task.title}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${getStatusBadgeClass(task.status)}`}>
                {task.status}
              </span>
              {task.isPurchase && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                  Compra
                </span>
              )}
              {task.isDelayed ? (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40">
                  Atrasada
                </span>
              ) : task.isTodayTask ? (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  Hoje
                </span>
              ) : task.isTomorrowTask ? (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                  Amanhã
                </span>
              ) : null}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-[#94A3B8] truncate">
              {task.projectName} {task.collaboratorName ? `• ${task.collaboratorName}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="inline-flex items-center bg-white dark:bg-brand-dark-800 rounded-lg p-0.5 border border-slate-200 dark:border-gray-700 shadow-xs">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevTask}
              disabled={!hasPrev}
              className="h-6 w-6 text-slate-600 dark:text-gray-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-brand-dark-700 rounded cursor-pointer"
              title="Tarefa Anterior (Seta Cima)"
            >
              <ChevronUpIcon className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] font-mono font-medium px-1.5 text-slate-500 dark:text-gray-400 select-none">
              {currentIndex + 1} de {totalCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNextTask}
              disabled={!hasNext}
              className="h-6 w-6 text-slate-600 dark:text-gray-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-brand-dark-700 rounded cursor-pointer"
              title="Próxima Tarefa (Seta Baixo)"
            >
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer ml-1"
            title="Fechar Detalhe (Esc)"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 2. BARRA DE AÇÕES (FIXA NO TOPO, LOGO ABAIXO DA TOPBAR) */}
      <div className="p-3 bg-white dark:bg-[#111827] border-b border-slate-200/80 dark:border-gray-800 flex items-center justify-between gap-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={isMutating}
            onClick={() => onToggleStatus(task)}
            className={`h-8 text-xs font-semibold gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              task.isCompleted
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-700'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
            }`}
          >
            <CheckCircle2Icon className="h-3.5 w-3.5" />
            <span>{task.isCompleted ? 'Reabrir Tarefa' : 'Concluir Tarefa'}</span>
          </Button>

          {!task.isCompleted && (
            <Button
              variant="outline"
              size="sm"
              disabled={isMutating}
              onClick={() => onRescheduleTomorrow(task)}
              className="h-8 text-xs font-semibold border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-brand-dark-800 gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Adiar prazo para amanhã"
            >
              <ClockIcon className="h-3.5 w-3.5 text-slate-400" />
              <span>Adiar p/ Amanhã</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(task)}
            className="h-8 px-2.5 text-xs font-semibold text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-brand-dark-800 gap-1 cursor-pointer"
            title="Editar Tarefa"
          >
            <EditIcon className="h-3.5 w-3.5" />
            <span>Editar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(task)}
            className="h-8 px-2.5 text-xs font-semibold text-[#E11D48] hover:bg-[#FFF1F2] border-rose-200/80 dark:text-[#FB7185] dark:hover:bg-rose-500/[0.12] dark:border-rose-900/40 gap-1 cursor-pointer"
            title="Excluir Tarefa"
          >
            <Trash2Icon className="h-3.5 w-3.5" />
            <span>Excluir</span>
          </Button>
        </div>
      </div>

      {/* 3. CORPO DETALHADO (SCROLLABLE) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar text-xs">
        {task.isPurchase ? (
          <>
            {/* 1) CompraItensChecklist (logo no início do corpo) */}
            {compraItens.length > 0 ? (
              <CompraItensChecklist task={task} />
            ) : materiais.length > 0 ? (
              <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 p-3.5 rounded-xl shadow-xs space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-gray-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <PackageIcon className="h-3.5 w-3.5 text-indigo-500" /> Materiais Previstos
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-brand-dark-800 text-slate-600 dark:text-gray-300">
                    {materiais.length} {materiais.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>
                <ul className="space-y-1">
                  {materiais.map((mat, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-slate-700 dark:text-gray-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                      <span>{mat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* 2) Linha compacta com as informações que existirem separadas por " · " */}
            {compraInfoItems.length > 0 && (
              <div className="bg-slate-50/70 dark:bg-brand-dark-800/50 border border-slate-200/80 dark:border-gray-800 p-2.5 sm:px-3 rounded-xl flex items-center gap-2 flex-wrap text-xs text-slate-600 dark:text-gray-400">
                {compraInfoItems.map((item, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span className="text-slate-300 dark:text-gray-600 select-none">·</span>}
                    {item}
                  </React.Fragment>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Tarefas comuns: grade de 2 colunas */
          <div className="bg-slate-50/70 dark:bg-brand-dark-800/50 border border-slate-200/80 dark:border-gray-800 p-3.5 rounded-xl space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {task.projectName && (
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <ConstructionIcon className="h-3 w-3 text-emerald-600" /> Obra / Canteiro
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-gray-200">{task.projectName}</p>
                </div>
              )}

              {task.collaboratorName && (
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <UserIcon className="h-3 w-3 text-blue-500" /> Responsável
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-gray-200">{task.collaboratorName}</p>
                </div>
              )}

              {task.data_inicio_prevista && (
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3 text-indigo-500" /> Início Previsto
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-gray-200">{formatDateBR(task.data_inicio_prevista)}</p>
                </div>
              )}

              {task.data_fim_prevista && (
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <ClockIcon className="h-3 w-3 text-amber-500" /> Prazo Final
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-slate-800 dark:text-gray-200">{formatDateBR(task.data_fim_prevista)}</span>
                    {task.isDelayed ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40">
                        Atrasada
                      </span>
                    ) : task.isTodayTask ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                        Hoje
                      </span>
                    ) : task.isTomorrowTask ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                        Amanhã
                      </span>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 dark:text-gray-400 uppercase tracking-wider block">
                  Prioridade
                </span>
                <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded border ${getPriorityBadgeClass(task.prioridade)}`}>
                  {task.prioridade}
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 dark:text-gray-400 uppercase tracking-wider block">
                  Tipo de Registro
                </span>
                <span className="font-semibold text-slate-800 dark:text-gray-200">
                  🏗️ Tarefa de Canteiro
                </span>
              </div>

              {hasCustoReal && (
                <div className="space-y-0.5 sm:col-span-2">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <DollarSignIcon className="h-3 w-3 text-emerald-600" /> Custo Real
                  </span>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                    {formatCurrency(task.custo_real)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3) Descrição e observações se houver (para compras e tarefas comuns) */}
        {cleanDescricao !== '' && (
          <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 p-3.5 rounded-xl shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Descrição Detalhada</span>
            <p className="text-xs text-slate-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{cleanDescricao}</p>
          </div>
        )}

        {cleanObservacoes !== '' && (
          <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 p-3.5 rounded-xl shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Observações</span>
            <p className="text-xs text-slate-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{cleanObservacoes}</p>
          </div>
        )}

        {/* Materiais e equipamentos para tarefas comuns */}
        {!task.isPurchase && materiais.length > 0 && (
          <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 p-3.5 rounded-xl shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-gray-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <PackageIcon className="h-3.5 w-3.5 text-indigo-500" /> Materiais Previstos
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-brand-dark-800 text-slate-600 dark:text-gray-300">
                {materiais.length} {materiais.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <ul className="space-y-1">
              {materiais.map((mat, idx) => (
                <li key={idx} className="flex items-center gap-2 text-slate-700 dark:text-gray-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                  <span>{mat}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {equipamentos.length > 0 && (
          <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 p-3.5 rounded-xl shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-gray-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <WrenchIcon className="h-3.5 w-3.5 text-amber-500" /> Equipamentos Utilizados
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-brand-dark-800 text-slate-600 dark:text-gray-300">
                {equipamentos.length} {equipamentos.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <ul className="space-y-1">
              {equipamentos.map((eq, idx) => (
                <li key={idx} className="flex items-center gap-2 text-slate-700 dark:text-gray-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span>{eq}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskDetailPanel;
