import React, { useState, useMemo, lazy, Suspense, useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { AdvanceWithDetails, Collaborator, Project } from '../../types';
import AdiantamentoCard from './AdiantamentoCard';
import ConfirmationModal from './ConfirmationModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { FilterIcon, SearchIcon, DollarSignIcon, MoreVerticalIcon, EditIcon, Trash2Icon, PaperclipIcon } from '../../lib/icons';
import { useToast } from '../../contexts/ToastContext';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/Popover';
import { Command, CommandInput, CommandEmpty, CommandItem, CommandList } from '../ui/Command';
import { ChevronsUpDownIcon } from '../../lib/icons';
import { Label } from '../ui/Label';
import { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '../ui/DatePickerWithRange';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { openStorageFile } from '../../lib/utils';
import AdiantamentoCardSkeleton from './AdiantamentoCardSkeleton';
import { TableSkeleton } from '../ui/TableSkeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/DropdownMenu';

const EditarAdiantamentoModal = lazy(() => import('./EditarAdiantamentoModal'));

type AdvanceFilters = {
    searchTerm: string;
    collaboratorId: string | null;
    projectId: string | null;
    dateRange: DateRange | undefined;
};

const PAGE_SIZE = 10;

const fetchAdvances = async ({ pageParam = 0, queryKey }: { pageParam?: number, queryKey: any }) => {
    const [_, companyId, filters] = queryKey;
    if (!companyId) return { data: [], count: 0, nextPage: undefined };

    let query = supabase
        .from('adiantamentos')
        .select('*, servicos!inner(description, collaborator_id, project_id, collaborators(name), projects(name))', { count: 'exact' })
        .eq('company_id', companyId);

    if (filters.searchTerm) {
        query = query.ilike('description', `%${filters.searchTerm}%`);
    }
    if (filters.collaboratorId) {
        query = query.eq('servicos.collaborator_id', filters.collaboratorId);
    }
    if (filters.projectId) {
        query = query.eq('servicos.project_id', filters.projectId);
    }
    if (filters.dateRange?.from) {
        query = query.gte('payment_date', filters.dateRange.from.toISOString().split('T')[0]);
    }
    if (filters.dateRange?.to) {
        query = query.lte('payment_date', filters.dateRange.to.toISOString().split('T')[0]);
    }

    const from = pageParam * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await query.order('payment_date', { ascending: false }).range(from, to);
        
    if (error) {
        throw new Error(`Falha ao buscar adiantamentos: ${error.message}`);
    }
    
    const formattedData = data.map((a: any) => {
        const service = a.servicos;
        return {
            ...a,
            service_description: service?.description || 'Serviço não encontrado',
            collaborator_name: service?.collaborators?.name || null,
            project_name: service?.projects?.name || null,
            servicos: undefined, // clean up
        }
    });

    return { 
        data: formattedData as AdvanceWithDetails[], 
        count: count ?? 0,
        nextPage: data.length === PAGE_SIZE ? pageParam + 1 : undefined
    };
};

const AdiantamentosHistorico: React.FC = () => {
    const { profile, user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    
    const [filters, setFilters] = useState<AdvanceFilters>({ searchTerm: '', collaboratorId: null, projectId: null, dateRange: undefined });
    const [tempFilters, setTempFilters] = useState<AdvanceFilters>(filters);
    
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [advanceToEdit, setAdvanceToEdit] = useState<AdvanceWithDetails | null>(null);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [advanceToDelete, setAdvanceToDelete] = useState<AdvanceWithDetails | null>(null);
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
        queryKey: ['adiantamentos', profile?.company_id, filters],
        queryFn: fetchAdvances,
        enabled: !!profile?.company_id,
        getNextPageParam: (lastPage) => lastPage.nextPage,
        initialPageParam: 0,
    });
    
    useEffect(() => {
        return () => {
            queryClient.resetQueries({ queryKey: ['adiantamentos'] });
        };
    }, [queryClient]);

    const { data: prerequisites } = useQuery({
        queryKey: ['advance_prerequisites', profile?.company_id],
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
        mutationFn: async (advance: AdvanceWithDetails) => {
            if (advance.receipt_path) {
                const { error: deleteFileError } = await supabase.storage.from('jpl-conecta').remove([advance.receipt_path]);
                if (deleteFileError) console.error("Erro ao remover comprovante:", deleteFileError);
            }
            const { error } = await supabase.from('adiantamentos').delete().eq('id', advance.id);
            if (error) throw error;

            // Se o serviço estava 'Concluído', verificar se ainda há saldo pendente após a exclusão do adiantamento
            if (advance.service_id) {
                const { data: serviceData } = await (supabase as any)
                    .from('servicos')
                    .select('id, total_value, status, adiantamentos(value)')
                    .eq('id', advance.service_id)
                    .maybeSingle();

                if (serviceData && serviceData.status === 'Concluído') {
                    const remainingAdvances = (serviceData.adiantamentos || []).reduce(
                        (sum: number, a: { value: number }) => sum + Number(a.value || 0),
                        0
                    );
                    if (Number(serviceData.total_value) - remainingAdvances > 0.009) {
                        await (supabase as any)
                            .from('servicos')
                            .update({ status: 'Em Andamento' })
                            .eq('id', advance.service_id);
                    }
                }
            }
            
            await logAuditAction(
                profile?.company_id,
                user?.email,
                'EXCLUIR',
                `Adiantamento: ${advance.description || advance.id}`,
                { id: advance.id, amount: advance.value }
            );
        },
        onSuccess: () => {
            toast({ title: 'Sucesso!', description: 'Adiantamento excluído com sucesso.' });
            queryClient.invalidateQueries({ queryKey: ['adiantamentos'] });
            queryClient.invalidateQueries({ queryKey: ['servicos'] }); // Advances affect services totals
        },
        onError: (err) => {
            const errorMessage = formatApiError(err);
            toast({ variant: 'destructive', title: 'Erro!', description: errorMessage });
        },
        onSettled: () => {
            setDeleteModalOpen(false);
            setAdvanceToDelete(null);
        }
    });

    const handleEdit = (advance: AdvanceWithDetails) => {
        setAdvanceToEdit(advance);
        setEditModalOpen(true);
    };

    const handleDelete = (advance: AdvanceWithDetails) => {
        setAdvanceToDelete(advance);
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
    
    const allAdvances = useMemo(() => data?.pages.flatMap(page => page.data) ?? [], [data]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('pt-BR');
    };

    const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const renderContent = () => {
        if (status === 'pending') {
            return (
                <>
                    <div className="md:hidden grid grid-cols-1 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => <AdiantamentoCardSkeleton key={i} />)}
                    </div>
                    <TableSkeleton />
                </>
            );
        }
        if (status === 'error') {
            return <p className="text-center text-red-500 py-8">Erro: {error.message}</p>;
        }
        if (allAdvances.length === 0) {
            return (
                 <div className="text-center py-12 px-6 bg-brand-dark-900/50 rounded-2xl border-2 border-dashed border-gray-700 mt-4">
                    <div className="mx-auto p-3 bg-brand-dark-950 rounded-full w-fit mb-4 shadow-sm border border-gray-800">
                        <DollarSignIcon className="h-8 w-8 text-brand-blue-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nenhum adiantamento encontrado</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm">Nenhum registro corresponde aos filtros atuais. Tente ajustar sua busca ou limpar os filtros.</p>
                </div>
            );
        }
        
        return (
            <>
                {/* Mobile: Cards */}
                <div className="md:hidden grid grid-cols-1 gap-4">
                    {allAdvances.map(advance => (
                        <AdiantamentoCard key={advance.id} advance={advance} onEdit={handleEdit} onDelete={handleDelete} onViewAttachment={handleViewFile} />
                    ))}
                </div>

                <div className="hidden md:block overflow-hidden rounded-xl border border-gray-800 bg-brand-dark-900 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-400 uppercase bg-brand-dark-950/50 border-b border-gray-800">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Data</th>
                                    <th className="px-6 py-4 font-medium">Serviço / Descrição</th>
                                    <th className="px-6 py-4 font-medium">Colaborador</th>
                                    <th className="px-6 py-4 font-medium text-right">Valor</th>
                                    <th className="px-6 py-4 font-medium text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                {allAdvances.map((advance) => (
                                    <tr key={advance.id} className="hover:bg-brand-dark-950/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">{formatDate(advance.payment_date)}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900 dark:text-white max-w-xs truncate">{advance.service_description}</span>
                                                {advance.description && <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{advance.description}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">{advance.collaborator_name || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900 dark:text-white">
                                            {formatCurrency(advance.value)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="icon" className="h-8 w-8 border-gray-800 hover:bg-brand-dark-950/50">
                                                        <MoreVerticalIcon className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {advance.receipt_path && (
                                                        <DropdownMenuItem onSelect={() => handleViewFile(advance.receipt_path!)}>
                                                            <PaperclipIcon className="h-4 w-4 mr-2" /> Ver Anexo
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem onSelect={() => handleEdit(advance)}>
                                                        <EditIcon className="h-4 w-4 mr-2" /> Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => handleDelete(advance)} className="text-red-500 focus:text-red-500">
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
                        placeholder="Buscar por descrição do adiantamento..."
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
                                Filtrar Adiantamentos
                            </ResponsiveModalTitle>
                            <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400">
                                Refine a lista de adiantamentos
                            </ResponsiveModalDescription>
                        </ResponsiveModalHeader>
                        <div className="p-5 space-y-5 flex-grow overflow-y-auto custom-scrollbar bg-brand-dark-950/50">
                            <FilterCombobox label="Colaborador" options={prerequisites?.collaborators || []} selectedValue={tempFilters.collaboratorId} onSelect={id => setTempFilters(f => ({...f, collaboratorId: id}))} />
                            <FilterCombobox label="Obra" options={prerequisites?.projects || []} selectedValue={tempFilters.projectId} onSelect={id => setTempFilters(f => ({...f, projectId: id}))} />
                            <div className="space-y-1.5"><Label className="text-xs font-medium text-gray-300">Período de Pagamento</Label><DatePickerWithRange date={tempFilters.dateRange} onDateChange={range => setTempFilters(f => ({...f, dateRange: range}))}/></div>
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
                    <EditarAdiantamentoModal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} onSuccess={() => {}} advance={advanceToEdit} />
                )}
            </Suspense>
            <ConfirmationModal 
                isOpen={isDeleteModalOpen} 
                onClose={() => setDeleteModalOpen(false)} 
                onConfirm={() => advanceToDelete && deleteMutation.mutate(advanceToDelete)} 
                title="Confirmar Exclusão" 
                description={<>Tem certeza que deseja excluir este adiantamento no valor de <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(advanceToDelete?.value || 0)}</strong>? Esta ação não pode ser desfeita.</>} 
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

export default AdiantamentosHistorico;