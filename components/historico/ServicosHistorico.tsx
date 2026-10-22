import React, { useState, useMemo, lazy, Suspense, useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { ServiceWithDetails, Collaborator, Project } from '../../types';
import ServicoCard from './ServicoCard';
import ConfirmationModal from './ConfirmationModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { FilterIcon, SearchIcon, BriefcaseIcon, MoreVerticalIcon, EditIcon, Trash2Icon, PaperclipIcon } from '../../lib/icons';
import { useToast } from '../../contexts/ToastContext';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/Popover';
import { Command, CommandInput, CommandEmpty, CommandItem, CommandList } from '../ui/Command';
import { ChevronsUpDownIcon } from '../../lib/icons';
import { Label } from '../ui/Label';
import { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '../ui/DatePickerWithRange';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { openStorageFile, formatCurrency, formatDateBR as formatDate } from '../../lib/utils';
import ServicoCardSkeleton from './ServicoCardSkeleton';
import { TableSkeleton } from '../ui/TableSkeleton';
import { Badge } from '../ui/Badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/DropdownMenu';

const EditarServicoModal = lazy(() => import('./EditarServicoModal'));

type ServiceFilters = {
    searchTerm: string;
    collaboratorId: string | null;
    projectId: string | null;
    dateRange: DateRange | undefined;
};

const PAGE_SIZE = 10;

const fetchServices = async ({ pageParam = 0, queryKey }: { pageParam?: number, queryKey: any }) => {
    const [_, companyId, filters] = queryKey;
    if (!companyId) return { data: [], count: 0, nextPage: undefined };

    let query = supabase
        .from('servicos')
        .select('*, collaborators(name), projects(name), adiantamentos(value)', { count: 'exact' })
        .eq('company_id', companyId);

    if (filters.searchTerm) {
        query = query.ilike('description', `%${filters.searchTerm}%`);
    }
    if (filters.collaboratorId) {
        query = query.eq('collaborator_id', filters.collaboratorId);
    }
    if (filters.projectId) {
        query = query.eq('project_id', filters.projectId);
    }
    if (filters.dateRange?.from) {
        query = query.gte('start_date', filters.dateRange.from.toISOString().split('T')[0]);
    }
    if (filters.dateRange?.to) {
        query = query.lte('end_date', filters.dateRange.to.toISOString().split('T')[0]);
    }

    const from = pageParam * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await query
        .order('status', { ascending: true }) // Ajuste para que 'Em Andamento' apareça primeiro.
        .order('end_date', { ascending: false }) // Modificado para false
        .order('created_at', { ascending: false })
        .range(from, to);
        
    if (error) {
        throw new Error(`Falha ao buscar serviços: ${error.message}`);
    }
    
    const formattedData = data.map((s: any) => {
        const total_advances = s.adiantamentos.reduce((acc: any, curr: any) => acc + curr.value, 0);
        return { ...s, collaborator_name: s.collaborators?.name || null, project_name: s.projects?.name || null, total_advances, remaining_value: s.status === 'Concluído' ? 0 : s.total_value - total_advances, collaborators: undefined, projects: undefined, adiantamentos: undefined }
    });

    return { 
        data: formattedData as ServiceWithDetails[], 
        count: count ?? 0,
        nextPage: data.length === PAGE_SIZE ? pageParam + 1 : undefined
    };
};

const ServicosHistorico: React.FC = () => {
    const { profile, user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    
    const [filters, setFilters] = useState<ServiceFilters>({ searchTerm: '', collaboratorId: null, projectId: null, dateRange: undefined });
    const [tempFilters, setTempFilters] = useState<ServiceFilters>(filters);
    
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [serviceToEdit, setServiceToEdit] = useState<ServiceWithDetails | null>(null);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [serviceToDelete, setServiceToDelete] = useState<ServiceWithDetails | null>(null);
    const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

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

    const { 
        data, 
        error, 
        fetchNextPage, 
        hasNextPage, 
        isFetchingNextPage, 
        status 
    } = useInfiniteQuery({
        queryKey: ['servicos', profile?.company_id, filters],
        queryFn: fetchServices,
        enabled: !!profile?.company_id,
        getNextPageParam: (lastPage) => lastPage.nextPage,
        initialPageParam: 0,
    });

    useEffect(() => {
        return () => {
            queryClient.resetQueries({ queryKey: ['servicos'] });
        };
    }, [queryClient]);
    
    const { data: prerequisites } = useQuery({
        queryKey: ['service_prerequisites', profile?.company_id],
        queryFn: async () => {
            if (!profile?.company_id) return { collaborators: [], projects: [] };
            const [collaboratorsRes, projectsRes] = await Promise.all([
                supabase.from('collaborators').select('id, name').eq('company_id', profile.company_id).order('name'),
                supabase.from('projects').select('id, name').eq('company_id', profile.company_id).order('name')
            ]);
            return { collaborators: (collaboratorsRes.data as Collaborator[]) || [], projects: (projectsRes.data as Project[]) || [] };
        },
        enabled: !!profile?.company_id,
        staleTime: Infinity,
    });

    const deleteMutation = useMutation({
        mutationFn: async (service: ServiceWithDetails) => {
            if (service.receipt_path) {
                const { error: deleteFileError } = await supabase.storage.from('jpl-conecta').remove([service.receipt_path]);
                if (deleteFileError) console.error("Erro ao remover comprovante:", deleteFileError);
            }
            const { error } = await supabase.from('servicos').delete().eq('id', service.id);
            if (error) throw error;
            
            await logAuditAction(
                profile?.company_id,
                user?.email,
                'EXCLUIR',
                `Serviço: ${service.description || service.id}`,
                { id: service.id, amount: service.total_value }
            );
        },
        onSuccess: () => {
            toast({ title: 'Sucesso!', description: 'Serviço excluído com sucesso.' });
            queryClient.invalidateQueries({ queryKey: ['servicos'] });
            queryClient.invalidateQueries({ queryKey: ['services_dashboard'] });
        },
        onError: (err) => {
            const errorMessage = formatApiError(err);
            toast({ variant: 'destructive', title: 'Erro!', description: errorMessage });
        },
        onSettled: () => {
            setDeleteModalOpen(false);
            setServiceToDelete(null);
        }
    });

    const handleEdit = (service: ServiceWithDetails) => {
        setServiceToEdit(service);
        setEditModalOpen(true);
    };

    const handleDelete = (service: ServiceWithDetails) => {
        setServiceToDelete(service);
        setDeleteModalOpen(true);
    };
    
    const applyFilters = () => {
        setFilters(tempFilters);
        setIsFilterSheetOpen(false);
    };
    
    const clearFilters = () => {
        const cleared = { searchTerm: '', collaboratorId: null, projectId: null, dateRange: undefined };
        setTempFilters(cleared);
        setFilters(cleared);
        setIsFilterSheetOpen(false);
    };
    
    const allServices = useMemo(() => data?.pages.flatMap(page => page.data) ?? [], [data]);

    const renderContent = () => {
        if (status === 'pending') {
            return (
                <>
                    <div className="md:hidden grid grid-cols-1 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => <ServicoCardSkeleton key={i} />)}
                    </div>
                    <TableSkeleton />
                </>
            );
        }
        if (status === 'error') {
            return <p className="text-center text-red-500 py-8">Erro: {error.message}</p>;
        }
        if (allServices.length === 0) {
            return (
                <div className="text-center py-12 px-6 bg-brand-dark-900/50 rounded-2xl border-2 border-dashed border-gray-700 mt-4">
                    <div className="mx-auto p-3 bg-brand-dark-950 rounded-full w-fit mb-4 shadow-sm border border-gray-800">
                        <BriefcaseIcon className="h-8 w-8 text-brand-blue-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nenhum serviço encontrado</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm">Nenhum registro corresponde aos filtros atuais. Tente ajustar sua busca ou limpar os filtros.</p>
                </div>
            );
        }
        
        return (
            <>
                {/* Mobile: Cards */}
                <div className="md:hidden grid grid-cols-1 gap-4">
                    {allServices.map(service => (
                        <ServicoCard key={service.id} service={service} onEdit={handleEdit} onDelete={handleDelete} onViewAttachment={handleViewFile} />
                    ))}
                </div>

                <div className="hidden md:block overflow-hidden rounded-xl border border-gray-800 bg-brand-dark-900 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-400 uppercase bg-brand-dark-950/50 border-b border-gray-800">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Data Início</th>
                                    <th className="px-6 py-4 font-medium">Descrição</th>
                                    <th className="px-6 py-4 font-medium">Colaborador / Obra</th>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium text-right">Valor Total</th>
                                    <th className="px-6 py-4 font-medium text-right">Restante</th>
                                    <th className="px-6 py-4 font-medium text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                {allServices.map((service) => (
                                    <tr key={service.id} className="hover:bg-brand-dark-950/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">{formatDate(service.start_date)}</td>
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white max-w-xs truncate" title={service.description}>{service.description}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900 dark:text-white">{service.collaborator_name || 'N/A'}</span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">{service.project_name || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Badge variant="outline" className={service.status === 'Concluído' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'}>
                                                {service.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">
                                            {formatCurrency(service.total_value)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900 dark:text-white">
                                            <span className={service.remaining_value > 0 ? "text-green-600 dark:text-green-400" : "text-gray-500"}>
                                                {formatCurrency(service.remaining_value)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="icon" className="h-8 w-8 border-gray-800 hover:bg-brand-dark-950/50">
                                                        <MoreVerticalIcon className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {service.receipt_path && (
                                                        <DropdownMenuItem onSelect={() => handleViewFile(service.receipt_path!)}>
                                                            <PaperclipIcon className="h-4 w-4 mr-2" /> Ver Anexo
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem onSelect={() => handleEdit(service)}>
                                                        <EditIcon className="h-4 w-4 mr-2" /> Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => handleDelete(service)} className="text-red-500 focus:text-red-500">
                                                        <Trash2Icon className="h-4 w-4 mr-2" /> Excluir
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {hasNextPage && (
                    <div className="flex justify-center pt-4">
                        <Button variant="outline" onClick={() => fetchNextPage()} isLoading={isFetchingNextPage}>
                            {isFetchingNextPage ? 'Carregando...' : 'Carregar Mais'}
                        </Button>
                    </div>
                )}
            </>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Buscar por descrição do serviço..."
                        className="pl-9"
                        value={tempFilters.searchTerm}
                        onChange={e => setTempFilters(f => ({ ...f, searchTerm: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && applyFilters()}
                    />
                </div>
                <Button variant="outline" className="flex-shrink-0" onClick={() => setIsFilterSheetOpen(true)}>
                    <FilterIcon className="h-4 w-4 mr-2" />
                    Filtros
                </Button>

                <ResponsiveModal open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen} displayMode="drawer">
                    <ResponsiveModalContent className="max-w-md bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
                        <ResponsiveModalHeader className="px-5 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
                            <ResponsiveModalTitle className="flex items-center gap-2 text-base text-white">
                                <FilterIcon className="h-4 w-4 text-brand-blue-500" />
                                Filtrar Histórico
                            </ResponsiveModalTitle>
                            <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400">
                                Refine a lista de serviços concluídos
                            </ResponsiveModalDescription>
                        </ResponsiveModalHeader>
                        <div className="p-5 space-y-5 flex-grow overflow-y-auto custom-scrollbar bg-brand-dark-950/50">
                            <FilterCombobox label="Colaborador" options={prerequisites?.collaborators || []} selectedValue={tempFilters.collaboratorId} onSelect={id => setTempFilters(f => ({...f, collaboratorId: id}))} />
                            <FilterCombobox label="Obra" options={prerequisites?.projects || []} selectedValue={tempFilters.projectId} onSelect={id => setTempFilters(f => ({...f, projectId: id}))} />
                            <div className="space-y-1.5"><Label className="text-xs font-medium text-gray-300">Período de Execução</Label><DatePickerWithRange date={tempFilters.dateRange} onDateChange={range => setTempFilters(f => ({...f, dateRange: range}))}/></div>
                        </div>
                        <ResponsiveModalFooter className="p-4 border-t border-gray-800 bg-brand-dark-900 flex-shrink-0 flex justify-end items-center gap-3">
                            <Button variant="ghost" onClick={clearFilters} className="h-9 px-4 text-gray-400 hover:text-white hover:bg-brand-dark-800">Limpar</Button>
                            <Button onClick={applyFilters} className="h-9 px-6 bg-brand-blue-600 hover:bg-brand-blue-500 text-white">Aplicar Filtros</Button>
                        </ResponsiveModalFooter>
                    </ResponsiveModalContent>
                </ResponsiveModal>
            </div>
            
            {renderContent()}
            
            <Suspense fallback={<div className="text-center p-8">Carregando editor...</div>}>
                {isEditModalOpen && (
                    <EditarServicoModal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} onSuccess={() => {}} service={serviceToEdit} collaborators={prerequisites?.collaborators || []} projects={prerequisites?.projects || []} />
                )}
            </Suspense>
            <ConfirmationModal 
                isOpen={isDeleteModalOpen} 
                onClose={() => setDeleteModalOpen(false)} 
                onConfirm={() => serviceToDelete && deleteMutation.mutate(serviceToDelete)} 
                title="Confirmar Exclusão" 
                description={<>Tem certeza que deseja excluir o serviço "<strong>{serviceToDelete?.description}</strong>"? Esta ação não pode ser desfeita.</>} 
                confirmText="Excluir"
                isLoading={deleteMutation.isPending}
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
        <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-300">{label}</Label>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between font-normal text-left h-9 px-3 text-sm">
                        <span className="truncate">{selectedLabel}</span>
                        <ChevronsUpDownIcon className="ml-2 h-4 w-4 text-gray-400 flex-shrink-0" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
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

export default ServicosHistorico;