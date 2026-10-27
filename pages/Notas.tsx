import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { NotaFiscal, NotaWithItemCount, Supplier, Project, AIProcessJob, PAYMENT_METHODS } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { TableSkeleton } from '../components/ui/TableSkeleton';
import { 
    FileTextIcon, DollarSignIcon, FilterIcon, PlusIcon, MoreVerticalIcon, 
    EditIcon, Trash2Icon, EyeIcon, PackageIcon, DownloadIcon, 
    TrendingUpIcon, ConstructionIcon, BuildingIcon, SparklesIcon,
    UploadCloudIcon, SearchIcon, XIcon, CheckCircle2Icon
} from '../lib/icons';
import ListaNotas from '../components/notas/ListaNotas';
import DetalhesNotaModal from '../components/notas/DetalhesNotaModal';
import ManualNotaModal from '../components/notas/ManualNotaModal';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../components/ui/ResponsiveModal';
import FiltrosNotas, { NotaFilters } from '../components/notas/FiltrosNotas';
import { useQuery, useQueryClient, useMutation, useInfiniteQuery } from '@tanstack/react-query';
import NotasPendentesIA, { LocalJob } from '../components/notas/NotasPendentesIA';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { formatApiError } from '../lib/handleError';
import { formatCurrency, formatDateBR as formatDate, formatDateYMD } from '../lib/utils';
import { useToast } from '../contexts/ToastContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/DropdownMenu';
import { useUploadNotaIA } from '../hooks/useUploadNotaIA';
import { logAuditAction } from '../lib/auditLogger';
import { useMediaQuery } from '../hooks/use-media-query';
import NotaDetailPanel from '../components/notas/NotaDetailPanel';

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

const isReceipt = (invoiceNumber?: string | null): boolean => {
    if (!invoiceNumber) return false;
    const lower = invoiceNumber.toLowerCase();
    return lower.includes('rec') || lower.includes('recibo') || lower.includes('cupom');
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

type NotaExportRow = NotaFiscal & {
    projects: { name: string } | null;
    suppliers: { name: string } | null;
    itens_nota_fiscal: { count: number }[] | null;
};

const fetchNotasSummary = async (companyId: string, filters: NotaFilters) => {
    const { data, error } = await supabase.rpc('get_notas_summary', {
        p_company_id: companyId,
        p_invoice_number: filters.invoice_number || null,
        p_supplier_id: filters.supplier_id || null,
        p_project_id: filters.project_id || null,
        p_payment_method: filters.payment_method || null,
        p_start_date: filters.start_date ? formatDateYMD(filters.start_date) : null,
        p_end_date: filters.end_date ? formatDateYMD(filters.end_date) : null,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    return {
        totalValue: Number(row?.total_value) || 0,
        count: Number(row?.total_count) || 0,
    };
};

const Notas: React.FC = () => {
    const { user, profile } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const isDesktop = useMediaQuery('(min-width: 1024px)');

    // Modals state
    const [selectedNota, setSelectedNota] = useState<NotaFiscal | NotaWithItemCount | null>(null);
    const [highlightItemId, setHighlightItemId] = useState<string | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

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

    // Navegação Sequencial no Drawer de Detalhes
    const selectedNotaIndex = useMemo(() => {
        if (!selectedNota) return -1;
        return allNotas.findIndex(n => n.id === selectedNota.id);
    }, [selectedNota, allNotas]);

    const hasPrevNota = selectedNotaIndex > 0;
    const hasNextNota = selectedNotaIndex >= 0 && selectedNotaIndex < allNotas.length - 1;
    const pendingAdvanceAfterFetchRef = useRef(false);
    const tableSentinelRef = useRef<HTMLDivElement | null>(null);

    const handlePrevNota = useCallback(() => {
        if (hasPrevNota) {
            setSelectedNota(allNotas[selectedNotaIndex - 1]);
        }
    }, [hasPrevNota, selectedNotaIndex, allNotas]);

    const handleNextNota = useCallback(() => {
        if (hasNextNota) {
            setSelectedNota(allNotas[selectedNotaIndex + 1]);
            // Se estiver nos últimos 3 itens e houver próxima página, pré-carrega em background!
            if (selectedNotaIndex >= allNotas.length - 3 && hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
            }
        } else if (hasNextPage && !isFetchingNextPage) {
            // Chegou no final da página atual, solicita próxima página e avança assim que chegar
            pendingAdvanceAfterFetchRef.current = true;
            fetchNextPage();
        }
    }, [hasNextNota, selectedNotaIndex, allNotas, hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Avançar automaticamente para a nota recém-carregada quando pendingAdvanceAfterFetchRef for true
    useEffect(() => {
        if (pendingAdvanceAfterFetchRef.current && allNotas.length > 0) {
            pendingAdvanceAfterFetchRef.current = false;
            if (selectedNotaIndex >= 0 && selectedNotaIndex < allNotas.length - 1) {
                setSelectedNota(allNotas[selectedNotaIndex + 1]);
            }
        }
    }, [allNotas, selectedNotaIndex]);

    // Acompanhar a linha selecionada na tabela ao navegar pelas setas
    useEffect(() => {
        if (!selectedNota) return;
        const el = document.getElementById(`nota-row-${selectedNota.id}`);
        if (el) {
            el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        }
    }, [selectedNota?.id]);

    // Scroll infinito automático via IntersectionObserver
    useEffect(() => {
        const sentinel = tableSentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
            }
        }, { threshold: 0.1 });

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Atalhos de teclado no Split View (↑ / ↓ para navegar pelas notas, Esc para fechar o painel)
    useEffect(() => {
        if (!selectedNota || !isDesktop) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeTag = (document.activeElement?.tagName || '').toLowerCase();
            if (['input', 'textarea', 'select'].includes(activeTag)) return;

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                handlePrevNota();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                handleNextNota();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setSelectedNota(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNota, isDesktop, handlePrevNota, handleNextNota]);

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
        const itemParam = searchParams.get('item');

        if (!editNotaId || !profile?.company_id) return;
        if (handledNotaIdRef.current === editNotaId) return;

        handledNotaIdRef.current = editNotaId;
        if (itemParam) {
            setHighlightItemId(itemParam);
        }
        navigate(location.pathname, { replace: true, state: {} });

        let isCurrent = true;

        const loadNotaForDisplay = async () => {
            const found = allNotas.find(n => n.id === editNotaId);
            if (found && isCurrent) {
                setSelectedNota(found);
                if (!isDesktop) {
                    setIsDetailsModalOpen(true);
                }
                setTimeout(() => {
                    const el = document.getElementById(`nota-row-${editNotaId}`);
                    if (el) {
                        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }
                }, 150);
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
                    if (!isDesktop) {
                        setIsDetailsModalOpen(true);
                    }
                    setTimeout(() => {
                        const el = document.getElementById(`nota-row-${editNotaId}`);
                        if (el) {
                            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        }
                    }, 150);
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
                        if (!isDesktop) {
                            setIsDetailsModalOpen(true);
                        }
                        setTimeout(() => {
                            const el = document.getElementById(`nota-row-${itemData.nota_fiscal_id}`);
                            if (el) {
                                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                            }
                        }, 150);
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
            }
            setSelectedNota(null);
        }
    });
    
    const { data: summaryData, isLoading: isLoadingSummary } = useQuery({
        queryKey: ['notasSummary', profile?.company_id, filters],
        queryFn: () => fetchNotasSummary(profile!.company_id!, filters),
        enabled: !!profile?.company_id,
    });
    
    const handleSelectNota = (nota: NotaWithItemCount | NotaFiscal) => {
        setSelectedNota(nota);
        if (!isDesktop) {
            setIsDetailsModalOpen(true);
        }
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

    // Exportar listagem filtrada para CSV com UTF-8 BOM
    const handleExportCsv = useCallback(async () => {
        if (!profile?.company_id) return;
        try {
            const BATCH_SIZE = 1000;
            let from = 0;
            const exportData: NotaExportRow[] = [];

            while (true) {
                let query = supabase
                    .from('notas_fiscais')
                    .select('*, projects(name), suppliers(name), itens_nota_fiscal(count)')
                    .eq('company_id', profile.company_id);

                if (filters.invoice_number) query = query.ilike('invoice_number', `%${filters.invoice_number}%`);
                if (filters.supplier_id) query = query.eq('supplier_id', filters.supplier_id);
                if (filters.project_id) query = query.eq('project_id', filters.project_id);
                if (filters.payment_method) query = query.eq('payment_method', filters.payment_method);
                if (filters.start_date) {
                    const d = filters.start_date instanceof Date ? formatDateYMD(filters.start_date) : filters.start_date;
                    query = query.gte('issue_date', d);
                }
                if (filters.end_date) {
                    const d = filters.end_date instanceof Date ? formatDateYMD(filters.end_date) : filters.end_date;
                    query = query.lte('issue_date', d);
                }

                const { data: batch, error } = await query
                    .order('issue_date', { ascending: false })
                    .range(from, from + BATCH_SIZE - 1)
                    .returns<NotaExportRow[]>();
                if (error) throw error;
                if (!batch || batch.length === 0) break;
                exportData.push(...batch);
                if (batch.length < BATCH_SIZE) break;
                from += BATCH_SIZE;
            }

            let csv = '\uFEFF'; // UTF-8 Byte Order Mark
            csv += 'Número da Nota;Data de Emissão;Fornecedor;Obra / Projeto;Forma de Pagamento;Qtd Itens;Frete (R$);Valor Total (R$)\r\n';

            exportData.forEach((n) => {
                const num = n.invoice_number || '';
                const emissao = n.issue_date ? formatDate(n.issue_date) : '';
                const fornecedor = n.suppliers?.name || 'N/A';
                const obra = n.projects?.name || 'Geral / Matriz';
                const pagto = PAYMENT_METHODS[n.payment_method] || n.payment_method || '';
                const itensCount = n.itens_nota_fiscal?.[0]?.count || 0;
                const frete = (Number(n.shipping_value) || 0).toFixed(2).replace('.', ',');
                const total = (Number(n.total_value) || 0).toFixed(2).replace('.', ',');

                csv += `"${num}";"${emissao}";"${fornecedor.replace(/"/g, '""')}";"${obra.replace(/"/g, '""')}";"${pagto}";${itensCount};"${frete}";"${total}"\r\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `notas_fiscais_jpl_${formatDateYMD(new Date())}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast({ title: 'Exportado com sucesso!', description: 'Arquivo CSV baixado para o seu computador.' });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Falha ao gerar arquivo CSV.';
            toast({ variant: 'destructive', title: 'Erro ao exportar', description: message });
        }
    }, [profile?.company_id, filters, toast]);

    const combinedJobs: LocalJob[] = [
        ...localJobs,
        ...(activeJobs || []).map(job => ({ ...job }))
    ];

    return (
        <div className="w-full space-y-4 animate-in fade-in-50">
            {/* ========================================================= */}
            {/* 1. CABEÇALHO OPERACIONAL ENXUTO                           */}
            {/* ========================================================= */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
                        <FileTextIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-[#F8FAFC] tracking-tight">
                            Notas Fiscais
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                            Gerencie e audite suas notas fiscais de entrada.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportCsv}
                        className="h-9 text-xs font-semibold border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-brand-dark-800 gap-1.5 cursor-pointer"
                        title="Exportar listagem de notas em formato CSV"
                    >
                        <DownloadIcon className="h-4 w-4 text-slate-500 dark:text-gray-400" />
                        <span>Exportar CSV</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsManualModalOpen(true)}
                        className="h-9 text-xs font-semibold border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-brand-dark-800 gap-1.5 cursor-pointer"
                    >
                        <PlusIcon className="h-4 w-4" />
                        <span>+ Registro Manual</span>
                    </Button>

                    <Button
                        size="sm"
                        onClick={() => setIsUploadModalOpen(true)}
                        className="h-9 text-xs font-bold bg-[#4F46E5] hover:bg-indigo-600 dark:bg-[#6366F1] dark:hover:bg-indigo-500 text-white gap-1.5 shadow-sm shadow-indigo-600/30 cursor-pointer"
                    >
                        <UploadCloudIcon className="h-4 w-4" />
                        <span>+ Registrar com IA</span>
                    </Button>
                </div>
            </header>

            {/* ========================================================= */}
            {/* 2. FAIXA DE 4 CARDS OPERACIONAIS (GRID 4 COLUNAS)         */}
            {/* ========================================================= */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* Card 1: Total Faturado */}
                <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-4 rounded-xl shadow-xs flex items-center justify-between">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                            <DollarSignIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">Total Faturado (Filtro)</p>
                            {isLoadingSummary ? (
                                <Skeleton className="h-6 w-28 mt-1" />
                            ) : (
                                <p className="text-lg font-bold text-slate-800 dark:text-[#F8FAFC] truncate font-mono">
                                    {formatCurrency(summaryData?.totalValue || 0)}
                                </p>
                            )}
                        </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#047857] dark:text-[#34D399] bg-[#ECFDF5] dark:bg-emerald-500/[0.12] px-2 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-500/20 whitespace-nowrap shrink-0">
                        {summaryData?.count || 0} notas
                    </span>
                </div>

                {/* Card 2: Ticket Médio & Volume */}
                <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-4 rounded-xl shadow-xs flex items-center justify-between">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                            <TrendingUpIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">Ticket Médio por Nota</p>
                            {isLoadingSummary ? (
                                <Skeleton className="h-6 w-24 mt-1" />
                            ) : (
                                <p className="text-lg font-bold text-slate-800 dark:text-[#F8FAFC] truncate font-mono">
                                    {formatCurrency(summaryData?.count ? (summaryData.totalValue / summaryData.count) : 0)}
                                </p>
                            )}
                        </div>
                    </div>
                    <span className="text-[11px] font-medium text-slate-600 dark:text-[#94A3B8] bg-slate-100 dark:bg-[#1E293B] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700/60 whitespace-nowrap shrink-0">
                        {allNotas.length} carregadas
                    </span>
                </div>

                {/* Card 3: Obras & Centros de Custo */}
                <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-4 rounded-xl shadow-xs flex items-center justify-between">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                            <ConstructionIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">Centros de Custo</p>
                            <p className="text-base font-bold text-slate-800 dark:text-[#F8FAFC] truncate">
                                {filters.project_id
                                    ? (projects.find(p => p.id === filters.project_id)?.name || 'Obra Filtrada')
                                    : `${projects.length} obras ativas`}
                            </p>
                        </div>
                    </div>
                    <span className="text-[11px] font-semibold text-indigo-700 dark:text-[#818CF8] bg-[#EEF2FF] dark:bg-indigo-500/[0.12] px-2 py-0.5 rounded border border-indigo-200/80 dark:border-indigo-500/20 whitespace-nowrap shrink-0">
                        {filters.project_id ? 'Filtro Ativo' : 'Consolidado'}
                    </span>
                </div>

                {/* Card 4: Status da Fila IA */}
                <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-4 rounded-xl shadow-xs flex items-center justify-between">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                            combinedJobs.length > 0
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                        }`}>
                            <SparklesIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">Inteligência Fiscal</p>
                            <p className="text-base font-bold text-slate-800 dark:text-[#F8FAFC] truncate">
                                {combinedJobs.length > 0 ? `${combinedJobs.length} em processamento` : 'Fila IA em dia'}
                            </p>
                        </div>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${
                        combinedJobs.length > 0
                            ? 'text-[#B45309] dark:text-[#FBBF24] bg-[#FFFBEB] dark:bg-amber-500/[0.12] border-amber-200/80 dark:border-amber-500/20 animate-pulse'
                            : 'text-[#047857] dark:text-[#34D399] bg-[#ECFDF5] dark:bg-emerald-500/[0.12] border-emerald-200/80 dark:border-emerald-500/20'
                    }`}>
                        {combinedJobs.length > 0 ? 'OCR Rodando' : 'OCR Ativo'}
                    </span>
                </div>
            </div>

            {/* Fita de Jobs Pendentes / Revisão (se houver) */}
            {combinedJobs.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                            <SparklesIcon className="h-3.5 w-3.5 text-amber-500" />
                            Em Processamento & Revisão com IA
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                            {combinedJobs.length} {combinedJobs.length === 1 ? 'item pendente' : 'itens pendentes'}
                        </span>
                    </div>
                    <NotasPendentesIA
                        jobs={combinedJobs}
                        isLoading={isLoadingActiveJobs && localJobs.length === 0}
                        onSelectJob={handleSelectJobForReview}
                        onArchiveOrCancelJob={handleArchiveOrCancelJob}
                    />
                </div>
            )}

            {/* ========================================================= */}
            {/* 3. BARRA DE CONTROLE E FILTROS RÁPIDOS                    */}
            {/* ========================================================= */}
            <div className="space-y-0">
                <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-t-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                    {/* Esquerda: Quick-filter pills para Obra + Atalhos de Período */}
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline mr-1">
                            Obra:
                        </span>
                        <button
                            type="button"
                            onClick={() => setFilters(prev => ({ ...prev, project_id: null }))}
                            className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                                !filters.project_id
                                    ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold border border-indigo-200/80 dark:bg-[#1E293B] dark:text-[#818CF8] dark:border-indigo-800/40 shadow-xs'
                                    : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium'
                            }`}
                        >
                            Todas
                        </button>
                        {projects.slice(0, 4).map(p => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setFilters(prev => ({ ...prev, project_id: prev.project_id === p.id ? null : p.id }))}
                                className={`px-2.5 py-1 rounded-md text-xs max-w-[130px] truncate transition-all cursor-pointer ${
                                    filters.project_id === p.id
                                        ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold border border-indigo-200/80 dark:bg-[#1E293B] dark:text-[#818CF8] dark:border-indigo-800/40 shadow-xs'
                                        : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium'
                                }`}
                                title={p.name}
                            >
                                {p.name}
                            </button>
                        ))}

                        <div className="hidden lg:block h-4 w-px bg-slate-200 dark:bg-gray-800 mx-1" />

                        {/* Atalhos Rápidos de Período */}
                        <div className="hidden md:flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => {
                                    const today = new Date();
                                    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                                    setFilters(prev => ({ ...prev, start_date: startOfMonth, end_date: today }));
                                }}
                                className="px-2 py-1 text-[11px] font-medium rounded-md text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-dark-800 transition-colors cursor-pointer"
                            >
                                Este Mês
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const today = new Date();
                                    const past7 = new Date(Date.now() - 7 * 86400000);
                                    setFilters(prev => ({ ...prev, start_date: past7, end_date: today }));
                                }}
                                className="px-2 py-1 text-[11px] font-medium rounded-md text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-dark-800 transition-colors cursor-pointer"
                            >
                                7 dias
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const today = new Date();
                                    const past90 = new Date(Date.now() - 90 * 86400000);
                                    setFilters(prev => ({ ...prev, start_date: past90, end_date: today }));
                                }}
                                className="px-2 py-1 text-[11px] font-medium rounded-md text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-dark-800 transition-colors cursor-pointer"
                            >
                                90 dias
                            </button>
                        </div>
                    </div>

                    {/* Direita: Busca Rápida + Botão Filtrar Notas */}
                    <div className="flex items-center gap-2">
                        <div className="relative w-52 sm:w-60">
                            <SearchIcon className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input
                                type="text"
                                value={filters.invoice_number}
                                onChange={(e) => setFilters(prev => ({ ...prev, invoice_number: e.target.value }))}
                                placeholder="Buscar nº da nota..."
                                className="h-8 pl-8 pr-7 text-xs bg-slate-50 dark:bg-brand-dark-800/80 border-slate-200 dark:border-gray-700"
                            />
                            {filters.invoice_number && (
                                <button
                                    type="button"
                                    onClick={() => setFilters(prev => ({ ...prev, invoice_number: '' }))}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <XIcon className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setTempFilters(filters); setIsFilterSheetOpen(true); }}
                            className="h-8 px-3 text-xs font-semibold border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-brand-dark-800 text-slate-700 dark:text-gray-300 gap-1.5 cursor-pointer"
                        >
                            <FilterIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Filtros</span>
                            {activeFiltersCount > 0 && (
                                <span className="ml-1 flex items-center justify-center h-4.5 min-w-[18px] px-1 text-[10px] font-bold rounded-full bg-indigo-600 text-white">
                                    {activeFiltersCount}
                                </span>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Faixa de Filtros Ativos (se houver) */}
                {activeFiltersCount > 0 && (
                    <div className="flex items-center justify-between gap-3 bg-indigo-50/60 dark:bg-indigo-950/20 border-x border-b border-indigo-200/80 dark:border-indigo-900/40 px-4 py-2 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                <FilterIcon className="h-3.5 w-3.5" /> Filtros ativos ({activeFiltersCount}):
                            </span>
                            {filters.invoice_number && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                                    Nº: {filters.invoice_number}
                                </span>
                            )}
                            {filters.supplier_id && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                                    Fornecedor: {suppliers.find(s => s.id === filters.supplier_id)?.name}
                                </span>
                            )}
                            {filters.project_id && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                                    Obra: {projects.find(p => p.id === filters.project_id)?.name}
                                </span>
                            )}
                            {filters.payment_method && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                                    Pgto: {PAYMENT_METHODS[filters.payment_method] || filters.payment_method}
                                </span>
                            )}
                            {(filters.start_date || filters.end_date) && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                                    Período: {filters.start_date ? filters.start_date.toLocaleDateString('pt-BR') : 'Início'} até {filters.end_date ? filters.end_date.toLocaleDateString('pt-BR') : 'Hoje'}
                                </span>
                            )}
                        </div>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleClearFilters}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline h-7 px-2 font-semibold"
                        >
                            Limpar todos
                        </Button>
                    </div>
                )}

                {/* ========================================================= */}
                {/* 4. TABELA DE ALTA DENSIDADE (COLUNAS SEPARADAS)           */}
                {/* ========================================================= */}
                <div className={`overflow-hidden rounded-b-xl border-x border-b border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111827] shadow-xs flex flex-col lg:flex-row ${
                    selectedNota && isDesktop ? 'items-stretch' : ''
                }`}>
                    {notasStatus === 'pending' ? (
                        <>
                            <div className="md:hidden p-4">
                                <ListaNotas
                                    notas={[]}
                                    loading={true}
                                    onSelectNota={() => {}}
                                    onAddNew={() => setIsManualModalOpen(true)}
                                />
                            </div>
                            <div className="hidden md:block w-full">
                                <TableSkeleton />
                            </div>
                        </>
                    ) : notasStatus === 'error' ? (
                        <p className="text-center text-red-500 py-8 text-sm w-full">Erro ao carregar notas: {(notasError as Error)?.message}</p>
                    ) : allNotas.length === 0 ? (
                        <div className="text-center py-12 px-6 bg-slate-50/50 dark:bg-brand-dark-900/50 w-full">
                            <div className="mx-auto p-3 bg-slate-100 dark:bg-gray-800 rounded-full w-fit mb-3">
                                <FileTextIcon className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Nenhuma nota fiscal encontrada</h3>
                            <p className="mt-1 text-xs text-slate-500 dark:text-gray-400 max-w-sm mx-auto">
                                Nenhum registro corresponde aos filtros atuais. Tente ajustar sua busca ou adicione uma nova nota fiscal.
                            </p>
                            <div className="mt-5">
                                <Button 
                                    size="sm"
                                    onClick={() => setIsManualModalOpen(true)}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs cursor-pointer"
                                >
                                    <PlusIcon className="h-3.5 w-3.5 mr-1.5"/>
                                    Novo Registro Manual
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Mobile: Cards */}
                            <div className="md:hidden p-3 w-full">
                                <ListaNotas
                                    notas={allNotas}
                                    loading={false}
                                    onSelectNota={handleSelectNota}
                                    onEditNota={handleEditNota}
                                    onDeleteNota={handleDeleteNota}
                                    onAddNew={() => setIsManualModalOpen(true)}
                                />
                            </div>

                            {/* Desktop: Painel Esquerdo (Tabela Retrátil em Split View) */}
                            <div className={`${
                                selectedNota && isDesktop
                                    ? 'w-full lg:w-[48%] xl:w-[46%] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-gray-800'
                                    : 'w-full'
                            }`}>
                                <div className={`hidden md:block overflow-x-auto ${selectedNota && isDesktop ? 'max-h-[calc(100vh-270px)] overflow-y-auto custom-scrollbar' : ''}`}>
                                    <table className="w-full text-sm text-left text-slate-600 dark:text-gray-400">
                                        <thead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 bg-slate-50 dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#1E293B] sticky top-0 z-10 text-slate-500 dark:text-[#94A3B8]">
                                            <tr>
                                                <th className="px-3 sm:px-4 py-3.5 font-semibold whitespace-nowrap">Emissão</th>
                                                <th className="px-3 sm:px-4 py-3.5 font-semibold">Nota / Tipo</th>
                                                <th className={selectedNota && isDesktop ? 'hidden' : 'px-4 py-3.5 font-semibold'}>Fornecedor</th>
                                                <th className={selectedNota && isDesktop ? 'hidden' : 'px-4 py-3.5 font-semibold'}>Obra / Destino</th>
                                                <th className={selectedNota && isDesktop ? 'hidden' : 'px-4 py-3.5 font-semibold'}>Pagamento</th>
                                                <th className="px-3 sm:px-4 py-3.5 font-semibold text-right whitespace-nowrap">Valor Total</th>
                                                <th className="px-2 sm:px-4 py-3.5 font-semibold text-center w-12 sm:w-16">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-gray-800 bg-white dark:bg-[#111827]">
                                            {allNotas.map((nota) => {
                                                const isRec = isReceipt(nota.invoice_number);
                                                const isSelected = selectedNota?.id === nota.id && isDesktop;
                                                return (
                                                    <tr 
                                                        id={`nota-row-${nota.id}`}
                                                        key={nota.id} 
                                                        className={`transition-colors cursor-pointer group ${
                                                            isSelected
                                                                ? 'bg-[#F5F3FF] dark:bg-indigo-500/[0.08] border-l-4 border-[#818CF8] font-semibold text-slate-800 dark:text-[#F8FAFC]'
                                                                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                                        }`}
                                                        onClick={() => handleSelectNota(nota)}
                                                    >
                                                        {/* 1. EMISSÃO */}
                                                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-600 dark:text-gray-300">
                                                            {formatDate(nota.issue_date)}
                                                        </td>

                                                        {/* 2. NOTA & TIPO / FORNECEDOR */}
                                                        <td className="px-3 sm:px-4 py-3 min-w-0">
                                                            <div className="flex flex-col min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className={`text-xs truncate ${isSelected ? 'font-bold text-indigo-700 dark:text-indigo-300' : 'font-semibold text-slate-900 dark:text-white'}`}>
                                                                        {nota.invoice_number || 'Sem Nº'}
                                                                    </span>
                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${
                                                                        isRec
                                                                            ? 'bg-[#FFFBEB] text-[#B45309] border-amber-200/80 dark:bg-amber-500/[0.12] dark:text-[#FBBF24] dark:border-amber-500/20'
                                                                            : 'bg-[#F1F5F9] text-[#475569] border-slate-200 dark:bg-[#1E293B] dark:text-[#94A3B8] dark:border-slate-700/60'
                                                                    }`}>
                                                                        {isRec ? 'RECIBO' : 'NF-e'}
                                                                    </span>
                                                                    {(!selectedNota || !isDesktop) && nota.item_count > 0 && (
                                                                        <span className="text-[10px] font-semibold text-slate-600 dark:text-gray-300 bg-slate-100 dark:bg-brand-dark-800 border border-slate-200 dark:border-gray-700 px-1.5 py-0.2 rounded flex items-center gap-1">
                                                                            <PackageIcon className="w-3 h-3 text-slate-400" />
                                                                            {nota.item_count}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {/* Subtítulo do Fornecedor quando retraída */}
                                                                {selectedNota && isDesktop && (
                                                                    <span className="text-[11px] text-slate-500 dark:text-gray-400 truncate max-w-[150px] sm:max-w-[200px]" title={nota.suppliers?.name || 'Não informado'}>
                                                                        {nota.suppliers?.name || 'Não informado'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* 3. FORNECEDOR */}
                                                        <td className={selectedNota && isDesktop ? 'hidden' : 'px-4 py-3 max-w-xs'}>
                                                            <span className="font-semibold text-slate-900 dark:text-white text-xs truncate block" title={nota.suppliers?.name || 'Não informado'}>
                                                                {nota.suppliers?.name || 'Não informado'}
                                                            </span>
                                                        </td>

                                                        {/* 4. OBRA / DESTINO */}
                                                        <td className={selectedNota && isDesktop ? 'hidden' : 'px-4 py-3'}>
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-brand-dark-800 text-slate-700 dark:text-gray-300 border border-slate-200/80 dark:border-gray-700 max-w-[200px] truncate" title={nota.projects?.name || 'Geral / Matriz'}>
                                                                <ConstructionIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                                <span className="truncate">{nota.projects?.name || 'Geral / Matriz'}</span>
                                                            </span>
                                                        </td>

                                                        {/* 5. PAGAMENTO */}
                                                        <td className={selectedNota && isDesktop ? 'hidden' : 'px-4 py-3 whitespace-nowrap'}>
                                                            <Badge variant="outline" className="text-[11px] font-medium py-0.5 bg-slate-50 dark:bg-brand-dark-800/80 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700">
                                                                {PAYMENT_METHODS[nota.payment_method] || nota.payment_method || '-'}
                                                            </Badge>
                                                        </td>

                                                        {/* 6. VALOR TOTAL */}
                                                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white text-sm">
                                                            {formatCurrency(nota.total_value)}
                                                        </td>

                                                        {/* 7. AÇÕES */}
                                                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        className="h-7 w-7 sm:h-8 sm:w-8 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-dark-800 rounded-lg cursor-pointer"
                                                                    >
                                                                        <MoreVerticalIcon className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-44 bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 shadow-xl rounded-xl p-1 z-30">
                                                                    <DropdownMenuItem onSelect={() => handleSelectNota(nota)} className="text-xs py-2 px-2.5 rounded-lg cursor-pointer">
                                                                        <EyeIcon className="h-4 w-4 mr-2 text-slate-400" /> Visualizar Detalhes
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onSelect={() => handleEditNota(nota)} className="text-xs py-2 px-2.5 rounded-lg cursor-pointer">
                                                                        <EditIcon className="h-4 w-4 mr-2 text-slate-400" /> Editar Nota
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onSelect={() => handleDeleteNota(nota)} className="text-xs py-2 px-2.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer font-semibold">
                                                                        <Trash2Icon className="h-4 w-4 mr-2 text-rose-600" /> Excluir Nota
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

                                {/* Sentinel de Scroll Infinito Automático (Sem necessidade de clicar em botões) */}
                                <div ref={tableSentinelRef} className="p-3 text-center border-t border-slate-100 dark:border-gray-800">
                                    {isFetchingNextPage ? (
                                        <div className="flex items-center justify-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                                            <div className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                                            <span>Carregando mais notas...</span>
                                        </div>
                                    ) : hasNextPage ? (
                                        <span className="text-[11px] text-slate-400">Role ou use as setas para carregar mais</span>
                                    ) : allNotas.length > 0 ? (
                                        <span className="text-[11px] text-slate-400">Todas as {allNotas.length} notas carregadas</span>
                                    ) : null}
                                </div>
                            </div>

                            {/* Desktop: Painel Direito (Mestre-Detalhe Embutido - Sem Modal / Sem Backdrop) */}
                            {selectedNota && isDesktop && (
                                <div className="w-full lg:w-[52%] xl:w-[54%] shrink-0 min-h-[480px] max-h-[calc(100vh-270px)] overflow-hidden flex flex-col animate-in fade-in-0 duration-150">
                                    <NotaDetailPanel
                                        nota={selectedNota}
                                        onClose={() => {
                                            setSelectedNota(null);
                                            setHighlightItemId(null);
                                        }}
                                        onEdit={handleEditNota}
                                        onDelete={handleDeleteNota}
                                        onPrevNota={handlePrevNota}
                                        onNextNota={handleNextNota}
                                        hasPrev={hasPrevNota}
                                        hasNext={hasNextNota}
                                        currentIndex={selectedNotaIndex}
                                        totalCount={allNotas.length}
                                        highlightItemId={highlightItemId}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Modal de Gaveta de Filtros */}
            <ResponsiveModal open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen} displayMode="drawer">
                <ResponsiveModalContent size="sm">
                    <ResponsiveModalHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg border border-indigo-200 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400">
                                <FilterIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <ResponsiveModalTitle>Filtrar Notas Fiscais</ResponsiveModalTitle>
                                <ResponsiveModalDescription>Refine a busca por número, fornecedor, obra ou período</ResponsiveModalDescription>
                            </div>
                        </div>
                    </ResponsiveModalHeader>
                    <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-slate-50/50 dark:bg-brand-dark-950/50">
                        <FiltrosNotas
                            filters={tempFilters}
                            onFiltersChange={setTempFilters}
                            suppliers={suppliers}
                            projects={projects}
                        />
                    </div>
                    <ResponsiveModalFooter>
                        <Button variant="ghost" onClick={handleClearFilters} className="text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white text-xs">Limpar</Button>
                        <Button onClick={handleApplyFilters} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">Aplicar Filtros</Button>
                    </ResponsiveModalFooter>
                </ResponsiveModalContent>
            </ResponsiveModal>
            
            {/* Modal de Detalhes da Nota com ações integradas e navegação sequencial */}
            <DetalhesNotaModal
                nota={selectedNota}
                isOpen={isDetailsModalOpen}
                highlightItemId={highlightItemId}
                onClose={() => {
                    setIsDetailsModalOpen(false);
                    setSelectedNota(null);
                    setHighlightItemId(null);
                }}
                onEdit={(nota) => {
                    setIsDetailsModalOpen(false);
                    handleEditNota(nota);
                }}
                onDelete={(nota) => {
                    setIsDetailsModalOpen(false);
                    handleDeleteNota(nota);
                }}
                onPrevNota={handlePrevNota}
                onNextNota={handleNextNota}
                hasPrev={hasPrevNota}
                hasNext={hasNextNota}
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
                            <span className="block mt-2 text-xs text-slate-500 dark:text-gray-400">
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
