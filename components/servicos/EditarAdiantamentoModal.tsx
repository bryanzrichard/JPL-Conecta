import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ResponsiveModal, 
  ResponsiveModalContent, 
  ResponsiveModalHeader, 
  ResponsiveModalTitle, 
  ResponsiveModalDescription, 
  ResponsiveModalFooter 
} from '../ui/ResponsiveModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Textarea } from '../ui/Textarea';
import { supabase } from '../../lib/supabaseClient';
import { AdvanceWithDetails } from '../../types';
import { adiantamentoSchema, AdiantamentoFormValues, createZodResolver } from '../../lib/validators';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { TrendingUpIcon, UploadIcon, XIcon, PaperclipIcon, DollarSignIcon, CalendarIcon, EditIcon } from '../../lib/icons';
import { useAuth } from '../../hooks/useAuth';
import { computeSha256, openStorageFile, formatCurrency } from '../../lib/utils';

interface EditarAdiantamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  advance: AdvanceWithDetails | null;
}

const customResolver = createZodResolver(adiantamentoSchema);

const EditarAdiantamentoModal: React.FC<EditarAdiantamentoModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  advance 
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPath, setReceiptPath] = useState<string | null>(null);

  const { 
    register, 
    handleSubmit, 
    control, 
    reset, 
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitted, touchedFields } 
  } = useForm<AdiantamentoFormValues>({
    resolver: customResolver,
    mode: 'onBlur',
  });

  useEffect(() => {
    if (advance) {
      reset({
        value: Number(advance.value) || 0,
        payment_date: advance.payment_date ? advance.payment_date.split('T')[0] : '',
        description: advance.description || '',
      });
      setReceiptPath(advance.receipt_path || null);
      setReceiptFile(null);
    }
  }, [advance, reset]);

  const watchedValue = Number(watch('value')) || 0;

  const updateMutation = useMutation({
    mutationFn: async (data: AdiantamentoFormValues) => {
      if (!advance) throw new Error("Adiantamento não encontrado.");

      const newValue = Number(data.value);

      // Validar teto de saldo do serviço vinculado e sincronizar status
      const { data: serviceData, error: serviceFetchError } = await (supabase as any)
        .from('servicos')
        .select('id, total_value, status, adiantamentos(id, value)')
        .eq('id', advance.service_id)
        .single();

      if (serviceFetchError || !serviceData) {
        throw new Error("Não foi possível validar o serviço vinculado a este adiantamento.");
      }

      const otherAdvancesTotal = (serviceData.adiantamentos || [])
        .filter((a: { id: string; value: number }) => a.id !== advance.id)
        .reduce((sum: number, a: { id: string; value: number }) => sum + Number(a.value || 0), 0);

      const maxAllowed = Number((Number(serviceData.total_value) - otherAdvancesTotal).toFixed(2));
      if (newValue > maxAllowed + 0.009) {
        throw new Error(
          `O valor (${formatCurrency(newValue)}) excede o saldo disponível do contrato (${formatCurrency(maxAllowed)}).`
        );
      }

      let current_receipt_path = receiptPath;
      if (receiptFile && user && profile?.company_id) {
        const fileHash = await computeSha256(receiptFile);
        const filePath = `${profile.company_id}/${user.id}/comprovante_${fileHash}.${receiptFile.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage.from('jpl-conecta').upload(filePath, receiptFile, { upsert: true });
        if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);
        current_receipt_path = filePath;
      }

      if (advance.receipt_path && advance.receipt_path !== current_receipt_path) {
        const { error: deleteError } = await supabase.storage.from('jpl-conecta').remove([advance.receipt_path]);
        if (deleteError) console.error("Erro ao remover comprovante antigo:", deleteError);
      }

      const { receipt_file, ...sendData } = data;
      const { error } = await (supabase as any)
        .from('adiantamentos')
        .update({ ...sendData, value: newValue, receipt_path: current_receipt_path })
        .eq('id', advance.id);

      if (error) throw error;

      // Reconciliar integridade de status do serviço vinculado:
      const totalPaidAfter = otherAdvancesTotal + newValue;
      const hasDebt = Number(serviceData.total_value) - totalPaidAfter > 0.009;
      let serviceStatusUpdated: string | null = null;

      if (!hasDebt && serviceData.status !== 'Concluído') {
        // Se quitou o contrato na totalidade, marca como 'Concluído'
        await (supabase as any)
          .from('servicos')
          .update({ status: 'Concluído' })
          .eq('id', serviceData.id);
        serviceStatusUpdated = 'Concluído';
      } else if (hasDebt && serviceData.status === 'Concluído') {
        // Se o adiantamento foi reduzido e passou a ter saldo devedor, reverte para 'Em Andamento'
        await (supabase as any)
          .from('servicos')
          .update({ status: 'Em Andamento' })
          .eq('id', serviceData.id);
        serviceStatusUpdated = 'Em Andamento';
      }

      await logAuditAction(
        profile?.company_id,
        user?.email,
        'EDITAR',
        `Adiantamento: ${data.description || 'Sem descrição'}`,
        { 
          id: advance.id, 
          value: newValue, 
          service_id: advance.service_id,
          serviceStatusUpdated
        }
      );

      return { serviceStatusUpdated };
    },
    onSuccess: (result) => {
      let description = "Adiantamento atualizado.";
      if (result?.serviceStatusUpdated === 'Em Andamento') {
        description = "Adiantamento atualizado. O contrato de serviço reverteu para 'Em Andamento' por saldo pendente.";
      } else if (result?.serviceStatusUpdated === 'Concluído') {
        description = "Adiantamento atualizado. O contrato de serviço foi marcado como 'Concluído' (quitado).";
      }

      toast({ title: "Sucesso!", description });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['adiantamentos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardItems'] });
      onSuccess();
      onClose();
    },
    onError: (err) => {
      const errorMessage = formatApiError(err);
      toast({ variant: 'destructive', title: 'Erro!', description: errorMessage });
    }
  });

  const onSubmit = (data: AdiantamentoFormValues) => {
    updateMutation.mutate(data);
  };

  const handleOpenReceipt = async (path: string) => {
    try {
      await openStorageFile(path);
    } catch {
      toast({ title: 'Erro ao abrir anexo', description: 'Não foi possível gerar link para o documento.', variant: 'destructive' });
    }
  };

  const setDateShortcut = (daysAgo: number) => {
    const targetDate = new Date(Date.now() - (daysAgo * 86400000));
    setValue('payment_date', targetDate.toISOString().split('T')[0], { shouldValidate: true, shouldDirty: true });
  };

  return (
    <ResponsiveModal open={isOpen} onOpenChange={onClose} displayMode="drawer">
      <ResponsiveModalContent size="md" className="max-w-2xl flex flex-col p-0">
        
        {/* Header Consistente */}
        <ResponsiveModalHeader className="px-6 py-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <EditIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle className="text-base font-bold text-gray-900 dark:text-white">
                Editar Adiantamento / Medição
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Atualize o valor liberado, comprovante ou observações da medição.
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>
        
        <form id="editar-advance-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/60 dark:bg-brand-dark-950/50 space-y-4 custom-scrollbar">
            
            {/* Card de Preenchimento do Valor */}
            <div className="bg-white dark:bg-brand-dark-900 border-2 border-emerald-500/30 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <DollarSignIcon className="h-4 w-4 text-emerald-500" />
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                    Valor Desta Liberação (R$) <span className="text-red-500">*</span>
                  </Label>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  Em Edição
                </span>
              </div>

              {/* Input de Moeda com Tipografia Destacada */}
              <div className="bg-gray-50 dark:bg-brand-dark-950 p-3 rounded-xl border border-gray-200 dark:border-gray-800">
                <CurrencyInput 
                  control={control} 
                  name="value" 
                  className="h-10 text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 bg-transparent border-none text-right focus:ring-0 p-0" 
                />
              </div>
              {errors.value && (
                <p className="text-xs text-red-500 font-medium">{errors.value.message}</p>
              )}
            </div>

            {/* Informações da Liberação (Data e Comprovante) */}
            <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Data da Liberação <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setDateShortcut(0)}
                        className="px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-800 font-medium"
                      >
                        Hoje
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setDateShortcut(1)}
                        className="px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-800 font-medium"
                      >
                        Ontem
                      </button>
                    </div>
                  </div>
                  <Input 
                    type="date" 
                    {...register('payment_date')} 
                    className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" 
                  />
                  {errors.payment_date && <p className="text-[11px] text-red-500 mt-1">{errors.payment_date.message}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Comprovante Anexo
                    </Label>
                    {receiptPath && (
                      <button 
                        type="button" 
                        onClick={() => handleOpenReceipt(receiptPath)}
                        className="text-[11px] text-brand-blue-600 dark:text-brand-blue-400 hover:underline flex items-center gap-1"
                      >
                        <PaperclipIcon className="h-3 w-3" /> Ver Atual
                      </button>
                    )}
                  </div>
                  {receiptFile ? (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs h-9">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[160px]">
                        {receiptFile.name}
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setReceiptFile(null)}
                        className="text-red-500 hover:underline text-[10px]"
                      >
                        Remover
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="edit-advance-receipt-file"
                      className="flex items-center justify-center gap-2 h-9 border border-dashed border-gray-300 dark:border-gray-800 hover:border-emerald-500 rounded-lg cursor-pointer bg-gray-50/50 dark:bg-brand-dark-950 text-xs text-gray-600 dark:text-gray-400 px-3"
                    >
                      <UploadIcon className="h-3.5 w-3.5" />
                      <span>{receiptPath ? 'Substituir comprovante' : 'Anexar comprovante'}</span>
                      <input 
                        id="edit-advance-receipt-file" 
                        type="file" 
                        className="hidden" 
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setReceiptFile(e.target.files[0]);
                          }
                        }} 
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Referência / Medição / Descrição
                </Label>
                <Textarea 
                  {...register('description')} 
                  placeholder="Ex: Medição da 1ª etapa concluída..."
                  className="min-h-[70px] text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white resize-none"
                />
              </div>
            </div>

          </div>

          {/* Footer Fixo */}
          <ResponsiveModalFooter className="px-6 py-4 flex-shrink-0 flex items-center justify-end border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900 gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              disabled={updateMutation.isPending} 
              className="text-xs h-9 px-4 font-semibold"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!isDirty && !receiptFile}
              isLoading={updateMutation.isPending} 
              loadingText="Salvando..." 
              className="text-xs h-9 px-6 font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Salvar Alterações
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

const CurrencyInput: React.FC<{ control: any; name: string; className?: string }> = ({ control, name, className }) => (
  <Controller
    name={name}
    control={control}
    render={({ field: { onChange, value, onBlur } }) => {
      const displayValue = useMemo(() => {
        if (value === null || value === undefined || value === '') return '';
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numValue)) return '';
        return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(numValue);
      }, [value]);

      const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const numberValue = e.target.value.replace(/[^0-9]/g, '');
        onChange(numberValue === '' ? 0 : parseFloat(numberValue) / 100);
      };

      return <Input type="text" inputMode="decimal" value={displayValue} onChange={handleValueChange} onBlur={onBlur} className={`text-right ${className}`} placeholder="0,00" />
    }}
  />
);

export default EditarAdiantamentoModal;
