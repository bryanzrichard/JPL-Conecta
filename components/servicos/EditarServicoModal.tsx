import React, { useEffect, useState, useMemo } from 'react';
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
import { Popover, PopoverTrigger, PopoverContent } from '../ui/Popover';
import { Command, CommandInput, CommandEmpty, CommandItem, CommandList } from '../ui/Command';
import { 
  ChevronsUpDownIcon, 
  BriefcaseIcon, 
  UploadIcon, 
  XIcon, 
  PaperclipIcon, 
  ConstructionIcon, 
  CalendarIcon, 
  DollarSignIcon, 
  EditIcon,
  ExternalLinkIcon 
} from '../../lib/icons';
import { supabase } from '../../lib/supabaseClient';
import { ServiceWithDetails, Collaborator, Project, SERVICE_STATUSES } from '../../types';
import { servicoSchema, ServicoFormValues, createZodResolver } from '../../lib/validators';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { useAuth } from '../../hooks/useAuth';
import { computeSha256, openStorageFile, formatCurrency } from '../../lib/utils';

interface EditarServicoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  service: ServiceWithDetails | null;
  collaborators: Collaborator[];
  projects: Project[];
}

const customResolver = createZodResolver(servicoSchema);

const SERVICE_QUICK_PRESETS = [
  'Instalações Elétricas',
  'Instalações Hidráulicas',
  'Alvenaria e Reboco',
  'Pintura Interna / Externa',
  'Forro de Gesso e Drywall',
  'Assentamento de Pisos e Porcelanato',
  'Carpintaria e Esquadrias',
  'Impermeabilização',
];

const EditarServicoModal: React.FC<EditarServicoModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  service, 
  collaborators, 
  projects 
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

  const startDate = watch('start_date');
  const endDate = watch('end_date');

  const estimatedDays = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return days >= 0 ? days : null;
  }, [startDate, endDate]);

  const updateMutation = useMutation({
    mutationFn: async (data: ServicoFormValues) => {
      if (!service) throw new Error("Serviço não encontrado.");

      const newTotalValue = Number(data.total_value);

      // Reconciliação financeira: buscar adiantamentos vinculados ao serviço
      const { data: advancesData, error: advancesError } = await (supabase as any)
        .from('adiantamentos')
        .select('value')
        .eq('service_id', service.id);

      if (advancesError) {
        console.error("Erro ao consultar adiantamentos vinculados:", advancesError);
      }

      const totalAdvances = (advancesData || []).reduce(
        (sum: number, a: { value: number }) => sum + Number(a.value || 0),
        0
      );

      // Validação: novo valor contratado não pode ser menor que o total já adiantado
      if (newTotalValue < totalAdvances - 0.009) {
        throw new Error(
          `O novo valor contratado (${formatCurrency(newTotalValue)}) não pode ser inferior ao total de adiantamentos já liberados (${formatCurrency(totalAdvances)}).`
        );
      }

      // Regra de integridade de status:
      // Se o status estava ou foi indicado como 'Concluído', mas o valor do serviço aumentou gerando saldo devedor
      let finalStatus = data.status;
      let statusReverted = false;
      const hasDebt = (newTotalValue - totalAdvances) > 0.009;

      if (finalStatus === 'Concluído' && hasDebt) {
        finalStatus = 'Em Andamento';
        statusReverted = true;
      }
      
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
      const { error } = await (supabase as any)
        .from('servicos')
        .update({ 
          ...sendData, 
          status: finalStatus,
          total_value: newTotalValue, 
          receipt_path: current_receipt_path 
        })
        .eq('id', service.id);

      if (error) throw error;
      
      await logAuditAction(
        profile?.company_id,
        user?.email,
        'EDITAR',
        `Serviço: ${data.description}`,
        { 
          id: service.id, 
          total_value: newTotalValue, 
          status: finalStatus,
          statusReverted
        }
      );

      return { statusReverted };
    },
    onSuccess: (result) => {
      toast({ 
        title: "Sucesso!", 
        description: result?.statusReverted 
          ? "Contrato atualizado. O status foi ajustado para 'Em Andamento' devido ao saldo devedor restante."
          : "Contrato de serviço atualizado com sucesso." 
      });
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

  const onSubmit = (data: ServicoFormValues) => {
    updateMutation.mutate(data);
  };

  const handleOpenReceipt = async (path: string) => {
    try {
      await openStorageFile(path);
    } catch {
      toast({ title: 'Erro ao abrir anexo', description: 'Não foi possível gerar link para o documento.', variant: 'destructive' });
    }
  };

  const handleApplyPreset = (preset: string) => {
    const current = watch('description') || '';
    if (!current) {
      setValue('description', preset, { shouldValidate: true, shouldDirty: true });
    } else if (!current.includes(preset)) {
      setValue('description', `${current} • ${preset}`, { shouldValidate: true, shouldDirty: true });
    }
  };

  return (
    <ResponsiveModal open={isOpen} onOpenChange={onClose} displayMode="drawer">
      <ResponsiveModalContent size="xl" fullHeight className="max-w-5xl flex flex-col">
        {/* Header Consistente */}
        <ResponsiveModalHeader className="px-6 py-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20 flex items-center justify-center text-brand-blue-600 dark:text-brand-blue-400 shrink-0">
              <EditIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle className="text-base font-bold text-gray-900 dark:text-white">
                Editar Contrato de Serviço
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Atualize prestador, escopo, cronograma e valor global contratado.
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>
        
        {/* Formulário com Master Split (60% / 40%) */}
        <form id="editar-servico-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/60 dark:bg-brand-dark-950/50 custom-scrollbar">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* COLUNA ESQUERDA (60%): Escopo, Envolvidos e Cronograma */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* Bloco 1: Escopo do Serviço */}
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <BriefcaseIcon className="h-4 w-4 text-brand-blue-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                        1. Escopo & Descrição do Trabalho
                      </h3>
                    </div>
                  </div>

                  {/* Sugestões Rápidas de Especialidade */}
                  <div>
                    <Label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
                      Sugestões Rápidas:
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {SERVICE_QUICK_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleApplyPreset(preset)}
                          className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 dark:bg-brand-dark-800 hover:bg-brand-blue-500/10 hover:text-brand-blue-600 dark:hover:text-brand-blue-400 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-colors"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Descrição Detalhada do Contrato <span className="text-red-500">*</span>
                    </Label>
                    <Textarea 
                      {...register('description')} 
                      placeholder="Descreva o escopo acordado..." 
                      className="min-h-[85px] text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white focus:border-brand-blue-500 resize-none leading-relaxed"
                    />
                    {errors.description && (
                      <p className="text-[11px] text-red-500 mt-1">{errors.description.message}</p>
                    )}
                  </div>
                </div>

                {/* Bloco 2: Envolvidos e Obra */}
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <ConstructionIcon className="h-4 w-4 text-brand-blue-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                      2. Obra & Prestador Responsável
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Controller 
                      name="project_id" 
                      control={control} 
                      render={({ field }) => ( 
                        <Combobox 
                          label={<>Obra / Canteiro <span className="text-red-500">*</span></>} 
                          options={projects.map(p => ({ value: p.id, label: p.name }))} 
                          value={field.value || ''} 
                          onChange={field.onChange} 
                          placeholder="Selecione a obra..." 
                          error={errors.project_id?.message as string} 
                        /> 
                      )} 
                    />

                    <Controller 
                      name="collaborator_id" 
                      control={control} 
                      render={({ field }) => ( 
                        <Combobox 
                          label={<>Prestador / Empreiteiro <span className="text-red-500">*</span></>} 
                          options={collaborators.map(c => ({ value: c.id, label: c.name }))} 
                          value={field.value || ''} 
                          onChange={field.onChange} 
                          placeholder="Selecione o profissional..." 
                          error={errors.collaborator_id?.message as string}
                        /> 
                      )} 
                    />
                  </div>
                </div>

                {/* Bloco 3: Cronograma & Status */}
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-brand-blue-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                        3. Cronograma de Execução
                      </h3>
                    </div>
                    {estimatedDays !== null && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-blue-500/10 text-brand-blue-600 dark:text-brand-blue-400">
                        Duração: {estimatedDays} {estimatedDays === 1 ? 'dia' : 'dias'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Data de Início <span className="text-red-500">*</span>
                      </Label>
                      <Input 
                        type="date" 
                        {...register('start_date')} 
                        className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" 
                      />
                      {errors.start_date && <p className="text-[11px] text-red-500 mt-1">{errors.start_date.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Previsão de Término
                      </Label>
                      <Input 
                        type="date" 
                        {...register('end_date')} 
                        className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Status do Contrato
                      </Label>
                      <select 
                        {...register('status')} 
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-800 bg-white dark:bg-brand-dark-950 h-9 px-2 text-xs font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-blue-500"
                      >
                        {SERVICE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

              </div>

              {/* COLUNA DIREITA (40% Sticky): Valores, Contrato & Observações */}
              <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-0">
                
                {/* Card Financeiro Principal */}
                <div className="bg-white dark:bg-brand-dark-900 border-2 border-brand-blue-500/30 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <DollarSignIcon className="h-4 w-4 text-brand-blue-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                        Acordo Financeiro
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      Em Edição
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Valor Contratado (R$) <span className="text-red-500">*</span>
                    </Label>
                    <div className="bg-gray-50 dark:bg-brand-dark-950 p-3 rounded-xl border border-gray-200 dark:border-gray-800">
                      <CurrencyInput 
                        control={control} 
                        name="total_value" 
                        className="h-10 text-2xl font-black font-mono text-brand-blue-600 dark:text-brand-blue-400 bg-transparent border-none text-right focus:ring-0 p-0" 
                      />
                    </div>
                    {errors.total_value && (
                      <p className="text-xs text-red-500 mt-1 font-medium">{errors.total_value.message}</p>
                    )}
                  </div>
                </div>

                {/* Card Comprovante / Minuta */}
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                    <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                      Minuta / Comprovante
                    </Label>
                    {receiptPath && (
                      <button 
                        type="button" 
                        onClick={() => handleOpenReceipt(receiptPath)}
                        className="text-[11px] text-brand-blue-600 dark:text-brand-blue-400 hover:underline flex items-center gap-1 font-medium"
                      >
                        <PaperclipIcon className="h-3 w-3" /> Ver Atual
                      </button>
                    )}
                  </div>

                  {receiptFile ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20 text-xs">
                      <span className="font-semibold text-brand-blue-600 dark:text-brand-blue-400 truncate max-w-[180px]">
                        {receiptFile.name}
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setReceiptFile(null)}
                        className="text-[10px] text-red-500 hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="edit-service-file-upload"
                      className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-800 hover:border-brand-blue-500/50 rounded-xl cursor-pointer bg-gray-50/50 dark:bg-brand-dark-950 transition-colors text-center px-4"
                    >
                      <UploadIcon className="h-6 w-6 text-gray-400 mb-1" />
                      <span className="text-xs font-semibold text-brand-blue-600 dark:text-brand-blue-400">
                        {receiptPath ? 'Substituir Documento' : 'Anexar Minuta ou Contrato'}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5">
                        PDF, PNG ou JPG até 10MB
                      </span>
                      <input 
                        id="edit-service-file-upload" 
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

                {/* Card Observações */}
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                    Observações Adicionais
                  </Label>
                  <Textarea 
                    {...register('observations')} 
                    placeholder="Condições de pagamento, etapas de medição, retenção técnica..."
                    className="bg-gray-50/50 dark:bg-brand-dark-950 border-gray-200 dark:border-gray-800 min-h-[75px] text-xs text-gray-900 dark:text-white resize-none"
                  />
                </div>

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
              className="text-xs h-9 px-6 font-bold uppercase tracking-wider bg-brand-blue-600 hover:bg-brand-blue-500 text-white"
            >
              Salvar Alterações
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

const Combobox: React.FC<{
  label: React.ReactNode; 
  options: { value: string; label: string }[]; 
  value: string; 
  onChange: (value: string) => void; 
  placeholder: string; 
  error?: string;
}> = ({ label, options, value, onChange, placeholder, error }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;
  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-1.5">
      <Label className={`text-xs font-medium ${error ? "text-red-500" : "text-gray-700 dark:text-gray-300"}`}>{label}</Label>
      <Popover open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setSearch(''); }}>
        <PopoverTrigger asChild>
          <Button 
            type="button" 
            variant="outline" 
            className={`w-full justify-between font-normal text-left h-9 px-3 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 ${!value ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronsUpDownIcon className="ml-2 h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900 shadow-xl">
          <Command>
            <CommandInput placeholder="Buscar..." value={search} onInput={(e) => setSearch(e.currentTarget.value)} className="border-none focus:ring-0 h-9 text-xs" />
            <CommandList className="max-h-[200px] overflow-y-auto custom-scrollbar">
              <CommandEmpty className="py-3 text-center text-xs text-gray-400">Nenhum resultado encontrado.</CommandEmpty>
              {filteredOptions.map(option => (
                <CommandItem 
                  key={option.value} 
                  className="cursor-pointer aria-selected:bg-brand-blue-500/10 aria-selected:text-brand-blue-600 dark:aria-selected:text-brand-blue-400 text-xs py-2 px-3" 
                  onSelect={() => { onChange(option.value); setIsOpen(false); }}
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
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

export default EditarServicoModal;
