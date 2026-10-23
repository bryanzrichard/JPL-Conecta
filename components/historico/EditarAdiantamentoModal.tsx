import React, { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
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
import { TrendingUpIcon, UploadIcon, XIcon, PaperclipIcon } from '../../lib/icons';
import { useAuth } from '../../hooks/useAuth';
import { computeSha256, openStorageFile } from '../../lib/utils';
import { useState } from 'react';

interface EditarAdiantamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  advance: AdvanceWithDetails | null;
}

const customResolver = createZodResolver(adiantamentoSchema);

const EditarAdiantamentoModal: React.FC<EditarAdiantamentoModalProps> = ({ isOpen, onClose, onSuccess, advance }) => {
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
              `O valor (R$ ${newValue.toFixed(2)}) excede o saldo disponível do serviço (R$ ${maxAllowed.toFixed(2)}).`
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
          // FIX: Cast update payload to `any` to resolve incorrect type inference to `never`.
          const { error } = await (supabase as any)
            .from('adiantamentos')
            .update({
              ...sendData,
              value: newValue,
              payment_date: data.payment_date,
              description: data.description,
              receipt_path: current_receipt_path
            })
            .eq('id', advance.id);

          if (error) throw error;

          // Sincronizar status do serviço automaticamente conforme o novo saldo restante
          const newRemaining = Number((maxAllowed - newValue).toFixed(2));
          if (newRemaining <= 0.009 && serviceData.status !== 'Concluído' && serviceData.status !== 'Cancelado') {
            await (supabase as any)
              .from('servicos')
              .update({ status: 'Concluído' })
              .eq('id', advance.service_id);
          } else if (newRemaining > 0.009 && serviceData.status === 'Concluído') {
            await (supabase as any)
              .from('servicos')
              .update({ status: 'Em Andamento' })
              .eq('id', advance.service_id);
          }
          
          await logAuditAction(
              profile?.company_id,
              user?.email,
              'EDITAR',
              `Adiantamento: ${data.description}`,
              { id: advance.id, value: newValue, service_id: advance.service_id }
          );
      },
      onSuccess: () => {
          toast({ title: "Sucesso!", description: "Adiantamento atualizado com sucesso." });
          queryClient.invalidateQueries({ queryKey: ['adiantamentos'] });
          queryClient.invalidateQueries({ queryKey: ['servicos'] }); // Advances affect services totals
          onSuccess();
          onClose();
      },
      onError: (err) => {
          const errorMessage = formatApiError(err);
          toast({ variant: "destructive", title: "Erro!", description: errorMessage });
      }
  });

  const onSubmit = (data: AdiantamentoFormValues) => {
    updateMutation.mutate(data);
  };

  const handleViewFile = async (path: string) => {
      try {
          await openStorageFile(path);
      } catch (err) {
          toast({ 
              title: 'Erro ao acessar anexo', 
              description: 'Não foi possível gerar um link para este arquivo.', 
              variant: 'destructive' 
          });
      }
  };

  const shouldShowError = (fieldName: keyof AdiantamentoFormValues) => {
      return isSubmitted || !!(touchedFields as any)[fieldName];
  };

  if (!advance) return null;

  const isReceiptChanged = receiptFile !== null || receiptPath !== (advance.receipt_path || null);
  const isFormDirty = isDirty || isReceiptChanged;

  return (
    <ResponsiveModal isOpen={isOpen} onOpenChange={onClose} displayMode="dialog">
      <ResponsiveModalContent className="max-w-2xl bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
        <ResponsiveModalHeader className="px-6 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20 flex items-center justify-center text-brand-blue-400 shrink-0">
              <TrendingUpIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle className="text-base text-white font-bold">
                Editar Adiantamento
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-xs text-gray-400 mt-0.5">
                Atualize o valor, data ou comprovante deste lançamento.
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>

        <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-gray-50/50 dark:bg-brand-dark-950/50">
          <form id="edit-advance-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="p-3.5 bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold">Serviço Vinculado</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{advance.service_description || 'Serviço'}</p>
                    </div>
                    {advance.collaborator_name && (
                        <div className="text-right">
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold">Colaborador</p>
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-0.5">{advance.collaborator_name}</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputGroup label="Valor (R$) *" error={shouldShowError('value') ? errors.value?.message as string : undefined}>
                        <CurrencyInput control={control} name="value" className="h-9 text-sm bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white focus:border-brand-blue-500 font-mono" />
                    </InputGroup>
                    
                    <InputGroup label="Data de Pagamento *" error={shouldShowError('payment_date') ? errors.payment_date?.message as string : undefined}>
                        <Input type="date" {...register('payment_date')} className="h-9 text-sm bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white focus:border-brand-blue-500" />
                    </InputGroup>
                </div>
                
                <InputGroup label="Descrição">
                    <Textarea 
                        {...register('description')} 
                        className="h-20 text-sm bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white focus:border-brand-blue-500 resize-none"
                    />
                </InputGroup>

                <InputGroup label="Comprovante (Opcional)">
                   <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-800 border-dashed rounded-md bg-white dark:bg-brand-dark-900 relative hover:border-gray-400 dark:hover:border-gray-700 transition-colors">
                       <div className="space-y-1 text-center w-full">
                           {receiptFile ? (
                               <div className="flex flex-col items-center gap-2">
                                   <div className="flex items-center gap-2 bg-brand-dark-800 px-3 py-1.5 rounded text-sm text-white border border-gray-700">
                                       <PaperclipIcon className="h-4 w-4 text-gray-400" />
                                       <span className="truncate max-w-[200px]">{receiptFile.name}</span>
                                       <button 
                                           type="button" 
                                           onClick={() => setReceiptFile(null)}
                                           className="text-gray-400 hover:text-red-400 p-0.5 ml-2 transition-colors"
                                       >
                                           <XIcon className="h-4 w-4" />
                                       </button>
                                   </div>
                               </div>
                           ) : receiptPath ? (
                               <div className="flex flex-col items-center gap-2">
                                   <div className="flex items-center gap-2 bg-brand-dark-800 px-3 py-1.5 rounded text-sm text-white border border-gray-700">
                                        <button 
                                           type="button" 
                                           onClick={() => handleViewFile(receiptPath)}
                                           className="flex items-center gap-2 text-brand-blue-400 hover:text-brand-blue-300 transition-colors"
                                       >
                                           <PaperclipIcon className="h-4 w-4" />
                                           <span className="truncate max-w-[200px]">Ver Anexo Atual</span>
                                       </button>
                                       <button 
                                           type="button" 
                                           onClick={() => setReceiptPath(null)}
                                           className="text-gray-400 hover:text-red-400 p-0.5 ml-2 transition-colors"
                                           title="Remover anexo atual"
                                       >
                                           <XIcon className="h-4 w-4" />
                                       </button>
                                   </div>
                               </div>
                           ) : (
                               <>
                                   <UploadIcon className="mx-auto h-10 w-10 text-gray-500 mb-3" />
                                   <div className="flex justify-center text-sm text-gray-400">
                                       <label
                                           htmlFor="file-upload-advance-edit"
                                           className="relative cursor-pointer bg-brand-dark-900 rounded-md font-medium text-brand-blue-500 hover:text-brand-blue-400 focus-within:outline-none"
                                       >
                                           <span>Fazer upload de arquivo</span>
                                           <input id="file-upload-advance-edit" name="file-upload-advance-edit" type="file" className="sr-only" onChange={(e) => {
                                               if (e.target.files && e.target.files[0]) {
                                                   setReceiptFile(e.target.files[0]);
                                               }
                                           }} />
                                       </label>
                                       <p className="pl-1 hidden sm:block">ou arraste e solte</p>
                                   </div>
                                   <p className="text-xs text-gray-500 mt-2">PDF, PNG, JPG até 10MB</p>
                               </>
                           )}
                       </div>
                   </div>
                </InputGroup>
          </form>
        </div>

        <ResponsiveModalFooter className="p-4 border-t border-gray-800 bg-brand-dark-900 flex-shrink-0 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={updateMutation.isPending} className="text-sm h-9">
                Cancelar
            </Button>
            <Button type="submit" form="edit-advance-form" isLoading={updateMutation.isPending} loadingText="Salvando..." disabled={!isFormDirty} className="text-sm h-9 px-6">
                Salvar Alterações
            </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

const InputGroup: React.FC<{ label: React.ReactNode; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
    <div className="space-y-1.5">
        <Label className={`text-xs font-medium ${error ? "text-red-500" : "text-gray-300"}`}>{label}</Label>
        {children}
        {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
);

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

export default EditarAdiantamentoModal;