import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ServiceWithDetails, Advance } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { 
  BriefcaseIcon, 
  UserIcon, 
  ConstructionIcon, 
  CalendarIcon, 
  DollarSignIcon, 
  TrendingUpIcon, 
  PaperclipIcon, 
  ExternalLinkIcon,
  EditIcon,
  Trash2Icon,
  PlusIcon,
  ClockIcon,
  AlertTriangleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XIcon
} from '../../lib/icons';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, openStorageFile, formatDateBR as formatDate } from '../../lib/utils';

interface ServicoDetailPanelProps {
  service: ServiceWithDetails;
  onClose: () => void;
  onEdit: (service: ServiceWithDetails) => void;
  onDelete: (service: ServiceWithDetails) => void;
  onAddAdvance?: (service: ServiceWithDetails) => void;
  onViewAdvances?: (service: ServiceWithDetails) => void;
  onPrevService: () => void;
  onNextService: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  currentIndex: number;
  totalCount: number;
}

export const ServicoDetailPanel: React.FC<ServicoDetailPanelProps> = ({
  service,
  onClose,
  onEdit,
  onDelete,
  onAddAdvance,
  onViewAdvances,
  onPrevService,
  onNextService,
  hasPrev,
  hasNext,
  currentIndex,
  totalCount,
}) => {
  const { toast } = useToast();

  // Adiantamentos vinculados ao serviço
  const {
    data: advances = [],
    isLoading: loadingAdvances,
    isError,
  } = useQuery({
    queryKey: ['servico_adiantamentos', service?.id],
    enabled: !!service?.id,
    queryFn: async (): Promise<Advance[]> => {
      const { data, error } = await supabase
        .from('adiantamentos')
        .select('*')
        .eq('service_id', service.id)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return (data || []) as Advance[];
    },
    staleTime: 30000,
  });

  const handleViewFile = async (path: string) => {
    try {
      await openStorageFile(path);
    } catch {
      toast({ 
        title: 'Erro ao abrir anexo', 
        description: 'Não foi possível gerar um link para o documento armazenado.', 
        variant: 'destructive' 
      });
    }
  };

  // Cálculo de prazos e alertas
  const scheduleDetails = useMemo(() => {
    if (!service) return { estimatedDays: null, isOverdue: false, isUrgent: false };
    
    let estimatedDays: number | null = null;
    if (service.start_date && service.end_date) {
      const start = new Date(`${service.start_date}T00:00:00`);
      const end = new Date(`${service.end_date}T00:00:00`);
      const diffTime = end.getTime() - start.getTime();
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      estimatedDays = days >= 0 ? days : null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(`${service.end_date}T00:00:00`);
    const isCompleted = service.status === 'Concluído';
    const isOverdue = !isCompleted && endDate < today;
    const diffTimeToday = endDate.getTime() - today.getTime();
    const diffDaysToday = Math.ceil(diffTimeToday / (1000 * 60 * 60 * 24));
    const isUrgent = !isCompleted && !isOverdue && diffDaysToday <= 7 && diffDaysToday >= 0;

    return { estimatedDays, isOverdue, isUrgent };
  }, [service]);

  const totalContract = Number(service.total_value) || 0;
  const isCompleted = service.status === 'Concluído';
  const totalPaid = isCompleted ? totalContract : (Number(service.total_advances) || 0);
  const remainingValue = isCompleted ? 0 : (Number(service.remaining_value) || 0);
  const progressPercent = isCompleted ? 100 : (totalContract > 0 ? Math.min(100, Math.max(0, Math.round((totalPaid / totalContract) * 100))) : 0);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-brand-dark-900 overflow-hidden select-text">
      
      {/* ========================================================= */}
      {/* 1. TOPBAR DE CONTROLE E NAVEGAÇÃO SEQUENCIAL (COMPACTA)   */}
      {/* ========================================================= */}
      <div className="px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-brand-dark-950/60 shrink-0">
        
        {/* Esquerda: Identificador do Serviço */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <BriefcaseIcon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[150px] sm:max-w-[200px]" title={service.description}>
                {service.description}
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${
                isCompleted
                  ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800/60'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
              }`}>
                {service.status}
              </span>
              {scheduleDetails.isOverdue && (
                <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 px-1 py-0.2 rounded flex items-center gap-0.5">
                  <AlertTriangleIcon className="h-2.5 w-2.5" /> Atrasado
                </span>
              )}
              {scheduleDetails.isUrgent && (
                <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-1 py-0.2 rounded flex items-center gap-0.5">
                  <ClockIcon className="h-2.5 w-2.5" /> Urgente
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate">
              {service.collaborator_name || 'Sem prestador'} • {service.project_name || 'Sem obra'}
            </p>
          </div>
        </div>

        {/* Direita: Controles de Navegação e Ações Rápidas */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Navegação Sequencial: ↑ Anterior e ↓ Próxima */}
          <div className="inline-flex items-center bg-white dark:bg-brand-dark-800 rounded-md p-0.5 border border-slate-200 dark:border-gray-700 shadow-xs">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevService}
              disabled={!hasPrev}
              className="h-5.5 w-5.5 text-slate-600 dark:text-gray-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-brand-dark-700 rounded cursor-pointer"
              title="Contrato Anterior (Seta Cima)"
            >
              <ChevronUpIcon className="h-3 w-3" />
            </Button>
            <span className="text-[10px] font-mono font-medium px-1 text-slate-500 dark:text-gray-400 select-none">
              {currentIndex + 1}/{totalCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNextService}
              disabled={!hasNext}
              className="h-5.5 w-5.5 text-slate-600 dark:text-gray-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-brand-dark-700 rounded cursor-pointer"
              title="Próximo Contrato (Seta Baixo)"
            >
              <ChevronDownIcon className="h-3 w-3" />
            </Button>
          </div>

          <div className="h-3.5 w-px bg-slate-200 dark:bg-gray-800 mx-0.5 hidden sm:block" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(service)}
            className="h-6.5 px-2 text-[10px] font-semibold text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-brand-dark-800 gap-1 cursor-pointer"
            title="Editar Contrato"
          >
            <EditIcon className="h-3 w-3" />
            <span className="hidden sm:inline">Editar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(service)}
            className="h-6.5 px-2 text-[10px] font-semibold text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1 cursor-pointer"
            title="Excluir Contrato"
          >
            <Trash2Icon className="h-3 w-3" />
            <span className="hidden sm:inline">Excluir</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6.5 w-6.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-md cursor-pointer ml-0.5"
            title="Fechar Painel (Esc)"
          >
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        </div>

      </div>

      {/* ========================================================= */}
      {/* 2. CORPO DO PAINEL: ALTA DENSIDADE E SEM ESPAÇOS VAZIOS   */}
      {/* ========================================================= */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar bg-slate-50/40 dark:bg-brand-dark-950/30">
        
        {/* Bloco Consolidado: Balanço Financeiro & Detalhes do Contrato */}
        <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 rounded-xl p-3 shadow-xs space-y-2">
          
          {/* Linha 1: Métricas Financeiras Compactas */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-50 dark:bg-brand-dark-950/60 p-2 rounded-lg border border-slate-100 dark:border-gray-800">
              <span className="text-[9px] text-slate-500 uppercase font-semibold block">Contratado</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-white">
                {formatCurrency(totalContract)}
              </span>
            </div>

            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold block">Total Pago</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalPaid)}
              </span>
            </div>

            <div className="bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30">
              <span className="text-[9px] text-amber-600 dark:text-amber-400 uppercase font-semibold block">Saldo a Pagar</span>
              <span className={`text-xs sm:text-sm font-bold font-mono ${isCompleted ? 'text-slate-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {isCompleted ? 'Quitado' : formatCurrency(remainingValue)}
              </span>
            </div>
          </div>

          {/* Barra de Progresso com % Quitado */}
          <div className="flex items-center gap-2 pt-0.5">
            <div className="flex-1 bg-slate-100 dark:bg-brand-dark-800 rounded-full h-1.5 overflow-hidden">
              <div 
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  progressPercent >= 100 
                    ? 'bg-emerald-500' 
                    : progressPercent >= 50 
                    ? 'bg-indigo-600' 
                    : 'bg-amber-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-gray-300 shrink-0">
              {progressPercent}% quitado
            </span>
          </div>

          {/* Linha 2: Chips de Metadados (Prestador, Obra e Cronograma) */}
          <div className="pt-1.5 border-t border-slate-100 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <UserIcon className="h-3 w-3 text-indigo-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[9px] text-slate-400 block leading-tight">Prestador</span>
                <span className="font-semibold text-slate-800 dark:text-gray-200 truncate block text-[11px]" title={service.collaborator_name || 'Sem colaborador'}>
                  {service.collaborator_name || 'Sem prestador'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              <ConstructionIcon className="h-3 w-3 text-indigo-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[9px] text-slate-400 block leading-tight">Obra / Destino</span>
                <span className="font-semibold text-slate-800 dark:text-gray-200 truncate block text-[11px]" title={service.project_name || 'Sem obra'}>
                  {service.project_name || 'Sem obra'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              <CalendarIcon className="h-3 w-3 text-indigo-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[9px] text-slate-400 block leading-tight">Prazo Previsto</span>
                <span className="text-slate-700 dark:text-gray-300 text-[11px] block truncate">
                  {formatDate(service.start_date)} ~ {formatDate(service.end_date)}
                  {scheduleDetails.estimatedDays !== null && ` (${scheduleDetails.estimatedDays}d)`}
                </span>
              </div>
            </div>
          </div>

          {/* Linha 3: Anexo / Minuta Integrado (se houver) */}
          {service.receipt_path && (
            <div className="pt-1.5 border-t border-slate-100 dark:border-gray-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-gray-400 text-[11px] min-w-0">
                <PaperclipIcon className="h-3 w-3 text-indigo-500 shrink-0" />
                <span className="truncate">Minuta ou documento contratual disponível</span>
              </div>
              <button
                type="button"
                onClick={() => handleViewFile(service.receipt_path!)}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>Visualizar Anexo</span>
                <ExternalLinkIcon className="h-2.5 w-2.5" />
              </button>
            </div>
          )}

        </div>

        {/* Bloco de Observações Contratuais (se houver) */}
        {service.observations && (
          <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 p-2.5 rounded-xl shadow-xs text-xs space-y-0.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Observações & Termos Contratuais
            </span>
            <p className="text-slate-700 dark:text-gray-300 text-[11px] leading-relaxed line-clamp-2" title={service.observations}>
              {service.observations}
            </p>
          </div>
        )}

        {/* Bloco: Tabela de Medições e Adiantamentos Vinculados */}
        <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-gray-800">
            <div className="flex items-center gap-1.5">
              <TrendingUpIcon className="h-3.5 w-3.5 text-emerald-500" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-gray-200">
                Medições & Adiantamentos ({advances.length})
              </h3>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 font-mono">
                {formatCurrency(totalPaid)} pago
              </span>
              {onAddAdvance && !isCompleted && remainingValue > 0.009 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAddAdvance(service)}
                  className="h-6 px-2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1 cursor-pointer"
                >
                  <PlusIcon className="h-3 w-3" /> Nova Medição
                </Button>
              )}
            </div>
          </div>

          {loadingAdvances ? (
            <div className="flex flex-col items-center justify-center py-6 space-y-1.5">
              <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-[11px] text-slate-500 dark:text-gray-400">Carregando medições...</p>
            </div>
          ) : isError ? (
            <div className="p-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-lg text-center">
              <p className="text-xs text-rose-500">Erro ao carregar adiantamentos vinculados.</p>
            </div>
          ) : advances.length === 0 ? (
            <div className="text-center py-4 border border-dashed border-slate-200 dark:border-gray-800 rounded-lg">
              <DollarSignIcon className="w-6 h-6 text-slate-400 mx-auto mb-1 opacity-50" />
              <p className="text-[11px] text-slate-500 font-medium">Nenhum adiantamento liberado ainda.</p>
              {onAddAdvance && !isCompleted && (
                <button
                  type="button"
                  onClick={() => onAddAdvance(service)}
                  className="mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  + Liberar 1ª Medição
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[220px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-white dark:bg-brand-dark-900 z-10">
                  <tr className="border-b border-slate-100 dark:border-gray-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-1.5 px-2">Data</th>
                    <th className="py-1.5 px-2">Medição / Descrição</th>
                    <th className="py-1.5 px-2 text-right">Valor</th>
                    <th className="py-1.5 px-2 text-center w-16">Anexo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800/60 text-[11px]">
                  {advances.map((adv) => (
                    <tr key={adv.id} className="hover:bg-slate-50/50 dark:hover:bg-brand-dark-800/30 transition-colors">
                      <td className="py-1.5 px-2 font-medium text-slate-900 dark:text-white whitespace-nowrap font-mono">
                        {formatDate(adv.payment_date)}
                      </td>
                      <td className="py-1.5 px-2 text-slate-700 dark:text-gray-300 max-w-[150px] truncate" title={adv.description || ''}>
                        {adv.description || <span className="text-slate-400 italic">Medição</span>}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {formatCurrency(adv.value)}
                      </td>
                      <td className="py-1.5 px-2 text-center whitespace-nowrap">
                        {adv.receipt_path ? (
                          <button
                            type="button"
                            onClick={() => handleViewFile(adv.receipt_path!)}
                            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            <PaperclipIcon className="h-2.5 w-2.5" /> Ver
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* ========================================================= */}
      {/* 3. RODAPÉ FIXO: SEMPRE VISÍVEL NO VIEWPORT                */}
      {/* ========================================================= */}
      <div className="px-3 sm:px-4 py-2 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          {onViewAdvances && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onViewAdvances(service)}
              className="h-7.5 px-2 text-xs font-semibold text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40 hover:bg-amber-50 dark:hover:bg-amber-950/30 gap-1 cursor-pointer"
              title="Filtrar aba de adiantamentos por este serviço"
            >
              <DollarSignIcon className="h-3 w-3" />
              <span>Ver no Extrato</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(service)}
            className="h-7.5 px-2.5 text-xs font-semibold text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-brand-dark-800 gap-1 cursor-pointer"
          >
            <EditIcon className="h-3 w-3" />
            <span>Editar</span>
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          {onAddAdvance && !isCompleted && remainingValue > 0.009 && (
            <Button
              type="button"
              size="sm"
              onClick={() => onAddAdvance(service)}
              className="h-7.5 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1 shadow-xs cursor-pointer"
            >
              <PlusIcon className="h-3 w-3" />
              <span>+ Nova Medição</span>
            </Button>
          )}

          <Button 
            variant="ghost" 
            size="sm"
            onClick={onClose} 
            className="h-7.5 px-2.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white cursor-pointer"
          >
            Fechar
          </Button>
        </div>
      </div>

    </div>
  );
};

export default ServicoDetailPanel;
