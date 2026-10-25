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
import { adiantamentoSchema, AdiantamentoFormValues } from '../../lib/validators';
import { useToast } from '../../contexts/ToastContext';
import { ServiceWithDetails } from '../../types';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { TrendingUpIcon, UploadIcon, XIcon, PaperclipIcon, DollarSignIcon, CalendarIcon, CheckCircle2Icon } from '../../lib/icons';
import { useAuth } from '../../hooks/useAuth';
import { computeSha256, formatCurrency } from '../../lib/utils';

interface AdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: ServiceWithDetails | null;
}

const AdvanceModal: React.FC<AdvanceModalProps> = ({ isOpen, onClose, service }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const customResolver = useMemo(() => {
    return async (values: AdiantamentoFormValues) => {
      try {
        const schemaWithRefine = adiantamentoSchema.refine(
          (data) => !service || data.value <= service.remaining_value + 0.009,
          {
            message: 'O valor do adiantamento não pode ser maior que o saldo restante do serviço.',
            path: ['value'],
          }
        );

        const result = await schemaWithRefine.safeParseAsync(values);
        if (result.success) {
          return { values: result.data, errors: {} };
        }

        const errors: any = {};
        for (const issue of result.error.issues) {
          const path = issue.path[0];
          if (path) {
            errors[path] = { type: issue.code, message: issue.message };
          }
        }
        return { values: {}, errors };
      } catch (err) {
        console.error("Resolver Error:", err);
        return { values: {}, errors: { root: { message: "Erro na validação interna." } } };
      }
    };
  }, [service]);

  const { 
    register, 
    handleSubmit, 
    control, 
    reset, 
    watch,
    setValue,
    formState: { errors, isSubmitted, touchedFields } 
  } = useForm<AdiantamentoFormValues>({
    resolver: customResolver,
    mode: 'onBlur',
    defaultValues: {
      value: 0,
      payment_date: new Date().toISOString().split('T')[0],
      description: ''
    }
  });

  const watchedValue = Number(watch('value')) || 0;
  const currentRemaining = Number(service?.remaining_value) || 0;
  const totalContract = Number(service?.total_value) || 0;
  
  const newRemaining = Math.max(0, currentRemaining - watchedValue);
  const willComplete = service && watchedValue > 0 && watchedValue >= currentRemaining - 0.009;

  // Porcentagem acumulada do contrato
  const currentProgressPercent = totalContract > 0 
    ? Math.min(100, Math.round(((totalContract - currentRemaining) / totalContract) * 100))
    : 0;
  const newProgressPercent = totalContract > 0
    ? Math.min(100, Math.round(((totalContract - newRemaining) / totalContract) * 100))
    : 0;

  const createMutation = useMutation({
    mutationFn: async (data: AdiantamentoFormValues) => {
      if (!service || !user || !profile?.company_id) throw new Error("Dados inválidos ou sessão expirada.");
      
      let receipt_path = null;
      if (receiptFile) {
        const fileHash = await computeSha256(receiptFile);
        const filePath = `${profile.company_id}/${user.id}/comprovante_${fileHash}.${receiptFile.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage.from('jpl-conecta').upload(filePath, receiptFile, { upsert: true });
        if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);
        receipt_path = filePath;
      }

      const advanceValue = Number(data.value);
      const isCompleting = advanceValue >= service.remaining_value - 0.009;

      const { receipt_file, ...sendData } = data;
      const { error } = await (supabase as any).from('adiantamentos').insert({
        ...sendData,
        service_id: service.id,
        value: advanceValue,
        company_id: profile.company_id,
        created_by: user.id,
        receipt_path
      });
      if (error) throw error;

      if (isCompleting) {
        const { error: updateError } = await (supabase as any)
          .from('servicos')
          .update({ status: 'Concluído' })
          .eq('id', service.id);
        
        if (updateError) {
          console.warn("Failed to auto-complete service:", updateError);
        }
      }
      
      await logAuditAction(
        profile?.company_id,
        user?.email,
        'CRIAR',
        `Adiantamento: ${data.description || 'Sem descrição'}`,
        { value: advanceValue, service_id: service.id }
      );
    },
    onSuccess: () => {
      toast({ title: "Sucesso!", description: "Adiantamento registrado com sucesso." });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['services_dashboard'] });
      onClose();
    },
    onError: (err) => {
      const errorMessage = formatApiError(err);
      toast({ variant: 'destructive', title: 'Erro ao Salvar!', description: errorMessage });
    }
  });

  useEffect(() => {
    if (!isOpen) {
      reset({
        value: 0,
        payment_date: new Date().toISOString().split('T')[0],
        description: ''
      });
      setReceiptFile(null);
    }
  }, [isOpen, reset]);
  
  const onSubmit = (data: AdiantamentoFormValues) => {
    createMutation.mutate(data);
  };

  const applyPercentage = (pct: number) => {
    if (!service) return;
    const calculated = parseFloat(((service.remaining_value * pct) / 100).toFixed(2));
    setValue('value', calculated, { shouldValidate: true, shouldDirty: true });
  };

  const setDateShortcut = (daysAgo: number) => {
    const targetDate = new Date(Date.now() - (daysAgo * 86400000));
    setValue('payment_date', targetDate.toISOString().split('T')[0], { shouldValidate: true });
  };

  return (
    <ResponsiveModal open={isOpen} onOpenChange={onClose} displayMode="drawer">
      <ResponsiveModalContent size="md" className="max-w-2xl flex flex-col p-0">
        
        {/* Header Consistente */}
        <ResponsiveModalHeader className="px-6 py-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <TrendingUpIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle className="text-base font-bold text-gray-900 dark:text-white">
                Voucher de Adiantamento / Medição
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-md">
                {service ? `Contrato: ${service.description}` : 'Registro de adiantamento financeiro'}
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>
        
        <form id="advance-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/60 dark:bg-brand-dark-950/50 space-y-4 custom-scrollbar">
            
            {service && (
              /* Card de Painel do Contrato */
              <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                    <span className="text-gray-400">Obra:</span>
                    <strong className="font-semibold">{service.project_name || 'Geral'}</strong>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                    <span className="text-gray-400">Prestador:</span>
                    <strong className="font-semibold">{service.collaborator_name || 'Não informado'}</strong>
                  </div>
                </div>

                {/* Grid dos 3 Saldos */}
                <div className="grid grid-cols-3 gap-2.5 pt-2">
                  <div className="bg-gray-50 dark:bg-brand-dark-950 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-center">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Contrato Global</span>
                    <p className="text-xs sm:text-sm font-bold font-mono text-gray-800 dark:text-gray-200 mt-0.5">
                      {formatCurrency(service.total_value)}
                    </p>
                  </div>

                  <div className="bg-emerald-50/60 dark:bg-brand-dark-950 p-2.5 rounded-xl border border-emerald-500/20 text-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">Saldo Atual</span>
                    <p className="text-xs sm:text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {formatCurrency(service.remaining_value)}
                    </p>
                  </div>

                  <div className="bg-gray-50 dark:bg-brand-dark-950 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-center">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Saldo Pós-Medição</span>
                    <p className={`text-xs sm:text-sm font-bold font-mono mt-0.5 ${
                      willComplete 
                        ? 'text-brand-blue-600 dark:text-brand-blue-400 font-black' 
                        : 'text-gray-800 dark:text-gray-200'
                    }`}>
                      {formatCurrency(newRemaining)}
                    </p>
                  </div>
                </div>

                {/* Barra de Progresso do Contrato */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                    <span>Liberação Contratual</span>
                    <span>{newProgressPercent}% Liberado</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-brand-dark-950 h-2 rounded-full overflow-hidden border border-gray-200 dark:border-gray-800">
                    <div 
                      className={`h-full transition-all duration-300 ${willComplete ? 'bg-brand-blue-500' : 'bg-emerald-500'}`}
                      style={{ width: `${newProgressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Card de Preenchimento do Valor */}
            <div className="bg-white dark:bg-brand-dark-900 border-2 border-emerald-500/30 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <DollarSignIcon className="h-4 w-4 text-emerald-500" />
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                    Valor Desta Liberação (R$) <span className="text-red-500">*</span>
                  </Label>
                </div>
                {willComplete && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-blue-500/10 text-brand-blue-600 dark:text-brand-blue-400 border border-brand-blue-500/20">
                    Quitação Total
                  </span>
                )}
              </div>

              {/* Botões Rápidos de Porcentagem */}
              <div className="grid grid-cols-4 gap-1.5">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applyPercentage(pct)}
                    className="py-1.5 px-2 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-brand-dark-950 hover:border-emerald-500 hover:text-emerald-500 text-gray-700 dark:text-gray-300 transition-colors text-center"
                  >
                    {pct === 100 ? '100% (Quitar)' : `${pct}%`}
                  </button>
                ))}
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

            {/* Informações da Liberação (Data e Descrição) */}
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
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Comprovante PIX / Transferência
                  </Label>
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
                      htmlFor="advance-receipt-file"
                      className="flex items-center justify-center gap-2 h-9 border border-dashed border-gray-300 dark:border-gray-800 hover:border-emerald-500 rounded-lg cursor-pointer bg-gray-50/50 dark:bg-brand-dark-950 text-xs text-gray-600 dark:text-gray-400 px-3"
                    >
                      <UploadIcon className="h-3.5 w-3.5" />
                      <span>Anexar comprovante</span>
                      <input 
                        id="advance-receipt-file" 
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
                  placeholder="Ex: Medição da 1ª etapa de fundação concluída. Liberado via PIX..."
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
              disabled={createMutation.isPending} 
              className="text-xs h-9 px-4 font-semibold"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              isLoading={createMutation.isPending} 
              loadingText="Registrando..." 
              className="text-xs h-9 px-6 font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {willComplete ? 'Quitar e Concluir Contrato' : 'Registrar Liberação'}
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

export default AdvanceModal;
