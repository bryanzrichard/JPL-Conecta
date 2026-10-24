import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { NotaFiscal, NotaWithItemCount, Supplier, Project, AIProcessJob, PAYMENT_METHODS } from '../types';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FileTextIcon, DollarSignIcon, FilterIcon, PlusIcon, MoreVerticalIcon, EditIcon, Trash2Icon, EyeIcon, PackageIcon } from '../lib/icons';
import ListaNotas from '../components/notas/ListaNotas';
import DetalhesNotaModal from '../components/notas/DetalhesNotaModal';
import ManualNotaModal from '../components/notas/ManualNotaModal';
import SuccessPopup from '../components/notas/SuccessPopup';
import { PageHeader } from '../components/ui/PageHeader';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../components/ui/ResponsiveModal';
import FiltrosNotas, { NotaFilters } from '../components/notas/FiltrosNotas';
import { useQuery, useQueryClient, useMutation, useInfiniteQuery } from '@tanstack/react-query';
import NotasPendentesIA, { LocalJob } from '../components/notas/NotasPendentesIA';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { formatApiError } from '../lib/handleError';
import { formatCurrency, formatDateBR as formatDate } from '../lib/utils';
import { useToast } from '../contexts/ToastContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Skeleton } from '../components/ui/Skeleton';
import { TableSkeleton } from '../components/ui/TableSkeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/DropdownMenu';
import { Badge } from '../components/ui/Badge';
import { useUploadNotaIA } from '../hooks/useUploadNotaIA';
import { logAuditAction } from '../lib/auditLogger';

const UploadNotaModal = lazy(() => import('../components/notas/UploadNotaModal'));
const EditarNotaModal = lazy(() => import('../components/notas/EditarNotaModal'));

const PAGE_SIZE = 10;

const initialFilters: NotaFilters = {
    invoice_number: '',
    supplier_id: null,
    project_id: null,
    payment_method: null,
    start_date: null,
    end_date: null,
};

const fetchNotas = async ({ pageParam = 0, queryKey }: { pageParam?: number, queryKey: any }) => {
    const [_, companyId, filters] = queryKey;
    if (!companyId) return { data: [], count: 0, nextPage: undefined };

    let query = supabase
        .from('notas_fiscais')
        .select('*, projects(name), suppliers(name), itens_nota_fiscal(count)', { count: 'exact' })
        .eq('company_id', companyId);

    if (filters.invoice_number) {
        query = query.ilike('invoice_number', `%${filters.invoice_number}%`);
    }
    if (filters.supplier_id) {
        query = query.eq('supplier_id', filters.supplier_id);
    }
    if (filters.project_id) {
        query = query.eq('project_id', filters.project_id);
    }
    if (filters.payment_method) {
        query = query.eq('payment_method', filters.payment_method);
    }
    if (filters.start_date) {
        const d = filters.start_date instanceof Date ? filters.start_date.toISOString().split('T')[0] : filters.start_date;
        query = query.gte('issue_date', d);
    }
    if (filters.end_date) {
        const d = filters.end_date instanceof Date ? filters.end_date.toISOString().split('T')[0] : filters.end_date;
        query = query.lte('issue_date', d);
    }

    const from = pageParam * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);

    if (error) {
        throw new Error(`Falha ao buscar notas: ${error.message}`);
    }
    
    const formattedData = (data || []).map((n: any) => ({
        ...n,
        item_count: n.itens_nota_fiscal?.[0]?.count || 0,
        itens_nota_fiscal: undefined
    }));

    return { 
        data: formattedData as NotaWithItemCount[], 
        count: count ?? 0,
        nextPage: data && data.length === PAGE_SIZE ? pageParam + 1 : undefined
    };
};

const fetchNotasSummary = async (companyId: string, filters: NotaFilters) => {
    let query = supabase
        .from('notas_fiscais')
        .select('total_value', { count: 'exact' })
        .eq('company_id', companyId);

    if (filters.invoice_number) {
        query = query.ilike('invoice_number', `%${filters.invoice_number}%`);
    }
    if (filters.supplier_id) {
        query = query.eq('supplier_id', filters.supplier_id);
    }
    if (filters.project_id) {
        query = query.eq('project_id', filters.project_id);
    }
    if (filters.payment_method) {
        query = query.eq('payment_method', filters.payment_method);
    }
    if (filters.start_date) {
        const d = filters.start_date instanceof Date ? filters.start_date.toISOString().split('T')[0] : filters.start_date;
        query = query.gte('issue_date', d);
    }
    if (filters.end_date) {
        const d = filters.end_date instanceof Date ? filters.end_date.toISOString().split('T')[0] : filters.end_date;
        query = query.lte('issue_date', d);
    }

    const { data, error, count } = await query.range(0, 9999);
    if (error) throw error;
    
    const totalValue = (data || []).reduce((sum, row) => sum + (Number(row.total_value) || 0), 0);
    return { totalValue, count: count ?? 0 };
};

const Notas: React.FC = () => {
    const { user, profile } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();

    // Modals state
    const [selectedNota, setSelectedNota] = useState<NotaFiscal | NotaWithItemCount | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);

    // Edit and Delete Modal state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [notaToEdit, setNotaToEdit] = useState<NotaWithItemCount | null>(null);
    const [isDeleteNotaModalOpen, setDeleteNotaModalOpen] = useState(false);
    const [notaToDelete, setNotaToDelete] = useState<NotaWithItemCount | null>(null);
    
    // Filters state
    const [filters, setFilters] = useState<NotaFilters>(initialFilters);
    const [tempFilters, setTempFilters] = useState<NotaFilters>(initialFilters);
    const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);

    // Active filters count
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (filters.invoice_number) count++;
        if (filters.supplier_id) count++;
        if (filters.project_id) count++;
        if (filters.payment_method) count++;
        if (filters.start_date || filters.end_date) count++;
        return count;
    }, [filters]);

    // State to manage reviewing a job from the pending list
    const [selectedJob, setSelectedJob] = useState<AIProcessJob | null>(null);
    const [jobToArchive, setJobToArchive] = useState<AIProcessJob | null>(null);

    const { localJobs, processFile, removeLocalJob } = useUploadNotaIA();
    const handledNotaIdRef = useRef<string | null>(null);

    // Query principal de notas com paginação infinita
    const { 
        data: notasData, 
        error: notasError, 
        fetchNextPage, 
        hasNextPage, 
        isFetchingNextPage, 
        isLoading: isLoadingNotas,
        status: notasStatus 
    } = useInfiniteQuery({
        queryKey: ['notas', profile?.company_id, filters],
        queryFn: fetchNotas,
        enabled: !!profile?.company_id,
        getNextPageParam: (lastPage) => lastPage.nextPage,
        initialPageParam: 0,
    });

    const allNotas = useMemo(() => notasData?.pages.flatMap(page => page.data) ?? [], [notasData]);

    // Effect to open modal from Quick Add button
    useEffect(() => {
        if (location.state?.action === 'newAiNota') {
            setIsUploadModalOpen(true);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, location.pathname]);

    // Interceptar ?editar={id} para abrir modal de exibição e detalhes automaticamente sem loop
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const editNotaId = searchParams.get('editar') || (location.state as any)?.editId;

        if (!editNotaId || !profile?.company_id) return;
        if (handledNotaIdRef.current === editNotaId) return;

        handledNotaIdRef.current = editNotaId;
        navigate(location.pathname, { replace: true, state: {} });

        let isCurrent = true;

        const loadNotaForDisplay = async () => {
            const found = allNotas.find(n => n.id === editNotaId);
            if (found && isCurrent) {
                setSelectedNota(found);
                setIsDetailsModalOpen(true);
                return;
            }

            try {
                const { data: notaData } = await supabase
                    .from('notas_fiscais')
                    .select('*, projects(name), suppliers(name), itens_nota_fiscal(count)')
                    .eq('id', editNotaId)
                    .eq('company_id', profile.company_id)
                    .maybeSingle();

                if (!isCurrent) return;

                if (notaData) {
                    const formatted = {
                        ...notaData,
                        item_count: (notaData as any).itens_nota_fiscal?.[0]?.count || 0,
                        itens_nota_fiscal: undefined
                    };
                    setSelectedNota(formatted as any);
                    setIsDetailsModalOpen(true);
                    return;
                }

                const { data: itemData } = await supabase
                    .from('itens_nota_fiscal')
                    .select('nota_fiscal_id')
                    .eq('id', editNotaId)
                    .maybeSingle();

                if (itemData?.nota_fiscal_id && isCurrent) {
                    const { data: notaFromItem } = await supabase
                        .from('notas_fiscais')
                        .select('*, projects(name), suppliers(name), itens_nota_fiscal(count)')
                        .eq('id', itemData.nota_fiscal_id)
                        .eq('company_id', profile.company_id)
                        .maybeSingle();

                    if (notaFromItem && isCurrent) {
                        const formatted = {
                            ...notaFromItem,
                            item_count: (notaFromItem as any).itens_nota_fiscal?.[0]?.count || 0,
                            itens_nota_fiscal: undefined
                        };
                        setSelectedNota(formatted as any);
                        setIsDetailsModalOpen(true);
                    }
                }
            } catch (err) {
                console.error('Erro ao carregar detalhes da nota selecionada:', err);
            }
        };

        loadNotaForDisplay();

        return () => {
            isCurrent = false;
        };
    }, [location.search, location.state, profile?.company_id, navigate, allNotas]);

    const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery({
        queryKey: ['suppliers', profile?.company_id],
        queryFn: async () => {
            const { data, error } = await supabase.from('suppliers').select('*').eq('company_id', profile!.company_id).order('name');
            if (error) throw error;
            return data as Supplier[];
        },
        enabled: !!profile?.company_id,
    });

    const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
        queryKey: ['projects', profile?.company_id],
        queryFn: async () => {
            const { data, error } = await supabase.from('projects').select('*').eq('company_id', profile!.company_id).order('name');
            if (error) throw error;
            return data as Project[];
        },
        enabled: !!profile?.company_id,
    });

    const isLoadingPrerequisites = isLoadingSuppliers || isLoadingProjects;

    const { data: activeJobs, isLoading: isLoadingActiveJobs } = useQuery({
        queryKey: ['active_ai_jobs', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const { data, error } = await (supabase as any)
                .from('ai_process_jobs')
                .select('*')
                .eq('user_id', user.id)
                .in('status', ['pending', 'processing', 'completed', 'failed'])
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data as AIProcessJob[] || [];
        },
        enabled: !!user?.id,
        refetchInterval: (query) => {
            const jobs = query.state.data as AIProcessJob[] | undefined;
            if (!jobs) return false;
            return jobs.some(job => job.status === 'pending' || job.status === 'processing') ? 5000 : false;
        },
    });

    const archiveJobMutation = useMutation({
        mutationFn: async (jobId: string) => {
            const { error } = await (supabase as any)
                .from('ai_process_jobs')
                .update({ status: 'archived' })
                .eq('id', jobId);
            if (error) throw error;
        },
        onSuccess: () => {
            const successMessage = jobToArchive?.status === 'completed' ? 'Nota processada descartada.' : 'Processamento cancelado.';
            toast({ title: 'Sucesso', description: successMessage });
            queryClient.invalidateQueries({ queryKey: ['active_ai_jobs', user?.id] });
        },
        onError: (err) => {
            toast({ variant: 'destructive', title: 'Erro!', description: formatApiError(err) });
        },
        onSettled: () => {
            setDeleteModalOpen(false);
            setJobToArchive(null);
        }
    });

    // Exclusão completa de Nota Fiscal (Arquivo Storage + Banco de Dados + Auditoria)
    const deleteNotaMutation = useMutation({
        mutationFn: async (nota: NotaWithItemCount | NotaFiscal) => {
            if (nota.file_url) {
                const { error: storageError } = await supabase.storage
                    .from('jpl-conecta')
                    .remove([nota.file_url]);

                if (storageError && !storageError.message.toLowerCase().includes('not found') && !storageError.message.includes('bucket not found')) {
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
            toast({ title: 'Sucesso!', description: 'Nota fiscal excluída com sucesso.' });
            queryClient.invalidateQueries({ queryKey: ['notas'] });
            queryClient.invalidateQueries({ queryKey: ['notasSummary'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardItems'] });
        },
        onError: (err) => {
            toast({ variant: 'destructive', title: 'Erro ao excluir nota!', description: formatApiError(err) });
        },
        onSettled: () => {
            setDeleteNotaModalOpen(false);
            setNotaToDelete(null);
            if (isDetailsModalOpen) {
                setIsDetailsModalOpen(false);
                setSelectedNota(null);
            }
        }
    });
    
    const { data: summaryData, isLoading: isLoadingSummary } = useQuery({
        queryKey: ['notasSummary', profile?.company_id, filters],
        queryFn: () => fetchNotasSummary(profile!.company_id!, filters),
        enabled: !!profile?.company_id,
    });
    
    const handleSelectNota = (nota: NotaWithItemCount | NotaFiscal) => {
        setSelectedNota(nota);
        setIsDetailsModalOpen(true);
    };

    const handleEditNota = (nota: NotaWithItemCount | NotaFiscal) => {
        setNotaToEdit(nota as NotaWithItemCount);
        setIsEditModalOpen(true);
    };

    const handleDeleteNota = (nota: NotaWithItemCount | NotaFiscal) => {
        setNotaToDelete(nota as NotaWithItemCount);
        setDeleteNotaModalOpen(true);
    };

    const handleApplyFilters = () => {
        setFilters(tempFilters);
        setIsFilterSheetOpen(false);
    };

    const handleClearFilters = () => {
        setTempFilters(initialFilters);
        setFilters(initialFilters);
        setIsFilterSheetOpen(false);
    };

    const handleSaveSuccess = (isAiFlow = false) => {
        setIsUploadModalOpen(false);
        setIsManualModalOpen(false);
        setSelectedJob(null);
        
        queryClient.invalidateQueries({ queryKey: ['notas'] });
        queryClient.invalidateQueries({ queryKey: ['active_ai_jobs', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['notasSummary'] });
        queryClient.invalidateQueries({ queryKey: ['dashboardItems'] });
        
        setShowSuccessPopup(true);
    };

    const handleSelectJobForReview = (job: AIProcessJob) => {
        setSelectedJob(job);
    };
    
    const handleCloseUploadModal = () => {
        setIsUploadModalOpen(false);
        setSelectedJob(null);
    };

    const handleArchiveOrCancelJob = (job: AIProcessJob) => {
        setJobToArchive(job);
        setDeleteModalOpen(true);
    };
    
    const handleConfirmArchiveOrCancel = () => {
        if (jobToArchive) {
            if (jobToArchive.id.startsWith('temp_')) {
                removeLocalJob(jobToArchive.id);
                setDeleteModalOpen(false);
                setJobToArchive(null);
            } else {
                archiveJobMutation.mutate(jobToArchive.id);
            }
        }
    };

    const combinedJobs: LocalJob[] = [
        ...localJobs,
        ...(activeJobs || []).map(job => ({ ...job }))
    ];

    return (
        <div className="space-y-6 animate-in fade-in-50">
            <PageHeader
                icon={FileTextIcon}
                title="Notas Fiscais"
                description="Gerencie e audite suas notas fiscais de entrada."
                actions={
                    <>
                        <Button onClick={() => setIsUploadModalOpen(true)}>
                            <PlusIcon className="h-4 w-4 mr-2" />
                            Registrar com IA
                        </Button>
                        <Button onClick={() => setIsManualModalOpen(true)} variant="outline">
                            <PlusIcon className="h-4 w-4 mr-2" />
                            Registro Manual
                        </Button>
                    </>
                }
            />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 p-4 rounded-xl flex items-center gap-4 w-full md:w-auto justify-start shadow-sm order-2 md:order-1">
                    <div className="flex-shrink-0 p-2.5 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20">
                        <DollarSignIcon className="h-5 w-5 text-brand-blue-500" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Valor Total (Filtro)</p>
                        {isLoadingSummary ? (
                           <Skeleton className="h-7 w-32 mt-1" />
                        ) : (
                           <p className="text-xl font-bold text-gray-900 dark:text-white truncate">{formatCurrency(summaryData?.totalValue || 0)}</p>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-between md:justify-end order-1 md:order-2">
                     <div className="text-sm text-gray-500 dark:text-gray-400">
                        {isLoadingSummary ? <Skeleton className="h-5 w-24" /> : <>
                          <span className="font-bold text-gray-900 dark:text-white">{summaryData?.count || 0}</span> {summaryData?.count === 1 ? 'nota encontrada' : 'notas encontradas'}
                        </>}
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => { setTempFilters(filters); setIsFilterSheetOpen(true); }}
                        className="relative h-9 px-3.5 text-sm font-medium border-gray-300 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:text-brand-blue-600 dark:hover:text-brand-blue-400 hover:border-brand-blue-500/50 hover:bg-brand-blue-50/50 dark:hover:bg-brand-blue-500/10 transition-colors"
                    >
                        <FilterIcon className="h-4 w-4 mr-2 text-brand-blue-500" />
                        <span>Filtrar Notas</span>
                        {activeFiltersCount > 0 && (
                            <span className="ml-2 flex items-center justify-center h-5 min-w-[20px] px-1 text-[11px] font-bold rounded-full bg-brand-blue-600 text-white shadow-sm">
                                {activeFiltersCount}
                            </span>
                        )}
                    </Button>
                </div>
            </div>

            {/* Active Filters Bar */}
            {activeFiltersCount > 0 && (
                <div className="flex items-center justify-between gap-3 bg-brand-blue-50/50 dark:bg-brand-blue-950/30 border border-brand-blue-200 dark:border-brand-blue-900/50 px-4 py-2.5 rounded-xl">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-semibold text-brand-blue-700 dark:text-brand-blue-300 flex items-center gap-1.5">
                            <FilterIcon className="h-3.5 w-3.5" /> Filtros ativos ({activeFiltersCount}):
                        </span>
                        {filters.invoice_number && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                                Nº: {filters.invoice_number}
                            </span>
                        )}
                        {filters.supplier_id && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                                Fornecedor: {suppliers.find(s => s.id === filters.supplier_id)?.name}
                            </span>
                        )}
                        {filters.project_id && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                                Obra: {projects.find(p => p.id === filters.project_id)?.name}
                            </span>
                        )}
                        {filters.payment_method && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                                Pgto: {filters.payment_method}
                            </span>
                        )}
                        {(filters.start_date || filters.end_date) && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                                Período: {filters.start_date ? filters.start_date.toLocaleDateString('pt-BR') : 'Início'} até {filters.end_date ? filters.end_date.toLocaleDateString('pt-BR') : 'Hoje'}
                            </span>
                        )}
                    </div>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleClearFilters}
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
                                <ResponsiveModalTitle>Filtrar Notas Fiscais</ResponsiveModalTitle>
                                <ResponsiveModalDescription>Refine a busca por número, fornecedor, obra ou período</ResponsiveModalDescription>
                            </div>
                        </div>
                    </ResponsiveModalHeader>
                    <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-gray-50/50 dark:bg-brand-dark-950/50">
                        <FiltrosNotas
                            filters={tempFilters}
                            onFiltersChange={setTempFilters}
                            suppliers={suppliers}
                            projects={projects}
                        />
                    </div>
                    <ResponsiveModalFooter>
                        <Button variant="ghost" onClick={handleClearFilters} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">Limpar</Button>
                        <Button onClick={handleApplyFilters} className="bg-brand-blue-600 hover:bg-brand-blue-500 text-white">Aplicar Filtros</Button>
                    </ResponsiveModalFooter>
                </ResponsiveModalContent>
            </ResponsiveModal>

            {/* Renderiza a lista de notas pendentes se houver alguma */}
            {combinedJobs.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-white px-2">Em Processamento / Revisão</h2>
                    <NotasPendentesIA
                        jobs={combinedJobs}
                        isLoading={isLoadingActiveJobs && localJobs.length === 0}
                        onSelectJob={handleSelectJobForReview}
                        onArchiveOrCancelJob={handleArchiveOrCancelJob}
                    />
                </div>
            )}

            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white px-2">Notas Fiscais Registradas</h2>
                
                {notasStatus === 'pending' ? (
                    <>
                        <div className="md:hidden">
                            <ListaNotas
                                notas={[]}
                                loading={true}
                                onSelectNota={() => {}}
                                onAddNew={() => setIsManualModalOpen(true)}
                            />
                        </div>
                        <div className="hidden md:block">
                            <TableSkeleton />
                        </div>
                    </>
                ) : notasStatus === 'error' ? (
                    <p className="text-center text-red-500 py-8">Erro ao carregar notas: {(notasError as Error)?.message}</p>
                ) : allNotas.length === 0 ? (
                    <div className="text-center py-12 px-6 bg-brand-dark-900/50 rounded-2xl border-2 border-dashed border-gray-700">
                        <div className="mx-auto p-3 bg-gray-800 rounded-full w-fit mb-4">
                            <FileTextIcon className="h-8 w-8 text-brand-blue-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Nenhuma nota fiscal encontrada</h3>
                        <p className="mt-1 text-sm text-gray-400">Nenhum registro corresponde aos filtros atuais. Tente ajustar sua busca ou adicione uma nova nota.</p>
                        <div className="mt-6">
                            <Button onClick={() => setIsManualModalOpen(true)}>
                                <PlusIcon className="h-4 w-4 mr-2"/>
                                Novo Registro
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Mobile: Cards */}
                        <div className="md:hidden">
                            <ListaNotas
                                notas={allNotas}
                                loading={false}
                                onSelectNota={handleSelectNota}
                                onEditNota={handleEditNota}
                                onDeleteNota={handleDeleteNota}
                                onAddNew={() => setIsManualModalOpen(true)}
                            />
                        </div>

                        {/* Desktop: Table */}
                        <div className="hidden md:block overflow-hidden rounded-xl border border-gray-800 bg-brand-dark-900 shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-gray-400">
                                    <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 border-b border-gray-800">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">Emissão</th>
                                            <th className="px-6 py-4 font-medium">Nota</th>
                                            <th className="px-6 py-4 font-medium">Fornecedor / Obra</th>
                                            <th className="px-6 py-4 font-medium">Pagamento</th>
                                            <th className="px-6 py-4 font-medium text-right">Valor Total</th>
                                            <th className="px-6 py-4 font-medium text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800">
                                        {allNotas.map((nota) => (
                                            <tr 
                                                key={nota.id} 
                                                className="hover:bg-gray-800/50 transition-colors cursor-pointer group"
                                                onClick={() => handleSelectNota(nota)}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">{formatDate(nota.issue_date)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap font-medium text-white">
                                                    <div className="flex items-center gap-2">
                                                        <span>{nota.invoice_number}</span>
                                                        {nota.item_count > 0 && (
                                                            <span className="text-[11px] font-medium text-brand-blue-400 bg-brand-blue-500/10 border border-brand-blue-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                <PackageIcon className="w-3 h-3" />
                                                                {nota.item_count}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-white">{nota.suppliers?.name || 'N/A'}</span>
                                                        <span className="text-xs text-gray-500">{nota.projects?.name || 'N/A'}</span>
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
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <MoreVerticalIcon className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onSelect={() => handleSelectNota(nota)}>
                                                                <EyeIcon className="h-4 w-4 mr-2" /> Visualizar Detalhes
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onSelect={() => handleEditNota(nota)}>
                                                                <EditIcon className="h-4 w-4 mr-2" /> Editar Nota
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onSelect={() => handleDeleteNota(nota)} className="text-red-500 hover:!text-red-400 focus:text-red-500">
                                                                <Trash2Icon className="h-4 w-4 mr-2" /> Excluir Nota
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

                        {/* Botão Carregar Mais Notas */}
                        {hasNextPage && (
                            <div className="flex justify-center mt-6">
                                <Button variant="outline" onClick={() => fetchNextPage()} isLoading={isFetchingNextPage}>
                                    {isFetchingNextPage ? 'Carregando...' : 'Carregar mais notas'}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
            
            {/* Modal de Detalhes da Nota com ações integradas de Editar e Excluir */}
            <DetalhesNotaModal
                nota={selectedNota}
                isOpen={isDetailsModalOpen}
                onClose={() => {
                    setIsDetailsModalOpen(false);
                    setSelectedNota(null);
                }}
                onEdit={(nota) => {
                    setIsDetailsModalOpen(false);
                    handleEditNota(nota);
                }}
                onDelete={(nota) => {
                    setIsDetailsModalOpen(false);
                    handleDeleteNota(nota);
                }}
            />

            {/* Modal de Edição Completa da Nota Fiscal */}
            {isEditModalOpen && (
                <Suspense fallback={<div />}>
                    <EditarNotaModal
                        isOpen={isEditModalOpen}
                        onClose={() => {
                            setIsEditModalOpen(false);
                            setNotaToEdit(null);
                        }}
                        onSuccess={() => {
                            setIsEditModalOpen(false);
                            setNotaToEdit(null);
                            queryClient.invalidateQueries({ queryKey: ['notas'] });
                            queryClient.invalidateQueries({ queryKey: ['notasSummary'] });
                            queryClient.invalidateQueries({ queryKey: ['dashboardItems'] });
                        }}
                        nota={notaToEdit}
                        suppliers={suppliers}
                        projects={projects}
                    />
                </Suspense>
            )}
            
            <ManualNotaModal
                isOpen={isManualModalOpen}
                onClose={() => setIsManualModalOpen(false)}
                onSuccess={() => handleSaveSuccess(false)}
                suppliers={suppliers}
                projects={projects}
            />

             <Suspense fallback={<div />}>
                {(isUploadModalOpen || selectedJob) && (
                    <UploadNotaModal
                        isOpen={isUploadModalOpen || !!selectedJob}
                        onClose={handleCloseUploadModal}
                        onSuccess={() => handleSaveSuccess(true)}
                        suppliers={suppliers}
                        projects={projects}
                        initialJob={selectedJob}
                        onFileSelected={processFile}
                    />
                )}
            </Suspense>

            {showSuccessPopup && (
                <SuccessPopup 
                    message="Nota fiscal registrada com sucesso!" 
                    onClose={() => setShowSuccessPopup(false)} 
                />
            )}
            
            {/* Confirmação de Exclusão de Nota Fiscal */}
            <ConfirmationModal
                isOpen={isDeleteNotaModalOpen}
                onClose={() => {
                    setDeleteNotaModalOpen(false);
                    setNotaToDelete(null);
                }}
                onConfirm={() => notaToDelete && deleteNotaMutation.mutate(notaToDelete)}
                title="Excluir Nota Fiscal"
                description={
                    <>
                        Tem certeza que deseja excluir a nota fiscal <strong>{notaToDelete?.invoice_number || 'selecionada'}</strong>?
                        {notaToDelete?.file_url && (
                            <span className="block mt-2 text-xs text-gray-400">
                                O documento digitalizado anexado também será removido permanentemente do storage.
                            </span>
                        )}
                    </>
                }
                confirmText="Excluir Nota"
                isLoading={deleteNotaMutation.isPending}
            />

            {/* Confirmação de Exclusão de Job IA */}
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleConfirmArchiveOrCancel}
                title={
                    jobToArchive?.status === 'completed' ? "Descartar Nota Processada" : 
                    jobToArchive?.status === 'failed' ? "Remover Nota Falha" : 
                    "Cancelar Processamento"
                }
                description={
                    jobToArchive?.status === 'completed'
                    ? <>Tem certeza que deseja descartar esta nota? O arquivo analisado será removido da sua lista de revisão.</>
                    : jobToArchive?.status === 'failed'
                    ? <>Tem certeza que deseja remover esta nota da lista?</>
                    : <>Tem certeza que deseja cancelar o processamento desta nota? Esta ação não pode ser desfeita.</>
                }
                confirmText={
                    jobToArchive?.status === 'completed' ? "Sim, Descartar" : 
                    jobToArchive?.status === 'failed' ? "Sim, Remover" : 
                    "Sim, Cancelar"
                }
                isLoading={archiveJobMutation.isPending}
            />

        </div>
    );
};

export default Notas;
