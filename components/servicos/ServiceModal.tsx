
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
import { ChevronsUpDownIcon, BriefcaseIcon, UploadIcon, XIcon } from '../../lib/icons';
import { supabase } from '../../lib/supabaseClient';
import { Collaborator, Project, SERVICE_STATUSES } from '../../types';
import { servicoSchema, ServicoFormValues, createZodResolver } from '../../lib/validators';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { useAuth } from '../../hooks/useAuth';
import { computeSha256 } from '../../lib/utils';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  collaborators: Collaborator[];
  projects: Project[];
}

const customResolver = createZodResolver(servicoSchema);

const ServiceModal: React.FC<ServiceModalProps> = ({ isOpen, onClose, collaborators, projects }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const { 
      register, 
      handleSubmit, 
      control, 
      reset, 
      formState: { errors, isSubmitted, touchedFields } 
  } = useForm<ServicoFormValues>({
    resolver: customResolver,
    mode: 'onBlur',
    defaultValues: {
      description: '',
      collaborator_id: null,
      project_id: null,
      status: 'Em Andamento',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      total_value: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ServicoFormValues) => {
      if (!user || !profile?.company_id) throw new Error("Sessão inválida.");

      let receipt_path = null;
      if (receiptFile) {
          const fileHash = await computeSha256(receiptFile);
          const filePath = `${profile.company_id}/${user.id}/comprovante_servico_${fileHash}.${receiptFile.name.split('.').pop()}`;
          const { error: uploadError } = await supabase.storage.from('jpl-conecta').upload(filePath, receiptFile, { upsert: true });
          if (uploadError) throw new Error(`Erro no upload do comprovante: ${uploadError.message}`);
          receipt_path = filePath;
      }

      const { receipt_file, ...sendData } = data;
      const { error } = await supabase.from('servicos').insert({
        ...sendData,
        total_value: Number(data.total_value),
        company_id: profile.company_id,
        created_by: user.id,
        receipt_path
      } as any);
      if (error) throw error;
      
      await logAuditAction(
          profile?.company_id,
          user?.email,
          'CRIAR',
          `Serviço: ${data.description}`,
          { total_value: data.total_value, status: data.status }
      );
    },
    onSuccess: () => {
      toast({ title: "Sucesso!", description: "Serviço criado com sucesso." });
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

  const onSubmit = (data: ServicoFormValues) => {
    createMutation.mutate(data);
  };

  const shouldShowError = (fieldName: keyof ServicoFormValues) => {
      return isSubmitted || !!(touchedFields as any)[fieldName];
  };

  return (
    <ResponsiveModal isOpen={isOpen} onOpenChange={onClose} displayMode="dialog">
      <ResponsiveModalContent className="max-w-5xl bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
        <ResponsiveModalHeader className="px-6 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20 flex items-center justify-center text-brand-blue-400 shrink-0">
              <BriefcaseIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle className="text-base text-white font-bold">
                Criar Novo Serviço / Contrato
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-xs text-gray-400 mt-0.5">
                Defina o prestador, obra, cronograma e valor contratado da medição.
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>
        
        <div className="flex-grow overflow-y-auto custom-scrollbar p-5 bg-gray-50/50 dark:bg-brand-dark-950/50">
          <form id="service-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <InputGroup label="Descrição *" error={shouldShowError('description') ? errors.description?.message as string : undefined}>
                    <Textarea 
                        {...register('description')} 
                        placeholder="Descreva o serviço..." 
                        className="h-20 text-sm bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white focus:border-brand-blue-500 resize-none"
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
                            className="w-full rounded-md border border-gray-800 bg-brand-dark-950 h-9 px-3 text-sm text-white focus:border-brand-blue-500 focus:ring-brand-blue-500 transition-all"
                        >
                            {SERVICE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </InputGroup>
                    <InputGroup label="Data de Início *" error={shouldShowError('start_date') ? errors.start_date?.message as string : undefined}>
                        <Input type="date" {...register('start_date')} className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
                    </InputGroup>
                    <InputGroup label="Data de Fim *" error={shouldShowError('end_date') ? errors.end_date?.message as string : undefined}>
                        <Input type="date" {...register('end_date')} className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
                    </InputGroup>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputGroup label="Valor Total (R$) *" error={shouldShowError('total_value') ? errors.total_value?.message as string : undefined}>
                        <CurrencyInput control={control} name="total_value" className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
                    </InputGroup>
                </div>

                <InputGroup label="Observações">
                    <Textarea 
                        {...register('observations')} 
                        placeholder="Observações adicionais..."
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
                                           htmlFor="file-upload-service"
                                           className="relative cursor-pointer bg-brand-dark-900 rounded-md font-medium text-brand-blue-500 hover:text-brand-blue-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-brand-blue-500"
                                       >
                                           <span>Fazer upload de arquivo</span>
                                           <input id="file-upload-service" name="file-upload-service" type="file" className="sr-only" onChange={(e) => {
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
            <Button type="submit" form="service-form" isLoading={createMutation.isPending} loadingText="Salvando..." className="text-sm h-9 px-6">
                Salvar Serviço
            </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

// Reusable components
const InputGroup: React.FC<{ label: React.ReactNode; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
    <div>
        <Label className={`text-xs font-medium ${error ? "text-red-500" : "text-gray-400"}`}>{label}</Label>
        <div className="mt-1">{children}</div>
        {error && <p className="text-[10px] text-red-500 mt-1 animate-in fade-in slide-in-from-top-1">{error}</p>}
    </div>
);

const Combobox: React.FC<{label: string; options: { value: string; label: string }[]; value: string | null; onChange: (value: string | null) => void; placeholder: string; error?: string;}> = ({ label, options, value, onChange, placeholder, error }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    
    // Reset search when closed
    useEffect(() => { if (!isOpen) setSearch(''); }, [isOpen]);

    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;
    const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

    return (
        <InputGroup label={label} error={error}>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className={`w-full justify-between font-normal text-left h-9 px-3 text-sm bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white ${!value && 'text-gray-400'}`}>
                        <span className="truncate">{selectedLabel}</span>
                        <ChevronsUpDownIcon className="ml-2 h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width] border-gray-200 dark:border-gray-700 bg-white dark:bg-brand-dark-900">
                    <Command onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                        }
                    }}>
                        <CommandInput placeholder="Buscar..." value={search} onInput={(e) => setSearch(e.currentTarget.value)} className="border-none focus:ring-0 h-9 text-sm text-gray-900 dark:text-white" />
                        <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty className="py-2 text-center text-sm">Nenhum resultado.</CommandEmpty>
                            <CommandItem className="cursor-pointer aria-selected:bg-brand-blue-500/20 text-sm py-1.5 text-gray-700 dark:text-white" onSelect={() => { onChange(null); setIsOpen(false); }}>-- Nenhum --</CommandItem>
                            {filteredOptions.map(option => (
                                <CommandItem key={option.value} className="cursor-pointer aria-selected:bg-brand-blue-500/20 text-sm py-1.5 text-gray-700 dark:text-white" onSelect={() => { onChange(option.value); setIsOpen(false); }}>
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </InputGroup>
    );
};

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

export default ServiceModal;
