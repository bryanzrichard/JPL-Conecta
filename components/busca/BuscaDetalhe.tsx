import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { BuscaGlobalRow, BuscaGlobalTipo } from '../../lib/buscaGlobal';
import { carregarNota, carregarNotaPorItem, carregarServico, carregarServicoPorAdiantamento, carregarTarefa } from '../../lib/carregarRegistros';
import { NotaDetailPanel } from '../notas/NotaDetailPanel';
import { ServicoDetailPanel } from '../servicos/ServicoDetailPanel';
import { TaskDetailPanel } from '../tarefas/TaskDetailPanel';
import { BuscaDetalheGenerico } from './BuscaDetalheGenerico';
import { Button } from '../ui/Button';
import { ExternalLinkIcon, XIcon, ChevronUpIcon, ChevronDownIcon } from '../../lib/icons';

export interface BuscaDetalheProps {
  item: BuscaGlobalRow;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  currentIndex: number;
  totalCount: number;
  onAuditFilter: (filtros: { q?: string; tipo?: BuscaGlobalTipo; obra?: string }) => void;
}

export const BuscaDetalhe: React.FC<BuscaDetalheProps> = ({
  item,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  currentIndex,
  totalCount,
  onAuditFilter,
}) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const detalhes = (item.detalhes || {}) as Record<string, unknown>;

  // 1. Carregamento de NOTA (seja tipo nota ou item)
  const isNota = item.tipo === 'nota';
  const isItem = item.tipo === 'item';
  const notaIdFromItem = typeof detalhes.nota_id === 'string' ? detalhes.nota_id : null;

  const { data: notaData, isLoading: loadingNota } = useQuery({
    queryKey: ['busca_detalhe_nota', item.tipo, item.id],
    queryFn: async () => {
      if (isNota) {
        return await carregarNota(item.id, companyId);
      }
      if (isItem) {
        if (notaIdFromItem) {
          return await carregarNota(notaIdFromItem, companyId);
        }
        const res = await carregarNotaPorItem(item.id, companyId);
        return res.nota;
      }
      return null;
    },
    enabled: isNota || isItem,
    staleTime: 60000,
  });

  // 2. Carregamento de SERVIÇO (seja tipo servico ou adiantamento)
  const isServico = item.tipo === 'servico';
  const isAdiantamento = item.tipo === 'adiantamento';
  const servicoIdFromAdv =
    typeof detalhes.service_id === 'string'
      ? detalhes.service_id
      : typeof detalhes.servico_id === 'string'
      ? detalhes.servico_id
      : null;

  const { data: servicoData, isLoading: loadingServico } = useQuery({
    queryKey: ['busca_detalhe_servico', item.tipo, item.id],
    queryFn: async () => {
      if (isServico) {
        return await carregarServico(item.id, companyId);
      }
      if (isAdiantamento) {
        if (servicoIdFromAdv) {
          return await carregarServico(servicoIdFromAdv, companyId);
        }
        const res = await carregarServicoPorAdiantamento(item.id, companyId);
        return res.servico;
      }
      return null;
    },
    enabled: isServico || isAdiantamento,
    staleTime: 60000,
  });

  // 3. Carregamento de TAREFA / COMPRA
  const isTarefa = item.tipo === 'tarefa' || item.tipo === 'compra';

  const { data: tarefaData, isLoading: loadingTarefa } = useQuery({
    queryKey: ['busca_detalhe_tarefa', item.tipo, item.id],
    queryFn: async () => {
      return await carregarTarefa(item.id, companyId);
    },
    enabled: isTarefa,
    staleTime: 60000,
  });

  const renderHeaderAction = (label: string) => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate(item.rota)}
      className="h-7 px-2 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 gap-1 cursor-pointer"
      title={`Abrir na página do registro (${item.rota})`}
    >
      <ExternalLinkIcon className="h-3 w-3" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );

  const renderLoadingFallback = (titulo: string) => (
    <div className="h-full flex flex-col bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-3.5 sm:px-4 border-b border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-[#111827] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div>
            <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mb-1" />
            <div className="h-2.5 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="inline-flex items-center bg-white dark:bg-brand-dark-800 rounded-lg p-0.5 border border-slate-200 dark:border-gray-700">
            <Button variant="ghost" size="icon" onClick={onPrev} disabled={!hasPrev} className="h-6 w-6">
              <ChevronUpIcon className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] font-mono font-medium px-1.5 text-slate-500">
              {currentIndex + 1}/{totalCount}
            </span>
            <Button variant="ghost" size="icon" onClick={onNext} disabled={!hasNext} className="h-6 w-6">
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-slate-400">
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-2">
        <div className="w-6 h-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Carregando detalhes de {titulo}...</p>
      </div>
    </div>
  );

  // Renderizar Nota Fiscal ou Item da Nota
  if (isNota || isItem) {
    if (loadingNota) {
      return renderLoadingFallback(isItem ? 'item de nota' : 'nota fiscal');
    }
    if (notaData) {
      return (
        <NotaDetailPanel
          nota={notaData}
          onClose={onClose}
          onPrevNota={onPrev}
          onNextNota={onNext}
          hasPrev={hasPrev}
          hasNext={hasNext}
          currentIndex={currentIndex}
          totalCount={totalCount}
          highlightItemId={isItem ? item.id : null}
          headerAction={renderHeaderAction('Abrir em Notas')}
        />
      );
    }
    // Se não carregou notaData por algum motivo, cai no genérico
  }

  // Renderizar Serviço ou Adiantamento
  if (isServico || isAdiantamento) {
    if (loadingServico) {
      return renderLoadingFallback(isAdiantamento ? 'pagamento' : 'serviço');
    }
    if (servicoData) {
      return (
        <ServicoDetailPanel
          service={servicoData}
          onClose={onClose}
          onPrevService={onPrev}
          onNextService={onNext}
          hasPrev={hasPrev}
          hasNext={hasNext}
          currentIndex={currentIndex}
          totalCount={totalCount}
          highlightAdvanceId={isAdiantamento ? item.id : null}
          headerAction={renderHeaderAction('Abrir em Serviços')}
        />
      );
    }
  }

  // Renderizar Tarefa ou Compra
  if (isTarefa) {
    if (loadingTarefa) {
      return renderLoadingFallback(item.tipo === 'compra' ? 'compra' : 'tarefa');
    }
    if (tarefaData) {
      return (
        <TaskDetailPanel
          task={tarefaData}
          onClose={onClose}
          onPrevTask={onPrev}
          onNextTask={onNext}
          hasPrev={hasPrev}
          hasNext={hasNext}
          currentIndex={currentIndex}
          totalCount={totalCount}
          headerAction={renderHeaderAction('Abrir em Tarefas')}
        />
      );
    }
  }

  // Fallback e demais tipos: fornecedor, colaborador, obra, cartorio, etapa, orcamento_item
  return (
    <BuscaDetalheGenerico
      item={item}
      onClose={onClose}
      onPrev={onPrev}
      onNext={onNext}
      hasPrev={hasPrev}
      hasNext={hasNext}
      currentIndex={currentIndex}
      totalCount={totalCount}
      onAuditFilter={onAuditFilter}
    />
  );
};

export default BuscaDetalhe;
