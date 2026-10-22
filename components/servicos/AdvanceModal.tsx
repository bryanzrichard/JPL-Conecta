
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
import { TrendingUpIcon, UploadIcon, XIcon } from '../../lib/icons';
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
            // Apply refine logic here to check against remaining value
            const schemaWithRefine = adiantamentoSchema.refine(
                (data) => !service || data.value <= service.remaining_value,
                {
                    message: 'O valor do adiantamento não pode ser maior que o valor restante do serviço.',
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
          const isCompleting = advanceValue >= service.remaining_value;

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
              `Adiantamento: ${data.description}`,
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
      reset();
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
    <ResponsiveModal isOpen={isOpen} onOpenChange={onClose}>
      <ResponsiveModalContent className="max-w-3xl bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
        <ResponsiveModalHeader className="px-5 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
          <ResponsiveModalTitle className="flex items-center gap-2 text-base text-white">
            <TrendingUpIcon className="h-4 w-4 text-brand-blue-500" />
            Registrar Adiantamento
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400">
            Registre um pagamento antecipado para este serviço.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        
        <div className="flex-grow overflow-y-auto custom-scrollbar p-5 bg-brand-dark-950/50">
          <form id="advance-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {service && (
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 text-center sm:text-left">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Valor restante disponível para adiantamento:</p>
                    <p className="text-lg font-bold text-emerald-500">{formatCurrency(service.remaining_value)}</p>
                </div>
            )}

            <InputGroup label="Valor (R$) *" error={shouldShowError('value') ? errors.value?.message as string : undefined}>
                <CurrencyInput control={control} name="value" className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
            </InputGroup>
            
            <InputGroup label="Data de Pagamento *" error={shouldShowError('payment_date') ? errors.payment_date?.message as string : undefined}>
                <Input type="date" {...register('payment_date')} className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
            </InputGroup>
            
            <InputGroup label="Descrição (Opcional)">
                <Textarea 
                    {...register('description')} 
                    placeholder="Ex: Compra de material inicial" 
                    className="h-20 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500 resize-none"
                />
            </InputGroup>

            <InputGroup label="Comprovante (Opcional)">
               <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-800 border-dashed rounded-md bg-brand-dark-900 relative">
                   <div className="space-y-1 text-center">
                       {receiptFile ? (
                           <div className="flex flex-col items-center gap-2">
                               <div className="flex items-center gap-2 bg-brand-dark-800 px-3 py-1.5 rounded text-sm text-white border border-gray-700">
                                   <span className="truncate max-w-[200px]">{receiptFile.name}</span>
                                   <button 
                                       type="button" 
                                       onClick={() => setReceiptFile(null)}
                                       className="text-gray-400 hover:text-red-400 p-0.5"
                                   >
                                       <XIcon className="h-4 w-4" />
                                   </button>
                               </div>
                           </div>
                       ) : (
                           <>
                               <UploadIcon className="mx-auto h-10 w-10 text-gray-500" />
                               <div className="flex text-sm text-gray-400">
                                   <label
                                       htmlFor="file-upload-advance"
                                       className="relative cursor-pointer bg-brand-dark-900 rounded-md font-medium text-brand-blue-500 hover:text-brand-blue-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-brand-blue-500"
                                   >
                                       <span>Fazer upload de arquivo</span>
                                       <input id="file-upload-advance" name="file-upload-advance" type="file" className="sr-only" onChange={(e) => {
                                           if (e.target.files && e.target.files[0]) {
                                               setReceiptFile(e.target.files[0]);
                                           }
                                       }} />
                                   </label>
                                   <p className="pl-1">ou arraste e solte</p>
                               </div>
                               <p className="text-xs text-gray-500">PDF, PNG, JPG até 10MB</p>
                           </>
                       )}
                   </div>
               </div>
            </InputGroup>

          </form>
        </div>

        <ResponsiveModalFooter className="p-4 border-t border-gray-800 bg-brand-dark-900 flex-shrink-0 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={createMutation.isPending} className="text-sm h-9">
              Cancelar
          </Button>
          <Button type="submit" form="advance-form" isLoading={createMutation.isPending} loadingText="Registrando..." className="text-sm h-9 px-6">
              Registrar
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

const InputGroup: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
    <div>
        <Label className={error ? "text-red-500" : ""}>{label}</Label>
        <div className="mt-1">{children}</div>
        {error && <p className="text-xs text-red-500 mt-1 font-medium animate-in fade-in slide-in-from-top-1">{error}</p>}
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
                        <span className="text-gray-500 sm:text-sm">R$</span>
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
