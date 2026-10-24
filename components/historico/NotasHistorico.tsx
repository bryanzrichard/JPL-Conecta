import React, { useState, useMemo, lazy, Suspense, useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { NotaWithItemCount, Supplier, Project, PAYMENT_METHODS } from '../../types';
import NotaCard from './NotaCard';
import ConfirmationModal from '../ui/ConfirmationModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { FilterIcon, SearchIcon, FileTextIcon, MoreVerticalIcon, EditIcon, Trash2Icon, EyeIcon, CalendarIcon, XIcon, ChevronsUpDownIcon } from '../../lib/icons';
import { useToast } from '../../contexts/ToastContext';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/Popover';
import { Command, CommandInput, CommandEmpty, CommandItem, CommandList } from '../ui/Command';
import { Label } from '../ui/Label';
import { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '../ui/DatePickerWithRange';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import NotaCardSkeleton from '../notas/NotaCardSkeleton';
import { TableSkeleton } from '../ui/TableSkeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/DropdownMenu';
import { Badge } from '../ui/Badge';

const EditarNotaModal = lazy(() => import('../notas/EditarNotaModal'));

type NotaFilters = {
    searchTerm: string;
    supplierId: string | null;
    projectId: string | null;
    dateRange: DateRange | undefined;
};

const PAGE_SIZE = 10;

const fetchNotas = async ({ pageParam = 0, queryKey }: { pageParam?: number, queryKey: any }) => {
    const [_, companyId, filters] = queryKey;
    if (!companyId) return { data: [], count: 0, nextPage: undefined };

    let query = supabase
        .from('notas_fiscais')
        .select('*, projects(name), suppliers(name), itens_nota_fiscal(count)', { count: 'exact' })
        .eq('company_id', companyId);

    if (filters.searchTerm) {
        query = query.ilike('invoice_number', `%${filters.searchTerm}%`);
    }
    if (filters.supplierId) {
        query = query.eq('supplier_id', filters.supplierId);
    }
    if (filters.projectId) {
        query = query.eq('project_id', filters.projectId);
    }
    if (filters.dateRange?.from) {
        query = query.gte('issue_date', filters.dateRange.from.toISOString().split('T')[0]);
    }
    if (filters.dateRange?.to) {
        query = query.lte('issue_date', filters.dateRange.to.toISOString().split('T')[0]);
    }

    const from = pageParam * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);

    if (error) {
        throw new Error(`Falha ao buscar notas: ${error.message}`);
    }
    
    const formattedData = data.map((n: any) => ({
        ...n,
        item_count: n.itens_nota_fiscal[0]?.count || 0,
        itens_nota_fiscal: undefined
    }));

    return { 
        data: formattedData as NotaWithItemCount[], 
        count: count ?? 0,
        nextPage: data.length === PAGE_SIZE ? pageParam + 1 : undefined
    };
};

const QUICK_PERIOD_SHORTCUTS = [
    { label: 'Hoje', daysAgo: 0 },
    { label: 'Últimos 7 dias', daysAgo: 7 },
    { label: 'Este Mês', isCurrentMonth: true },
    { label: 'Últimos 90 dias', daysAgo: 90 },
];

const NotasHistorico: React.FC = () => {
    const { profile, user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    
    const [filters, setFilters] = useState<NotaFilters>({ searchTerm: '', supplierId: null, projectId: null, dateRange: undefined });
    const [tempFilters, setTempFilters] = useState<NotaFilters>(filters);
    
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [notaToEdit, setNotaToEdit] = useState<NotaWithItemCount | null>(null);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [notaToDelete, setNotaToDelete] = useState<NotaWithItemCount | null>(null);
    const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

    // Active filters count
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (filters.supplierId) count++;
        if (filters.projectId) count++;
        if (filters.dateRange?.from || filters.dateRange?.to) count++;
        return count;
    }, [filters]);

    const applyQuickPeriod = (shortcut: typeof QUICK_PERIOD_SHORTCUTS[number]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (shortcut.isCurrentMonth) {
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            setTempFilters(f => ({
                ...f,
                dateRange: { from: startOfMonth, to: today }
            }));
            return;
        }

        if (shortcut.daysAgo === 0) {
            setTempFilters(f => ({
                ...f,
                dateRange: { from: today, to: today }
            }));
            return;
        }

        const pastDate = new Date(Date.now() - shortcut.daysAgo * 86400000);
        pastDate.setHours(0, 0, 0, 0);
        setTempFilters(f => ({
            ...f,
            dateRange: { from: pastDate, to: today }
        }));
    };


    const { 
        data, 
        error, 
        fetchNextPage, 
        hasNextPage, 
        isFetchingNextPage, 
        status 
    } = useInfiniteQuery({
        queryKey: ['notas', profile?.company_id, filters],
        queryFn: fetchNotas,
        enabled: !!profile?.company_id,
        getNextPageParam: (lastPage) => lastPage.nextPage,
        initialPageParam: 0,
    });

    useEffect(() => {
        return () => {
            queryClient.resetQueries({ queryKey: ['notas'] });
        };
    }, [queryClient]);
    
    const { data: prerequisites } = useQuery({
        queryKey: ['prerequisites', profile?.company_id],
        queryFn: async () => {
            if (!profile?.company_id) return { suppliers: [], projects: [] };
            const [suppliersRes, projectsRes] = await Promise.all([
                supabase.from('suppliers').select('id, name').eq('company_id', profile.company_id).order('name'),
                supabase.from('projects').select('id, name').eq('company_id', profile.company_id).order('name')
            ]);
            return { suppliers: (suppliersRes.data as Supplier[]) || [], projects: (projectsRes.data as Project[]) || [] };
        },
        enabled: !!profile?.company_id,
        staleTime: Infinity,
    });

    const deleteMutation = useMutation({
        mutationFn: async (nota: NotaWithItemCount) => {
            if (nota.file_url) {
                const { error: storageError } = await supabase.storage
                    .from('jpl-conecta')
                    .remove([nota.file_url]);

                if (storageError && !storageError.message.toLowerCase().includes('not found') && !storageError.message.includes('Bucket not found')) {
                     // Log but do not throw, to ensure record is deleted
                     console.error(`Falha ao excluir o arquivo da nota: ${storageError.message}`);
                }
            }
            const { error: dbError } = await supabase.from('notas_fiscais').delete().eq('id', nota.id);
            if (dbError) throw dbError;
            
            await logAuditAction(
                profile?.company_id,
                user?.email,
                'EXCLUIR',
                `Nota Fiscal: ${nota.invoice_number || nota.id}`,
                { id: nota.id, amount: nota.total_value }
            );
        },
        onSuccess: () => {
            toast({ title: 'Sucesso!', description: 'Nota fiscal excluída.' });
            queryClient.invalidateQueries({ queryKey: ['notas'] });
            queryClient.invalidateQueries({ queryKey: ['notasSummary'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardItems'] });
        },
        onError: (err) => {
            const errorMessage = formatApiError(err);
            toast({ variant: 'destructive', title: 'Erro!', description: errorMessage });
        },
        onSettled: () => {
            setDeleteModalOpen(false);
            setNotaToDelete(null);
        }
    });

    const handleEdit = (nota: NotaWithItemCount) => {
        setNotaToEdit(nota);
        setEditModalOpen(true);
    };

    const handleDelete = (nota: NotaWithItemCount) => {
        setNotaToDelete(nota);
        setDeleteModalOpen(true);
    };
    
    const applyFilters = () => {
        setFilters(tempFilters);
        setIsFilterSheetOpen(false);
    };
    
    const clearFilters = () => {
        const cleared = { searchTerm: '', supplierId: null, projectId: null, dateRange: undefined };
        setTempFilters(cleared);
        setFilters(cleared);
        setIsFilterSheetOpen(false);
    };

    const allNotas = useMemo(() => data?.pages.flatMap(page => page.data) ?? [], [data]);
    
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
                        {Array.from({ length: 4 }).map((_, i) => <NotaCardSkeleton key={i} />)}
                    </div>
                    <TableSkeleton />
                </>
            );
        }
        if (status === 'error') {
            return <p className="text-center text-red-500 py-8">Erro: {error.message}</p>;
        }
        if (allNotas.length === 0) {
            return (
                 <div className="text-center py-12 px-6 bg-brand-dark-900/50 rounded-2xl border-2 border-dashed border-gray-700 mt-4">
                    <div className="mx-auto p-3 bg-brand-dark-950 rounded-full w-fit mb-4 shadow-sm border border-gray-800">
                        <FileTextIcon className="h-8 w-8 text-brand-blue-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Nenhuma nota encontrada</h3>
                    <p className="mt-1 text-sm text-gray-400 max-w-sm mx-auto">Nenhum registro corresponde aos filtros atuais. Tente ajustar sua busca ou limpar os filtros.</p>
                </div>
            );
        }
        
        return (
            <>
                {/* Mobile View: Cards */}
                <div className="md:hidden grid grid-cols-1 gap-4">
                    {allNotas.map(nota => (
                        <NotaCard key={nota.id} nota={nota} onEdit={handleEdit} onDelete={handleDelete} />
                    ))}
                </div>

            <div className="hidden md:block overflow-hidden rounded-xl border border-gray-800 bg-brand-dark-900 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 border-b border-gray-800">
                            <tr>
                                <th className="px-6 py-4 font-medium">Emissão</th>
                                <th className="px-6 py-4 font-medium">Nº Nota</th>
                                <th className="px-6 py-4 font-medium">Fornecedor / Obra</th>
                                <th className="px-6 py-4 font-medium">Pagamento</th>
                                <th className="px-6 py-4 font-medium text-right">Valor Total</th>
                                <th className="px-6 py-4 font-medium text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {allNotas.map((nota) => (
                                <tr key={nota.id} className="hover:bg-gray-800/40 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">{formatDate(nota.issue_date)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-white">{nota.invoice_number}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-white">{nota.suppliers?.name || 'N/A'}</span>
                                            <span className="text-xs text-gray-400">{nota.projects?.name || 'N/A'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Badge variant="outline" className="bg-gray-800/50 text-gray-300 border-gray-700">
                                            {PAYMENT_METHODS[nota.payment_method] || nota.payment_method}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-white">
                                        {formatCurrency(nota.total_value)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="icon" className="h-8 w-8 border-gray-700 hover:bg-gray-700">
                                                    <MoreVerticalIcon className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onSelect={() => handleEdit(nota)}>
                                                    <EditIcon className="h-4 w-4 mr-2" /> Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => handleDelete(nota)} className="text-red-500 focus:text-red-500">
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
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Buscar por número da nota..."
                        className="pl-9"
                        value={tempFilters.searchTerm}
                        onChange={e => setTempFilters(f => ({ ...f, searchTerm: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && applyFilters()}
                    />
                </div>
                <Button
                    variant="outline"
                    onClick={() => setIsFilterSheetOpen(true)}
                    className="relative h-9 px-3.5 text-sm font-medium border-gray-300 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:text-brand-blue-600 dark:hover:text-brand-blue-400 hover:border-brand-blue-500/50 hover:bg-brand-blue-50/50 dark:hover:bg-brand-blue-500/10 transition-colors flex-shrink-0"
                >
                    <FilterIcon className="h-4 w-4 mr-2 text-brand-blue-500" />
                    <span>Filtros</span>
                    {activeFiltersCount > 0 && (
                        <span className="ml-2 flex items-center justify-center h-5 min-w-[20px] px-1 text-[11px] font-bold rounded-full bg-brand-blue-600 text-white shadow-sm">
                            {activeFiltersCount}
                        </span>
                    )}
                </Button>

                <ResponsiveModal open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen} displayMode="drawer">
                    <ResponsiveModalContent size="sm">
                        <ResponsiveModalHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-brand-blue-500/10 rounded-lg border border-brand-blue-500/20">
                                    <FilterIcon className="h-5 w-5 text-brand-blue-500" />
                                </div>
                                <div>
                                    <ResponsiveModalTitle>Filtrar Notas Fiscais</ResponsiveModalTitle>
                                    <ResponsiveModalDescription>Refine a lista de notas por fornecedor, obra ou data</ResponsiveModalDescription>
                                </div>
                            </div>
                        </ResponsiveModalHeader>
                        <div className="p-6 space-y-4 flex-grow overflow-y-auto custom-scrollbar bg-gray-50/50 dark:bg-brand-dark-950/50">
                            {/* Atalhos Rápidos de Período */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                        <CalendarIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                                        Atalhos de Período
                                    </Label>
                                    {(tempFilters.dateRange?.from || tempFilters.dateRange?.to) && (
                                        <button
                                            type="button"
                                            onClick={() => setTempFilters(f => ({ ...f, dateRange: undefined }))}
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

                            <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3 shadow-sm">
                                <FilterCombobox label="Fornecedor" options={prerequisites?.suppliers || []} selectedValue={tempFilters.supplierId} onSelect={id => setTempFilters(f => ({...f, supplierId: id}))} />
                                <FilterCombobox label="Obra / Projeto" options={prerequisites?.projects || []} selectedValue={tempFilters.projectId} onSelect={id => setTempFilters(f => ({...f, projectId: id}))} />
                            </div>

                            <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2 shadow-sm">
                                <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">Período de Emissão</Label>
                                <DatePickerWithRange date={tempFilters.dateRange} onDateChange={range => setTempFilters(f => ({...f, dateRange: range}))}/>
                            </div>
                        </div>
                        <ResponsiveModalFooter>
                            <Button variant="ghost" onClick={clearFilters} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">Limpar</Button>
                            <Button onClick={applyFilters} className="bg-brand-blue-600 hover:bg-brand-blue-500 text-white">Aplicar Filtros</Button>
                        </ResponsiveModalFooter>
                    </ResponsiveModalContent>
                </ResponsiveModal>
            </div>
            
            {renderContent()}

            {/* Modals */}
             <Suspense fallback={<div className="text-center p-8">Carregando editor...</div>}>
                {isEditModalOpen && (
                    <EditarNotaModal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} onSuccess={() => {}} nota={notaToEdit} suppliers={prerequisites?.suppliers || []} projects={prerequisites?.projects || []} />
                )}
            </Suspense>
            <ConfirmationModal 
                isOpen={isDeleteModalOpen} 
                onClose={() => setDeleteModalOpen(false)} 
                onConfirm={() => notaToDelete && deleteMutation.mutate(notaToDelete)} 
                title="Confirmar Exclusão" 
                description={<>Tem certeza que deseja excluir a nota fiscal <strong>{notaToDelete?.invoice_number}</strong>? O arquivo associado também será removido permanentemente.</>} 
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
            <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">{label}</Label>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between font-normal text-left h-9 px-3 text-sm bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white">
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

export default NotasHistorico;