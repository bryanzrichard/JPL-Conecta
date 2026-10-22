import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { ServiceWithDetails, Collaborator, Project, SERVICE_STATUSES } from '../types';
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
    MoreVerticalIcon
} from '../lib/icons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/DropdownMenu';

const ServiceModal = lazy(() => import('../components/servicos/ServiceModal'));
const AdvanceModal = lazy(() => import('../components/servicos/AdvanceModal'));

type Filters = {
    collaboratorId: string | null;
    projectId: string | null;
    startDate: Date | null;
    endDate: Date | null;
};

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

    // Popover and search states for filters
    const [collaboratorSearch, setCollaboratorSearch] = useState("");
    const [projectSearch, setProjectSearch] = useState("");
    const [isCollaboratorPopoverOpen, setCollaboratorPopoverOpen] = useState(false);
    const [isProjectPopoverOpen, setProjectPopoverOpen] = useState(false);
    
    const [selectedService, setSelectedService] = useState<ServiceWithDetails | null>(null);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isAdvanceModalOpen, setAdvanceModalOpen] = useState(false);
    const requestIdRef = useRef(0);

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
                <div className="bg-brand-dark-900 p-4 rounded-xl shadow-sm border border-gray-800 flex items-center gap-4">
                    <div className="flex-shrink-0 p-2.5 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20">
                        <DollarSignIcon className="h-5 w-5 text-brand-blue-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Valor Total (Em Andamento)</p>
                        <p className="text-xl font-bold text-white truncate">{formatCurrency(summary.totalValue)}</p>
                    </div>
                </div>

                {/* Falta Pagar */}
                <div className="bg-brand-dark-900 p-4 rounded-xl shadow-sm border border-gray-800 flex items-center gap-4">
                    <div className="flex-shrink-0 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <TrendingUpIcon className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Falta Pagar (Em Andamento)</p>
                        <p className="text-xl font-bold text-emerald-400 truncate">{formatCurrency(summary.remainingValue)}</p>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center">
                 <p className="text-sm text-gray-400">
                    <span className="font-bold text-white">{summary.count}</span> {summary.count === 1 ? 'serviço em andamento' : 'serviços em andamento'}
                </p>
                <Button variant="outline" className="h-9 text-sm border-brand-blue-500/50 text-brand-blue-400 hover:bg-brand-blue-500/10 hover:text-brand-blue-300" onClick={() => { setTempFilters(filters); setIsFilterSheetOpen(true); }}>
                    <FilterIcon className="h-4 w-4 mr-2"/>
                    Filtrar Serviços
                </Button>
            </div>

            <ResponsiveModal open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen} displayMode="drawer">
                <ResponsiveModalContent size="sm">
                    <ResponsiveModalHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand-blue-500/10 rounded-lg border border-brand-blue-500/20">
                                <FilterIcon className="h-5 w-5 text-brand-blue-400" />
                            </div>
                            <div>
                                <ResponsiveModalTitle>Filtrar Serviços</ResponsiveModalTitle>
                                <ResponsiveModalDescription>Refine a lista de serviços em andamento</ResponsiveModalDescription>
                            </div>
                        </div>
                    </ResponsiveModalHeader>
                    <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-5 bg-brand-dark-950/50">
                        {/* Collaborator Filter */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-300">Colaborador</Label>
                            <Popover open={isCollaboratorPopoverOpen} onOpenChange={setCollaboratorPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between font-normal text-left h-9 px-3 text-sm border-gray-800 focus:border-brand-blue-500">
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
                        
                        {/* Project Filter */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-300">Obra</Label>
                            <Popover open={isProjectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between font-normal text-left h-9 px-3 text-sm border-gray-800 focus:border-brand-blue-500">
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

                         {/* Date Filter */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-300">Período</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="start_date" className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Início</Label>
                                    <Input
                                        id="start_date"
                                        type="date"
                                        className="h-9 border-gray-800 focus:border-brand-blue-500 text-sm"
                                        value={tempFilters.startDate ? tempFilters.startDate.toISOString().split('T')[0] : ''}
                                        onChange={e => setTempFilters(f => ({...f, startDate: e.target.value ? new Date(e.target.value + 'T00:00:00') : null}))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="end_date" className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Fim</Label>
                                    <Input
                                        id="end_date"
                                        type="date"
                                        className="h-9 border-gray-800 focus:border-brand-blue-500 text-sm"
                                        value={tempFilters.endDate ? tempFilters.endDate.toISOString().split('T')[0] : ''}
                                        onChange={e => setTempFilters(f => ({...f, endDate: e.target.value ? new Date(e.target.value + 'T00:00:00') : null}))}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <ResponsiveModalFooter>
                        <Button variant="ghost" onClick={() => { handleClearFilters(); setIsFilterSheetOpen(false); }} className="text-gray-400 hover:text-white hover:bg-brand-dark-800">Limpar</Button>
                        <Button onClick={() => { handleApplyFilters(); setIsFilterSheetOpen(false); }} className="bg-brand-blue-600 hover:bg-brand-blue-500 text-white">Aplicar Filtros</Button>
                    </ResponsiveModalFooter>
                </ResponsiveModalContent>
            </ResponsiveModal>
            
            {loading ? <p className="text-center text-gray-400">Carregando serviços...</p> : 
            processedServices.length === 0 ? (
                <div className="text-center py-12 px-6 bg-brand-dark-900 rounded-2xl border-2 border-dashed border-gray-800 mt-4">
                    <div className="mx-auto p-3 bg-gray-800 rounded-full w-fit mb-4">
                        <BriefcaseIcon className="h-8 w-8 text-brand-blue-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Nenhum serviço em andamento</h3>
                    <p className="mt-1 text-sm text-gray-400">Todos os serviços estão concluídos ou nenhum foi registrado ainda.</p>
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
                                            onClick={() => handleOpenAdvanceModal(service)}
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

                {isAdvanceModalOpen && selectedService && (
                    <AdvanceModal
                        isOpen={isAdvanceModalOpen}
                        onClose={() => {
                            setAdvanceModalOpen(false);
                            fetchServices(filters); // Refresh on close to update values
                        }}
                        service={selectedService}
                    />
                )}
            </Suspense>
        </div>
    );
};

export default Servicos;