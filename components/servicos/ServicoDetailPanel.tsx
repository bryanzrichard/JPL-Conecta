import React, { useState, useMemo } from 'react';
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
  XIcon,
  CheckCircle2Icon
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
  const [activeTab, setActiveTab] = useState<'resumo' | 'anexo'>('resumo');

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
      {/* 1. TOPBAR DE CONTROLE E NAVEGAÇÃO SEQUENCIAL              */}
      {/* ========================================================= */}
      <div className="p-3.5 sm:px-4 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-brand-dark-950/60 shrink-0">
        
        {/* Esquerda: Identificador do Serviço */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <BriefcaseIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[160px] sm:max-w-[220px]" title={service.description}>
                {service.description}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${
                isCompleted
                  ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800/60'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
              }`}>
                {service.status}
              </span>
              {scheduleDetails.isOverdue && (
                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                  <AlertTriangleIcon className="h-2.5 w-2.5" /> Atrasado
                </span>
              )}
              {scheduleDetails.isUrgent && (
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                  <ClockIcon className="h-2.5 w-2.5" /> Urgente
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate">
              {service.collaborator_name || 'Sem colaborador'} • {service.project_name || 'Sem obra'}
            </p>
          </div>
        </div>

        {/* Centro / Direita: Controles de Navegação e Ações */}
        <div className="flex items-center gap-1.5 shrink-0">
          
          {/* Navegação Sequencial: ↑ Anterior e ↓ Próxima */}
          <div className="inline-flex items-center bg-white dark:bg-brand-dark-800 rounded-lg p-0.5 border border-slate-200 dark:border-gray-700 shadow-xs">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevService}
              disabled={!hasPrev}
              className="h-6 w-6 text-slate-600 dark:text-gray-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-brand-dark-700 rounded cursor-pointer"
              title="Contrato Anterior (Seta Cima)"
            >
              <ChevronUpIcon className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] font-mono font-medium px-1.5 text-slate-500 dark:text-gray-400 select-none">
              {currentIndex + 1}/{totalCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNextService}
              disabled={!hasNext}
              className="h-6 w-6 text-slate-600 dark:text-gray-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-brand-dark-700 rounded cursor-pointer"
              title="Próximo Contrato (Seta Baixo)"
            >
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-gray-800 mx-0.5 hidden sm:block" />

          {/* Botões de Ação Rápida: Editar, Excluir e Fechar */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(service)}
            className="h-7 px-2 text-[11px] font-semibold text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-brand-dark-800 gap-1 cursor-pointer"
            title="Editar Contrato de Serviço"
          >
            <EditIcon className="h-3 w-3" />
            <span className="hidden sm:inline">Editar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(service)}
            className="h-7 px-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1 cursor-pointer"
            title="Excluir Contrato"
          >
            <Trash2Icon className="h-3 w-3" />
            <span className="hidden sm:inline">Excluir</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer ml-1"
            title="Fechar Painel (Esc)"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

      </div>

      {/* ========================================================= */}
      {/* 2. SUB-BARRA DE ABAS (RESUMO vs MINUTA)                    */}
      {/* ========================================================= */}
      {service.receipt_path && (
        <div className="flex items-center gap-1 px-4 pt-2 pb-2 border-b border-slate-100 dark:border-gray-800 bg-white dark:bg-brand-dark-900 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('resumo')}
            className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
              activeTab === 'resumo'
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-gray-200'
            }`}
          >
            Resumo & Medições ({advances.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('anexo')}
            className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'anexo'
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-gray-200'
            }`}
          >
            <PaperclipIcon className="h-3.5 w-3.5" />
            Minuta / Anexo
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. CORPO COM SCROLL INDEPENDENTE                          */}
      {/* ========================================================= */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/40 dark:bg-brand-dark-950/30">
        
        {activeTab === 'resumo' ? (
          <>
            {/* Bloco 1: Balanço Financeiro do Contrato (Burn-down) */}
            <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSignIcon className="h-4 w-4 text-emerald-500" /> Balanço Financeiro
                </span>
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {progressPercent}% Quitado
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="bg-slate-50 dark:bg-brand-dark-950/60 p-2.5 rounded-lg border border-slate-100 dark:border-gray-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Valor Contratado</span>
                  <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                    {formatCurrency(totalContract)}
                  </span>
                </div>

                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold block">Total Já Pago</span>
                  <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(totalPaid)}
                  </span>
                </div>

                <div className="bg-amber-50/50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/30">
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold block">Saldo a Pagar</span>
                  <span className={`text-base font-bold font-mono ${isCompleted ? 'text-slate-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {isCompleted ? 'Quitado (R$ 0,00)' : formatCurrency(remainingValue)}
                  </span>
                </div>
              </div>

              {/* Barra de Progresso */}
              <div className="space-y-1 pt-1">
                <div className="w-full bg-slate-100 dark:bg-brand-dark-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${
                      progressPercent >= 100 
                        ? 'bg-emerald-500' 
                        : progressPercent >= 50 
                        ? 'bg-indigo-600' 
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Bloco 2: Envolvidos e Cronograma */}
            <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 rounded-xl p-4 shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Prestador */}
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <UserIcon className="h-3 w-3 text-indigo-500" /> Prestador / Empreiteiro
                  </span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {service.collaborator_name || 'Sem colaborador'}
                  </p>
                  <p className="text-[10px] text-slate-500">Profissional Responsável</p>
                </div>

                {/* Obra */}
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <ConstructionIcon className="h-3 w-3 text-indigo-500" /> Obra / Canteiro
                  </span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {service.project_name || 'Obra não informada'}
                  </p>
                  <p className="text-[10px] text-slate-500">Centro de Custo</p>
                </div>

                {/* Cronograma */}
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3 text-indigo-500" /> Cronograma
                  </span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {formatDate(service.start_date)} até {formatDate(service.end_date)}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {scheduleDetails.estimatedDays !== null ? `${scheduleDetails.estimatedDays} dias de duração` : 'Período flexível'}
                  </p>
                </div>
              </div>
            </div>

            {/* Bloco 3: Observações Contratuais (se houver) */}
            {service.observations && (
              <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 p-3.5 rounded-xl shadow-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Termos & Observações Contratuais
                </span>
                <p className="text-xs text-slate-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {service.observations}
                </p>
              </div>
            )}

            {/* Bloco 4: Acesso Rápido ao Anexo (se existir e não tiver trocado de aba) */}
            {service.receipt_path && (
              <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/40 p-3 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <PaperclipIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      Minuta Contratual / Comprovante Digitalizado
                    </p>
                    <p className="text-[10px] text-slate-500">Arquivo anexado ao contrato no JPL Conecta</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleViewFile(service.receipt_path!)}
                  className="h-7 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 gap-1 shrink-0 cursor-pointer"
                >
                  <ExternalLinkIcon className="h-3 w-3" />
                  <span>Visualizar</span>
                </Button>
              </div>
            )}

            {/* Bloco 5: Tabela de Medições e Adiantamentos Vinculados */}
            <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <TrendingUpIcon className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-gray-200">
                    Medições & Adiantamentos ({advances.length})
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {onAddAdvance && !isCompleted && remainingValue > 0.009 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAddAdvance(service)}
                      className="h-7 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1 cursor-pointer"
                    >
                      <PlusIcon className="h-3.5 w-3.5" /> Nova Medição
                    </Button>
                  )}
                </div>
              </div>

              {loadingAdvances ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-2">
                  <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                  <p className="text-xs text-slate-500 dark:text-gray-400">Carregando medições vinculadas...</p>
                </div>
              ) : isError ? (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg text-center">
                  <p className="text-xs text-red-500">Erro ao carregar adiantamentos vinculados.</p>
                </div>
              ) : advances.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 dark:border-gray-800 rounded-xl">
                  <DollarSignIcon className="w-7 h-7 text-slate-400 mx-auto mb-1.5 opacity-50" />
                  <p className="text-xs text-slate-500 font-medium">Nenhum adiantamento ou medição foi liberada ainda.</p>
                  {onAddAdvance && !isCompleted && (
                    <button
                      type="button"
                      onClick={() => onAddAdvance(service)}
                      className="mt-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      + Liberar 1º Adiantamento
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-gray-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-2 px-2.5">Data</th>
                        <th className="py-2 px-2.5">Medição / Descrição</th>
                        <th className="py-2 px-2.5 text-right">Valor Liberado</th>
                        <th className="py-2 px-2.5 text-center w-20">Anexo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800/60">
                      {advances.map((adv) => (
                        <tr key={adv.id} className="hover:bg-slate-50/50 dark:hover:bg-brand-dark-800/30 transition-colors">
                          <td className="py-2.5 px-2.5 font-medium text-slate-900 dark:text-white whitespace-nowrap font-mono text-[11px]">
                            {formatDate(adv.payment_date)}
                          </td>
                          <td className="py-2.5 px-2.5 text-slate-700 dark:text-gray-300 max-w-[180px] truncate" title={adv.description || ''}>
                            {adv.description || <span className="text-slate-400 italic">Sem descrição</span>}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {formatCurrency(adv.value)}
                          </td>
                          <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                            {adv.receipt_path ? (
                              <button
                                type="button"
                                onClick={() => handleViewFile(adv.receipt_path!)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                              >
                                <PaperclipIcon className="h-3 w-3" /> Ver
                              </button>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Aba Minuta Contratual / Anexo Completo */
          <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 rounded-xl p-6 shadow-xs flex flex-col items-center justify-center min-h-[300px] text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <PaperclipIcon className="h-6 w-6" />
            </div>
            <div className="max-w-sm">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Minuta Contratual ou Comprovante Digitalizado
              </h4>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                Este contrato de serviço possui um documento anexo armazenado com segurança no storage do JPL Conecta.
              </p>
            </div>
            <Button
              onClick={() => handleViewFile(service.receipt_path!)}
              className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-8 px-4 cursor-pointer"
            >
              <ExternalLinkIcon className="h-3.5 w-3.5" /> Visualizar Documento Completo
            </Button>
          </div>
        )}

      </div>

      {/* ========================================================= */}
      {/* 4. RODAPÉ FIXO COM AÇÕES RÁPIDAS                          */}
      {/* ========================================================= */}
      <div className="p-3 sm:px-4 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900 flex items-center justify-between gap-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          {onViewAdvances && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onViewAdvances(service)}
              className="h-8 px-2.5 text-xs font-semibold text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40 hover:bg-amber-50 dark:hover:bg-amber-950/30 gap-1.5 cursor-pointer"
              title="Filtrar aba de adiantamentos por este serviço"
            >
              <DollarSignIcon className="h-3.5 w-3.5" />
              <span>Ver no Extrato</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(service)}
            className="h-8 px-2.5 text-xs font-semibold text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-brand-dark-800 gap-1.5 cursor-pointer"
          >
            <EditIcon className="h-3.5 w-3.5" />
            <span>Editar</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {onAddAdvance && !isCompleted && remainingValue > 0.009 && (
            <Button
              type="button"
              size="sm"
              onClick={() => onAddAdvance(service)}
              className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-xs cursor-pointer"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>+ Nova Medição</span>
            </Button>
          )}

          <Button 
            variant="ghost" 
            size="sm"
            onClick={onClose} 
            className="h-8 px-3 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white cursor-pointer"
          >
            Fechar
          </Button>
        </div>
      </div>

    </div>
  );
};

export default ServicoDetailPanel;
