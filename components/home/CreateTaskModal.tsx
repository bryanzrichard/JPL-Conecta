import React, { useEffect, useState, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
import { taskSchema, TaskFormValues, createZodResolver } from '../../lib/validators';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { Task, Project, Collaborator, TaskStatus, TaskPriority } from '../../types';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/Popover';
import { Command, CommandInput, CommandEmpty, CommandItem, CommandList } from '../ui/Command';
import { 
  ChevronsUpDownIcon, 
  PlusIcon, 
  Trash2Icon, 
  PackageIcon, 
  WrenchIcon, 
  MapPinIcon, 
  ClipboardListIcon,
  CalendarIcon,
  DollarSignIcon,
  ConstructionIcon,
  UsersIcon,
  CheckCircle2Icon
} from '../../lib/icons';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  projects: Project[];
  collaborators: Collaborator[];
  isLoadingPrerequisites: boolean;
}

const CONSTRUCTION_DISCIPLINES = [
  'Alvenaria', 'Pintura', 'Elétrica', 'Hidráulica', 'Carpintaria', 
  'Serralheria', 'Acabamento', 'Limpeza', 'Estrutura', 'Gesso'
];

const customResolver = createZodResolver(taskSchema);

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ 
  isOpen, 
  onClose, 
  taskToEdit, 
  projects, 
  collaborators, 
  isLoadingPrerequisites 
}) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!taskToEdit;

  const [activeTab, setActiveTab] = useState<'planejamento' | 'almoxarifado'>('planejamento');
  const [discipline, setDiscipline] = useState('');
  const [location, setLocation] = useState('');
  const [responsibleManual, setResponsibleManual] = useState('');

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
      project_id: undefined,
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

  const { 
    register, 
    handleSubmit, 
    reset, 
    control, 
    watch, 
    setValue, 
    formState: { errors, isDirty, isSubmitted, touchedFields } 
  } = useForm<TaskFormValues>({
    resolver: customResolver,
    mode: 'onBlur',
    defaultValues
  });
  
  const { fields: materialFields, append: appendMaterial, remove: removeMaterial } = useFieldArray({ control, name: "materiais_previstos" });
  const { fields: equipmentFields, append: appendEquipment, remove: removeEquipment } = useFieldArray({ control, name: "equipamentos_utilizados" });

  useEffect(() => {
    if (isOpen) {
      setDiscipline('');
      setLocation('');
      setResponsibleManual('');
      setActiveTab('planejamento');
      reset(defaultValues);
    }
  }, [isOpen, defaultValues, reset]);

  const startDate = watch('data_inicio_prevista');
  const endDate = watch('data_fim_prevista');
  const status = watch('status');
  const priority = watch('prioridade');

  // Cálculo da duração estimada em dias
  const estimatedDays = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return days >= 0 ? days : null;
  }, [startDate, endDate]);

  // Atualização automática de status e prioridade baseada nas datas
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T00:00:00`) : null;
    
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
    
    setValue('prioridade', newPriority, { shouldDirty: true });
  }, [startDate, endDate, status, setValue]);

  const mutation = useMutation({
    mutationFn: async (data: TaskFormValues) => {
      if (!user || !profile) throw new Error("Usuário não autenticado.");
      
      let finalDescription = data.description || '';
      const prefix = [];
      if (discipline) prefix.push(`[${discipline}]`);
      if (location) prefix.push(`Local: ${location}`);
      if (responsibleManual) prefix.push(`Resp: ${responsibleManual}`);
      
      if (prefix.length > 0 && !isEditMode) {
        finalDescription = `${prefix.join(' - ')}\n${finalDescription}`;
      }

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
      toast({ title: 'Sucesso!', description: `Ordem de serviço ${isEditMode ? 'atualizada' : 'emitida'} com sucesso.` });
      onClose();
    },
    onError: (error) => {
      const errorMessage = formatApiError(error);
      toast({ variant: 'destructive', title: 'Erro ao Salvar Tarefa', description: errorMessage });
    }
  });

  const onSubmit = (data: TaskFormValues) => {
    mutation.mutate(data);
  };

  const getPriorityBadgeClass = (p: TaskPriority) => {
    switch (p) {
      case 'Alta':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'Média':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    }
  };

  return (
    <ResponsiveModal open={isOpen} onOpenChange={onClose} displayMode="dialog">
      <ResponsiveModalContent size="xl" fullHeight className="max-w-5xl flex flex-col p-0">
        
        {/* Header Consistente */}
        <ResponsiveModalHeader className="px-6 py-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20 flex items-center justify-center text-brand-blue-600 dark:text-brand-blue-400 shrink-0">
                <ClipboardListIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <ResponsiveModalTitle className="text-base font-bold text-gray-900 dark:text-white">
                    {isEditMode ? 'Editar Ordem de Serviço da Obra' : 'Nova Ordem de Serviço / Tarefa'}
                  </ResponsiveModalTitle>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getPriorityBadgeClass(priority)}`}>
                    {status} • Prioridade {priority}
                  </span>
                </div>
                <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Planeje atividades, canteiro, alocação de equipe e requisições de almoxarifado.
                </ResponsiveModalDescription>
              </div>
            </div>

            {/* Abas Superiores de Navegação */}
            <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-brand-dark-950 rounded-xl border border-gray-200 dark:border-gray-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('planejamento')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'planejamento'
                    ? 'bg-white dark:bg-brand-dark-900 text-brand-blue-600 dark:text-brand-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                1. Planejamento & Execução
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('almoxarifado')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === 'almoxarifado'
                    ? 'bg-white dark:bg-brand-dark-900 text-brand-blue-600 dark:text-brand-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <PackageIcon className="h-3.5 w-3.5" />
                2. Almoxarifado ({materialFields.length + equipmentFields.length})
              </button>
            </div>
          </div>
        </ResponsiveModalHeader>
        
        {/* Formulário com Tabbed Views */}
        <form id="create-task-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/60 dark:bg-brand-dark-950/50 space-y-4 custom-scrollbar">
            
            {activeTab === 'planejamento' ? (
              /* ABA 1: Planejamento & Execução */
              <div className="space-y-4">
                
                {/* Bloco Contexto de Canteiro */}
                {!isEditMode && (
                  <div className="bg-white dark:bg-brand-dark-900 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3 shadow-sm">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                      <MapPinIcon className="h-4 w-4 text-brand-blue-500" />
                      <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                        Contexto do Canteiro de Obras
                      </Label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Disciplina / Especialidade</Label>
                        <select 
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-800 bg-white dark:bg-brand-dark-950 p-2 text-xs font-medium text-gray-800 dark:text-gray-200 h-9"
                          value={discipline}
                          onChange={(e) => setDiscipline(e.target.value)}
                        >
                          <option value="">Selecione a especialidade...</option>
                          {CONSTRUCTION_DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>

                      <div>
                        <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Local Específico na Obra</Label>
                        <div className="relative">
                          <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400"/>
                          <Input 
                            className="pl-9 h-9 bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white text-xs" 
                            placeholder="Ex: Apto 302, Fachada Norte, Torre B..." 
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bloco Detalhes da Ordem de Serviço */}
                <div className="bg-white dark:bg-brand-dark-900 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4 shadow-sm">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Título da Atividade <span className="text-red-500">*</span>
                    </Label>
                    <Input 
                      {...register('title')} 
                      placeholder="Ex: Instalação das louças e metais sanitários do 3º pavimento" 
                      className="bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 font-medium h-9 text-xs"
                    />
                    {errors.title && <p className="text-[11px] text-red-500">{errors.title.message}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Controller 
                      name="project_id" 
                      control={control} 
                      render={({ field }) => ( 
                        <Combobox 
                          label={<>Obra / Canteiro <span className="text-red-500">*</span></>} 
                          options={projects} 
                          value={field.value} 
                          onChange={field.onChange} 
                          placeholder="Selecione a obra..." 
                          disabled={isLoadingPrerequisites} 
                          error={errors.project_id?.message as string}
                        /> 
                      )} 
                    />

                    <Controller 
                      name="responsavel_execucao_id" 
                      control={control} 
                      render={({ field }) => ( 
                        <Combobox 
                          label="Responsável Técnico da Equipe" 
                          options={collaborators} 
                          value={field.value} 
                          onChange={field.onChange} 
                          placeholder="Selecione o profissional..." 
                          disabled={isLoadingPrerequisites} 
                          error={errors.responsavel_execucao_id?.message as string}
                        /> 
                      )} 
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Início Previsto
                      </Label>
                      <Input 
                        type="date" 
                        {...register('data_inicio_prevista')} 
                        className="bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 h-9 text-xs" 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Conclusão Prevista
                        </Label>
                        {estimatedDays !== null && (
                          <span className="text-[10px] text-brand-blue-600 dark:text-brand-blue-400 font-semibold">
                            {estimatedDays}d
                          </span>
                        )}
                      </div>
                      <Input 
                        type="date" 
                        {...register('data_fim_prevista')} 
                        className="bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 h-9 text-xs" 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Custo Estimado (R$)
                      </Label>
                      <CurrencyInput 
                        control={control} 
                        name="custo_real" 
                        className="bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 h-9 text-xs" 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Instruções Técnicas e Procedimentos
                    </Label>
                    <Textarea 
                      placeholder="Ex: Verificar nivelamento antes da fixação. Aplicar silicone antimofo nas bordas..." 
                      {...register('description')} 
                      className="min-h-[80px] bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-xs resize-none" 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Observações de Segurança e Canteiro
                    </Label>
                    <Textarea 
                      placeholder="EPIs obrigatórios para a atividade, isolamento de área..." 
                      {...register('observacoes')} 
                      className="min-h-[60px] bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-xs resize-none" 
                    />
                  </div>

                  {/* Hidden Status e Prioridade (calculados automaticamente) */}
                  <input type="hidden" {...register('status')} />
                  <input type="hidden" {...register('prioridade')} />
                </div>

              </div>
            ) : (
              /* ABA 2: Almoxarifado & Equipamentos */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Requisição de Materiais */}
                <ResourceCard 
                  title="Materiais e Insumos" 
                  subtitle="Requisição para o Almoxarifado"
                  icon={<PackageIcon className="h-4 w-4 text-brand-blue-500" />} 
                  fields={materialFields} 
                  register={register} 
                  errors={errors.materiais_previstos} 
                  remove={removeMaterial} 
                  append={() => appendMaterial({ nome: '' })} 
                  placeholder="Ex: 5 sacos de argamassa AC-III, 2 rolos fita veda rosca..."
                  name="materiais_previstos"
                />
                
                {/* Ferramentas e Equipamentos */}
                <ResourceCard 
                  title="Ferramentas e Cautela" 
                  subtitle="Patrimônio e Maquinário"
                  icon={<WrenchIcon className="h-4 w-4 text-amber-500" />} 
                  fields={equipmentFields} 
                  register={register} 
                  errors={errors.equipamentos_utilizados} 
                  remove={removeEquipment} 
                  append={() => appendEquipment({ nome: '' })} 
                  placeholder="Ex: Furadeira de impacto Bosch, Andaime tubular..."
                  name="equipamentos_utilizados"
                />

              </div>
            )}

          </div>
          
          {/* Footer Fixo */}
          <ResponsiveModalFooter className="px-6 py-4 flex-shrink-0 flex items-center justify-between border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900">
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-2.5 py-1 rounded-full font-semibold border ${getPriorityBadgeClass(priority)}`}>
                {status} • Prioridade {priority}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                disabled={mutation.isPending} 
                className="text-xs h-9 px-4 font-semibold"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                form="create-task-form" 
                isLoading={mutation.isPending} 
                loadingText="Salvando..." 
                disabled={!isDirty && isEditMode} 
                className="text-xs h-9 px-6 font-bold uppercase tracking-wider bg-brand-blue-600 hover:bg-brand-blue-500 text-white"
              >
                {isEditMode ? 'Salvar Alterações' : 'Emitir Ordem de Serviço'}
              </Button>
            </div>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

const ResourceCard: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  fields: any[];
  register: any;
  errors: any;
  remove: (index: number) => void;
  append: () => void;
  placeholder: string;
  name: string;
}> = ({ title, subtitle, icon, fields, register, errors, remove, append, placeholder, name }) => (
  <div className="bg-white dark:bg-brand-dark-900 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3 shadow-sm flex flex-col h-full">
    <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
            {title}
          </h4>
          <p className="text-[10px] text-gray-500">{subtitle}</p>
        </div>
      </div>
      <Button 
        type="button" 
        size="sm" 
        variant="secondary"
        onClick={append} 
        className="h-7 text-xs font-semibold gap-1 px-2.5"
      >
        <PlusIcon className="h-3 w-3" /> Adicionar
      </Button>
    </div>

    <div className="flex-1 space-y-2 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
      {fields.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
          <p className="text-xs text-gray-400">Nenhum item adicionado a esta requisição.</p>
        </div>
      ) : (
        fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input 
              {...register(`${name}.${index}.nome` as const)} 
              placeholder={placeholder} 
              className="h-8 text-xs bg-gray-50/50 dark:bg-brand-dark-950 border-gray-200 dark:border-gray-800 flex-1" 
            />
            <button
              type="button"
              onClick={() => remove(index)}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
              title="Remover linha"
            >
              <Trash2Icon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))
      )}
    </div>
  </div>
);

const Combobox: React.FC<{
  label: React.ReactNode; 
  options: { id: string; name: string }[]; 
  value?: string | null; 
  onChange: (value: string) => void; 
  placeholder: string; 
  disabled?: boolean;
  error?: string;
}> = ({ label, options, value, onChange, placeholder, disabled, error }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  useEffect(() => { if (!isOpen) setSearch(''); }, [isOpen]);

  const selectedLabel = options.find(o => o.id === value)?.name || placeholder;
  const filteredOptions = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-1.5">
      <Label className={`text-xs font-medium ${error ? "text-red-500" : "text-gray-700 dark:text-gray-300"}`}>{label}</Label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            type="button" 
            variant="outline" 
            disabled={disabled}
            className={`w-full justify-between font-normal text-left h-9 px-3 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 ${!value ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronsUpDownIcon className="ml-2 h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900 shadow-xl">
          <Command onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}>
            <CommandInput placeholder="Buscar..." value={search} onInput={(e) => setSearch(e.currentTarget.value)} className="border-none focus:ring-0 h-9 text-xs" />
            <CommandList className="max-h-[220px] overflow-y-auto custom-scrollbar">
              <CommandEmpty className="py-3 text-center text-xs text-gray-400">Nenhum resultado encontrado.</CommandEmpty>
              {filteredOptions.map(option => (
                <CommandItem 
                  key={option.id} 
                  className="cursor-pointer aria-selected:bg-brand-blue-500/10 aria-selected:text-brand-blue-600 dark:aria-selected:text-brand-blue-400 text-xs py-2 px-3" 
                  onSelect={() => { onChange(option.id); setIsOpen(false); }}
                >
                  {option.name}
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

export default CreateTaskModal;
