
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { Task, Project, Collaborator, TaskStatus, TASK_STATUSES } from '../types';
import { Button } from '../components/ui/Button';
import { PlusIcon, LayoutIcon, FilterIcon, ClipboardListIcon, AlertTriangleIcon, DollarSignIcon, MoreVerticalIcon, EditIcon, Trash2Icon, ConstructionIcon, UserIcon, CalendarIcon } from '../lib/icons';
import TaskCard from '../components/home/TaskCard';
import CreateTaskModal from '../components/home/CreateTaskModal';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalFooter } from '../components/ui/ResponsiveModal';
import { Label } from '../components/ui/Label';
import { Popover, PopoverTrigger, PopoverContent } from '../components/ui/Popover';
import { Command, CommandInput, CommandEmpty, CommandItem, CommandList } from '../components/ui/Command';
import { ChevronsUpDownIcon } from '../lib/icons';
import { useToast } from '../contexts/ToastContext';
import ConfirmationModal from '../components/historico/ConfirmationModal';
import { formatApiError } from '../lib/handleError';
import { Skeleton } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/DropdownMenu';

// Filter State Type
type TaskFilters = {
    projectId: string | null;
    collaboratorId: string | null;
    priority: string | null;
};

// Fetch function
const fetchAllActiveTasks = async (companyId: string) => {
    // Explicitly select columns to ensure data integrity
    const { data, error } = await supabase
        .from('tasks')
        .select(`
            id,
            title,
            description,
            project_id,
            company_id,
            data_inicio_prevista,
            data_fim_prevista,
            status,
            prioridade,
            responsavel_execucao_id,
            created_by,
            materiais_previstos,
            equipamentos_utilizados,
            observacoes,
            custo_real,
            created_at,
            projects(name),
            collaborators:responsavel_execucao_id(name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
    
    if (error) throw new Error(error.message);
    return data as unknown as Task[];
};

// Prerequisites fetcher
const fetchPrerequisites = async (companyId: string) => {
    const [projectsRes, collaboratorsRes] = await Promise.all([
        supabase.from('projects').select('id, name').eq('company_id', companyId).order('name'),
        supabase.from('collaborators').select('id, name').eq('company_id', companyId).order('name')
    ]);
    return {
        projects: (projectsRes.data as unknown as Project[]) || [],
        collaborators: (collaboratorsRes.data as unknown as Collaborator[]) || []
    };
};

const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString('pt-BR');
};

const Tarefas: React.FC = () => {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();

    // State
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    const [filters, setFilters] = useState<TaskFilters>({ projectId: null, collaboratorId: null, priority: null });
    const [tempFilters, setTempFilters] = useState<TaskFilters>(filters);
    const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

    useEffect(() => {
        if (location.state?.action === 'newTask') {
            setCreateModalOpen(true);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate]);

    // Queries
    const { data: tasks, isLoading: isLoadingTasks } = useQuery({
        queryKey: ['tasks', profile?.company_id],
        queryFn: () => fetchAllActiveTasks(profile!.company_id!),
        enabled: !!profile?.company_id,
    });

    const { data: prerequisites, isLoading: isLoadingPrerequisites } = useQuery({
        queryKey: ['taskPrerequisites', profile?.company_id],
        queryFn: () => fetchPrerequisites(profile!.company_id!),
        enabled: !!profile?.company_id,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    // Mutations
    const deleteTaskMutation = useMutation({
        mutationFn: async (taskId: string) => {
            const { error } = await supabase.from('tasks').delete().eq('id', taskId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Sucesso', description: 'Tarefa excluída com sucesso.' });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
        onError: (err) => {
            toast({ variant: 'destructive', title: 'Erro!', description: formatApiError(err) });
        },
        onSettled: () => setTaskToDelete(null)
    });

    // Filtering Logic
    const filteredTasks = useMemo(() => {
        if (!tasks) return [];
        return tasks.filter(task => {
            if (filters.projectId && task.project_id !== filters.projectId) return false;
            if (filters.collaboratorId && task.responsavel_execucao_id !== filters.collaboratorId) return false;
            if (filters.priority && task.prioridade !== filters.priority) return false;
            return true;
        });
    }, [tasks, filters]);

    // KPIs
    const kpis = useMemo(() => {
        const total = filteredTasks.length;
        const delayed = filteredTasks.filter(t => t.status === 'Atrasada').length;
        const totalCost = filteredTasks.reduce((acc, t) => acc + (t.custo_real || 0), 0);
        return { total, delayed, totalCost };
    }, [filteredTasks]);

    // Handlers
    const handleApplyFilters = () => {
        setFilters(tempFilters);
        setIsFilterSheetOpen(false);
    };

    const handleClearFilters = () => {
        const cleared = { projectId: null, collaboratorId: null, priority: null };
        setTempFilters(cleared);
        setFilters(cleared);
        setIsFilterSheetOpen(false);
    };

    const handleEditTask = (task: Task) => {
        setTaskToEdit(task);
        setCreateModalOpen(true);
    };

    const handleDeleteTask = (task: Task) => {
        setTaskToDelete(task);
    }

    const priorityClasses = {
        'Alta': 'bg-red-500/20 text-red-400 border-red-500/30',
        'Média': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        'Baixa': 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    };
    
    const statusClasses = {
        'Planejada': 'bg-gray-500/20 text-gray-300 border-gray-500/30',
        'Em Execução': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'Concluída': 'bg-green-500/20 text-green-400 border-green-500/30',
        'Atrasada': 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <LayoutIcon className="h-8 w-8 text-brand-blue-500" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gerenciador de Tarefas</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Visualize e mova suas tarefas.</p>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsFilterSheetOpen(true)}>
                        <FilterIcon className="h-4 w-4 mr-2"/> Filtros
                    </Button>
                    <ResponsiveModal open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                        <ResponsiveModalContent className="w-full sm:max-w-md bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
                            <ResponsiveModalHeader className="px-5 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-brand-blue-500/10 rounded-lg">
                                        <FilterIcon className="h-5 w-5 text-brand-blue-500" />
                                    </div>
                                    <div>
                                        <ResponsiveModalTitle className="text-gray-900 dark:text-white text-lg">Filtrar Tarefas</ResponsiveModalTitle>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Refine a lista de tarefas</p>
                                    </div>
                                </div>
                            </ResponsiveModalHeader>
                            <div className="p-5 space-y-5 flex-grow overflow-y-auto custom-scrollbar bg-brand-dark-950/50">
                                <FilterCombobox label="Obra" options={prerequisites?.projects || []} selectedValue={tempFilters.projectId} onSelect={id => setTempFilters(p => ({...p, projectId: id}))} />
                                <FilterCombobox label="Responsável" options={prerequisites?.collaborators || []} selectedValue={tempFilters.collaboratorId} onSelect={id => setTempFilters(p => ({...p, collaboratorId: id}))} />
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-gray-300">Prioridade</Label>
                                    <select 
                                        className="w-full rounded-lg border border-gray-800 bg-brand-dark-950 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-blue-500/50"
                                        value={tempFilters.priority || ''}
                                        onChange={(e) => setTempFilters(p => ({...p, priority: e.target.value || null}))}
                                    >
                                        <option value="">Todas</option>
                                        <option value="Alta">Alta</option>
                                        <option value="Média">Média</option>
                                        <option value="Baixa">Baixa</option>
                                    </select>
                                </div>
                            </div>
                            <ResponsiveModalFooter className="p-4 border-t border-gray-800 bg-brand-dark-900 flex-shrink-0 flex justify-end items-center gap-3">
                                <Button variant="ghost" onClick={handleClearFilters} className="h-9 px-4 text-gray-400 hover:text-white hover:bg-brand-dark-800">Limpar</Button>
                                <Button onClick={handleApplyFilters} className="h-9 px-6 bg-brand-blue-600 hover:bg-brand-blue-500 text-white">Aplicar Filtros</Button>
                            </ResponsiveModalFooter>
                        </ResponsiveModalContent>
                    </ResponsiveModal>
                    <Button onClick={() => { setTaskToEdit(null); setCreateModalOpen(true); }} className="w-full sm:w-auto">
                        <PlusIcon className="h-4 w-4 mr-2"/> Nova Tarefa
                    </Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-brand-dark-900 p-4 rounded-xl flex items-center gap-3 border border-gray-800 shadow-sm">
                    <div className="p-2 bg-blue-500/10 rounded-full"><ClipboardListIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
                    <div><p className="text-xs text-gray-500 dark:text-gray-400">Total de Tarefas</p><p className="text-xl font-bold text-gray-900 dark:text-white">{kpis.total}</p></div>
                </div>
                <div className="bg-brand-dark-900 p-4 rounded-xl flex items-center gap-3 border border-red-900/30 shadow-sm">
                    <div className="p-2 bg-red-500/10 rounded-full"><AlertTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400" /></div>
                    <div><p className="text-xs text-gray-500 dark:text-gray-400">Atrasadas</p><p className="text-xl font-bold text-red-600 dark:text-red-400">{kpis.delayed}</p></div>
                </div>
                <div className="bg-brand-dark-900 p-4 rounded-xl flex items-center gap-3 border border-gray-800 shadow-sm">
                    <div className="p-2 bg-green-500/10 rounded-full"><DollarSignIcon className="h-5 w-5 text-green-600 dark:text-green-400" /></div>
                    <div><p className="text-xs text-gray-500 dark:text-gray-400">Custo Acumulado</p><p className="text-xl font-bold text-green-600 dark:text-green-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.totalCost)}</p></div>
                </div>
            </div>

            {/* Mobile View: List of Cards */}
            <div className="md:hidden space-y-4 pb-4">
                {isLoadingTasks ? (
                    Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
                ) : filteredTasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-brand-dark-900 rounded-xl border border-dashed border-gray-800 shadow-sm">
                        <p>Nenhuma tarefa encontrada.</p>
                    </div>
                ) : (
                    filteredTasks.map(task => (
                        <TaskCard key={task.id} task={task} onEdit={handleEditTask} onDelete={handleDeleteTask} />
                    ))
                )}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-gray-800 bg-brand-dark-900 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 border-b border-gray-800">
                            <tr>
                                <th className="px-6 py-4 font-medium">Status / Prioridade</th>
                                <th className="px-6 py-4 font-medium">Título</th>
                                <th className="px-6 py-4 font-medium">Obra / Responsável</th>
                                <th className="px-6 py-4 font-medium">Prazo</th>
                                <th className="px-6 py-4 font-medium text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {isLoadingTasks ? (
                                Array.from({length: 5}).map((_, i) => (
                                    <tr key={i}><td colSpan={5} className="p-4"><Skeleton className="h-8 w-full" /></td></tr>
                                ))
                            ) : filteredTasks.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        Nenhuma tarefa encontrada com os filtros atuais.
                                    </td>
                                </tr>
                            ) : (
                                filteredTasks.map((task) => (
                                    <tr 
                                        key={task.id} 
                                        className="hover:bg-gray-800/30 transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col gap-2 items-start">
                                                <Badge variant="outline" className={statusClasses[task.status]}>{task.status}</Badge>
                                                {task.prioridade && <Badge variant="outline" className={`${priorityClasses[task.prioridade]} text-[10px]`}>{task.prioridade}</Badge>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <p className="font-bold text-gray-900 dark:text-white max-w-sm truncate" title={task.title}>{task.title}</p>
                                                {task.description && <p className="text-xs text-gray-500 truncate max-w-sm">{task.description}</p>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <ConstructionIcon className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                                    <span className="text-gray-700 dark:text-gray-300">{task.projects?.name || '-'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <UserIcon className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                                    <span className="text-gray-500 dark:text-gray-400 text-xs">{task.collaborators?.name || '-'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs">
                                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                                <CalendarIcon className="h-3 w-3" />
                                                {/* Fallback to simple text if structured date is missing */}
                                                <span>{formatDate(task.data_inicio_prevista)} - {formatDate(task.data_fim_prevista)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button 
                                                        variant="outline" 
                                                        size="icon" 
                                                        className="h-8 w-8 border-gray-700 hover:bg-gray-700"
                                                    >
                                                        <MoreVerticalIcon className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onSelect={() => handleEditTask(task)}>
                                                        <EditIcon className="h-4 w-4 mr-2" /> Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => handleDeleteTask(task)} className="text-red-500 focus:text-red-500">
                                                        <Trash2Icon className="h-4 w-4 mr-2" /> Excluir
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {isCreateModalOpen && (
                <CreateTaskModal 
                    isOpen={isCreateModalOpen}
                    onClose={() => setCreateModalOpen(false)}
                    taskToEdit={taskToEdit}
                    projects={prerequisites?.projects || []}
                    collaborators={prerequisites?.collaborators || []}
                    isLoadingPrerequisites={isLoadingPrerequisites}
                />
            )}
            <ConfirmationModal
                isOpen={!!taskToDelete}
                onClose={() => setTaskToDelete(null)}
                onConfirm={() => taskToDelete && deleteTaskMutation.mutate(taskToDelete.id)}
                title="Excluir Tarefa"
                description={`Tem certeza que deseja excluir "${taskToDelete?.title}"?`}
                isLoading={deleteTaskMutation.isPending}
            />
        </div>
    );
};

const FilterCombobox: React.FC<{
    label: string;
    options: { id: string; name: string }[];
    selectedValue: string | null;
    onSelect: (id: string | null) => void;
}> = ({ label, options, selectedValue, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const selectedLabel = options.find(o => o.id === selectedValue)?.name || `Todos`;
    const filteredOptions = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-1">
            <Label>{label}</Label>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between font-normal text-left h-auto border-gray-200 dark:border-gray-700">
                        <span className="truncate">{selectedLabel}</span>
                        <ChevronsUpDownIcon className="ml-2 h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[200px]">
                    <Command>
                        <CommandInput placeholder="Buscar..." value={search} onInput={(e) => setSearch(e.currentTarget.value)} />
                        <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty>Nenhum resultado.</CommandEmpty>
                            <CommandItem className="cursor-pointer" onSelect={() => { onSelect(null); setIsOpen(false); }}>-- Todos --</CommandItem>
                            {filteredOptions.map(option => (<CommandItem key={option.id} className="cursor-pointer" onSelect={() => { onSelect(option.id); setIsOpen(false); }}>{option.name}</CommandItem>))}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
};

export default Tarefas;
