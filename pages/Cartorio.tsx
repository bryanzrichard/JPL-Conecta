import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { 
    SearchIcon, 
    PlusIcon, 
    BuildingIcon, 
    FileTextIcon, 
    MoreVerticalIcon, 
    EditIcon, 
    Trash2Icon, 
    DollarSignIcon,
    FilterIcon,
    CalendarIcon,
    XIcon
} from '../lib/icons';
import { useToast } from '../contexts/ToastContext';
import { CartorioRecord } from '../types';
import { formatDateYMD } from '../lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/DropdownMenu';
import { Skeleton } from '../components/ui/Skeleton';
import { PageHeader } from '../components/ui/PageHeader';
import {
    ResponsiveModal,
    ResponsiveModalContent,
    ResponsiveModalHeader,
    ResponsiveModalTitle,
    ResponsiveModalDescription,
    ResponsiveModalFooter,
} from '../components/ui/ResponsiveModal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import CartorioModal from '../components/cartorio/CartorioModal';
import { formatApiError } from '../lib/handleError';
import { logAuditAction } from '../lib/auditLogger';
import { formatCurrency, openStorageFile } from '../lib/utils';
import { carregarRegistroCartorioEPagina } from '../lib/carregarRegistros';

const PAGE_SIZE = 10;

type CartorioFilters = {
    projectId: string;
    startDate: Date | null;
    endDate: Date | null;
};

const initialFilters: CartorioFilters = {
    projectId: 'all',
    startDate: null,
    endDate: null,
};

const QUICK_PERIOD_SHORTCUTS = [
    { label: 'Hoje', daysAgo: 0 },
    { label: 'Últimos 7 dias', daysAgo: 7 },
    { label: 'Este Mês', isCurrentMonth: true },
    { label: 'Últimos 90 dias', daysAgo: 90 },
];

const Cartorio: React.FC = () => {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [page, setPage] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filters, setFilters] = useState<CartorioFilters>(initialFilters);
    const [tempFilters, setTempFilters] = useState<CartorioFilters>(initialFilters);
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<CartorioRecord | null>(null);
    const [highlightRecordId, setHighlightRecordId] = useState<string | null>(null);
    const location = useLocation();
    const navigate = useNavigate();
    const handledCartorioIdRef = useRef<string | null>(null);

    // Interceptar ?editar={id}: limpa filtros, descobre a página exata, navega e destaca a linha
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const stateObj = typeof location.state === 'object' && location.state !== null ? (location.state as Record<string, unknown>) : null;
        const editCartorioId = searchParams.get('editar') || (stateObj?.editId ? String(stateObj.editId) : null);

        if (!editCartorioId || !profile?.company_id) return;
        if (handledCartorioIdRef.current === editCartorioId) return;

        handledCartorioIdRef.current = editCartorioId;
        // Limpar parâmetros da URL imediatamente para evitar reaberturas involuntárias
        navigate(location.pathname, { replace: true, state: {} });

        // 1. Limpar busca e filtros da página
        setSearchTerm('');
        setDebouncedSearch('');
        setFilters(initialFilters);
        setTempFilters(initialFilters);

        // 2. Carregar o registro e descobrir em qual página ele aparece (PAGE_SIZE = 10)
        carregarRegistroCartorioEPagina(editCartorioId, profile.company_id, PAGE_SIZE).then((resultado) => {
            if (!resultado) {
                toast({
                    title: 'Registro de cartório não encontrado',
                    variant: 'destructive',
                });
                return;
            }

            // 3. Define a página calculada
            setPage(resultado.page);

            // 4. Destaca a linha por 3 segundos
            setHighlightRecordId(editCartorioId);
            setTimeout(() => {
                setHighlightRecordId(null);
            }, 3000);

            // 5. Rola suavemente até o registro se já estiver no DOM
            setTimeout(() => {
                const el = document.getElementById(`cartorio-row-${editCartorioId}`) || document.getElementById(`cartorio-card-${editCartorioId}`);
                if (el) {
                    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            }, 150);
        });
    }, [location.search, location.state, profile?.company_id, navigate, toast]);

    React.useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(0);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Active filters count
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (filters.projectId !== 'all') count++;
        if (filters.startDate || filters.endDate) count++;
        return count;
    }, [filters]);

    // Fetch Projects using a double query to get only those actually used
    const { data: projectsData } = useQuery({
        queryKey: ['filter_projects', profile?.company_id],
        queryFn: async () => {
            if (!profile?.company_id) return [];
            
            const { data: records, error: recordsError } = await supabase
                .from('cartorio_records')
                .select('project_id')
                .eq('company_id', profile.company_id)
                .not('project_id', 'is', null);
                
            if (recordsError) throw recordsError;
            
            const projectIds = [...new Set(records?.map(r => r.project_id).filter(Boolean))];
            
            if (projectIds.length === 0) return [];

            const { data, error } = await supabase
                .from('projects')
                .select('id, name')
                .in('id', projectIds)
                .order('name');
                
            if (error) throw error;
            return data || [];
        },
        enabled: !!profile?.company_id
    });

    // Fetch Summary
    const { data: summaryData, isLoading: isLoadingSummary } = useQuery({
        queryKey: ['cartorioSummary', profile?.company_id, debouncedSearch, filters],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_cartorio_summary', {
                p_company_id: profile!.company_id!,
                p_search: debouncedSearch || null,
                p_project_id: filters.projectId !== 'all' ? filters.projectId : null,
                p_start_date: filters.startDate ? formatDateYMD(filters.startDate) : null,
                p_end_date: filters.endDate ? formatDateYMD(filters.endDate) : null,
            });
            if (error) throw error;
            const row = Array.isArray(data) ? data[0] : data;
            return {
                count: Number(row?.total_count) || 0,
                totalValue: Number(row?.total_value) || 0,
            };
        },
        enabled: !!profile?.company_id,
        placeholderData: (prev) => prev
    });

    // Fetch List
    const { data, isLoading, isError, error } = useQuery<{ data: CartorioRecord[], count: number }>({
        queryKey: ['cartorio_records', profile?.company_id, page, debouncedSearch, filters],
        queryFn: async () => {
            let query = supabase.from('cartorio_records').select('*', { count: 'exact' }).eq('company_id', profile!.company_id!);
            if (debouncedSearch) {
                query = query.ilike('description', `%${debouncedSearch}%`);
            }
            if (filters.projectId !== 'all') {
                query = query.eq('project_id', filters.projectId);
            }
            if (filters.startDate) {
                query = query.gte('issue_date', filters.startDate.toISOString().split('T')[0]);
            }
            if (filters.endDate) {
                query = query.lte('issue_date', filters.endDate.toISOString().split('T')[0]);
            }
            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            const res = await query
                .order('issue_date', { ascending: false })
                .order('created_at', { ascending: false })
                .range(from, to);
            if (res.error) throw res.error;
            return { data: res.data as CartorioRecord[], count: res.count ?? 0 };
        },
        enabled: !!profile?.company_id,
        placeholderData: (prev) => prev
    });

    const totalPages = useMemo(() => (data?.count ? Math.ceil(data.count / PAGE_SIZE) : 0), [data?.count]);

    // Rola até a linha/card destacado assim que os dados carregarem
    useEffect(() => {
        if (highlightRecordId && data?.data) {
            setTimeout(() => {
                const el = document.getElementById(`cartorio-row-${highlightRecordId}`) || document.getElementById(`cartorio-card-${highlightRecordId}`);
                if (el) {
                    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            }, 100);
        }
    }, [highlightRecordId, data?.data]);

    const deleteMutation = useMutation({
        mutationFn: async (record: CartorioRecord) => {
            const filesToDelete = [];
            if (record.file_url) filesToDelete.push(record.file_url);
            if (record.document_file_url) filesToDelete.push(record.document_file_url);
            
            if (filesToDelete.length > 0) {
                const { error: storageError } = await supabase.storage.from('cartorio_docs').remove(filesToDelete);
                if (storageError && !storageError.message.toLowerCase().includes('not found') && !storageError.message.toLowerCase().includes('bucket not found')) {
                     console.error("Storage error on delete:", storageError);
                }
            }

            const { error } = await supabase.from('cartorio_records').delete().eq('id', record.id);
            if (error) throw error;
            
            await logAuditAction(
                profile?.company_id,
                user?.email,
                'EXCLUIR',
                `Cartório/Imóvel: ${record.description}`,
                { id: record.id, amount: record.amount }
            );
            
            return record.id;
        },
        onSuccess: () => {
            toast({ title: 'Sucesso', description: 'Registro excluído.' });
            queryClient.invalidateQueries({ queryKey: ['cartorio_records'] });
            queryClient.invalidateQueries({ queryKey: ['cartorioSummary'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardItems'] });
        },
        onError: (err) => {
            toast({ title: 'Erro', description: formatApiError(err), variant: 'destructive' });
        },
        onSettled: () => {
            setIsDeleteModalOpen(false);
            setSelectedRecord(null);
        }
    });

    const handleViewFile = async (path: string) => {
        try {
            await openStorageFile(path, 'cartorio_docs');
        } catch (err) {
            toast({ 
                title: 'Erro ao acessar arquivo', 
                description: 'Verifique se o bucket "cartorio_docs" é privado e tem as políticas de RLS.', 
                variant: 'destructive' 
            });
        }
    };

    const handleCreate = () => {
        setSelectedRecord(null);
        setIsEditModalOpen(true);
    };

    const handleEdit = (record: CartorioRecord) => {
        setSelectedRecord(record);
        setIsEditModalOpen(true);
    };

    const handleDelete = (record: CartorioRecord) => {
        setSelectedRecord(record);
        setIsDeleteModalOpen(true);
    };

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

    const handleApplyFilters = () => {
        setFilters(tempFilters);
        setIsFilterDrawerOpen(false);
        setPage(0);
    };

    const handleClearFilters = () => {
        setTempFilters(initialFilters);
        setFilters(initialFilters);
        setIsFilterDrawerOpen(false);
        setPage(0);
    };

    return (
        <div className="space-y-6 animate-in fade-in-50">
            {/* Header */}
            <PageHeader
                icon={BuildingIcon}
                title="Cartório e Imóveis"
                description="Registre gastos com documentação e imóveis."
                actions={
                    <Button onClick={handleCreate}>
                        <PlusIcon className="h-4 w-4 mr-2" /> Novo Registro
                    </Button>
                }
            />

            {/* Resumo & Toolbar de Busca e Filtros */}
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 p-4 rounded-xl shadow-sm flex items-center gap-4 w-full md:w-auto">
                    <div className="flex-shrink-0 p-2.5 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20">
                        <DollarSignIcon className="h-5 w-5 text-brand-blue-500" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total (Filtro)</p>
                        {isLoadingSummary ? (
                            <Skeleton className="h-7 w-32 mt-1" />
                        ) : (
                            <p className="text-xl font-bold text-gray-900 dark:text-white truncate">{formatCurrency(summaryData?.totalValue || 0)}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto flex-1 md:justify-end">
                    <div className="relative flex-grow max-w-md">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar por descrição..."
                            className="pl-9 bg-white dark:bg-brand-dark-900 border-gray-300 dark:border-gray-800"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => { setTempFilters(filters); setIsFilterDrawerOpen(true); }}
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
                </div>
            </div>

            {/* Right Drawer de Filtros */}
            <ResponsiveModal open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen} displayMode="drawer">
                <ResponsiveModalContent size="sm">
                    <ResponsiveModalHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand-blue-500/10 rounded-lg border border-brand-blue-500/20">
                                <FilterIcon className="h-5 w-5 text-brand-blue-500" />
                            </div>
                            <div>
                                <ResponsiveModalTitle>Filtrar Cartório e Imóveis</ResponsiveModalTitle>
                                <ResponsiveModalDescription>Refine por obra e período dos documentos</ResponsiveModalDescription>
                            </div>
                        </div>
                    </ResponsiveModalHeader>

                    <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-5 bg-gray-50/50 dark:bg-brand-dark-950/50">
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

                        {/* Obra */}
                        <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                <BuildingIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                                Obra / Projeto
                            </Label>
                            <select
                                value={tempFilters.projectId}
                                onChange={(e) => setTempFilters(f => ({ ...f, projectId: e.target.value }))}
                                className="w-full bg-white dark:bg-brand-dark-950 border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white h-9 px-3 rounded-md text-sm focus:border-brand-blue-500 focus:outline-none"
                            >
                                <option value="all">Todas as Obras</option>
                                {projectsData?.map(project => (
                                    <option key={project.id} value={project.id}>
                                        {project.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Intervalo de Datas */}
                        <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                <CalendarIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                                Intervalo de Datas
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold">Data Inicial</Label>
                                    <Input
                                        type="date"
                                        value={tempFilters.startDate ? tempFilters.startDate.toISOString().split('T')[0] : ''}
                                        onChange={(e) => setTempFilters(f => ({ ...f, startDate: e.target.value ? new Date(e.target.value + 'T00:00:00') : null }))}
                                        className="h-9 text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold">Data Final</Label>
                                    <Input
                                        type="date"
                                        value={tempFilters.endDate ? tempFilters.endDate.toISOString().split('T')[0] : ''}
                                        onChange={(e) => setTempFilters(f => ({ ...f, endDate: e.target.value ? new Date(e.target.value + 'T00:00:00') : null }))}
                                        className="h-9 text-xs"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <ResponsiveModalFooter>
                        <Button variant="ghost" onClick={handleClearFilters} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                            Limpar
                        </Button>
                        <Button onClick={handleApplyFilters} className="bg-brand-blue-600 hover:bg-brand-blue-500 text-white">
                            Aplicar Filtros
                        </Button>
                    </ResponsiveModalFooter>
                </ResponsiveModalContent>
            </ResponsiveModal>

            {/* Conteúdo */}
            {isLoading && !data ? (
                <div className="space-y-4">
                    <Skeleton className="h-20 w-full rounded-2xl" />
                    <Skeleton className="h-20 w-full rounded-2xl" />
                    <Skeleton className="h-20 w-full rounded-2xl" />
                </div>
            ) : isError ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center text-red-400">
                    <p className="font-medium">Erro ao carregar registros.</p>
                    <p className="text-sm mt-1">{(error as Error)?.message || 'Tente novamente.'}</p>
                </div>
            ) : !data || data.data.length === 0 ? (
                <div className="text-center py-16 px-6 bg-white/50 dark:bg-brand-dark-900/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                    <div className="mx-auto p-4 bg-gray-100 dark:bg-gray-800/50 rounded-full w-fit mb-4">
                        <DocumentOutlineIcon className="h-10 w-10 text-brand-blue-500 opacity-80" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Nenhum registro encontrado</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                        {debouncedSearch || activeFiltersCount > 0
                            ? "Nenhum resultado corresponde aos filtros selecionados." 
                            : "Você ainda não cadastrou nenhum documento de cartório ou imóvel."
                        }
                    </p>
                    {activeFiltersCount > 0 && (
                        <div className="mt-4">
                            <Button variant="outline" size="sm" onClick={handleClearFilters}>
                                Limpar Filtros
                            </Button>
                        </div>
                    )}
                    {!debouncedSearch && activeFiltersCount === 0 && (
                        <div className="mt-6">
                            <Button onClick={handleCreate}>
                                <PlusIcon className="h-4 w-4 mr-2"/>
                                Cadastrar Primeiro Registro
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm dark:shadow-xl overflow-hidden">
                    {/* View Desktop - Tabela */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                            <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Descrição</th>
                                    <th className="px-6 py-4 font-semibold">Data</th>
                                    <th className="px-6 py-4 font-semibold text-center">Documento</th>
                                    <th className="px-6 py-4 font-semibold text-center">Comprovante</th>
                                    <th className="px-6 py-4 font-semibold text-right">Valor</th>
                                    <th className="px-6 py-4 font-semibold text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                {data.data.map(item => {
                                    const isHighlighted = highlightRecordId === item.id;
                                    return (
                                        <tr 
                                            key={item.id} 
                                            id={`cartorio-row-${item.id}`}
                                            className={`transition-colors ${
                                                isHighlighted
                                                    ? 'bg-amber-100/90 dark:bg-amber-950/70 ring-2 ring-amber-400 dark:ring-amber-500 font-medium'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                                            }`}
                                        >
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-gray-900 dark:text-white truncate max-w-[300px]" title={item.description}>{item.description}</p>
                                            </td>
                                        <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                                            {new Date(item.issue_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {item.document_file_url ? (
                                                <Button 
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => { e.stopPropagation(); handleViewFile(item.document_file_url!); }}
                                                    className="w-full min-w-[90px] mx-auto text-brand-blue-600 dark:text-brand-blue-400 hover:text-brand-blue-700 dark:hover:text-brand-blue-300 hover:bg-brand-blue-50 dark:hover:bg-brand-blue-900/20"
                                                >
                                                    <FileTextIcon className="h-4 w-4 mr-1.5" /> Ver Doc
                                                </Button>
                                            ) : (
                                                <span className="text-gray-400 dark:text-gray-500 italic text-xs block text-center">Sem anexo</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {item.file_url ? (
                                                <Button 
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => { e.stopPropagation(); handleViewFile(item.file_url!); }}
                                                    className="w-full min-w-[90px] mx-auto text-brand-blue-600 dark:text-brand-blue-400 hover:text-brand-blue-700 dark:hover:text-brand-blue-300 hover:bg-brand-blue-50 dark:hover:bg-brand-blue-900/20"
                                                >
                                                    <FileTextIcon className="h-4 w-4 mr-1.5" /> Ver Recibo
                                                </Button>
                                            ) : (
                                                <span className="text-gray-400 dark:text-gray-500 italic text-xs block text-center">Sem anexo</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right font-semibold text-gray-900 dark:text-white">
                                            {formatCurrency(item.amount)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700">
                                                        <MoreVerticalIcon className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-32 bg-white dark:bg-brand-dark-900 border-gray-200 dark:border-gray-800">
                                                    <DropdownMenuItem onSelect={() => handleEdit(item)} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-brand-dark-800">
                                                        <EditIcon className="h-4 w-4 mr-2" /> Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => handleDelete(item)} className="cursor-pointer text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20">
                                                        <Trash2Icon className="h-4 w-4 mr-2" /> Excluir
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

                    {/* View Mobile - Cards */}
                    <div className="md:hidden flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
                        {data.data.map(item => {
                            const isHighlighted = highlightRecordId === item.id;
                            return (
                                <div 
                                    key={item.id} 
                                    id={`cartorio-card-${item.id}`}
                                    className={`p-4 flex flex-col gap-3 transition-colors ${
                                        isHighlighted
                                            ? 'bg-amber-100/90 dark:bg-amber-950/70 ring-2 ring-amber-400 dark:ring-amber-500'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                                    }`}
                                >
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-grow">
                                        <h3 className="font-medium text-gray-900 dark:text-white text-base leading-tight break-words">{item.description}</h3>
                                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                                            {new Date(item.issue_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                                         <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(item.amount)}</p>
                                         <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700">
                                                    <MoreVerticalIcon className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-32 bg-white dark:bg-brand-dark-900 border-gray-200 dark:border-gray-800">
                                                <DropdownMenuItem onSelect={() => handleEdit(item)} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-brand-dark-800">
                                                    <EditIcon className="h-4 w-4 mr-2" /> Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => handleDelete(item)} className="cursor-pointer text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20">
                                                    <Trash2Icon className="h-4 w-4 mr-2" /> Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                
                                {/* Anexos mobile */}
                                <div className="flex gap-2 pt-2 w-full">
                                    {item.document_file_url && (
                                        <Button 
                                            variant="outline" 
                                            onClick={(e) => { e.stopPropagation(); handleViewFile(item.document_file_url!); }}
                                            className="flex-1 border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-dark-800 hover:bg-gray-50 dark:hover:bg-brand-dark-700 text-gray-700 dark:text-gray-300 h-10 text-xs font-normal"
                                        >
                                            <FileTextIcon className="h-4 w-4 mr-2" /> Ver Doc
                                        </Button>
                                    )}
                                    {item.file_url && (
                                        <Button 
                                            variant="outline" 
                                            onClick={(e) => { e.stopPropagation(); handleViewFile(item.file_url!); }}
                                            className="flex-1 border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-dark-800 hover:bg-gray-50 dark:hover:bg-brand-dark-700 text-gray-700 dark:text-gray-300 h-10 text-xs font-normal"
                                        >
                                            <FileTextIcon className="h-4 w-4 mr-2" /> Ver Recibo
                                        </Button>
                                    )}
                                    {!item.document_file_url && !item.file_url && (
                                        <p className="text-gray-400 dark:text-gray-500 italic text-xs w-full text-center py-1">Sem anexos</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    </div>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 pb-24 md:pb-2 relative z-10">
                    <p className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                        Mostrando página <span className="font-medium text-gray-900 dark:text-white">{page + 1}</span> de <span className="font-medium text-gray-900 dark:text-white">{totalPages}</span>
                    </p>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                        <Button
                            variant="outline"
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="bg-white dark:bg-brand-dark-900 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-brand-dark-800 w-auto"
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="bg-white dark:bg-brand-dark-900 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-brand-dark-800 w-auto"
                        >
                            Próxima
                        </Button>
                    </div>
                </div>
            )}

            {/* Modals */}
            {isEditModalOpen && (
                <CartorioModal 
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setSelectedRecord(null);
                    }}
                    record={selectedRecord}
                />
            )}
            
             <ConfirmationModal 
                isOpen={isDeleteModalOpen} 
                onClose={() => setIsDeleteModalOpen(false)} 
                onConfirm={() => selectedRecord && deleteMutation.mutate(selectedRecord)}
                title={`Confirmar Exclusão`}
                description={<>Você tem certeza que deseja excluir o registro de <strong>{selectedRecord?.description}</strong>?</>} 
                confirmText="Excluir"
                isLoading={deleteMutation.isPending}
            />
        </div>
    );
};

// Generic placeholder icon if one string fails
const DocumentOutlineIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
);

export default Cartorio;
