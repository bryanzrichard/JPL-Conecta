import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ServiceWithDetails, Advance } from '../../types';
import { 
  ResponsiveModal, 
  ResponsiveModalContent, 
  ResponsiveModalHeader, 
  ResponsiveModalTitle, 
  ResponsiveModalDescription, 
  ResponsiveModalFooter 
} from '../ui/ResponsiveModal';
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
  CheckCircle2Icon,
  EditIcon,
  Trash2Icon,
  PlusIcon,
  ClockIcon,
  AlertTriangleIcon
} from '../../lib/icons';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, openStorageFile, formatDateBR as formatDate } from '../../lib/utils';

interface DetalhesServicoModalProps {
  service: ServiceWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (service: ServiceWithDetails) => void;
  onDelete?: (service: ServiceWithDetails) => void;
  onAddAdvance?: (service: ServiceWithDetails) => void;
}

const DetalhesServicoModal: React.FC<DetalhesServicoModalProps> = ({ 
  service, 
  isOpen, 
  onClose, 
  onEdit, 
  onDelete,
  onAddAdvance 
}) => {
  const { toast } = useToast();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loadingAdvances, setLoadingAdvances] = useState(false);
  const [errorAdvances, setErrorAdvances] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'resumo' | 'anexo'>('resumo');

  // Buscar adiantamentos vinculados a este serviço
  const fetchAdvances = useCallback(async () => {
    if (!service?.id) return;
    setLoadingAdvances(true);
    setErrorAdvances(null);
    try {
      const { data, error } = await supabase
        .from('adiantamentos')
        .select('*')
        .eq('service_id', service.id)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setAdvances(data || []);
    } catch (err) {
      console.error("Erro ao carregar medições do serviço:", err);
      setErrorAdvances("Não foi possível carregar as medições deste serviço.");
    } finally {
      setLoadingAdvances(false);
    }
  }, [service?.id]);

  useEffect(() => {
    if (isOpen && service) {
      setActiveTab('resumo');
      fetchAdvances();
    }
  }, [isOpen, service, fetchAdvances]);

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
      const start = new Date(service.start_date);
      const end = new Date(service.end_date);
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

  if (!service) return null;

  const totalContract = Number(service.total_value) || 0;
  const totalPaid = Number(service.total_advances) || 0;
  const remainingValue = Number(service.remaining_value) || 0;
  const progressPercent = totalContract > 0 ? Math.min(100, Math.max(0, Math.round((totalPaid / totalContract) * 100))) : 0;
  const isCompleted = service.status === 'Concluído';

  return (
    <ResponsiveModal open={isOpen} onOpenChange={onClose} displayMode="drawer">
      <ResponsiveModalContent size="xl" className="max-w-4xl flex flex-col p-0">
        
        {/* Header do Dossier do Serviço */}
        <ResponsiveModalHeader className="px-6 py-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20 flex items-center justify-center text-brand-blue-600 dark:text-brand-blue-400 shrink-0">
                <BriefcaseIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <ResponsiveModalTitle className="text-base font-bold text-gray-900 dark:text-white truncate">
                    {service.description}
                  </ResponsiveModalTitle>
                  <Badge className={isCompleted 
                    ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' 
                    : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'}
                  >
                    {service.status}
                  </Badge>
                  {scheduleDetails.isOverdue && (
                    <span className="text-[10px] font-bold text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangleIcon className="h-3 w-3" /> ATRASADO
                    </span>
                  )}
                  {scheduleDetails.isUrgent && (
                    <span className="text-[10px] font-bold text-amber-500 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" /> URGENTE
                    </span>
                  )}
                </div>
                <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Início: {formatDate(service.start_date)} • Conclusão Prevista: {formatDate(service.end_date)}
                  {scheduleDetails.estimatedDays !== null && ` (${scheduleDetails.estimatedDays} dias)`}
                </ResponsiveModalDescription>
              </div>
            </div>

            {service.receipt_path && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewFile(service.receipt_path!)}
                className="h-8 text-xs font-semibold gap-1.5 border-brand-blue-500/30 text-brand-blue-600 dark:text-brand-blue-400 hover:bg-brand-blue-500/10 shrink-0"
              >
                <PaperclipIcon className="h-3.5 w-3.5" />
                <span>Minuta / Anexo</span>
                <ExternalLinkIcon className="h-3 w-3 ml-0.5" />
              </Button>
            )}
          </div>

          {/* Abas Superiores do Modal */}
          <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('resumo')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'resumo'
                  ? 'bg-brand-blue-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-800'
              }`}
            >
              Resumo & Medições ({advances.length})
            </button>
            {service.receipt_path && (
              <button
                type="button"
                onClick={() => setActiveTab('anexo')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === 'anexo'
                    ? 'bg-brand-blue-500 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-800'
                }`}
              >
                <PaperclipIcon className="h-3.5 w-3.5" /> Minuta Contratual
              </button>
            )}
          </div>
        </ResponsiveModalHeader>

        {/* Corpo do Inspector Drawer */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/60 dark:bg-brand-dark-950/50 space-y-5 custom-scrollbar">
          
          {activeTab === 'resumo' ? (
            <>
              {/* Grid de 4 Cards de Destaque */}
              <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  
                  {/* Card 1: Prestador */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <UserIcon className="h-3 w-3 text-brand-blue-500" /> Prestador / Empreiteiro
                    </span>
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {service.collaborator_name || 'Sem colaborador informado'}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Profissional Responsável
                    </p>
                  </div>

                  {/* Card 2: Obra */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <ConstructionIcon className="h-3 w-3 text-brand-blue-500" /> Obra / Canteiro
                    </span>
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {service.project_name || 'Obra não informada'}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Centro de Custo
                    </p>
                  </div>

                  {/* Card 3: Cronograma */}
                  <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3 text-brand-blue-500" /> Cronograma de Execução
                    </span>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {formatDate(service.start_date)} até {formatDate(service.end_date)}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {scheduleDetails.estimatedDays !== null ? `${scheduleDetails.estimatedDays} dias de duração` : 'Período flexível'}
                    </p>
                  </div>

                </div>

                {/* Quadro Financeiro do Contrato (Banner com Progresso) */}
                <div className="bg-gray-50 dark:bg-brand-dark-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSignIcon className="h-4 w-4 text-emerald-500" /> Balanço Financeiro do Contrato
                    </span>
                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      {progressPercent}% Quitado
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-semibold block">Valor Contratado</span>
                      <span className="text-lg font-bold font-mono text-gray-900 dark:text-white">
                        {formatCurrency(totalContract)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold block">Total Já Pago</span>
                      <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(totalPaid)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold block">Saldo a Pagar</span>
                      <span className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                        {formatCurrency(remainingValue)}
                      </span>
                    </div>
                  </div>

                  {/* Barra de Progresso de Quitação */}
                  <div className="space-y-1 pt-1">
                    <div className="w-full bg-gray-200 dark:bg-brand-dark-900 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          progressPercent >= 100 
                            ? 'bg-emerald-500' 
                            : progressPercent >= 50 
                            ? 'bg-brand-blue-500' 
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Bloco de Observações Adicionais */}
              {service.observations && (
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 p-4 rounded-xl shadow-sm space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Termos & Observações Contratuais
                  </span>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {service.observations}
                  </p>
                </div>
              )}

              {/* Tabela Integrada de Medições / Adiantamentos */}
              <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <TrendingUpIcon className="h-4 w-4 text-emerald-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                      Medições & Adiantamentos Vinculados
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {advances.length} {advances.length === 1 ? 'liberação' : 'liberações'}
                    </span>
                    {onAddAdvance && remainingValue > 0.009 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { onClose(); onAddAdvance(service); }}
                        className="h-7 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1"
                      >
                        <PlusIcon className="h-3.5 w-3.5" /> Nova Medição
                      </Button>
                    )}
                  </div>
                </div>

                {loadingAdvances ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-2">
                    <div className="w-7 h-7 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">Carregando medições do contrato...</p>
                  </div>
                ) : errorAdvances ? (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                    <p className="text-xs text-red-500">{errorAdvances}</p>
                  </div>
                ) : advances.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                    <DollarSignIcon className="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-gray-500 font-medium">Nenhum adiantamento ou medição foi liberada ainda.</p>
                    {onAddAdvance && (
                      <button
                        type="button"
                        onClick={() => { onClose(); onAddAdvance(service); }}
                        className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        + Liberar 1º Adiantamento
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          <th className="py-2.5 px-3">Data</th>
                          <th className="py-2.5 px-3">Medição / Descrição</th>
                          <th className="py-2.5 px-3 text-right">Valor Liberado</th>
                          <th className="py-2.5 px-3 text-center w-24">Comprovante</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs">
                        {advances.map((adv) => (
                          <tr key={adv.id} className="hover:bg-gray-50/50 dark:hover:bg-brand-dark-800/30 transition-colors">
                            <td className="py-3 px-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                              {formatDate(adv.payment_date)}
                            </td>
                            <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                              {adv.description || <span className="text-gray-400 italic">Medição sem descrição</span>}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              {formatCurrency(adv.value)}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {adv.receipt_path ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewFile(adv.receipt_path!)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-blue-600 dark:text-brand-blue-400 hover:underline"
                                >
                                  <PaperclipIcon className="h-3 w-3" /> Anexo
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
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
            /* Tab Minuta Contratual / Anexo */
            <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center min-h-[350px] text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-blue-500/10 border border-brand-blue-500/20 flex items-center justify-center text-brand-blue-600 dark:text-brand-blue-400">
                <PaperclipIcon className="h-7 w-7" />
              </div>
              <div className="max-w-md">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Minuta Contratual ou Comprovante Digitalizado
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Este contrato de serviço possui um documento anexo armazenado com segurança no storage do JPL Conecta.
                </p>
              </div>
              <Button
                onClick={() => handleViewFile(service.receipt_path!)}
                className="gap-2 bg-brand-blue-600 hover:bg-brand-blue-500 text-white font-semibold text-xs h-9 px-5"
              >
                <ExternalLinkIcon className="h-4 w-4" /> Visualizar Documento Completo
              </Button>
            </div>
          )}

        </div>

        {/* Rodapé Fixo com Ações Completas */}
        <ResponsiveModalFooter className="px-6 py-4 flex-shrink-0 flex items-center justify-between border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900 gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2">
            {onDelete && service && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { onClose(); onDelete(service); }}
                className="text-xs font-semibold h-9 px-3 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1.5"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
                Excluir
              </Button>
            )}
            {onEdit && service && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { onClose(); onEdit(service); }}
                className="text-xs font-semibold h-9 px-3 text-brand-blue-600 dark:text-brand-blue-400 border-brand-blue-200 dark:border-brand-blue-900/40 hover:bg-brand-blue-50 dark:hover:bg-brand-blue-950/30 gap-1.5"
              >
                <EditIcon className="h-3.5 w-3.5" />
                Editar Contrato
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onAddAdvance && service && remainingValue > 0.009 && (
              <Button
                type="button"
                size="sm"
                onClick={() => { onClose(); onAddAdvance(service); }}
                className="text-xs font-bold h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-sm"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Novo Adiantamento
              </Button>
            )}
            <Button 
              variant="ghost" 
              onClick={onClose} 
              className="text-xs font-semibold h-9 px-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Fechar
            </Button>
          </div>
        </ResponsiveModalFooter>

      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

export default DetalhesServicoModal;
