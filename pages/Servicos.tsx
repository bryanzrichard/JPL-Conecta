import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { ServiceWithDetails, AdvanceWithDetails, Collaborator, Project, SERVICE_STATUSES } from '../types';
import { formatCurrency, formatDateBR as formatDate } from '../lib/utils';
import { Card, CardHeader, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../components/ui/ResponsiveModal';
import { Popover, PopoverTrigger, PopoverContent } from '../components/ui/Popover';
import { Command, CommandInput, CommandEmpty, CommandItem, CommandList } from '../components/ui/Command';
import {
    BriefcaseIcon, PlusIcon, DollarSignIcon, TrendingUpIcon, FilterIcon,
    UserIcon, ConstructionIcon, CalendarIcon, ChevronsUpDownIcon,
    MoreVerticalIcon, XIcon, EditIcon
} from '../lib/icons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/DropdownMenu';

const ServiceModal = lazy(() => import('../components/servicos/ServiceModal'));
const AdvanceModal = lazy(() => import('../components/servicos/AdvanceModal'));
const EditarServicoModal = lazy(() => import('../components/servicos/EditarServicoModal'));
const EditarAdiantamentoModal = lazy(() => import('../components/servicos/EditarAdiantamentoModal'));

type Filters = {
    collaboratorId: string | null;
    projectId: string | null;
    startDate: Date | null;
    endDate: Date | null;
};

const QUICK_PERIOD_SHORTCUTS = [
    { label: 'Hoje', daysAgo: 0 },
    { label: 'Últimos 7 dias', daysAgo: 7 },
    { label: 'Este Mês', isCurrentMonth: true },
    { label: 'Últimos 90 dias', daysAgo: 90 },
];

const Servicos: React.FC = () => {
    const { profile } = useAuth();

    const [services, setServices] = useState<ServiceWithDetails[]>([]);
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);

    const [loading, setLoading] = useState(true);
    
    // Main filter state
    const [filters, setFilters] = useState<Filters>({ collaboratorId: null, projectId: null, startDate: null, endDate: null });
    // Temporary state for the filter sheet
    const [tempFilters, setTempFilters] = useState<Filters>(filters);
    const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

    // Active filters count
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (filters.collaboratorId) count++;
        if (filters.projectId) count++;
        if (filters.startDate || filters.endDate) count++;
        return count;
    }, [filters]);

    // Popover and search states for filters
    const [collaboratorSearch, setCollaboratorSearch] = useState("");
    const [projectSearch, setProjectSearch] = useState("");
    const [isCollaboratorPopoverOpen, setCollaboratorPopoverOpen] = useState(false);
    const [isProjectPopoverOpen, setProjectPopoverOpen] = useState(false);
    
    const [selectedService, setSelectedService] = useState<ServiceWithDetails | null>(null);
    const [selectedAdvance, setSelectedAdvance] = useState<AdvanceWithDetails | null>(null);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isEditServiceModalOpen, setEditServiceModalOpen] = useState(false);
    const [isAdvanceModalOpen, setAdvanceModalOpen] = useState(false);
    const [isEditAdvanceModalOpen, setEditAdvanceModalOpen] = useState(false);
    const requestIdRef = useRef(0);
    const handledIdRef = useRef<string | null>(null);
    const location = useLocation();
    const navigate = useNavigate();

    // Interceptar ?editar={id} ou ?editarAdiantamento={id} para abrir modal automaticamente sem loop
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const editServiceId = searchParams.get('editar') || (location.state as any)?.editId;
        const editAdvanceId = searchParams.get('editarAdiantamento') || (location.state as any)?.editAdvanceId;
        const targetId = editServiceId || editAdvanceId;

        if (!targetId || !profile?.company_id) return;
        if (handledIdRef.current === targetId) return;

        handledIdRef.current = targetId;

        // Limpar parâmetros da URL imediatamente para evitar reabertura involuntária ao fechar ou re-renderizar
        navigate(location.pathname, { replace: true, state: {} });

        let isCurrent = true;

        const loadTargetForDisplay = async () => {
            if (editServiceId) {
                // 1. Procurar nos serviços já carregados na página
                const found = services.find(s => s.id === editServiceId);
                if (found && isCurrent) {
                    setSelectedService(found);
                    setEditServiceModalOpen(true);
                    return;
                }

                // 2. Buscar detalhes completos do serviço via RPC fn_get_services_with_details
                try {
                    const { data } = await supabase.rpc('fn_get_services_with_details', {
                        p_company_id: profile.company_id,
                    });
                    if (data && isCurrent) {
                        const matched = (data as ServiceWithDetails[]).find(s => s.id === editServiceId);
                        if (matched) {
                            setSelectedService(matched);
                            setEditServiceModalOpen(true);
                        }
                    }
                } catch (err) {
                    console.error('Erro ao abrir serviço para edição:', err);
                }
            } else if (editAdvanceId) {
                // Buscar adiantamento e formatar para o modal de edição de adiantamento
                try {
                    const { data: advData } = await supabase
                        .from('adiantamentos')
                        .select('*, servicos(description, collaborator_id, project_id, collaborators(name), projects(name))')
                        .eq('id', editAdvanceId)
                        .maybeSingle();

                    if (advData && isCurrent) {
                        const formattedAdv: AdvanceWithDetails = {
                            ...advData,
                            service_description: advData.servicos?.description || 'Serviço',
                            collaborator_name: advData.servicos?.collaborators?.name || null,
                            project_name: advData.servicos?.projects?.name || null,
                        };
                        setSelectedAdvance(formattedAdv);
                        setEditAdvanceModalOpen(true);
                    }
                } catch (err) {
                    console.error('Erro ao abrir adiantamento para edição:', err);
                }
            }
        };

        loadTargetForDisplay();

        return () => {
            isCurrent = false;
        };
    }, [location.search, location.state, profile?.company_id, navigate]);

    const applyQuickPeriod = (shortcut: typeof QUICK_PERIOD_SHORTCUTS[number]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (shortcut.isCurrentMonth) {
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            setTempFilters(f => ({
                ...f,
                startDate: startOfMonth,
                endDate: today,
            }));
            return;
        }

        if (shortcut.daysAgo === 0) {
            setTempFilters(f => ({
                ...f,
                startDate: today,
                endDate: today,
            }));
            return;
        }

        const pastDate = new Date(Date.now() - shortcut.daysAgo * 86400000);
        pastDate.setHours(0, 0, 0, 0);
        setTempFilters(f => ({
            ...f,
            startDate: pastDate,
            endDate: today,
        }));
    };

    const clearDates = () => {
        setTempFilters(f => ({
            ...f,
            startDate: null,
            endDate: null,
        }));
    };

    const fetchServices = useCallback(async (currentFilters: Filters) => {
        if (!profile?.company_id) return;
        const currentRequestId = ++requestIdRef.current;
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('fn_get_services_with_details', {
                p_company_id: profile.company_id,
                p_collaborator_id: currentFilters.collaboratorId,
                p_project_id: currentFilters.projectId,
                p_start_date: currentFilters.startDate?.toISOString(),
                p_end_date: currentFilters.endDate?.toISOString(),
            });
            if (error) throw error;
            if (currentRequestId === requestIdRef.current) {
                setServices(data || []);
            }
        } catch (err) {
            console.error("Error fetching services:", err);
        } finally {
            if (currentRequestId === requestIdRef.current) {
                setLoading(false);
            }
        }
    }, [profile?.company_id]);

    const fetchDropdownData = useCallback(async () => {
        if (!profile?.company_id) return;
        try {
            const [collaboratorsRes, projectsRes] = await Promise.all([
                (supabase as any).from('collaborators').select('id, name').eq('company_id', profile.company_id).order('name'),
                (supabase as any).from('projects').select('id, name').eq('company_id', profile.company_id).order('name')
            ]);
            if (collaboratorsRes.error) throw collaboratorsRes.error;
            if (projectsRes.error) throw projectsRes.error;
            setCollaborators(collaboratorsRes.data || []);
            setProjects(projectsRes.data || []);
        } catch (error) {
            console.error("Error fetching collaborators/projects:", error);
        }
    }, [profile?.company_id]);
    
    useEffect(() => {
        fetchServices(filters);
        fetchDropdownData();
    }, [fetchServices, fetchDropdownData, filters]);

    const processedServices = useMemo(() => {
        return services
            .filter(s => s.status === 'Em Andamento')
            .sort((a, b) => {
                return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
            });
    }, [services]);

    const summary = useMemo(() => {
        return processedServices.reduce((acc, service) => {
            acc.totalValue += Number(service.total_value) || 0;
            acc.remainingValue += Number(service.remaining_value) || 0;
            return acc;
        }, { totalValue: 0, remainingValue: 0, count: processedServices.length });
    }, [processedServices]);
    
    const handleApplyFilters = () => {
        setFilters(tempFilters);
    };

    const handleClearFilters = () => {
        const initialFilters = { collaboratorId: null, projectId: null, startDate: null, endDate: null };
        setTempFilters(initialFilters);
        setFilters(initialFilters); // Apply clearing immediately
    };
    
    const filteredCollaboratorsForSearch = useMemo(() => 
        collaborators.filter(c => c.name.toLowerCase().includes(collaboratorSearch.toLowerCase()))
    , [collaborators, collaboratorSearch]);
    
    const filteredProjectsForSearch = useMemo(() =>
        projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
    , [projects, projectSearch]);

    const handleCreateNewService = () => {
        setSelectedService(null);
        setCreateModalOpen(true);
    };

    const handleOpenEditServiceModal = (service: ServiceWithDetails) => {
        setSelectedService(service);
        setEditServiceModalOpen(true);
    };
    
    const handleOpenAdvanceModal = (service: ServiceWithDetails) => {
        setSelectedService(service);
        setAdvanceModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <PageHeader
                icon={BriefcaseIcon}
                title="Serviços"
                description="Gerencie seus serviços e pagamentos."
                actions={
                    <Button onClick={handleCreateNewService}>
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Novo Serviço
                    </Button>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Valor Total */}
                <div className="bg-white dark:bg-brand-dark-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-4">
                    <div className="flex-shrink-0 p-2.5 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20">
                        <DollarSignIcon className="h-5 w-5 text-brand-blue-500" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Valor Total (Em Andamento)</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white truncate">{formatCurrency(summary.totalValue)}</p>
                    </div>
                </div>

                {/* Falta Pagar */}
                <div className="bg-white dark:bg-brand-dark-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-4">
                    <div className="flex-shrink-0 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <TrendingUpIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Falta Pagar (Em Andamento)</p>
                        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 truncate">{formatCurrency(summary.remainingValue)}</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                 <p className="text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-bold text-gray-900 dark:text-white">{summary.count}</span> {summary.count === 1 ? 'serviço em andamento' : 'serviços em andamento'}
                </p>
                <Button
                    variant="outline"
                    onClick={() => { setTempFilters(filters); setIsFilterSheetOpen(true); }}
                    className="relative h-9 px-3.5 text-sm font-medium border-gray-300 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:text-brand-blue-600 dark:hover:text-brand-blue-400 hover:border-brand-blue-500/50 hover:bg-brand-blue-50/50 dark:hover:bg-brand-blue-500/10 transition-colors"
                >
                    <FilterIcon className="h-4 w-4 mr-2 text-brand-blue-500" />
                    <span>Filtrar Serviços</span>
                    {activeFiltersCount > 0 && (
                        <span className="ml-2 flex items-center justify-center h-5 min-w-[20px] px-1 text-[11px] font-bold rounded-full bg-brand-blue-600 text-white shadow-sm">
                            {activeFiltersCount}
                        </span>
                    )}
                </Button>
            </div>

            {/* Active Filters Bar */}
            {activeFiltersCount > 0 && (
                <div className="flex items-center justify-between gap-3 bg-brand-blue-50/50 dark:bg-brand-blue-950/30 border border-brand-blue-200 dark:border-brand-blue-900/50 px-4 py-2.5 rounded-xl">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-semibold text-brand-blue-700 dark:text-brand-blue-300 flex items-center gap-1.5">
                            <FilterIcon className="h-3.5 w-3.5" /> Filtros ativos ({activeFiltersCount}):
                        </span>
                        {filters.collaboratorId && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                                Colaborador: {collaborators.find(c => c.id === filters.collaboratorId)?.name}
                            </span>
                        )}
                        {filters.projectId && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                                Obra: {projects.find(p => p.id === filters.projectId)?.name}
                            </span>
                        )}
                        {(filters.startDate || filters.endDate) && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                                Período: {filters.startDate ? filters.startDate.toLocaleDateString('pt-BR') : 'Início'} até {filters.endDate ? filters.endDate.toLocaleDateString('pt-BR') : 'Hoje'}
                            </span>
                        )}
                    </div>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => { handleClearFilters(); setIsFilterSheetOpen(false); }}
                        className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:underline h-7 px-2"
                    >
                        Limpar todos
                    </Button>
                </div>
            )}

            <ResponsiveModal open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen} displayMode="drawer">
                <ResponsiveModalContent size="sm">
                    <ResponsiveModalHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand-blue-500/10 rounded-lg border border-brand-blue-500/20">
                                <FilterIcon className="h-5 w-5 text-brand-blue-500" />
                            </div>
                            <div>
                                <ResponsiveModalTitle>Filtrar Serviços</ResponsiveModalTitle>
                                <ResponsiveModalDescription>Refine a lista por colaborador, obra ou período</ResponsiveModalDescription>
                            </div>
                        </div>
                    </ResponsiveModalHeader>
                    <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-4 bg-gray-50/50 dark:bg-brand-dark-950/50">
                        {/* Atalhos Rápidos de Período */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                    <CalendarIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                                    Atalhos de Período
                                </Label>
                                {(tempFilters.startDate || tempFilters.endDate) && (
                                    <button
                                        type="button"
                                        onClick={clearDates}
                                        className="text-[11px] text-red-500 hover:underline flex items-center gap-0.5 font-medium"
                                    >
                                        <XIcon className="h-3 w-3" /> Limpar datas
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {QUICK_PERIOD_SHORTCUTS.map(shortcut => (
                                    <Button
                                        key={shortcut.label}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => applyQuickPeriod(shortcut)}
                                        className="h-8 text-xs font-medium bg-white dark:bg-brand-dark-900 border-gray-200 dark:border-gray-800 hover:border-brand-blue-500 hover:text-brand-blue-500 justify-center"
                                    >
                                        {shortcut.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Obra Filter */}
                        <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                <ConstructionIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                                Obra / Projeto
                            </Label>
                            <Popover open={isProjectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between font-normal text-left h-9 px-3 text-sm bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white">
                                         <span className="truncate">
                                            {tempFilters.projectId
                                                ? projects.find(p => p.id === tempFilters.projectId)?.name
                                                : "Todas as obras"}
                                        </span>
                                        <ChevronsUpDownIcon className="ml-2 h-4 w-4 text-gray-400 flex-shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                                    <Command>
                                        <CommandInput placeholder="Buscar obra..." value={projectSearch} onInput={(e) => setProjectSearch(e.currentTarget.value)} />
                                        <CommandList className="max-h-[200px] overflow-y-auto">
                                            <CommandEmpty>Nenhuma obra encontrada.</CommandEmpty>
                                             <CommandItem className="cursor-pointer" onSelect={() => {
                                                setTempFilters(f => ({ ...f, projectId: null }));
                                                setProjectPopoverOpen(false);
                                            }}>
                                                -- Todas --
                                            </CommandItem>
                                            {filteredProjectsForSearch.map(p => (
                                                <CommandItem key={p.id} className="cursor-pointer" onSelect={() => {
                                                    setTempFilters(f => ({ ...f, projectId: p.id }));
                                                    setProjectPopoverOpen(false);
                                                }}>
                                                    {p.name}
                                                </CommandItem>
                                            ))}
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Collaborator Filter */}
                        <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                <UserIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                                Colaborador
                            </Label>
                            <Popover open={isCollaboratorPopoverOpen} onOpenChange={setCollaboratorPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between font-normal text-left h-9 px-3 text-sm bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white">
                                        <span className="truncate">
                                            {tempFilters.collaboratorId
                                                ? collaborators.find(c => c.id === tempFilters.collaboratorId)?.name
                                                : "Todos os colaboradores"}
                                        </span>
                                        <ChevronsUpDownIcon className="ml-2 h-4 w-4 text-gray-400 flex-shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                                    <Command>
                                        <CommandInput placeholder="Buscar colaborador..." value={collaboratorSearch} onInput={(e) => setCollaboratorSearch(e.currentTarget.value)} />
                                        <CommandList className="max-h-[200px] overflow-y-auto">
                                            <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                                            <CommandItem className="cursor-pointer" onSelect={() => {
                                                setTempFilters(f => ({ ...f, collaboratorId: null }));
                                                setCollaboratorPopoverOpen(false);
                                            }}>
                                                -- Todos --
                                            </CommandItem>
                                            {filteredCollaboratorsForSearch.map(c => (
                                                <CommandItem key={c.id} className="cursor-pointer" onSelect={() => {
                                                    setTempFilters(f => ({ ...f, collaboratorId: c.id }));
                                                    setCollaboratorPopoverOpen(false);
                                                }}>
                                                    {c.name}
                                                </CommandItem>
                                            ))}
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                         {/* Date Filter */}
                        <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                <CalendarIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                                Intervalo de Datas
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label htmlFor="start_date" className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold tracking-wider">Início</Label>
                                    <Input
                                        id="start_date"
                                        type="date"
                                        className="h-9 text-xs"
                                        value={tempFilters.startDate ? tempFilters.startDate.toISOString().split('T')[0] : ''}
                                        onChange={e => setTempFilters(f => ({...f, startDate: e.target.value ? new Date(e.target.value + 'T00:00:00') : null}))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="end_date" className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold tracking-wider">Fim</Label>
                                    <Input
                                        id="end_date"
                                        type="date"
                                        className="h-9 text-xs"
                                        value={tempFilters.endDate ? tempFilters.endDate.toISOString().split('T')[0] : ''}
                                        onChange={e => setTempFilters(f => ({...f, endDate: e.target.value ? new Date(e.target.value + 'T00:00:00') : null}))}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <ResponsiveModalFooter>
                        <Button variant="ghost" onClick={() => { handleClearFilters(); setIsFilterSheetOpen(false); }} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">Limpar</Button>
                        <Button onClick={() => { handleApplyFilters(); setIsFilterSheetOpen(false); }} className="bg-brand-blue-600 hover:bg-brand-blue-500 text-white">Aplicar Filtros</Button>
                    </ResponsiveModalFooter>
                </ResponsiveModalContent>
            </ResponsiveModal>
            
            {loading ? <p className="text-center text-gray-400">Carregando serviços...</p> : 
            processedServices.length === 0 ? (
                <div className="text-center py-12 px-6 bg-white/50 dark:bg-brand-dark-900 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-800 mt-4">
                    <div className="mx-auto p-3 bg-gray-100 dark:bg-gray-800 rounded-full w-fit mb-4">
                        <BriefcaseIcon className="h-8 w-8 text-brand-blue-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nenhum serviço em andamento</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Todos os serviços estão concluídos ou nenhum foi registrado ainda.</p>
                </div>
            ) :
            <>
                {/* Mobile: Cards */}
                <div className="md:hidden grid grid-cols-1 gap-4">
                    {processedServices.map(service => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const endDate = new Date(`${service.end_date}T00:00:00`);
                        const isOverdue = endDate < today;
                        const diffTime = endDate.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        const isUrgent = !isOverdue && diffDays <= 7;
                        
                        let cardBorderClass = 'border-gray-800/60 hover:border-brand-blue-500/30';
                        if (isOverdue) cardBorderClass = 'border-red-500/50 hover:border-red-500/70';
                        else if (isUrgent) cardBorderClass = 'border-yellow-500/50 hover:border-yellow-500/70';
                        
                        let dateBadge = null;
                        if (isOverdue) {
                            dateBadge = <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md">ATRASADO</span>;
                        } else if (isUrgent) {
                            dateBadge = <span className="text-[10px] font-bold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-md">URGENTE</span>;
                        }
                        
                        return (
                            <div 
                                key={service.id} 
                                onClick={() => handleOpenAdvanceModal(service)}
                                className={`group relative bg-brand-dark-900 rounded-2xl p-4 border ${cardBorderClass} transition-all duration-200 cursor-pointer shadow-sm touch-manipulation`}
                            >
                                {/* Cabeçalho do Card: Descrição e Status */}
                                <div className="flex justify-between items-start mb-3">
                                    <div className="pr-4 flex-1">
                                        <h3 className="font-semibold text-white text-base leading-tight line-clamp-2 mb-1.5">
                                            {service.description}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs font-medium text-green-400 bg-green-500/10 px-2 py-0.5 rounded-md">
                                                {service.status}
                                            </span>
                                            {dateBadge}
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col items-end flex-shrink-0 gap-1">
                                        <span className="text-[10px] text-gray-500 uppercase font-medium">Restante</span>
                                        <span className="font-bold text-emerald-400 text-lg tracking-tight">
                                            {formatCurrency(service.remaining_value)}
                                        </span>
                                    </div>
                                </div>

                                {/* Linha divisória sutil */}
                                <div className="h-px w-full bg-gradient-to-r from-gray-800/50 via-gray-800/20 to-transparent my-3" />

                                {/* Metadados: Colaborador, Obra, Datas */}
                                <div className="flex items-end justify-between">
                                    <div className="space-y-2 flex-1 pr-4">
                                        <div className="flex items-center gap-2 text-xs text-gray-300">
                                            <UserIcon className="w-3.5 h-3.5 text-brand-blue-500/70 flex-shrink-0" />
                                            <span className="line-clamp-1">{service.collaborator_name || 'Sem colaborador'}</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                            <ConstructionIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                            <span className="line-clamp-1">{service.project_name || 'Obra não informada'}</span>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-gray-500 pt-1">
                                            <CalendarIcon className="w-3.5 h-3.5" />
                                            <span>Até {formatDate(service.end_date)}</span>
                                        </div>
                                    </div>

                                    {/* Indicador de Ação (Thumb-friendly) */}
                                    <div className="w-8 h-8 rounded-full bg-brand-blue-500/10 flex items-center justify-center text-brand-blue-400 group-hover:bg-brand-blue-500/20 transition-colors flex-shrink-0">
                                        <PlusIcon className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block overflow-hidden rounded-xl border border-gray-800 bg-brand-dark-900 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-400">
                            <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 border-b border-gray-800">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium">Descrição</th>
                                    <th className="px-6 py-4 font-medium">Colaborador / Obra</th>
                                    <th className="px-6 py-4 font-medium">Período</th>
                                    <th className="px-6 py-4 font-medium text-right">Total</th>
                                    <th className="px-6 py-4 font-medium text-right">Restante</th>
                                    <th className="px-6 py-4 font-medium text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {processedServices.map((service) => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const endDate = new Date(`${service.end_date}T00:00:00`);
                                    const isOverdue = endDate < today;
                                    const diffTime = endDate.getTime() - today.getTime();
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    const isUrgent = !isOverdue && diffDays <= 7;

                                    let rowClass = "hover:bg-gray-800/50 transition-colors cursor-pointer group";
                                    if (isOverdue) rowClass += " border-l-2 border-l-red-500";
                                    else if (isUrgent) rowClass += " border-l-2 border-l-yellow-500";

                                    return (
                                        <tr 
                                            key={service.id} 
                                            className={rowClass}
                                            onClick={() => handleOpenEditServiceModal(service)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col gap-1">
                                                    <Badge variant="outline" className="w-fit bg-green-500/10 text-green-400 border-green-500/20">{service.status}</Badge>
                                                    {isOverdue && <span className="text-[10px] text-red-400 font-bold">ATRASADO</span>}
                                                    {isUrgent && <span className="text-[10px] text-yellow-400 font-bold">URGENTE</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-white max-w-xs truncate" title={service.description}>{service.description}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-white">{service.collaborator_name || 'N/A'}</span>
                                                    <span className="text-xs text-gray-400">{service.project_name || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                                                <div>{formatDate(service.start_date)}</div>
                                                <div>até {formatDate(service.end_date)}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-gray-300">
                                                {formatCurrency(service.total_value)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-bold">
                                                <span className="text-emerald-400">{formatCurrency(service.remaining_value)}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button 
                                                            variant="outline" 
                                                            size="icon" 
                                                            className="h-8 w-8 border-gray-700 hover:bg-gray-700"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <MoreVerticalIcon className="h-4 w-4 text-gray-400" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onSelect={() => handleOpenEditServiceModal(service)}>
                                                            <EditIcon className="h-4 w-4 mr-2" /> Editar / Detalhes
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => handleOpenAdvanceModal(service)}>
                                                            <TrendingUpIcon className="h-4 w-4 mr-2" /> Novo Adiantamento
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>}
            
            <Suspense fallback={<div />}>
                {isCreateModalOpen && (
                    <ServiceModal
                        isOpen={isCreateModalOpen}
                        onClose={() => {
                            setCreateModalOpen(false);
                            fetchServices(filters); // Refresh on close if needed
                        }}
                        collaborators={collaborators}
                        projects={projects}
                    />
                )}

                {isEditServiceModalOpen && selectedService && (
                    <EditarServicoModal
                        isOpen={isEditServiceModalOpen}
                        onClose={() => {
                            setEditServiceModalOpen(false);
                            setSelectedService(null);
                        }}
                        onSuccess={() => {
                            setEditServiceModalOpen(false);
                            setSelectedService(null);
                            fetchServices(filters);
                        }}
                        service={selectedService}
                        collaborators={collaborators}
                        projects={projects}
                    />
                )}

                {isAdvanceModalOpen && selectedService && (
                    <AdvanceModal
                        isOpen={isAdvanceModalOpen}
                        onClose={() => {
                            setAdvanceModalOpen(false);
                            setSelectedService(null);
                            fetchServices(filters); // Refresh on close to update values
                        }}
                        service={selectedService}
                    />
                )}

                {isEditAdvanceModalOpen && selectedAdvance && (
                    <EditarAdiantamentoModal
                        isOpen={isEditAdvanceModalOpen}
                        onClose={() => {
                            setEditAdvanceModalOpen(false);
                            setSelectedAdvance(null);
                        }}
                        onSuccess={() => {
                            setEditAdvanceModalOpen(false);
                            setSelectedAdvance(null);
                            fetchServices(filters);
                        }}
                        advance={selectedAdvance}
                    />
                )}
            </Suspense>
        </div>
    );
};

export default Servicos;