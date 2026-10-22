
import React, { useEffect, useState, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Textarea } from '../ui/Textarea';
import { taskSchema, TaskFormValues, createZodResolver } from '../../lib/validators';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { Task, Project, Collaborator, TaskStatus, TaskPriority } from '../../types';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/Popover';
import { Command, CommandInput, CommandEmpty, CommandItem, CommandList } from '../ui/Command';
import { ChevronsUpDownIcon, PlusIcon, Trash2Icon, PackageIcon, WrenchIcon, MapPinIcon, ClipboardListIcon } from '../../lib/icons';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  projects: Project[];
  collaborators: Collaborator[];
  isLoadingPrerequisites: boolean;
}

// Disciplinas comuns na construção civil para facilitar o preenchimento
const CONSTRUCTION_DISCIPLINES = [
    'Alvenaria', 'Pintura', 'Elétrica', 'Hidráulica', 'Carpintaria', 
    'Serralheria', 'Acabamento', 'Limpeza', 'Estrutura', 'Gesso'
];

const customResolver = createZodResolver(taskSchema);

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose, taskToEdit, projects, collaborators, isLoadingPrerequisites }) => {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const isEditMode = !!taskToEdit;

    // Local state for construction helpers
    const [discipline, setDiscipline] = useState('');
    const [location, setLocation] = useState('');
    const [responsibleManual, setResponsibleManual] = useState('');

    // Memoize default values to ensure stability and proper reset logic
    const defaultValues: TaskFormValues = useMemo(() => {
        if (taskToEdit) {
            return {
                title: taskToEdit.title || '',
                description: taskToEdit.description || '',
                project_id: taskToEdit.project_id,
                data_inicio_prevista: taskToEdit.data_inicio_prevista ? taskToEdit.data_inicio_prevista.split('T')[0] : null,
                data_fim_prevista: taskToEdit.data_fim_prevista ? taskToEdit.data_fim_prevista.split('T')[0] : null,
                materiais_previstos: (taskToEdit.materiais_previstos as any[]) || [],
                equipamentos_utilizados: (taskToEdit.equipamentos_utilizados as any[]) || [],
                observacoes: taskToEdit.observacoes || '', 
                status: taskToEdit.status,
                prioridade: taskToEdit.prioridade,
                responsavel_execucao_id: taskToEdit.responsavel_execucao_id || null,
                custo_real: taskToEdit.custo_real || 0
            };
        }
        return {
            title: '',
            description: '',
            project_id: undefined, // Will force selection
            status: 'Planejada',
            prioridade: 'Baixa',
            materiais_previstos: [],
            equipamentos_utilizados: [],
            observacoes: '',
            data_inicio_prevista: null,
            data_fim_prevista: null,
            responsavel_execucao_id: null,
            custo_real: 0
        };
    }, [taskToEdit]);

    const { register, handleSubmit, reset, control, watch, setValue, formState: { errors, isDirty, isSubmitted, touchedFields } } = useForm<TaskFormValues>({
        resolver: customResolver,
        mode: 'onBlur',
        defaultValues
    });
    
    const { fields: materialFields, append: appendMaterial, remove: removeMaterial } = useFieldArray({ control, name: "materiais_previstos" });
    const { fields: equipmentFields, append: appendEquipment, remove: removeEquipment } = useFieldArray({ control, name: "equipamentos_utilizados" });

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setDiscipline('');
            setLocation('');
            setResponsibleManual('');
            reset(defaultValues);
        }
    }, [isOpen, defaultValues, reset]);

    // Automatic status and priority update based on dates
    const startDate = watch('data_inicio_prevista');
    const endDate = watch('data_fim_prevista');
    const status = watch('status');

    // Auto-update logic for status/priority based on dates
    useEffect(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
        const end = endDate ? new Date(`${endDate}T00:00:00`) : null;
        
        // --- Status Logic ---
        if (status !== 'Concluída') {
            let newStatus: TaskStatus = 'Planejada';
            if (end && end < today) {
                newStatus = 'Atrasada';
            } else if (start && start <= today) {
                newStatus = 'Em Execução';
            }
            if (status !== newStatus) {
                setValue('status', newStatus, { shouldDirty: true });
            }
        }
        
        // --- Priority Logic (Automated) ---
        let newPriority: TaskPriority = 'Baixa';
        if (end) {
            const diffTime = end.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 3) {
                newPriority = 'Alta';
            } else if (diffDays <= 7) {
                newPriority = 'Média';
            }
        }
        
        // Force update priority field
        setValue('prioridade', newPriority, { shouldDirty: true });

    }, [startDate, endDate, status, setValue]);

    const mutation = useMutation({
        mutationFn: async (data: TaskFormValues) => {
            if (!user || !profile) throw new Error("Usuário não autenticado.");
            
            // Apply prefixes to Description if helpers were used (Title stays clean)
            let finalDescription = data.description || '';
            const prefix = [];
            if (discipline) prefix.push(`[${discipline}]`);
            if (location) prefix.push(`Local: ${location}`);
            if (responsibleManual) prefix.push(`Resp: ${responsibleManual}`);
            
            if (prefix.length > 0 && !isEditMode) {
                finalDescription = `${prefix.join(' - ')}\n${finalDescription}`;
            }

            // CLEAN PAYLOAD - Mapped correctly to database columns
            const payload = {
                title: data.title, 
                description: finalDescription,
                project_id: data.project_id || null, 
                status: data.status,
                prioridade: data.prioridade,
                data_inicio_prevista: data.data_inicio_prevista || null,
                data_fim_prevista: data.data_fim_prevista || null,
                materiais_previstos: data.materiais_previstos,
                equipamentos_utilizados: data.equipamentos_utilizados,
                observacoes: data.observacoes || null,
                responsavel_execucao_id: data.responsavel_execucao_id || null, 
                custo_real: data.custo_real || 0,
                company_id: profile.company_id,
                created_by: user.id,
            };

            const { error } = isEditMode
                ? await supabase.from('tasks').update(payload as never).eq('id', taskToEdit.id)
                : await supabase.from('tasks').insert(payload as never);
            
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['recentTasks'] });
            toast({ title: 'Sucesso!', description: `Tarefa ${isEditMode ? 'atualizada' : 'criada'} com sucesso.` });
            onClose();
        },
        onError: (error) => {
            const errorMessage = formatApiError(error);
            toast({ variant: 'destructive', title: 'Erro!', description: `Não foi possível salvar a tarefa: ${errorMessage}` });
        }
    });

    const onSubmit = (data: TaskFormValues) => {
        mutation.mutate(data);
    };

    const shouldShowError = (fieldName: keyof TaskFormValues) => {
        return isSubmitted || (touchedFields as any)[fieldName];
    };

    return (
        <ResponsiveModal open={isOpen} onOpenChange={onClose}>
            <ResponsiveModalContent className="max-w-5xl bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
                <ResponsiveModalHeader className="px-5 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
                    <ResponsiveModalTitle className="flex items-center gap-2 text-base text-white">
                        <ClipboardListIcon className="h-4 w-4 text-brand-blue-500" />
                        {isEditMode ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}
                    </ResponsiveModalTitle>
                    <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400">
                        Defina as atividades e recursos para o funcionário.
                    </ResponsiveModalDescription>
                </ResponsiveModalHeader>
                
                <div className="flex-grow overflow-y-auto custom-scrollbar p-5 bg-brand-dark-950/50">
                    <form id="create-task-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        
                        {/* 1. Contexto da Obra - Helpers Visuais */}
                        {!isEditMode && (
                            <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50 space-y-3">
                                <Label className="text-brand-blue-400 text-xs uppercase font-bold tracking-wider">Contexto da Atividade</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-xs text-gray-400 mb-1">Disciplina / Especialidade</Label>
                                        <select 
                                            className="w-full rounded-md border border-gray-800 bg-brand-dark-950 p-2 text-sm text-white focus:ring-1 focus:ring-brand-blue-500 h-9"
                                            value={discipline}
                                            onChange={(e) => setDiscipline(e.target.value)}
                                        >
                                            <option value="">Selecione...</option>
                                            {CONSTRUCTION_DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-400 mb-1">Local Específico na Obra</Label>
                                        <div className="relative">
                                            <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500"/>
                                            <Input 
                                                className="pl-9 h-9 bg-brand-dark-950 border-gray-800 text-sm focus:border-brand-blue-500" 
                                                placeholder="Ex: Apto 302, Banheiro..." 
                                                value={location}
                                                onChange={(e) => setLocation(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. Detalhes da Ordem */}
                        <div className="space-y-4">
                            <InputGroup label="Título da Tarefa *" error={shouldShowError('title') ? errors.title?.message as string : undefined}>
                                <Input 
                                    {...register('title')} 
                                    placeholder="Ex: Instalação de Pia da Cozinha" 
                                    className="bg-brand-dark-950 border-gray-800 font-medium h-9 text-sm focus:border-brand-blue-500"
                                />
                            </InputGroup>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Controller 
                                    name="project_id" 
                                    control={control} 
                                    render={({ field }) => ( 
                                        <Combobox 
                                            label="Obra / Projeto *" 
                                            options={projects} 
                                            value={field.value} 
                                            onChange={field.onChange} 
                                            placeholder="Selecione a obra..." 
                                            disabled={isLoadingPrerequisites} 
                                            error={shouldShowError('project_id') ? errors.project_id?.message as string : undefined}
                                        /> 
                                    )} 
                                />
                                <Controller 
                                    name="responsavel_execucao_id" 
                                    control={control} 
                                    render={({ field }) => ( 
                                        <Combobox 
                                            label="Responsável Técnico" 
                                            options={collaborators} 
                                            value={field.value} 
                                            onChange={field.onChange} 
                                            placeholder="Selecione o funcionário..." 
                                            disabled={isLoadingPrerequisites} 
                                            error={shouldShowError('responsavel_execucao_id') ? errors.responsavel_execucao_id?.message as string : undefined}
                                        /> 
                                    )} 
                                />
                            </div>
                            
                            {/* Manual input helper just for quick context addition, not saved as ID */}
                            <InputGroup label="Responsável (Nome Adicional/Auxiliar)">
                                <Input 
                                    value={responsibleManual} 
                                    onChange={(e) => setResponsibleManual(e.target.value)} 
                                    placeholder="Digite o nome se não estiver na lista..." 
                                    className="bg-brand-dark-950 border-gray-800 h-9 text-sm focus:border-brand-blue-500"
                                />
                            </InputGroup>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <InputGroup 
                                    label="Início Previsto" 
                                    error={shouldShowError('data_inicio_prevista') ? errors.data_inicio_prevista?.message as string : undefined}
                                >
                                    <Input type="date" {...register('data_inicio_prevista')} className="bg-brand-dark-950 border-gray-800 h-9 text-sm focus:border-brand-blue-500" />
                                </InputGroup>
                                <InputGroup 
                                    label="Conclusão Prevista" 
                                    error={shouldShowError('data_fim_prevista') ? errors.data_fim_prevista?.message as string : undefined}
                                >
                                    <Input type="date" {...register('data_fim_prevista')} className="bg-brand-dark-950 border-gray-800 h-9 text-sm focus:border-brand-blue-500" />
                                </InputGroup>
                                <InputGroup 
                                    label="Custo Real (R$)" 
                                    error={shouldShowError('custo_real') ? errors.custo_real?.message as string : undefined}
                                >
                                    <CurrencyInput control={control} name="custo_real" className="bg-brand-dark-950 border-gray-800 h-9 text-sm focus:border-brand-blue-500" />
                                </InputGroup>
                            </div>

                            <InputGroup label="Descrição Detalhada / Instruções" error={shouldShowError('description') ? errors.description?.message as string : undefined}>
                                <Textarea 
                                    placeholder="Ex: Utilizar silicone incolor no acabamento. Verificar nível antes de fixar." 
                                    {...register('description')} 
                                    className="h-20 bg-brand-dark-950 border-gray-800 text-sm focus:border-brand-blue-500 resize-none" 
                                />
                            </InputGroup>
                            
                            <InputGroup label="Observações Adicionais">
                                <Textarea 
                                    placeholder="Detalhes extras, cuidados especiais..." 
                                    {...register('observacoes')} 
                                    className="h-16 bg-brand-dark-950 border-gray-800 text-sm focus:border-brand-blue-500 resize-none" 
                                />
                            </InputGroup>

                            {/* Hidden Status and Priority fields - Automatic Calculation */}
                            <input type="hidden" {...register('status')} />
                            <input type="hidden" {...register('prioridade')} />
                        </div>

                        {/* 3. Recursos (Materiais e Ferramentas) - Side by Side */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                            <ResourceSection 
                                title="Materiais Necessários" 
                                subtitle="Requisição Almoxarifado"
                                icon={<PackageIcon className="h-4 w-4 text-brand-blue-500" />} 
                                fields={materialFields} 
                                register={register} 
                                errors={errors.materiais_previstos} 
                                remove={removeMaterial} 
                                append={() => appendMaterial({ nome: '' })} 
                                placeholder="Ex: 2 sacos cimento..."
                                name="materiais_previstos"
                            />
                            
                            <ResourceSection 
                                title="Ferramentas" 
                                subtitle="Patrimônio / Cautela"
                                icon={<WrenchIcon className="h-4 w-4 text-yellow-500" />} 
                                fields={equipmentFields} 
                                register={register} 
                                errors={errors.equipamentos_utilizados} 
                                remove={removeEquipment} 
                                append={() => appendEquipment({ nome: '' })} 
                                placeholder="Ex: Furadeira Bosch..."
                                name="equipamentos_utilizados"
                            />
                        </div>
                    </form>
                </div>
                
                <ResponsiveModalFooter className="p-4 border-t border-gray-800 bg-brand-dark-900 flex-shrink-0 flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending} className="text-sm h-9">Cancelar</Button>
                    <Button type="submit" form="create-task-form" isLoading={mutation.isPending} loadingText="Salvando..." disabled={!isDirty && isEditMode} className="text-sm h-9 px-6">
                        {isEditMode ? 'Salvar Alterações' : 'Emitir Ordem de Serviço'}
                    </Button>
                </ResponsiveModalFooter>
            </ResponsiveModalContent>
        </ResponsiveModal>
    );
};

// UI Components

const InputGroup: React.FC<{ label: React.ReactNode; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
    <div>
        <Label className={error ? "text-red-500" : ""}>{label}</Label>
        <div className="mt-1">{children}</div>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
);

const Combobox: React.FC<{label: string; options: { id: string; name: string }[]; value: string | null | undefined; onChange: (value: string | null) => void; placeholder: string; error?: string; disabled?: boolean;}> = ({ label, options, value, onChange, placeholder, error, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    
    // Reset search when closed
    useEffect(() => { if (!isOpen) setSearch(''); }, [isOpen]);

    const selectedLabel = options.find(o => o.id === value)?.name || placeholder;
    const filteredOptions = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <InputGroup label={label} error={error}>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className={`w-full justify-between font-normal text-left h-auto bg-brand-dark-900 border-gray-700 ${!value ? 'text-gray-400' : 'text-white'}`} disabled={disabled}><span className="truncate">{selectedLabel}</span><ChevronsUpDownIcon className="ml-2 h-4 w-4 text-gray-400 flex-shrink-0" /></Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width] bg-brand-dark-900 border-gray-700">
                    <Command onKeyDown={(e) => {
                        // Prevent form submission on Enter inside combobox
                        if (e.key === 'Enter') e.preventDefault();
                    }}>
                        <CommandInput 
                            placeholder="Buscar..." 
                            value={search} 
                            onInput={(e) => setSearch(e.currentTarget.value)} 
                            className="border-none focus:ring-0"
                        />
                        <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty>Nenhum resultado.</CommandEmpty>
                            <CommandItem className="cursor-pointer" onSelect={() => { onChange(null); setIsOpen(false); }}>-- Nenhum --</CommandItem>
                            {filteredOptions.map(option => (
                                <CommandItem key={option.id} className="cursor-pointer" onSelect={() => { onChange(option.id); setIsOpen(false); }}>{option.name}</CommandItem>
                            ))}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </InputGroup>
    );
};

// Helper component for Currency Input
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

const ResourceSection = ({ title, subtitle, icon, name, fields, register, errors, remove, append, placeholder }: any) => (
    <div className="flex flex-col h-full bg-gray-800/30 rounded-xl border border-gray-700/50 overflow-hidden">
        <div className="p-3 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
            <div>
                <Label className="flex items-center gap-2 text-sm font-semibold text-white">{icon} {title}</Label>
                <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>
            </div>
            <Button 
                type="button" 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0 rounded-full hover:bg-gray-700" 
                onClick={append}
                title="Adicionar Item"
            >
                <PlusIcon className="h-4 w-4 text-brand-blue-400" />
            </Button>
        </div>
        
        <div className="p-3 space-y-2 flex-grow min-h-[100px]">
            {fields.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-500 italic py-4">
                    Nenhum item adicionado.
                </div>
            ) : (
                fields.map((field: any, index: number) => {
                    const itemError = errors?.[index]?.nome;
                    return (
                        <div key={field.id} className="flex items-start gap-2 group">
                            <div className="flex-grow">
                                <Input 
                                    {...register(`${name}.${index}.nome`)} 
                                    placeholder={placeholder} 
                                    className={`bg-brand-dark-900 border-gray-700 h-9 text-sm ${itemError ? "border-red-500 focus:border-red-500" : "focus:border-brand-blue-500"}`}
                                />
                                {itemError && <p className="text-[9px] text-red-500 ml-1 mt-0.5">{itemError.message}</p>}
                            </div>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 flex-shrink-0 text-gray-500 hover:text-red-400 hover:bg-red-500/10" 
                                onClick={() => remove(index)}
                            >
                                <Trash2Icon className="h-4 w-4" />
                            </Button>
                        </div>
                    );
                })
            )}
        </div>
        
        {fields.length > 0 && (
            <div className="p-2 border-t border-gray-700/50 bg-gray-800/30">
                <Button 
                    type="button" 
                    variant="ghost" 
                    className="w-full h-8 text-xs text-gray-400 hover:text-white hover:bg-gray-700/50" 
                    onClick={append}
                >
                    <PlusIcon className="h-3 w-3 mr-2" /> Adicionar Outro
                </Button>
            </div>
        )}
    </div>
);

export default CreateTaskModal;
