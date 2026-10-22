import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
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
import { TrendingUpIcon, UploadIcon, XIcon, PaperclipIcon } from '../../lib/icons';
import { useAuth } from '../../hooks/useAuth';
import { computeSha256 } from '../../lib/utils';

interface AdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: ServiceWithDetails | null;
}

const formatCurrency = (value: number | null | undefined) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const AdvanceModal: React.FC<AdvanceModalProps> = ({ isOpen, onClose, service }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Custom resolver constructed dynamically to include the `refine` logic based on `service`
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

  const watchedValue = watch('value') || 0;
  const newRemaining = service ? Math.max(0, Number(service.remaining_value) - Number(watchedValue)) : 0;
  const willComplete = service && Number(watchedValue) > 0 && Number(watchedValue) >= Number(service.remaining_value) - 0.009;
  
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
          toast({ variant: 'destructive', title: 'Erro!', description: errorMessage });
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

  const shouldShowError = (fieldName: keyof AdiantamentoFormValues) => {
      return isSubmitted || !!(touchedFields as any)[fieldName];
  };

  return (
    <ResponsiveModal isOpen={isOpen} onOpenChange={onClose} displayMode="dialog">
      <ResponsiveModalContent className="max-w-2xl bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
        <ResponsiveModalHeader className="px-6 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <TrendingUpIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle className="text-base text-white font-bold">
                Lançar Adiantamento
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-xs text-gray-400 mt-0.5">
                {service ? `Contrato: ${service.description}` : 'Registro de adiantamento financeiro'}
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>
        
        <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-brand-dark-950/50 space-y-5">
          {service && (
            <div className="bg-brand-dark-900 border border-gray-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="truncate">Obra: <strong className="text-gray-200">{service.project_name || 'Geral'}</strong></span>
                    <span className="truncate">Prestador: <strong className="text-gray-200">{service.collaborator_name || 'Não informado'}</strong></span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-800/80 text-center">
                    <div className="bg-brand-dark-950/80 p-2 rounded-lg border border-gray-800">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">Valor Contrato</span>
                        <p className="text-xs font-bold text-gray-300 mt-0.5">{formatCurrency(service.total_value)}</p>
                    </div>
                    <div className="bg-brand-dark-950/80 p-2 rounded-lg border border-gray-800">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">Saldo Disponível</span>
                        <p className="text-xs font-bold text-emerald-400 mt-0.5">{formatCurrency(service.remaining_value)}</p>
                    </div>
                    <div className="bg-brand-dark-950/80 p-2 rounded-lg border border-gray-800">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">Saldo Posterior</span>
                        <p className={`text-xs font-bold mt-0.5 ${willComplete ? 'text-blue-400' : 'text-gray-300'}`}>
                            {formatCurrency(newRemaining)}
                        </p>
                    </div>
                </div>
                {willComplete && (
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-1.5 animate-in fade-in">
                        <span>✓ Este adiantamento liquidará o saldo total e marcará o serviço como <b>Concluído</b>.</span>
                    </div>
                )}
            </div>
          )}

          <form id="advance-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputGroup label="Valor do Adiantamento (R$) *" error={shouldShowError('value') ? errors.value?.message as string : undefined}>
                  <CurrencyInput control={control} name="value" className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500 font-mono" />
              </InputGroup>
              
              <InputGroup label="Data do Pagamento *" error={shouldShowError('payment_date') ? errors.payment_date?.message as string : undefined}>
                  <Input type="date" {...register('payment_date')} className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
              </InputGroup>
            </div>
            
            <InputGroup label="Descrição ou Justificativa">
                <Textarea 
                    {...register('description')} 
                    placeholder="Ex: Compra de materiais para início da etapa..." 
                    className="h-20 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500 resize-none"
                />
            </InputGroup>

            <InputGroup label="Comprovante de Transferência / Recibo (Opcional)">
               <div className="mt-1 flex justify-center px-6 pt-5 pb-5 border-2 border-gray-800 border-dashed rounded-xl bg-brand-dark-900/60 hover:border-gray-700 transition-colors relative">
                   <div className="space-y-1 text-center">
                       {receiptFile ? (
                           <div className="flex flex-col items-center gap-2">
                               <div className="flex items-center gap-2 bg-brand-dark-800 px-3.5 py-2 rounded-lg text-sm text-white border border-gray-700">
                                   <PaperclipIcon className="h-4 w-4 text-brand-blue-400" />
                                   <span className="truncate max-w-[220px] font-medium text-xs">{receiptFile.name}</span>
                                   <button 
                                       type="button" 
                                       onClick={() => setReceiptFile(null)}
                                       className="text-gray-400 hover:text-red-400 p-0.5 ml-1 transition-colors"
                                       title="Remover arquivo"
                                   >
                                       <XIcon className="h-4 w-4" />
                                   </button>
                               </div>
                           </div>
                       ) : (
                           <>
                               <UploadIcon className="mx-auto h-8 w-8 text-gray-500" />
                               <div className="flex text-xs text-gray-400 justify-center">
                                   <label
                                       htmlFor="file-upload-advance"
                                       className="relative cursor-pointer bg-transparent rounded font-medium text-brand-blue-400 hover:text-brand-blue-300 focus-within:outline-none"
                                   >
                                       <span>Clique para enviar comprovante</span>
                                       <input 
                                          id="file-upload-advance" 
                                          name="file-upload-advance" 
                                          type="file" 
                                          accept="image/*,application/pdf"
                                          className="sr-only" 
                                          onChange={(e) => {
                                             if (e.target.files && e.target.files[0]) {
                                                 setReceiptFile(e.target.files[0]);
                                             }
                                          }} 
                                       />
                                   </label>
                               </div>
                               <p className="text-[10px] text-gray-500">PDF, PNG ou JPG (Comprovante PIX ou Recibo assinado)</p>
                           </>
                       )}
                   </div>
               </div>
            </InputGroup>
          </form>
        </div>

        <ResponsiveModalFooter className="px-6 py-4 border-t border-gray-800 bg-brand-dark-900 flex justify-end gap-3">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose} 
            disabled={createMutation.isPending} 
            className="text-xs h-9 px-4 border-gray-700 hover:bg-gray-800 text-gray-300"
          >
              Cancelar
          </Button>
          <Button 
            type="submit" 
            form="advance-form" 
            isLoading={createMutation.isPending} 
            loadingText="Registrando..." 
            className="text-xs h-9 px-6 bg-brand-blue-600 hover:bg-brand-blue-500 text-white font-medium"
          >
              Registrar Adiantamento
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

const InputGroup: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
    <div>
        <Label className={`text-xs font-medium ${error ? "text-red-400" : "text-gray-300"}`}>{label}</Label>
        <div className="mt-1.5">{children}</div>
        {error && <p className="text-xs text-red-400 mt-1 font-medium animate-in fade-in">{error}</p>}
    </div>
);

const CurrencyInput: React.FC<{ control: any; name: string; className?: string }> = ({ control, name, className }) => (
    <Controller
        name={name}
        control={control}
        render={({ field: { onChange, value, onBlur } }) => {
            const displayValue = useMemo(() => {
                if (value === null || value === undefined || value === '') return '';
                const numValue = Number(String(value).replace(/[^0-9,.-]/g, '').replace(',', '.')) || 0;
                return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(numValue);
            }, [value]);

            const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                const numberValue = e.target.value.replace(/[^0-9]/g, '');
                onChange(numberValue === '' ? 0 : parseFloat(numberValue) / 100);
            };

            return (
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 text-xs">R$</span>
                    </div>
                    <Input 
                        type="text" 
                        inputMode="decimal" 
                        value={displayValue} 
                        onChange={handleValueChange} 
                        onBlur={onBlur}
                        className={`text-right pl-8 ${className}`} 
                        placeholder="0,00" 
                    />
                </div>
            )
        }}
    />
);

export default AdvanceModal;
