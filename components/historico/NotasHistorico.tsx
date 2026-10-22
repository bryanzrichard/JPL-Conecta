import React, { useState, useMemo, lazy, Suspense, useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { NotaWithItemCount, Supplier, Project, PAYMENT_METHODS } from '../../types';
import NotaCard from './NotaCard';
import ConfirmationModal from './ConfirmationModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { FilterIcon, SearchIcon, FileTextIcon, MoreVerticalIcon, EditIcon, Trash2Icon, EyeIcon } from '../../lib/icons';
import { useToast } from '../../contexts/ToastContext';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/Popover';
import { Command, CommandInput, CommandEmpty, CommandItem, CommandList } from '../ui/Command';
import { ChevronsUpDownIcon } from '../../lib/icons';
import { Label } from '../ui/Label';
import { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '../ui/DatePickerWithRange';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import NotaCardSkeleton from './NotaCardSkeleton';
import { TableSkeleton } from '../ui/TableSkeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/DropdownMenu';
import { Badge } from '../ui/Badge';

const EditarNotaModal = lazy(() => import('./EditarNotaModal'));

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
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nenhuma nota encontrada</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm">Nenhum registro corresponde aos filtros atuais. Tente ajustar sua busca ou limpar os filtros.</p>
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
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-brand-dark-950/50 border-b border-gray-800">
                            <tr>
                                <th className="px-6 py-4 font-medium">Emissão</th>
                                <th className="px-6 py-4 font-medium">Nº Nota</th>
                                <th className="px-6 py-4 font-medium">Fornecedor / Obra</th>
                                <th className="px-6 py-4 font-medium">Pagamento</th>
                                <th className="px-6 py-4 font-medium text-right">Valor Total</th>
                                <th className="px-6 py-4 font-medium text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {allNotas.map((nota) => (
                                <tr key={nota.id} className="hover:bg-brand-dark-950/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">{formatDate(nota.issue_date)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{nota.invoice_number}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-900 dark:text-white">{nota.suppliers?.name || 'N/A'}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{nota.projects?.name || 'N/A'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Badge variant="outline" className="bg-brand-dark-950/50 text-gray-300 border-gray-800">
                                            {PAYMENT_METHODS[nota.payment_method] || nota.payment_method}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900 dark:text-white">
                                        {formatCurrency(nota.total_value)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="icon" className="h-8 w-8 border-gray-800 hover:bg-brand-dark-950/50">
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
                <Button variant="outline" className="flex-shrink-0" onClick={() => setIsFilterSheetOpen(true)}>
                    <FilterIcon className="h-4 w-4 mr-2" />
                    Filtros
                </Button>

                <ResponsiveModal open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen} displayMode="drawer">
                    <ResponsiveModalContent className="max-w-md bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
                        <ResponsiveModalHeader className="px-5 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
                            <ResponsiveModalTitle className="flex items-center gap-2 text-base text-white">
                                <FilterIcon className="h-4 w-4 text-brand-blue-500" />
                                Filtrar Notas Fiscais
                            </ResponsiveModalTitle>
                            <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400">
                                Refine a lista de notas fiscais
                            </ResponsiveModalDescription>
                        </ResponsiveModalHeader>
                        <div className="p-5 space-y-5 flex-grow overflow-y-auto custom-scrollbar bg-brand-dark-950/50">
                            <FilterCombobox label="Fornecedor" options={prerequisites?.suppliers || []} selectedValue={tempFilters.supplierId} onSelect={id => setTempFilters(f => ({...f, supplierId: id}))} />
                            <FilterCombobox label="Obra" options={prerequisites?.projects || []} selectedValue={tempFilters.projectId} onSelect={id => setTempFilters(f => ({...f, projectId: id}))} />
                            <div className="space-y-1.5"><Label className="text-xs font-medium text-gray-300">Período de Emissão</Label><DatePickerWithRange date={tempFilters.dateRange} onDateChange={range => setTempFilters(f => ({...f, dateRange: range}))}/></div>
                        </div>
                        <ResponsiveModalFooter className="p-4 border-t border-gray-800 bg-brand-dark-900 flex-shrink-0 flex justify-end items-center gap-3">
                            <Button variant="ghost" onClick={clearFilters} className="h-9 px-4 text-gray-400 hover:text-white hover:bg-brand-dark-800">Limpar</Button>
                            <Button onClick={applyFilters} className="h-9 px-6 bg-brand-blue-600 hover:bg-brand-blue-500 text-white">Aplicar Filtros</Button>
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

export default NotasHistorico;