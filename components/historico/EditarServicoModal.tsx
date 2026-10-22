import React, { useEffect, useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Textarea } from '../ui/Textarea';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/Popover';
import { Command, CommandInput, CommandEmpty, CommandItem, CommandList } from '../ui/Command';
import { ChevronsUpDownIcon, BriefcaseIcon, UploadIcon, XIcon, PaperclipIcon } from '../../lib/icons';
import { supabase } from '../../lib/supabaseClient';
import { ServiceWithDetails, Collaborator, Project, SERVICE_STATUSES } from '../../types';
import { servicoSchema, ServicoFormValues, createZodResolver } from '../../lib/validators';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { useAuth } from '../../hooks/useAuth';
import { computeSha256, openStorageFile } from '../../lib/utils';

interface EditarServicoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  service: ServiceWithDetails | null;
  collaborators: Collaborator[];
  projects: Project[];
}

const customResolver = createZodResolver(servicoSchema);

const EditarServicoModal: React.FC<EditarServicoModalProps> = ({ isOpen, onClose, onSuccess, service, collaborators, projects }) => {
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
  } = useForm<ServicoFormValues>({
    resolver: customResolver,
    mode: 'onBlur',
  });

  useEffect(() => {
    if (service) {
      reset({
        description: service.description,
        collaborator_id: service.collaborator_id,
        project_id: service.project_id,
        status: service.status,
        start_date: service.start_date ? service.start_date.split('T')[0] : '',
        end_date: service.end_date ? service.end_date.split('T')[0] : '',
        total_value: Number(service.total_value) || 0,
        observations: service.observations || '',
      });
      setReceiptPath(service.receipt_path || null);
      setReceiptFile(null);
    }
  }, [service, reset]);

  const updateMutation = useMutation({
      mutationFn: async (data: ServicoFormValues) => {
          if (!service) throw new Error("Serviço não encontrado.");
          
          let current_receipt_path = receiptPath;
          if (receiptFile && user && profile?.company_id) {
              const fileHash = await computeSha256(receiptFile);
              const filePath = `${profile.company_id}/${user.id}/comprovante_servico_${fileHash}.${receiptFile.name.split('.').pop()}`;
              const { error: uploadError } = await supabase.storage.from('jpl-conecta').upload(filePath, receiptFile, { upsert: true });
              if (uploadError) throw new Error(`Erro no upload do comprovante: ${uploadError.message}`);
              current_receipt_path = filePath;
          }

          if (service.receipt_path && service.receipt_path !== current_receipt_path) {
              const { error: deleteError } = await supabase.storage.from('jpl-conecta').remove([service.receipt_path]);
              if (deleteError) console.error("Erro ao remover comprovante antigo:", deleteError);
          }

          const { receipt_file, ...sendData } = data;
          // FIX: Cast update payload to `any` to resolve incorrect type inference to `never`.
          const { error } = await (supabase as any)
            .from('servicos')
            .update({ ...sendData, total_value: Number(data.total_value), receipt_path: current_receipt_path })
            .eq('id', service.id);

          if (error) throw error;
          
          await logAuditAction(
              profile?.company_id,
              user?.email,
              'EDITAR',
              `Serviço: ${data.description}`,
              { id: service.id, total_value: data.total_value, status: data.status }
          );
      },
      onSuccess: () => {
          toast({ title: "Sucesso!", description: "Serviço atualizado com sucesso." });
          queryClient.invalidateQueries({ queryKey: ['servicos'] });
          queryClient.invalidateQueries({ queryKey: ['services_dashboard'] });
          onSuccess();
          onClose();
      },
      onError: (err) => {
          const errorMessage = formatApiError(err);
          toast({ variant: "destructive", title: "Erro!", description: errorMessage });
      }
  });


  const onSubmit = (data: ServicoFormValues) => {
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

  const shouldShowError = (fieldName: keyof ServicoFormValues) => {
      return isSubmitted || !!(touchedFields as any)[fieldName];
  };

  if (!service) return null;

  const isReceiptChanged = receiptFile !== null || receiptPath !== (service.receipt_path || null);
  const isFormDirty = isDirty || isReceiptChanged;

  return (
    <ResponsiveModal isOpen={isOpen} onOpenChange={onClose}>
      <ResponsiveModalContent className="max-w-5xl bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
        <ResponsiveModalHeader className="px-5 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
          <ResponsiveModalTitle className="flex items-center gap-2 text-base text-white">
            <BriefcaseIcon className="h-4 w-4 text-brand-blue-500" />
            Editar Serviço
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400">
            Atualize os detalhes do serviço.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full w-full overflow-hidden">
            <div className="flex-grow overflow-y-auto custom-scrollbar p-5 bg-brand-dark-950/50 space-y-5">
                
                <InputGroup label="Descrição *" error={shouldShowError('description') ? errors.description?.message as string : undefined}>
                    <Textarea 
                        {...register('description')} 
                        className="bg-brand-dark-950 border-gray-700 min-h-[80px]"
                    />
                </InputGroup>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Controller 
                        name="collaborator_id" 
                        control={control} 
                        render={({ field }) => ( 
                            <Combobox 
                                label="Colaborador" 
                                options={collaborators.map(c => ({ value: c.id, label: c.name }))} 
                                value={field.value} 
                                onChange={field.onChange} 
                                placeholder="Selecione..." 
                                error={shouldShowError('collaborator_id') ? errors.collaborator_id?.message as string : undefined}
                            /> 
                        )} 
                    />
                    <Controller 
                        name="project_id" 
                        control={control} 
                        render={({ field }) => ( 
                            <Combobox 
                                label="Obra" 
                                options={projects.map(p => ({ value: p.id, label: p.name }))} 
                                value={field.value} 
                                onChange={field.onChange} 
                                placeholder="Selecione..." 
                                error={shouldShowError('project_id') ? errors.project_id?.message as string : undefined} 
                            /> 
                        )} 
                    />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InputGroup label="Status *" error={shouldShowError('status') ? errors.status?.message as string : undefined}>
                        <select 
                            {...register('status')} 
                            className="h-9 w-full rounded-md border border-gray-700 bg-brand-dark-950 px-3 py-1 text-sm text-white focus:border-brand-blue-500 focus:ring-brand-blue-500"
                        >
                            {SERVICE_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                    </InputGroup>
                    <InputGroup label="Data de Início *" error={shouldShowError('start_date') ? errors.start_date?.message as string : undefined}>
                        <Input type="date" {...register('start_date')} className="h-9 bg-brand-dark-950 border-gray-700" />
                    </InputGroup>
                    <InputGroup label="Data de Fim *" error={shouldShowError('end_date') ? errors.end_date?.message as string : undefined}>
                        <Input type="date" {...register('end_date')} className="h-9 bg-brand-dark-950 border-gray-700" />
                    </InputGroup>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputGroup label="Valor Total (R$) *" error={shouldShowError('total_value') ? errors.total_value?.message as string : undefined}>
                        <CurrencyInput control={control} name="total_value" className="h-9 bg-brand-dark-950 border-gray-700" />
                    </InputGroup>
                </div>
                
                <InputGroup label="Observações">
                    <Textarea 
                        {...register('observations')} 
                        className="min-h-[80px] bg-brand-dark-950 border-gray-700"
                    />
                </InputGroup>

                <InputGroup label="Comprovante (Opcional)">
                   <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-800 border-dashed rounded-md bg-brand-dark-900 relative hover:border-gray-700 transition-colors">
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
                                           htmlFor="file-upload-service-edit"
                                           className="relative cursor-pointer bg-brand-dark-900 rounded-md font-medium text-brand-blue-500 hover:text-brand-blue-400 focus-within:outline-none"
                                       >
                                           <span>Fazer upload de arquivo</span>
                                           <input id="file-upload-service-edit" name="file-upload-service-edit" type="file" className="sr-only" onChange={(e) => {
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
            </div>

            <ResponsiveModalFooter className="p-4 border-t border-gray-800 bg-brand-dark-900 flex-shrink-0 flex justify-end items-center gap-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={updateMutation.isPending} className="h-9 px-4">
                    Cancelar
                </Button>
                <Button type="submit" isLoading={updateMutation.isPending} loadingText="Salvando..." disabled={!isFormDirty} className="h-9 px-6">
                    Salvar Serviço
                </Button>
            </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

const Combobox: React.FC<{label: string; options: { value: string; label: string }[]; value: string | null; onChange: (value: string | null) => void; placeholder: string; error?: string;}> = ({ label, options, value, onChange, placeholder, error }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;
    const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

    return (
        <InputGroup label={label} error={error}>
            <Popover open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setSearch(''); }}>
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className={`w-full justify-between font-normal text-left h-9 px-3 text-sm bg-brand-dark-950 border-gray-700 hover:bg-gray-800 ${!value && 'text-gray-400'}`}>
                        <span className="truncate">{selectedLabel}</span>
                        <ChevronsUpDownIcon className="ml-2 h-4 w-4 text-gray-400 flex-shrink-0" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width] border-gray-700 bg-brand-dark-900">
                    <Command>
                        <CommandInput placeholder="Buscar..." value={search} onInput={(e) => setSearch(e.currentTarget.value)} className="border-none focus:ring-0 h-9 text-sm" />
                        <CommandList className="max-h-[200px] overflow-y-auto custom-scrollbar">
                            <CommandEmpty className="py-2 text-center text-sm text-gray-400">Nenhum resultado.</CommandEmpty>
                            <CommandItem className="cursor-pointer text-sm py-1.5 px-2" onSelect={() => { onChange(null); setIsOpen(false); }}>-- Nenhum --</CommandItem>
                            {filteredOptions.map(option => (<CommandItem key={option.value} className="cursor-pointer aria-selected:bg-brand-blue-500/20 text-sm py-1.5 px-2" onSelect={() => { onChange(option.value); setIsOpen(false); }}>{option.label}</CommandItem>))}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </InputGroup>
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


export default EditarServicoModal;