import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { NotaFiscal, Supplier, Project, AIProcessJob, PAYMENT_METHODS } from '../types';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FileTextIcon, DollarSignIcon, FilterIcon, PlusIcon, MoreVerticalIcon, EditIcon, Trash2Icon, EyeIcon } from '../lib/icons';
import ListaNotas from '../components/notas/ListaNotas';
import DetalhesNotaModal from '../components/notas/DetalhesNotaModal';
import ManualNotaModal from '../components/notas/ManualNotaModal';
import SuccessPopup from '../components/notas/SuccessPopup';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalFooter } from '../components/ui/ResponsiveModal';
import FiltrosNotas from '../components/notas/FiltrosNotas';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import NotasPendentesIA from '../components/notas/NotasPendentesIA';
import ConfirmationModal from '../components/historico/ConfirmationModal';
import { formatApiError } from '../lib/handleError';
import { formatCurrency, formatDateBR as formatDate } from '../lib/utils';
import { useToast } from '../contexts/ToastContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Skeleton } from '../components/ui/Skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/DropdownMenu';
import { Badge } from '../components/ui/Badge';

const UploadNotaModal = lazy(() => import('../components/notas/UploadNotaModal'));


type NotaFilters = {
    invoice_number: string;
    supplier_id: string | null;
    payment_method: string | null;
    start_date: Date | null;
    end_date: Date | null;
};

const initialFilters: NotaFilters = {
    invoice_number: '',
    supplier_id: null,
    payment_method: null,
    start_date: null,
    end_date: null,
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
    if (filters.payment_method) {
        query = query.eq('payment_method', filters.payment_method);
    }
    if (filters.start_date) {
        query = query.gte('issue_date', filters.start_date.toISOString().split('T')[0]);
    }
    if (filters.end_date) {
        query = query.lte('issue_date', filters.end_date.toISOString().split('T')[0]);
    }

    const { data, error, count } = await query.range(0, 9999);
    if (error) throw error;
    
    const totalValue = (data || []).reduce((sum, row) => sum + (Number(row.total_value) || 0), 0);
    return { totalValue, count: count ?? 0 };
};


import { useUploadNotaIA } from '../hooks/useUploadNotaIA';
import { LocalJob } from '../components/notas/NotasPendentesIA';

const Notas: React.FC = () => {
    const { user, profile } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const [notas, setNotas] = useState<NotaFiscal[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [selectedNota, setSelectedNota] = useState<NotaFiscal | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    
    const [filters, setFilters] = useState<NotaFilters>(initialFilters);
    const [tempFilters, setTempFilters] = useState<NotaFilters>(initialFilters);
    const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [limit, setLimit] = useState(20);

    // State to manage reviewing a job from the pending list
    const [selectedJob, setSelectedJob] = useState<AIProcessJob | null>(null);
    const [jobToArchive, setJobToArchive] = useState<AIProcessJob | null>(null);

    const { localJobs, processFile, removeLocalJob } = useUploadNotaIA();

     // Effect to open modal from Quick Add button
    useEffect(() => {
        if (location.state?.action === 'newAiNota') {
            setIsUploadModalOpen(true);
            // Clear location state to prevent re-opening on refresh
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate]);

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
                .in('status', ['pending', 'processing', 'completed', 'failed']) // Don't fetch archived jobs
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data as AIProcessJob[] || [];
        },
        enabled: !!user?.id,
        refetchInterval: (query) => {
            const jobs = query.state.data as AIProcessJob[] | undefined;
            // Keep polling if ANY job is being processed or pending
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
            const errorMessage = formatApiError(err);
            toast({ variant: 'destructive', title: 'Erro!', description: errorMessage });
        },
        onSettled: () => {
            setDeleteModalOpen(false);
            setJobToArchive(null);
        }
    });

    const requestIdRef = useRef(0);

    const fetchNotas = useCallback(async (currentFilters: NotaFilters, currentLimit: number, isLoadMore: boolean = false) => {
        if (!profile?.company_id) return;
        const currentRequestId = ++requestIdRef.current;
        
        if (isLoadMore) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }

        try {
            let query = supabase
                .from('notas_fiscais')
                .select('*, projects(name), suppliers(name)')
                .eq('company_id', profile.company_id);

            if (currentFilters.invoice_number) {
                query = query.ilike('invoice_number', `%${currentFilters.invoice_number}%`);
            }
            if (currentFilters.supplier_id) {
                query = query.eq('supplier_id', currentFilters.supplier_id);
            }
            if (currentFilters.payment_method) {
                query = query.eq('payment_method', currentFilters.payment_method);
            }
            if (currentFilters.start_date) {
                query = query.gte('issue_date', currentFilters.start_date.toISOString().split('T')[0]);
            }
            if (currentFilters.end_date) {
                query = query.lte('issue_date', currentFilters.end_date.toISOString().split('T')[0]);
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(currentLimit);

            if (error) throw error;
            if (currentRequestId === requestIdRef.current) {
                setNotas(data || []);
            }
        } catch (err) {
            console.error("Error fetching invoices:", err);
        } finally {
            if (currentRequestId === requestIdRef.current) {
                if (isLoadMore) {
                    setLoadingMore(false);
                } else {
                    setLoading(false);
                }
            }
        }
    }, [profile?.company_id]);

    const prevLimitRef = useRef(limit);
    useEffect(() => {
        const isLoadMore = prevLimitRef.current !== limit && prevLimitRef.current < limit;
        fetchNotas(filters, limit, isLoadMore);
        prevLimitRef.current = limit;
    }, [fetchNotas, filters, limit]);
    
    const { data: summaryData, isLoading: isLoadingSummary } = useQuery({
        queryKey: ['notasSummary', profile?.company_id, filters],
        queryFn: () => fetchNotasSummary(profile!.company_id!, filters),
        enabled: !!profile?.company_id,
    });
    
    const handleSelectNota = (nota: NotaFiscal) => {
        setSelectedNota(nota);
        setIsDetailsModalOpen(true);
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
        
        fetchNotas(filters, limit); // Re-fetch the main list
        queryClient.invalidateQueries({ queryKey: ['active_ai_jobs', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['notasSummary'] }); // Invalidate summary
        queryClient.invalidateQueries({ queryKey: ['dashboardItems'] });
        
        setShowSuccessPopup(true);
    };

    const handleSelectJobForReview = (job: AIProcessJob) => {
        setSelectedJob(job);
    };
    
    const handleCloseUploadModal = () => {
        setIsUploadModalOpen(false);
        setSelectedJob(null);
    }

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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-center sm:justify-between gap-4 text-center sm:text-left">
                <div className='flex flex-col sm:flex-row items-center gap-3'>
                    <FileTextIcon className="h-8 w-8 text-brand-blue-500" />
                    <div>
                        <h1 className="text-2xl font-bold text-white">Notas Fiscais</h1>
                        <p className="text-gray-400 text-sm">Gerencie suas notas fiscais.</p>
                    </div>
                </div>
                 <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button onClick={() => setIsUploadModalOpen(true)} className="w-full sm:w-auto">
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Registrar com IA
                    </Button>
                    <Button onClick={() => setIsManualModalOpen(true)} variant="outline" className="w-full sm:w-auto">
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Registro Manual
                    </Button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center md:items-center gap-4">
                {/* Count and Filter Button - Moved up to be above the value on mobile */}
                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-center md:justify-end order-1 md:order-2">
                     <div className="text-sm text-gray-400">
                        {isLoadingSummary ? <Skeleton className="h-5 w-24" /> : <>
                          <span className="font-bold text-white">{summaryData?.count || 0}</span> {summaryData?.count === 1 ? 'nota encontrada' : 'notas encontradas'}
                        </>}
                    </div>
                    <Button variant="outline" className="border-brand-blue-500/50 text-brand-blue-500 hover:bg-brand-blue-500/10 hover:text-brand-blue-400" onClick={() => { setTempFilters(filters); setIsFilterSheetOpen(true); }}>
                        <FilterIcon className="h-4 w-4 mr-2"/>
                        Filtrar Histórico
                    </Button>
                    <ResponsiveModal open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen} displayMode="drawer">
                        <ResponsiveModalContent className="w-full sm:max-w-md bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
                            <ResponsiveModalHeader className="px-5 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-brand-blue-500/10 rounded-lg">
                                        <FilterIcon className="h-5 w-5 text-brand-blue-500" />
                                    </div>
                                    <div>
                                        <ResponsiveModalTitle className="text-gray-900 dark:text-white text-lg">Filtrar Notas Fiscais</ResponsiveModalTitle>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Refine a busca por notas fiscais</p>
                                    </div>
                                </div>
                            </ResponsiveModalHeader>
                            <div className="flex-grow overflow-y-auto custom-scrollbar p-5 bg-brand-dark-950/50">
                                <FiltrosNotas
                                    filters={tempFilters}
                                    onFiltersChange={setTempFilters}
                                    suppliers={suppliers}
                                />
                            </div>
                            <ResponsiveModalFooter className="p-4 border-t border-gray-800 bg-brand-dark-900 flex-shrink-0 flex justify-end items-center gap-3">
                                <Button variant="ghost" onClick={handleClearFilters} className="h-9 px-4 text-gray-400 hover:text-white hover:bg-brand-dark-800">Limpar</Button>
                                <Button onClick={handleApplyFilters} className="h-9 px-6 bg-brand-blue-600 hover:bg-brand-blue-500 text-white">Aplicar Filtros</Button>
                            </ResponsiveModalFooter>
                        </ResponsiveModalContent>
                    </ResponsiveModal>
                </div>

                {/* Valor Total - Moved down to be below the filter on mobile */}
                <div className="bg-brand-dark-900 p-5 rounded-2xl shadow-2xl shadow-black/50 flex items-center gap-4 w-full md:w-auto justify-center md:justify-start order-2 md:order-1">
                    <div className="flex-shrink-0 p-3 rounded-full bg-brand-blue-500/10">
                        <DollarSignIcon className="h-6 w-6 text-brand-blue-500" />
                    </div>
                    <div className="text-center md:text-left">
                        <p className="text-sm text-gray-400">Valor Total (Filtro)</p>
                        {isLoadingSummary ? (
                           <Skeleton className="h-8 w-32 mt-1" />
                        ) : (
                           <p className="text-2xl font-bold text-white truncate">{formatCurrency(summaryData?.totalValue || 0)}</p>
                        )}
                    </div>
                </div>
            </div>

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
                <h2 className="text-lg font-semibold text-white px-2">Últimos Registros</h2>
                
                {loading ? (
                    <p className="text-center text-gray-400 py-8">Carregando notas...</p>
                ) : notas.length === 0 ? (
                    <div className="text-center py-12 px-6 bg-brand-dark-900/50 rounded-2xl border-2 border-dashed border-gray-700">
                        <div className="mx-auto p-3 bg-gray-800 rounded-full w-fit mb-4">
                            <FileTextIcon className="h-8 w-8 text-brand-blue-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Nenhuma nota fiscal encontrada</h3>
                        <p className="mt-1 text-sm text-gray-400">Você ainda não tem registros. Adicione uma nota manualmente ou use a IA.</p>
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
                                notas={notas}
                                loading={loading}
                                onSelectNota={handleSelectNota}
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
                                        {notas.map((nota) => (
                                            <tr 
                                                key={nota.id} 
                                                className="hover:bg-gray-800/50 transition-colors cursor-pointer group"
                                                onClick={() => handleSelectNota(nota)}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">{formatDate(nota.issue_date)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap font-medium text-white">{nota.invoice_number}</td>
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
                                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSelectNota(nota); }}>
                                                        <EyeIcon className="h-4 w-4 text-gray-400 hover:text-white" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Botão Ver Mais */}
                        {notas.length >= limit && (
                            <div className="flex justify-center mt-6">
                                <Button variant="outline" onClick={() => setLimit(l => l + 20)} disabled={loadingMore}>
                                    {loadingMore ? 'Carregando...' : 'Ver mais'}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
            
            <DetalhesNotaModal
                nota={selectedNota}
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
            />
            
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