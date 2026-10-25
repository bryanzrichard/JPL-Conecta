import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabaseClient';
import { Service, ServiceWithDetails, AdvanceWithDetails, Advance, Collaborator, Project, SERVICE_STATUSES, ServiceStatus } from '../types';
import { formatCurrency, formatDateBR as formatDate, openStorageFile } from '../lib/utils';
import { formatApiError } from '../lib/handleError';
import { deleteServiceWithAttachments, deleteAdvanceWithAttachment } from '../components/servicos/serviceActions';
import { useMediaQuery } from '../hooks/use-media-query';

// UI Components
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Badge } from '../components/ui/Badge';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../components/ui/ResponsiveModal';
import { Popover, PopoverTrigger, PopoverContent } from '../components/ui/Popover';
import { Command, CommandInput, CommandEmpty, CommandItem, CommandList } from '../components/ui/Command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/DropdownMenu';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { TableSkeleton } from '../components/ui/TableSkeleton';
import { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '../components/ui/DatePickerWithRange';

// Servicos Components
import ServicoCard from '../components/servicos/ServicoCard';
import AdiantamentoCard from '../components/servicos/AdiantamentoCard';
import ServicoCardSkeleton from '../components/servicos/ServicoCardSkeleton';
import AdiantamentoCardSkeleton from '../components/servicos/AdiantamentoCardSkeleton';
import ServicoDetailPanel from '../components/servicos/ServicoDetailPanel';

// Icons
import {
    BriefcaseIcon, PlusIcon, DollarSignIcon, TrendingUpIcon, FilterIcon,
    UserIcon, ConstructionIcon, CalendarIcon, ChevronsUpDownIcon,
    MoreVerticalIcon, XIcon, EditIcon, Trash2Icon, PaperclipIcon,
    SearchIcon, CheckCircle2Icon, ExternalLinkIcon, EyeIcon, DownloadIcon,
    ClockIcon, AlertTriangleIcon
} from '../lib/icons';

// Modais Lazy
const ServiceModal = lazy(() => import('../components/servicos/ServiceModal'));
const AdvanceModal = lazy(() => import('../components/servicos/AdvanceModal'));
const EditarServicoModal = lazy(() => import('../components/servicos/EditarServicoModal'));
const EditarAdiantamentoModal = lazy(() => import('../components/servicos/EditarAdiantamentoModal'));
const DetalhesServicoModal = lazy(() => import('../components/servicos/DetalhesServicoModal'));

type ServiceFilters = {
    searchTerm: string;
    collaboratorId: string | null;
    projectId: string | null;
    startDate: Date | null;
    endDate: Date | null;
};

type AdvanceFilters = {
    searchTerm: string;
    collaboratorId: string | null;
    projectId: string | null;
    dateRange: DateRange | undefined;
    serviceId?: string | null;
};

type AdvanceQueryResult = Advance & {
    servicos: {
        description: string;
        collaborator_id: string | null;
        project_id: string | null;
        collaborators: { name: string } | null;
        projects: { name: string } | null;
    } | null;
};

const PAGE_SIZE = 10;

// Busca de adiantamentos por descrição do adiantamento OU do serviço.
const buildAdvanceSearchFilter = async (companyId: string, term: string): Promise<string> => {
    const safe = term.replace(/[,()*%]/g, ' ').trim();
    const { data } = await supabase
        .from('servicos')
        .select('id')
        .eq('company_id', companyId)
        .ilike('description', `%${safe}%`)
        .limit(500);
    const ids = (data || []).map((s: any) => s.id);
    const base = `description.ilike.%${safe}%`;
    return ids.length ? `${base},service_id.in.(${ids.join(',')})` : base;
};

// Formata Date em yyyy-MM-dd no fuso local
const toDateStr = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const QUICK_PERIOD_SHORTCUTS = [
    { label: 'Hoje', daysAgo: 0 },
    { label: 'Últimos 7 dias', daysAgo: 7 },
    { label: 'Este Mês', isCurrentMonth: true },
    { label: 'Últimos 90 dias', daysAgo: 90 },
];

const Servicos: React.FC = () => {
    const { profile, user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const isDesktop = useMediaQuery('(min-width: 1024px)');

    // 1. Sistema de Abas no Topo
    const tabFromUrl = searchParams.get('tab') as 'servicos' | 'adiantamentos' | null;
    const [activeTab, setActiveTab] = useState<'servicos' | 'adiantamentos'>(tabFromUrl || 'servicos');

    const handleTabChange = (newTab: 'servicos' | 'adiantamentos') => {
        setActiveTab(newTab);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', newTab);
            return next;
        }, { replace: true });
    };

    // 2. Filtros de Serviços (Aba 1)
    const [serviceStatusFilter, setServiceStatusFilter] = useState<'Em Andamento' | 'Concluído' | 'Todos'>('Em Andamento');
    const [serviceFilters, setServiceFilters] = useState<ServiceFilters>({
        searchTerm: '',
        collaboratorId: null,
        projectId: null,
        startDate: null,
        endDate: null
    });
    const [tempServiceFilters, setTempServiceFilters] = useState<ServiceFilters>(serviceFilters);
    const [isServiceFilterSheetOpen, setServiceFilterSheetOpen] = useState(false);

    // 3. Filtros de Adiantamentos (Aba 2)
    const [advanceFilters, setAdvanceFilters] = useState<AdvanceFilters>({
        searchTerm: '',
        collaboratorId: null,
        projectId: null,
        dateRange: undefined
    });
    const [tempAdvanceFilters, setTempAdvanceFilters] = useState<AdvanceFilters>(advanceFilters);
    const [isAdvanceFilterSheetOpen, setAdvanceFilterSheetOpen] = useState(false);

    // Estados de Apoio (Popovers nos drawers)
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [collaboratorSearch, setCollaboratorSearch] = useState('');
    const [projectSearch, setProjectSearch] = useState('');
    const [isCollaboratorPopoverOpen, setCollaboratorPopoverOpen] = useState(false);
    const [isProjectPopoverOpen, setProjectPopoverOpen] = useState(false);
    const [isAdvCollaboratorPopoverOpen, setAdvCollaboratorPopoverOpen] = useState(false);
    const [isAdvProjectPopoverOpen, setAdvProjectPopoverOpen] = useState(false);

    // Modais e Estados de Edição/Exclusão
    const [selectedService, setSelectedService] = useState<ServiceWithDetails | null>(null);
    const [selectedAdvance, setSelectedAdvance] = useState<AdvanceWithDetails | null>(null);
    const [isDetailsModalOpen, setDetailsModalOpen] = useState(false);
    const [isCreateServiceModalOpen, setCreateServiceModalOpen] = useState(false);
    const [isEditServiceModalOpen, setEditServiceModalOpen] = useState(false);
    const [isAdvanceModalOpen, setAdvanceModalOpen] = useState(false);
    const [isEditAdvanceModalOpen, setEditAdvanceModalOpen] = useState(false);

    const [serviceToDelete, setServiceToDelete] = useState<ServiceWithDetails | null>(null);
    const [isDeleteServiceModalOpen, setDeleteServiceModalOpen] = useState(false);

    const [advanceToDelete, setAdvanceToDelete] = useState<AdvanceWithDetails | null>(null);
    const [isDeleteAdvanceModalOpen, setDeleteAdvanceModalOpen] = useState(false);

    const handledIdRef = useRef<string | null>(null);
    const servicesSentinelRef = useRef<HTMLDivElement | null>(null);
    const advancesSentinelRef = useRef<HTMLDivElement | null>(null);
    const pendingAdvanceAfterFetchRef = useRef(false);

    // Carregar Cadastros de Apoio (Colaboradores e Projetos)
    useEffect(() => {
        if (!profile?.company_id) return;
        const fetchDropdownData = async () => {
            try {
                const [collaboratorsRes, projectsRes] = await Promise.all([
                    (supabase as any).from('collaborators').select('id, name').eq('company_id', profile.company_id).order('name'),
                    (supabase as any).from('projects').select('id, name').eq('company_id', profile.company_id).order('name')
                ]);
                if (collaboratorsRes.data) setCollaborators(collaboratorsRes.data);
                if (projectsRes.data) setProjects(projectsRes.data);
            } catch (err) {
                console.error("Erro ao carregar colaboradores e obras:", err);
            }
        };
        fetchDropdownData();
    }, [profile?.company_id]);

    // Deep Linking: Interceptar ?editar={id} ou ?editarAdiantamento={id} sem loop
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const editServiceId = params.get('editar') || (location.state as any)?.editId;
        const editAdvanceId = params.get('editarAdiantamento') || (location.state as any)?.editAdvanceId;
        const targetId = editServiceId || editAdvanceId;

        if (!targetId || !profile?.company_id) return;
        if (handledIdRef.current === targetId) return;

        handledIdRef.current = targetId;

        navigate(`${location.pathname}?tab=${editAdvanceId && !editServiceId ? 'adiantamentos' : 'servicos'}`, { replace: true, state: {} });

        let isMounted = true;

        const loadTarget = async () => {
            if (editServiceId) {
                setActiveTab('servicos');
                try {
                    const { data } = await (supabase as any)
                        .from('servicos')
                        .select('*, collaborators(name), projects(name), adiantamentos(id, value)')
                        .eq('id', editServiceId)
                        .maybeSingle();

                    if (data && isMounted) {
                        const isCompleted = data.status === 'Concluído';
                        const total_advances = (data.adiantamentos || []).reduce((acc: number, curr: any) => acc + (Number(curr.value) || 0), 0);
                        const formattedService: ServiceWithDetails = {
                            ...data,
                            collaborator_name: data.collaborators?.name || null,
                            project_name: data.projects?.name || null,
                            total_advances,
                            remaining_value: isCompleted ? 0 : Math.max(0, (Number(data.total_value) || 0) - total_advances),
                        };
                        setSelectedService(formattedService);
                        if (!isDesktop) {
                            setDetailsModalOpen(true);
                        }
                    }
                } catch (err) {
                    console.error('Erro ao abrir serviço para edição:', err);
                }
            } else if (editAdvanceId) {
                setActiveTab('adiantamentos');
                try {
                    const { data: advData } = await supabase
                        .from('adiantamentos')
                        .select('*, servicos(description, collaborator_id, project_id, collaborators(name), projects(name))')
                        .eq('id', editAdvanceId)
                        .maybeSingle()
                        .returns<AdvanceQueryResult>();

                    if (advData && isMounted) {
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

        loadTarget();

        return () => {
            isMounted = false;
        };
    }, [location.search, location.state, profile?.company_id, navigate, isDesktop]);

    // ==========================================
    // ABA 1: SERVIÇOS (Infinite Query + KPIs)
    // ==========================================
    const fetchServices = async ({ pageParam = 0, queryKey }: { pageParam?: number; queryKey: any }) => {
        const [_, companyId, filters, statusFilter] = queryKey;
        if (!companyId) return { data: [], count: 0, nextPage: undefined };

        let query = supabase
            .from('servicos')
            .select('*, collaborators(name), projects(name), adiantamentos(id, value, receipt_path)', { count: 'exact' })
            .eq('company_id', companyId);

        if (statusFilter && statusFilter !== 'Todos') {
            query = query.eq('status', statusFilter);
        }

        if (filters.searchTerm) {
            query = query.ilike('description', `%${filters.searchTerm}%`);
        }
        if (filters.collaboratorId) {
            query = query.eq('collaborator_id', filters.collaboratorId);
        }
        if (filters.projectId) {
            query = query.eq('project_id', filters.projectId);
        }
        if (filters.startDate) {
            query = query.gte('start_date', toDateStr(filters.startDate));
        }
        if (filters.endDate) {
            query = query.lte('end_date', toDateStr(filters.endDate));
        }

        const from = pageParam * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        const formattedData = (data || []).map((s: any) => {
            const isCompleted = s.status === 'Concluído';
            const total_advances = (s.adiantamentos || []).reduce((acc: number, curr: any) => acc + (Number(curr.value) || 0), 0);
            const remaining_value = isCompleted ? 0 : Math.max(0, (Number(s.total_value) || 0) - total_advances);
            return {
                ...s,
                collaborator_name: s.collaborators?.name || null,
                project_name: s.projects?.name || null,
                total_advances,
                remaining_value,
            };
        });

        return { 
            data: formattedData as ServiceWithDetails[], 
            count: count ?? 0,
            nextPage: data.length === PAGE_SIZE ? pageParam + 1 : undefined
        };
    };

    const {
        data: servicesData,
        fetchNextPage: fetchNextPageServices,
        hasNextPage: hasNextPageServices,
        isFetchingNextPage: isFetchingNextPageServices,
        isLoading: isLoadingServices,
        isError: isErrorServices,
        refetch: refetchServices
    } = useInfiniteQuery({
        queryKey: ['servicos', profile?.company_id, serviceFilters, serviceStatusFilter],
        queryFn: fetchServices,
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextPage,
        enabled: !!profile?.company_id && activeTab === 'servicos',
    });

    const allServices = useMemo(() => {
        return servicesData?.pages.flatMap(page => page.data) ?? [];
    }, [servicesData]);

    // Resumo de KPIs de Serviços
    const { data: servicesSummary } = useQuery({
        queryKey: ['servicesSummary', profile?.company_id, serviceFilters, serviceStatusFilter],
        queryFn: async () => {
            if (!profile?.company_id) return { totalValue: 0, totalPaid: 0, remainingValue: 0, count: 0 };

            const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_services_summary', {
                p_company_id: profile.company_id,
                p_status: serviceStatusFilter === 'Todos' ? null : serviceStatusFilter,
                p_search: serviceFilters.searchTerm || null,
                p_collaborator_id: serviceFilters.collaboratorId,
                p_project_id: serviceFilters.projectId,
                p_start_date: serviceFilters.startDate ? toDateStr(serviceFilters.startDate) : null,
                p_end_date: serviceFilters.endDate ? toDateStr(serviceFilters.endDate) : null,
            });
            const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
            if (!rpcError && rpcRow) {
                const totalValue = Number(rpcRow.total_value) || 0;
                let totalPaid = Number(rpcRow.total_paid) || 0;
                let remainingValue = Math.max(0, totalValue - totalPaid);

                if (serviceStatusFilter === 'Concluído') {
                    totalPaid = totalValue;
                    remainingValue = 0;
                }

                return {
                    totalValue,
                    totalPaid,
                    remainingValue,
                    count: Number(rpcRow.total_count) || 0,
                };
            }

            let query = supabase
                .from('servicos')
                .select('id, total_value, adiantamentos(value)')
                .eq('company_id', profile.company_id);

            if (serviceStatusFilter !== 'Todos') {
                query = query.eq('status', serviceStatusFilter);
            }
            if (serviceFilters.searchTerm) query = query.ilike('description', `%${serviceFilters.searchTerm}%`);
            if (serviceFilters.collaboratorId) query = query.eq('collaborator_id', serviceFilters.collaboratorId);
            if (serviceFilters.projectId) query = query.eq('project_id', serviceFilters.projectId);
            if (serviceFilters.startDate) query = query.gte('start_date', toDateStr(serviceFilters.startDate));
            if (serviceFilters.endDate) query = query.lte('end_date', toDateStr(serviceFilters.endDate));

            const { data, error } = await query;
            if (error) throw error;

            let totalValue = 0;
            let totalPaid = 0;
            (data || []).forEach((s: any) => {
                const val = Number(s.total_value) || 0;
                const paid = (s.adiantamentos || []).reduce((acc: number, c: any) => acc + (Number(c.value) || 0), 0);
                totalValue += val;
                totalPaid += paid;
            });

            return {
                totalValue,
                totalPaid,
                remainingValue: Math.max(0, totalValue - totalPaid),
                count: data?.length || 0,
            };
        },
        enabled: !!profile?.company_id,
        staleTime: 30000,
    });

    // Observer para scroll infinito em Serviços
    useEffect(() => {
        if (activeTab !== 'servicos') return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasNextPageServices && !isFetchingNextPageServices) {
                fetchNextPageServices();
            }
        }, { threshold: 0.1 });

        if (servicesSentinelRef.current) {
            observer.observe(servicesSentinelRef.current);
        }
        return () => observer.disconnect();
    }, [activeTab, hasNextPageServices, isFetchingNextPageServices, fetchNextPageServices]);

    // Navegação Sequencial no Split View / Drawer de Serviços
    const selectedServiceIndex = useMemo(() => {
        if (!selectedService) return -1;
        return allServices.findIndex(s => s.id === selectedService.id);
    }, [selectedService, allServices]);

    const hasPrevService = selectedServiceIndex > 0;
    const hasNextService = selectedServiceIndex >= 0 && selectedServiceIndex < allServices.length - 1;

    const handlePrevService = useCallback(() => {
        if (hasPrevService) {
            setSelectedService(allServices[selectedServiceIndex - 1]);
        }
    }, [hasPrevService, selectedServiceIndex, allServices]);

    const handleNextService = useCallback(() => {
        if (hasNextService) {
            setSelectedService(allServices[selectedServiceIndex + 1]);
            if (selectedServiceIndex >= allServices.length - 3 && hasNextPageServices && !isFetchingNextPageServices) {
                fetchNextPageServices();
            }
        } else if (hasNextPageServices && !isFetchingNextPageServices) {
            pendingAdvanceAfterFetchRef.current = true;
            fetchNextPageServices();
        }
    }, [hasNextService, selectedServiceIndex, allServices, hasNextPageServices, isFetchingNextPageServices, fetchNextPageServices]);

    // Avançar automaticamente para o serviço recém-carregado
    useEffect(() => {
        if (pendingAdvanceAfterFetchRef.current && allServices.length > 0) {
            pendingAdvanceAfterFetchRef.current = false;
            if (selectedServiceIndex >= 0 && selectedServiceIndex < allServices.length - 1) {
                setSelectedService(allServices[selectedServiceIndex + 1]);
            }
        }
    }, [allServices, selectedServiceIndex]);

    // Acompanhar a linha selecionada ao navegar pelas setas
    useEffect(() => {
        if (!selectedService) return;
        const el = document.getElementById(`service-row-${selectedService.id}`);
        if (el) {
            el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        }
    }, [selectedService?.id]);

    // Atalhos de teclado no Split View (↑ / ↓ para navegar, Esc para fechar)
    useEffect(() => {
        if (!selectedService || !isDesktop || activeTab !== 'servicos') return;
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeTag = (document.activeElement?.tagName || '').toLowerCase();
            if (['input', 'textarea', 'select'].includes(activeTag)) return;

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                handlePrevService();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                handleNextService();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setSelectedService(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedService, isDesktop, activeTab, handlePrevService, handleNextService]);

    // Seleção de serviço
    const handleSelectService = (service: ServiceWithDetails) => {
        setSelectedService(service);
        if (!isDesktop) {
            setDetailsModalOpen(true);
        }
    };

    // Mutation de Exclusão de Serviço
    const deleteServiceMutation = useMutation({
        mutationFn: async (service: ServiceWithDetails) => {
            await deleteServiceWithAttachments({
                service,
                companyId: profile?.company_id,
                userEmail: user?.email,
            });
        },
        onSuccess: () => {
            toast({ title: 'Sucesso!', description: 'Contrato e anexos excluídos com sucesso.' });
            queryClient.invalidateQueries({ queryKey: ['servicos'] });
            queryClient.invalidateQueries({ queryKey: ['servicesSummary'] });
            queryClient.invalidateQueries({ queryKey: ['adiantamentos'] });
            queryClient.invalidateQueries({ queryKey: ['advancesSummary'] });
            queryClient.invalidateQueries({ queryKey: ['servico_adiantamentos'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardItems'] });
        },
        onError: (err) => {
            toast({ variant: 'destructive', title: 'Erro!', description: formatApiError(err) });
        },
        onSettled: () => {
            setDeleteServiceModalOpen(false);
            setServiceToDelete(null);
            if (selectedService?.id === serviceToDelete?.id) {
                setSelectedService(null);
            }
        }
    });

    // ==========================================
    // ABA 2: ADIANTAMENTOS (Infinite Query + KPIs)
    // ==========================================
    const fetchAdvances = async ({ pageParam = 0, queryKey }: { pageParam?: number; queryKey: any }) => {
        const [_, companyId, filters] = queryKey;
        if (!companyId) return { data: [], count: 0, nextPage: undefined };

        let query = supabase
            .from('adiantamentos')
            .select(`
                *,
                servicos!inner(
                    id,
                    description,
                    collaborator_id,
                    project_id,
                    collaborators(name),
                    projects(name)
                )
            `, { count: 'exact' })
            .eq('company_id', companyId);

        if (filters.searchTerm) {
            query = query.or(await buildAdvanceSearchFilter(companyId, filters.searchTerm));
        }
        if (filters.collaboratorId) {
            query = query.eq('servicos.collaborator_id', filters.collaboratorId);
        }
        if (filters.projectId) {
            query = query.eq('servicos.project_id', filters.projectId);
        }
        if (filters.serviceId) {
            query = query.eq('service_id', filters.serviceId);
        }
        if (filters.dateRange?.from) {
            query = query.gte('payment_date', toDateStr(filters.dateRange.from));
        }
        if (filters.dateRange?.to) {
            query = query.lte('payment_date', toDateStr(filters.dateRange.to));
        }

        const from = pageParam * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error, count } = await query
            .order('payment_date', { ascending: false })
            .range(from, to);

        if (error) throw error;

        const formattedData = (data || []).map((a: any) => ({
            ...a,
            service_description: a.servicos?.description || 'N/A',
            collaborator_name: a.servicos?.collaborators?.name || null,
            project_name: a.servicos?.projects?.name || null,
        }));

        return { 
            data: formattedData as AdvanceWithDetails[], 
            count: count ?? 0,
            nextPage: data.length === PAGE_SIZE ? pageParam + 1 : undefined
        };
    };

    const {
        data: advancesData,
        fetchNextPage: fetchNextPageAdvances,
        hasNextPage: hasNextPageAdvances,
        isFetchingNextPage: isFetchingNextPageAdvances,
        isLoading: isLoadingAdvances,
        isError: isErrorAdvances,
        refetch: refetchAdvances
    } = useInfiniteQuery({
        queryKey: ['adiantamentos', profile?.company_id, advanceFilters],
        queryFn: fetchAdvances,
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextPage,
        enabled: !!profile?.company_id && activeTab === 'adiantamentos',
    });

    const allAdvances = useMemo(() => {
        return advancesData?.pages.flatMap(page => page.data) ?? [];
    }, [advancesData]);

    // Resumo de KPIs de Adiantamentos
    const { data: advancesSummary } = useQuery({
        queryKey: ['advancesSummary', profile?.company_id, advanceFilters],
        queryFn: async () => {
            if (!profile?.company_id) return { totalPaid: 0, count: 0 };

            const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_advances_summary', {
                p_company_id: profile.company_id,
                p_search: advanceFilters.searchTerm || null,
                p_collaborator_id: advanceFilters.collaboratorId,
                p_project_id: advanceFilters.projectId,
                p_service_id: advanceFilters.serviceId ?? null,
                p_from: advanceFilters.dateRange?.from ? toDateStr(advanceFilters.dateRange.from) : null,
                p_to: advanceFilters.dateRange?.to ? toDateStr(advanceFilters.dateRange.to) : null,
            });
            const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
            if (!rpcError && rpcRow) {
                return {
                    totalPaid: Number(rpcRow.total_paid) || 0,
                    count: Number(rpcRow.total_count) || 0,
                };
            }

            let query = supabase
                .from('adiantamentos')
                .select(`
                    id,
                    value,
                    servicos!inner(
                        description,
                        collaborator_id,
                        project_id
                    )
                `)
                .eq('company_id', profile.company_id);

            if (advanceFilters.searchTerm) {
                query = query.or(await buildAdvanceSearchFilter(profile.company_id, advanceFilters.searchTerm));
            }
            if (advanceFilters.collaboratorId) {
                query = query.eq('servicos.collaborator_id', advanceFilters.collaboratorId);
            }
            if (advanceFilters.projectId) {
                query = query.eq('servicos.project_id', advanceFilters.projectId);
            }
            if (advanceFilters.serviceId) {
                query = query.eq('service_id', advanceFilters.serviceId);
            }
            if (advanceFilters.dateRange?.from) {
                query = query.gte('payment_date', toDateStr(advanceFilters.dateRange.from));
            }
            if (advanceFilters.dateRange?.to) {
                query = query.lte('payment_date', toDateStr(advanceFilters.dateRange.to));
            }

            const { data, error } = await query;
            if (error) throw error;

            const totalPaid = (data || []).reduce((acc: number, item: any) => acc + (Number(item.value) || 0), 0);
            return {
                totalPaid,
                count: data?.length || 0
            };
        },
        enabled: !!profile?.company_id,
        staleTime: 30000,
    });

    // Observer para scroll infinito em Adiantamentos
    useEffect(() => {
        if (activeTab !== 'adiantamentos') return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasNextPageAdvances && !isFetchingNextPageAdvances) {
                fetchNextPageAdvances();
            }
        }, { threshold: 0.1 });

        if (advancesSentinelRef.current) {
            observer.observe(advancesSentinelRef.current);
        }
        return () => observer.disconnect();
    }, [activeTab, hasNextPageAdvances, isFetchingNextPageAdvances, fetchNextPageAdvances]);

    // Mutation de Exclusão de Adiantamento
    const deleteAdvanceMutation = useMutation({
        mutationFn: async (advance: AdvanceWithDetails) => {
            await deleteAdvanceWithAttachment({
                advance,
                companyId: profile?.company_id,
                userEmail: user?.email,
            });
        },
        onSuccess: () => {
            toast({ title: 'Sucesso!', description: 'Adiantamento excluído com sucesso.' });
            queryClient.invalidateQueries({ queryKey: ['adiantamentos'] });
            queryClient.invalidateQueries({ queryKey: ['advancesSummary'] });
            queryClient.invalidateQueries({ queryKey: ['servico_adiantamentos'] });
            queryClient.invalidateQueries({ queryKey: ['servicos'] });
            queryClient.invalidateQueries({ queryKey: ['servicesSummary'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardItems'] });
        },
        onError: (err) => {
            toast({ variant: 'destructive', title: 'Erro!', description: formatApiError(err) });
        },
        onSettled: () => {
            setDeleteAdvanceModalOpen(false);
            setAdvanceToDelete(null);
        }
    });

    // Ação: "Ver no Extrato" de um serviço -> troca para Aba 2 filtrando pelo serviço
    const handleViewAdvancesForService = (service: ServiceWithDetails) => {
        const filters: AdvanceFilters = {
            searchTerm: '',
            collaboratorId: null,
            projectId: null,
            dateRange: undefined,
            serviceId: service.id,
        };
        setAdvanceFilters(filters);
        setTempAdvanceFilters(filters);
        handleTabChange('adiantamentos');
    };

    // Abertura de anexo no storage
    const handleViewAttachment = async (path: string) => {
        try {
            await openStorageFile(path);
        } catch {
            toast({ title: 'Erro ao abrir arquivo', description: 'Não foi possível gerar link para o documento.', variant: 'destructive' });
        }
    };

    // Contagem de filtros ativos em Serviços
    const activeServiceFiltersCount = useMemo(() => {
        let count = 0;
        if (serviceFilters.searchTerm) count++;
        if (serviceFilters.collaboratorId) count++;
        if (serviceFilters.projectId) count++;
        if (serviceFilters.startDate || serviceFilters.endDate) count++;
        return count;
    }, [serviceFilters]);

    // Contagem de filtros ativos em Adiantamentos
    const activeAdvanceFiltersCount = useMemo(() => {
        let count = 0;
        if (advanceFilters.searchTerm) count++;
        if (advanceFilters.collaboratorId) count++;
        if (advanceFilters.projectId) count++;
        if (advanceFilters.serviceId) count++;
        if (advanceFilters.dateRange?.from || advanceFilters.dateRange?.to) count++;
        return count;
    }, [advanceFilters]);

    // Atalhos de Período para Serviços
    const applyQuickPeriodServices = (shortcut: typeof QUICK_PERIOD_SHORTCUTS[number]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (shortcut.isCurrentMonth) {
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            setServiceFilters(f => ({ ...f, startDate: startOfMonth, endDate: today }));
            return;
        }

        if (shortcut.daysAgo === 0) {
            setServiceFilters(f => ({ ...f, startDate: today, endDate: today }));
            return;
        }

        const pastDate = new Date(Date.now() - shortcut.daysAgo * 86400000);
        pastDate.setHours(0, 0, 0, 0);
        setServiceFilters(f => ({ ...f, startDate: pastDate, endDate: today }));
    };

    // Atalhos de Período para Adiantamentos
    const applyQuickPeriodAdvances = (shortcut: typeof QUICK_PERIOD_SHORTCUTS[number]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (shortcut.isCurrentMonth) {
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            setAdvanceFilters(f => ({ ...f, dateRange: { from: startOfMonth, to: today } }));
            return;
        }

        if (shortcut.daysAgo === 0) {
            setAdvanceFilters(f => ({ ...f, dateRange: { from: today, to: today } }));
            return;
        }

        const pastDate = new Date(Date.now() - shortcut.daysAgo * 86400000);
        pastDate.setHours(0, 0, 0, 0);
        setAdvanceFilters(f => ({ ...f, dateRange: { from: pastDate, to: today } }));
    };

    // Exportar listagem filtrada para CSV com UTF-8 BOM
    const handleExportCsv = useCallback(async () => {
        if (!profile?.company_id) return;
        try {
            const BATCH_SIZE = 1000;
            if (activeTab === 'servicos') {
                type ServiceExportRow = Service & {
                    collaborators: { name: string } | null;
                    projects: { name: string } | null;
                    adiantamentos: { value: number }[] | null;
                };
                let from = 0;
                const exportData: ServiceExportRow[] = [];

                while (true) {
                    let query = supabase
                        .from('servicos')
                        .select('*, collaborators(name), projects(name), adiantamentos(value)')
                        .eq('company_id', profile.company_id);

                    if (serviceStatusFilter && serviceStatusFilter !== 'Todos') {
                        query = query.eq('status', serviceStatusFilter);
                    }
                    if (serviceFilters.searchTerm) {
                        query = query.ilike('description', `%${serviceFilters.searchTerm}%`);
                    }
                    if (serviceFilters.collaboratorId) {
                        query = query.eq('collaborator_id', serviceFilters.collaboratorId);
                    }
                    if (serviceFilters.projectId) {
                        query = query.eq('project_id', serviceFilters.projectId);
                    }
                    if (serviceFilters.startDate) {
                        query = query.gte('start_date', toDateStr(serviceFilters.startDate));
                    }
                    if (serviceFilters.endDate) {
                        query = query.lte('end_date', toDateStr(serviceFilters.endDate));
                    }

                    const { data: batch, error } = await query
                        .order('created_at', { ascending: false })
                        .range(from, from + BATCH_SIZE - 1)
                        .returns<ServiceExportRow[]>();
                    if (error) throw error;
                    if (!batch || batch.length === 0) break;
                    exportData.push(...batch);
                    if (batch.length < BATCH_SIZE) break;
                    from += BATCH_SIZE;
                }

                let csv = '\uFEFF';
                csv += 'Descrição do Serviço;Prestador;Obra / Canteiro;Status;Início;Conclusão Prevista;Valor Contratado (R$);Total Pago (R$);Saldo Restante (R$)\r\n';

                exportData.forEach((s) => {
                    const desc = s.description || '';
                    const prestador = s.collaborators?.name || 'Não informado';
                    const obra = s.projects?.name || 'Geral';
                    const status = s.status || '';
                    const inicio = s.start_date ? formatDate(s.start_date) : '';
                    const fim = s.end_date ? formatDate(s.end_date) : '';
                    const totalContrato = Number(s.total_value) || 0;
                    const isCompleted = s.status === 'Concluído';
                    const totalAdiantamentos = (s.adiantamentos || []).reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
                    const totalPago = isCompleted ? totalContrato : totalAdiantamentos;
                    const saldo = isCompleted ? 0 : Math.max(0, totalContrato - totalAdiantamentos);

                    csv += `"${desc.replace(/"/g, '""')}";"${prestador.replace(/"/g, '""')}";"${obra.replace(/"/g, '""')}";"${status}";"${inicio}";"${fim}";"${totalContrato.toFixed(2).replace('.', ',')}";"${totalPago.toFixed(2).replace('.', ',')}";"${saldo.toFixed(2).replace('.', ',')}"\r\n`;
                });

                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `contratos_servicos_jpl_${toDateStr(new Date())}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                toast({ title: 'Exportado com sucesso!', description: 'Arquivo CSV de contratos baixado para o seu computador.' });
            } else {
                type AdvanceExportRow = Advance & {
                    servicos: {
                        description: string;
                        collaborator_id: string | null;
                        project_id: string | null;
                        collaborators: { name: string } | null;
                        projects: { name: string } | null;
                    } | null;
                };
                const advanceSearchFilter = advanceFilters.searchTerm
                    ? await buildAdvanceSearchFilter(profile.company_id, advanceFilters.searchTerm)
                    : null;
                let from = 0;
                const exportData: AdvanceExportRow[] = [];

                while (true) {
                    let query = supabase
                        .from('adiantamentos')
                        .select(`
                            *,
                            servicos!inner(
                                description,
                                collaborator_id,
                                project_id,
                                collaborators(name),
                                projects(name)
                            )
                        `)
                        .eq('company_id', profile.company_id);

                    if (advanceSearchFilter) {
                        query = query.or(advanceSearchFilter);
                    }
                    if (advanceFilters.collaboratorId) {
                        query = query.eq('servicos.collaborator_id', advanceFilters.collaboratorId);
                    }
                    if (advanceFilters.projectId) {
                        query = query.eq('servicos.project_id', advanceFilters.projectId);
                    }
                    if (advanceFilters.serviceId) {
                        query = query.eq('service_id', advanceFilters.serviceId);
                    }
                    if (advanceFilters.dateRange?.from) {
                        query = query.gte('payment_date', toDateStr(advanceFilters.dateRange.from));
                    }
                    if (advanceFilters.dateRange?.to) {
                        query = query.lte('payment_date', toDateStr(advanceFilters.dateRange.to));
                    }

                    const { data: batch, error } = await query
                        .order('payment_date', { ascending: false })
                        .range(from, from + BATCH_SIZE - 1)
                        .returns<AdvanceExportRow[]>();
                    if (error) throw error;
                    if (!batch || batch.length === 0) break;
                    exportData.push(...batch);
                    if (batch.length < BATCH_SIZE) break;
                    from += BATCH_SIZE;
                }

                let csv = '\uFEFF';
                csv += 'Data da Liberação;Medição / Observação;Contrato de Serviço;Prestador;Obra / Centro de Custo;Valor Liberado (R$)\r\n';

                exportData.forEach((a) => {
                    const dataLib = a.payment_date ? formatDate(a.payment_date) : '';
                    const desc = a.description || 'Medição';
                    const servico = a.servicos?.description || 'N/A';
                    const prestador = a.servicos?.collaborators?.name || 'Não informado';
                    const obra = a.servicos?.projects?.name || 'Geral';
                    const valor = (Number(a.value) || 0).toFixed(2).replace('.', ',');

                    csv += `"${dataLib}";"${desc.replace(/"/g, '""')}";"${servico.replace(/"/g, '""')}";"${prestador.replace(/"/g, '""')}";"${obra.replace(/"/g, '""')}";"${valor}"\r\n`;
                });

                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `extrato_adiantamentos_jpl_${toDateStr(new Date())}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                toast({ title: 'Exportado com sucesso!', description: 'Arquivo CSV de adiantamentos baixado para o seu computador.' });
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Falha ao gerar arquivo CSV.';
            toast({ variant: 'destructive', title: 'Erro ao exportar', description: message });
        }
    }, [profile?.company_id, activeTab, serviceStatusFilter, serviceFilters, advanceFilters, toast]);

    return (
        <div className="w-full space-y-4 animate-in fade-in-50">
            {/* ========================================================= */}
            {/* 1. CABEÇALHO OPERACIONAL ENXUTO (PADRÃO NOTAS FISCAIS)    */}
            {/* ========================================================= */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
                        <BriefcaseIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-[#F8FAFC] tracking-tight">
                            Serviços & Adiantamentos
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                            Controle global de contratos de serviços, medições e extrato financeiro.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportCsv}
                        className="h-9 text-xs font-semibold border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-brand-dark-800 gap-1.5 cursor-pointer"
                        title="Exportar listagem em formato CSV"
                    >
                        <DownloadIcon className="h-4 w-4 text-slate-500 dark:text-gray-400" />
                        <span>Exportar CSV</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (selectedService && selectedService.status !== 'Concluído' && selectedService.remaining_value > 0.009) {
                                setAdvanceModalOpen(true);
                            } else {
                                const candidate = allServices.find(s => s.status !== 'Concluído' && s.remaining_value > 0.009);
                                if (candidate) {
                                    setSelectedService(candidate);
                                    setAdvanceModalOpen(true);
                                } else if (allServices.length > 0) {
                                    setSelectedService(allServices[0]);
                                    setAdvanceModalOpen(true);
                                } else {
                                    toast({
                                        title: 'Nenhum contrato ativo',
                                        description: 'Cadastre um contrato de serviço antes de registrar adiantamentos.',
                                        variant: 'destructive'
                                    });
                                }
                            }
                        }}
                        className="h-9 text-xs font-semibold border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-brand-dark-800 gap-1.5 cursor-pointer"
                    >
                        <PlusIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span>+ Nova Medição</span>
                    </Button>

                    <Button
                        size="sm"
                        onClick={() => { setSelectedService(null); setCreateServiceModalOpen(true); }}
                        className="h-9 text-xs font-bold bg-[#4F46E5] hover:bg-indigo-600 dark:bg-[#6366F1] dark:hover:bg-indigo-500 text-white gap-1.5 shadow-sm shadow-indigo-600/30 cursor-pointer"
                    >
                        <PlusIcon className="h-4 w-4" />
                        <span>+ Novo Contrato</span>
                    </Button>
                </div>
            </header>

            {/* ========================================================= */}
            {/* 2. SISTEMA DE ABAS (PADRÃO NOTAS FISCAIS)                 */}
            {/* ========================================================= */}
            <div className="border-b border-slate-200 dark:border-gray-800">
                <nav className="flex space-x-6 sm:space-x-8" aria-label="Abas">
                    <button
                        onClick={() => handleTabChange('servicos')}
                        className={`pb-2.5 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                            activeTab === 'servicos'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                        }`}
                    >
                        <BriefcaseIcon className="h-4 w-4" />
                        <span>Contratos de Serviços</span>
                        <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-brand-dark-800 text-slate-600 dark:text-gray-400 font-semibold">
                            {servicesSummary?.count ?? '...'}
                        </span>
                    </button>

                    <button
                        onClick={() => handleTabChange('adiantamentos')}
                        className={`pb-2.5 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                            activeTab === 'adiantamentos'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                        }`}
                    >
                        <DollarSignIcon className="h-4 w-4" />
                        <span>Extrato de Adiantamentos</span>
                        <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-brand-dark-800 text-slate-600 dark:text-gray-400 font-semibold">
                            {advancesSummary?.count ?? '...'}
                        </span>
                    </button>
                </nav>
            </div>

            {/* ============================================================== */}
            {/* CONTEÚDO DA ABA 1: CONTRATOS DE SERVIÇOS                       */}
            {/* ============================================================== */}
            {activeTab === 'servicos' && (
                <div className="space-y-4">
                    {/* Faixa de 4 Cards Operacionais: Serviços (Grid 4 colunas padrão Notas) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {/* Card 1: Total Contratado */}
                        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-4 rounded-xl shadow-xs flex items-center justify-between">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                    <BriefcaseIcon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">Total Contratado</p>
                                    <p className="text-lg font-bold text-slate-800 dark:text-[#F8FAFC] truncate font-mono">
                                        {formatCurrency(servicesSummary?.totalValue || 0)}
                                    </p>
                                </div>
                            </div>
                            <span className="text-[11px] font-semibold text-indigo-700 dark:text-[#818CF8] bg-[#EEF2FF] dark:bg-indigo-500/[0.12] px-2 py-0.5 rounded-full border border-indigo-200/80 dark:border-indigo-500/20 whitespace-nowrap shrink-0">
                                {servicesSummary?.count || 0} contratos
                            </span>
                        </div>

                        {/* Card 2: Total Pago */}
                        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-4 rounded-xl shadow-xs flex items-center justify-between">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                    <DollarSignIcon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">Total Pago (Execução)</p>
                                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate font-mono">
                                        {formatCurrency(servicesSummary?.totalPaid || 0)}
                                    </p>
                                </div>
                            </div>
                            <span className="text-[11px] font-semibold text-[#047857] dark:text-[#34D399] bg-[#ECFDF5] dark:bg-emerald-500/[0.12] px-2 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-500/20 whitespace-nowrap shrink-0">
                                {servicesSummary?.totalValue ? Math.round(((servicesSummary.totalPaid || 0) / servicesSummary.totalValue) * 100) : 0}% quitado
                            </span>
                        </div>

                        {/* Card 3: Saldo Restante */}
                        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-4 rounded-xl shadow-xs flex items-center justify-between">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                                    <TrendingUpIcon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">Saldo a Pagar</p>
                                    <p className="text-lg font-bold text-slate-800 dark:text-[#F8FAFC] truncate font-mono">
                                        {formatCurrency(servicesSummary?.remainingValue || 0)}
                                    </p>
                                </div>
                            </div>
                            <span className="text-[11px] font-semibold text-[#B45309] dark:text-[#FBBF24] bg-[#FFFBEB] dark:bg-amber-500/[0.12] px-2 py-0.5 rounded border border-amber-200/80 dark:border-amber-500/20 whitespace-nowrap shrink-0">
                                Pendente
                            </span>
                        </div>

                        {/* Card 4: Centros de Custo & Ticket Médio */}
                        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-4 rounded-xl shadow-xs flex items-center justify-between">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                    <ConstructionIcon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">Centros de Custo</p>
                                    <p className="text-base font-bold text-slate-800 dark:text-[#F8FAFC] truncate">
                                        {serviceFilters.projectId
                                            ? (projects.find(p => p.id === serviceFilters.projectId)?.name || 'Obra Filtrada')
                                            : `${projects.length} obras ativas`}
                                    </p>
                                </div>
                            </div>
                            <span className="text-[11px] font-medium text-slate-600 dark:text-[#94A3B8] bg-slate-100 dark:bg-[#1E293B] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700/60 whitespace-nowrap shrink-0">
                                {allServices.length} listados
                            </span>
                        </div>
                    </div>

                    {/* Barra de Controle e Filtros Rápidos (Colada no topo da tabela) */}
                    <div className="space-y-0">
                        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-t-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                            {/* Esquerda: Quick-filter pills para Obra + Pílulas de Status + Atalhos de Período */}
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                                {/* Pílulas de Status */}
                                <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#162235] p-0.5 border border-slate-200 dark:border-[#273549] text-xs">
                                    <button
                                        type="button"
                                        onClick={() => setServiceStatusFilter('Em Andamento')}
                                        className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                                            serviceStatusFilter === 'Em Andamento'
                                                ? 'bg-[#EEF2FF] text-[#4F46E5] dark:bg-[#1E293B] dark:text-[#818CF8] shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    >
                                        Em Andamento
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setServiceStatusFilter('Concluído')}
                                        className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                                            serviceStatusFilter === 'Concluído'
                                                ? 'bg-[#EEF2FF] text-[#4F46E5] dark:bg-[#1E293B] dark:text-[#818CF8] shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    >
                                        Concluídos
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setServiceStatusFilter('Todos')}
                                        className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                                            serviceStatusFilter === 'Todos'
                                                ? 'bg-[#EEF2FF] text-[#4F46E5] dark:bg-[#1E293B] dark:text-[#818CF8] shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    >
                                        Todos
                                    </button>
                                </div>

                                <div className="hidden lg:block h-4 w-px bg-slate-200 dark:bg-gray-800 mx-1" />

                                {/* Pílulas Rápidas de Obra */}
                                <button
                                    type="button"
                                    onClick={() => setServiceFilters(prev => ({ ...prev, projectId: null }))}
                                    className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                                        !serviceFilters.projectId
                                            ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold border border-indigo-200/80 dark:bg-[#1E293B] dark:text-[#818CF8] dark:border-indigo-800/40 shadow-xs'
                                            : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium'
                                    }`}
                                >
                                    Todas Obras
                                </button>
                                {projects.slice(0, 3).map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setServiceFilters(prev => ({ ...prev, projectId: prev.projectId === p.id ? null : p.id }))}
                                        className={`px-2.5 py-1 rounded-md text-xs max-w-[130px] truncate transition-all cursor-pointer ${
                                            serviceFilters.projectId === p.id
                                                ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold border border-indigo-200/80 dark:bg-[#1E293B] dark:text-[#818CF8] dark:border-indigo-800/40 shadow-xs'
                                                : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium'
                                        }`}
                                        title={p.name}
                                    >
                                        {p.name}
                                    </button>
                                ))}

                                <div className="hidden xl:block h-4 w-px bg-slate-200 dark:bg-gray-800 mx-1" />

                                {/* Atalhos Rápidos de Período */}
                                <div className="hidden md:flex items-center gap-1">
                                    {QUICK_PERIOD_SHORTCUTS.slice(1).map(s => (
                                        <button
                                            key={s.label}
                                            type="button"
                                            onClick={() => applyQuickPeriodServices(s)}
                                            className="px-2 py-1 text-[11px] font-medium rounded-md text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-dark-800 transition-colors cursor-pointer"
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Direita: Busca Rápida + Botão Drawer Filtros */}
                            <div className="flex items-center gap-2">
                                <div className="relative w-52 sm:w-60">
                                    <SearchIcon className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        type="text"
                                        value={serviceFilters.searchTerm}
                                        onChange={(e) => setServiceFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                                        placeholder="Buscar serviço..."
                                        className="h-8 pl-8 pr-7 text-xs bg-slate-50 dark:bg-brand-dark-800/80 border-slate-200 dark:border-gray-700"
                                    />
                                    {serviceFilters.searchTerm && (
                                        <button
                                            type="button"
                                            onClick={() => setServiceFilters(prev => ({ ...prev, searchTerm: '' }))}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            <XIcon className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setTempServiceFilters(serviceFilters); setServiceFilterSheetOpen(true); }}
                                    className="h-8 px-3 text-xs font-semibold border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-brand-dark-800 text-slate-700 dark:text-gray-300 gap-1.5 cursor-pointer"
                                >
                                    <FilterIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                    <span>Filtros</span>
                                    {activeServiceFiltersCount > 0 && (
                                        <span className="ml-1 flex items-center justify-center h-4.5 min-w-[18px] px-1 text-[10px] font-bold rounded-full bg-indigo-600 text-white">
                                            {activeServiceFiltersCount}
                                        </span>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Faixa de Filtros Ativos (se houver) */}
                        {activeServiceFiltersCount > 0 && (
                            <div className="flex items-center justify-between gap-3 bg-indigo-50/60 dark:bg-indigo-950/20 border-x border-b border-indigo-200/80 dark:border-indigo-900/40 px-4 py-2 text-xs">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 text-xs">
                                        <FilterIcon className="h-3.5 w-3.5" /> Filtros ativos ({activeServiceFiltersCount}):
                                    </span>
                                    {serviceFilters.searchTerm && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                                            Termo: "{serviceFilters.searchTerm}"
                                        </span>
                                    )}
                                    {serviceFilters.collaboratorId && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                                            Prestador: {collaborators.find(c => c.id === serviceFilters.collaboratorId)?.name}
                                        </span>
                                    )}
                                    {serviceFilters.projectId && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                                            Obra: {projects.find(p => p.id === serviceFilters.projectId)?.name}
                                        </span>
                                    )}
                                    {(serviceFilters.startDate || serviceFilters.endDate) && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                                            Período: {serviceFilters.startDate ? serviceFilters.startDate.toLocaleDateString('pt-BR') : 'Início'} até {serviceFilters.endDate ? serviceFilters.endDate.toLocaleDateString('pt-BR') : 'Hoje'}
                                        </span>
                                    )}
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setServiceFilters({ searchTerm: '', collaboratorId: null, projectId: null, startDate: null, endDate: null })}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline h-7 px-2 font-semibold"
                                >
                                    Limpar todos
                                </Button>
                            </div>
                        )}

                        {/* Tabela de Alta Densidade com Split View Retrátil Inline */}
                        <div className={`overflow-hidden rounded-b-xl border-x border-b border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111827] shadow-xs flex flex-col lg:flex-row ${
                            selectedService && isDesktop ? 'items-stretch' : ''
                        }`}>
                            {isLoadingServices ? (
                                <>
                                    <div className="md:hidden p-4">
                                        <div className="grid grid-cols-1 gap-4">
                                            {Array.from({ length: 4 }).map((_, i) => <ServicoCardSkeleton key={i} />)}
                                        </div>
                                    </div>
                                    <div className="hidden md:block w-full">
                                        <TableSkeleton />
                                    </div>
                                </>
                            ) : isErrorServices ? (
                                <p className="text-center text-red-500 py-8 text-sm w-full">Erro ao carregar contratos de serviços.</p>
                            ) : allServices.length === 0 ? (
                                <div className="text-center py-12 px-6 bg-slate-50/50 dark:bg-brand-dark-900/50 w-full">
                                    <div className="mx-auto p-3 bg-slate-100 dark:bg-gray-800 rounded-full w-fit mb-3">
                                        <BriefcaseIcon className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Nenhum contrato de serviço encontrado</h3>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-gray-400 max-w-sm mx-auto">
                                        {activeServiceFiltersCount > 0 
                                            ? "Tente ajustar ou limpar os critérios de busca." 
                                            : "Cadastre um novo contrato de prestação de serviços para gerenciar escopo, medições e pagamentos."}
                                    </p>
                                    <div className="mt-5">
                                        <Button 
                                            size="sm"
                                            onClick={() => { setSelectedService(null); setCreateServiceModalOpen(true); }}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs cursor-pointer"
                                        >
                                            <PlusIcon className="h-3.5 w-3.5 mr-1.5"/>
                                            Novo Contrato
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Mobile: Cards */}
                                    <div className="md:hidden p-3 w-full">
                                        <div className="grid grid-cols-1 gap-4">
                                            {allServices.map(service => (
                                                <ServicoCard
                                                    key={service.id}
                                                    service={service}
                                                    onSelect={(s) => { setSelectedService(s); setDetailsModalOpen(true); }}
                                                    onEdit={(s) => { setSelectedService(s); setEditServiceModalOpen(true); }}
                                                    onDelete={(s) => { setServiceToDelete(s); setDeleteServiceModalOpen(true); }}
                                                    onAddAdvance={(s) => { setSelectedService(s); setAdvanceModalOpen(true); }}
                                                    onViewAttachment={service.receipt_path ? handleViewAttachment : undefined}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Desktop: Painel Esquerdo (Tabela Retrátil em Split View) */}
                                    <div className={`${
                                        selectedService && isDesktop
                                            ? 'w-full lg:w-[48%] xl:w-[46%] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-gray-800'
                                            : 'w-full'
                                    }`}>
                                        <div className={`hidden md:block overflow-x-auto ${selectedService && isDesktop ? 'max-h-[calc(100vh-270px)] overflow-y-auto custom-scrollbar' : ''}`}>
                                            <table className="w-full text-sm text-left text-slate-600 dark:text-gray-400">
                                                <thead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 bg-slate-50 dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#1E293B] sticky top-0 z-10 text-slate-500 dark:text-[#94A3B8]">
                                                    <tr>
                                                        <th className="px-3 sm:px-4 py-3.5 font-semibold">Serviço / Escopo</th>
                                                        <th className={selectedService && isDesktop ? 'hidden' : 'px-4 py-3.5 font-semibold'}>Prestador</th>
                                                        <th className={selectedService && isDesktop ? 'hidden' : 'px-4 py-3.5 font-semibold'}>Obra / Destino</th>
                                                        <th className={selectedService && isDesktop ? 'hidden' : 'px-4 py-3.5 font-semibold'}>Cronograma & Prazo</th>
                                                        <th className="px-3 sm:px-4 py-3.5 font-semibold text-right whitespace-nowrap">Execução Financeira</th>
                                                        <th className={selectedService && isDesktop ? 'hidden' : 'px-4 py-3.5 font-semibold text-center'}>Status</th>
                                                        <th className="px-2 sm:px-4 py-3.5 font-semibold text-center w-12 sm:w-16">Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-gray-800 bg-white dark:bg-[#111827]">
                                                    {allServices.map((service) => {
                                                        const isCompleted = service.status === 'Concluído';
                                                        const isSelected = selectedService?.id === service.id && isDesktop;
                                                        return (
                                                            <tr
                                                                id={`service-row-${service.id}`}
                                                                key={service.id}
                                                                className={`transition-colors cursor-pointer group ${
                                                                    isSelected
                                                                        ? 'bg-[#F5F3FF] dark:bg-indigo-500/[0.08] border-l-4 border-[#818CF8] font-semibold text-slate-800 dark:text-[#F8FAFC]'
                                                                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                                                }`}
                                                                onClick={() => handleSelectService(service)}
                                                            >
                                                                {/* 1. SERVIÇO / ESCOPO (+ PRESTADOR/OBRA quando retraída) */}
                                                                <td className="px-3 sm:px-4 py-3 min-w-0">
                                                                    <div className="flex flex-col min-w-0">
                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                            <span className={`text-xs truncate ${isSelected ? 'font-bold text-indigo-700 dark:text-indigo-300' : 'font-semibold text-slate-900 dark:text-white'}`} title={service.description}>
                                                                                {service.description}
                                                                            </span>
                                                                            {service.receipt_path && (
                                                                                <span className="text-[10px] text-slate-400" title="Possui anexo / minuta">
                                                                                    <PaperclipIcon className="h-3 w-3 inline" />
                                                                                </span>
                                                                            )}
                                                                            {selectedService && isDesktop && (
                                                                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${
                                                                                    isCompleted
                                                                                        ? 'bg-[#ECFDF5] text-[#047857] border-emerald-200/80 dark:bg-emerald-500/[0.12] dark:text-[#34D399] dark:border-emerald-500/20'
                                                                                        : 'bg-[#EEF2FF] text-[#4338CA] border-indigo-200/80 dark:bg-indigo-500/[0.12] dark:text-[#818CF8] dark:border-indigo-500/20'
                                                                                }`}>
                                                                                    {service.status}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {selectedService && isDesktop && (
                                                                            <span className="text-[10px] text-slate-500 dark:text-gray-400 truncate max-w-[200px]" title={`${service.collaborator_name || 'Sem colaborador'} • ${service.project_name || 'Sem obra'}`}>
                                                                                {service.collaborator_name || 'Sem colaborador'} • {service.project_name || 'Sem obra'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>

                                                                {/* 2. PRESTADOR */}
                                                                <td className={selectedService && isDesktop ? 'hidden' : 'px-4 py-3 max-w-xs'}>
                                                                    <span className="font-semibold text-slate-900 dark:text-white text-xs truncate block" title={service.collaborator_name || 'Sem colaborador'}>
                                                                        {service.collaborator_name || 'Sem colaborador'}
                                                                    </span>
                                                                </td>

                                                                {/* 3. OBRA / DESTINO */}
                                                                <td className={selectedService && isDesktop ? 'hidden' : 'px-4 py-3'}>
                                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-brand-dark-800 text-slate-700 dark:text-gray-300 border border-slate-200/80 dark:border-gray-700 max-w-[180px] truncate" title={service.project_name || 'Geral'}>
                                                                        <ConstructionIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                                        <span className="truncate">{service.project_name || 'Geral'}</span>
                                                                    </span>
                                                                </td>

                                                                {/* 4. CRONOGRAMA & PRAZO */}
                                                                <td className={selectedService && isDesktop ? 'hidden' : 'px-4 py-3 whitespace-nowrap text-xs text-slate-500 dark:text-gray-400'}>
                                                                    <div>{formatDate(service.start_date)}</div>
                                                                    <div className="text-[10px] text-slate-400">até {formatDate(service.end_date)}</div>
                                                                </td>

                                                                {/* 5. EXECUÇÃO FINANCEIRA */}
                                                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-right">
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                                                            {formatCurrency(service.total_value)}
                                                                        </span>
                                                                        <span className={`text-[10px] font-mono font-medium ${isCompleted ? 'text-slate-400' : (service.remaining_value > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400')}`}>
                                                                            {isCompleted ? 'Quitado' : `Resta ${formatCurrency(service.remaining_value)}`}
                                                                        </span>
                                                                    </div>
                                                                </td>

                                                                {/* 6. STATUS */}
                                                                <td className={selectedService && isDesktop ? 'hidden' : 'px-4 py-3 whitespace-nowrap text-center'}>
                                                                    <Badge className={isCompleted 
                                                                        ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-[10px] py-0' 
                                                                        : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-[10px] py-0'}
                                                                    >
                                                                        {service.status}
                                                                    </Badge>
                                                                </td>

                                                                {/* 7. AÇÕES */}
                                                                <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button 
                                                                                variant="ghost" 
                                                                                size="icon" 
                                                                                className="h-7 w-7 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-dark-800 rounded-lg cursor-pointer"
                                                                            >
                                                                                <MoreVerticalIcon className="h-4 w-4" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end" className="w-44 bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 shadow-xl rounded-xl p-1 z-30">
                                                                            <DropdownMenuItem onSelect={() => handleSelectService(service)} className="text-xs py-2 px-2.5 rounded-lg cursor-pointer">
                                                                                <EyeIcon className="h-4 w-4 mr-2 text-slate-400" /> Visualizar Detalhes
                                                                            </DropdownMenuItem>
                                                                            {!isCompleted && service.remaining_value > 0.009 && (
                                                                                <DropdownMenuItem onSelect={() => { setSelectedService(service); setAdvanceModalOpen(true); }} className="text-xs py-2 px-2.5 rounded-lg cursor-pointer font-semibold text-emerald-600 dark:text-emerald-400">
                                                                                    <PlusIcon className="h-4 w-4 mr-2" /> Nova Medição
                                                                                </DropdownMenuItem>
                                                                            )}
                                                                            <DropdownMenuItem onSelect={() => { setSelectedService(service); setEditServiceModalOpen(true); }} className="text-xs py-2 px-2.5 rounded-lg cursor-pointer">
                                                                                <EditIcon className="h-4 w-4 mr-2 text-slate-400" /> Editar Contrato
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem onSelect={() => handleViewAdvancesForService(service)} className="text-xs py-2 px-2.5 rounded-lg cursor-pointer">
                                                                                <DollarSignIcon className="h-4 w-4 mr-2 text-amber-500" /> Ver no Extrato
                                                                            </DropdownMenuItem>
                                                                            {service.receipt_path && (
                                                                                <DropdownMenuItem onSelect={() => handleViewAttachment(service.receipt_path!)} className="text-xs py-2 px-2.5 rounded-lg cursor-pointer">
                                                                                    <PaperclipIcon className="h-4 w-4 mr-2" /> Ver Anexo
                                                                                </DropdownMenuItem>
                                                                            )}
                                                                            <DropdownMenuItem 
                                                                                onSelect={() => { setServiceToDelete(service); setDeleteServiceModalOpen(true); }} 
                                                                                className="text-xs py-2 px-2.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer font-semibold"
                                                                            >
                                                                                <Trash2Icon className="h-4 w-4 mr-2 text-rose-600" /> Excluir Contrato
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

                                        {/* Sentinel de Scroll Infinito Automático */}
                                        <div ref={servicesSentinelRef} className="p-2 text-center border-t border-slate-100 dark:border-gray-800 shrink-0">
                                            {isFetchingNextPageServices ? (
                                                <div className="flex items-center justify-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                                                    <div className="w-3.5 h-3.5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                                                    <span>Carregando mais contratos...</span>
                                                </div>
                                            ) : hasNextPageServices ? (
                                                <span className="text-[10px] text-slate-400">Role ou use as setas para carregar mais</span>
                                            ) : allServices.length > 0 ? (
                                                <span className="text-[10px] text-slate-400">Todos os {allServices.length} contratos carregados</span>
                                            ) : null}
                                        </div>
                                    </div>

                                    {/* Desktop: Painel Direito (Mestre-Detalhe Embutido - Sem Modal / Sem Backdrop) */}
                                    {selectedService && isDesktop && (
                                        <div className="w-full lg:w-[52%] xl:w-[54%] shrink-0 min-h-[480px] max-h-[calc(100vh-270px)] overflow-hidden flex flex-col animate-in fade-in-0 duration-150">
                                            <ServicoDetailPanel
                                                service={selectedService}
                                                onClose={() => setSelectedService(null)}
                                                onEdit={(s) => { setSelectedService(s); setEditServiceModalOpen(true); }}
                                                onDelete={(s) => { setServiceToDelete(s); setDeleteServiceModalOpen(true); }}
                                                onAddAdvance={(s) => { setSelectedService(s); setAdvanceModalOpen(true); }}
                                                onViewAdvances={handleViewAdvancesForService}
                                                onPrevService={handlePrevService}
                                                onNextService={handleNextService}
                                                hasPrev={hasPrevService}
                                                hasNext={hasNextService}
                                                currentIndex={selectedServiceIndex}
                                                totalCount={allServices.length}
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* CONTEÚDO DA ABA 2: EXTRATO DE ADIANTAMENTOS                   */}
            {/* ============================================================== */}
            {activeTab === 'adiantamentos' && (
                <div className="space-y-4">
                    {/* Faixa de 4 Cards Operacionais: Adiantamentos (Padrão Notas Fiscais) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {/* Card 1: Total Liberado */}
                        <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 p-4 rounded-xl shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                    <DollarSignIcon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Total Liberado</p>
                                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate font-mono">
                                        {formatCurrency(advancesSummary?.totalPaid || 0)}
                                    </p>
                                </div>
                            </div>
                            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60 whitespace-nowrap shrink-0">
                                {advancesSummary?.count || 0} liberações
                            </span>
                        </div>

                        {/* Card 2: Volume de Medições */}
                        <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 p-4 rounded-xl shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                    <CheckCircle2Icon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Medições Registradas</p>
                                    <p className="text-lg font-bold text-slate-900 dark:text-white truncate font-mono">
                                        {advancesSummary?.count || 0} registros
                                    </p>
                                </div>
                            </div>
                            <span className="text-[11px] font-medium text-slate-500 dark:text-gray-400 bg-slate-100 dark:bg-brand-dark-800 px-2 py-0.5 rounded border border-slate-200 dark:border-gray-700 whitespace-nowrap shrink-0">
                                {allAdvances.length} listadas
                            </span>
                        </div>

                        {/* Card 3: Ticket Médio por Medição */}
                        <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 p-4 rounded-xl shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                                    <TrendingUpIcon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Média por Medição</p>
                                    <p className="text-lg font-bold text-slate-900 dark:text-white truncate font-mono">
                                        {formatCurrency(advancesSummary?.count ? ((advancesSummary.totalPaid || 0) / advancesSummary.count) : 0)}
                                    </p>
                                </div>
                            </div>
                            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60 whitespace-nowrap shrink-0">
                                Ticket Médio
                            </span>
                        </div>

                        {/* Card 4: Obras & Centros de Custo */}
                        <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 p-4 rounded-xl shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                    <ConstructionIcon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Centros de Custo</p>
                                    <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                                        {advanceFilters.projectId
                                            ? (projects.find(p => p.id === advanceFilters.projectId)?.name || 'Obra Filtrada')
                                            : `${projects.length} obras ativas`}
                                    </p>
                                </div>
                            </div>
                            <span className="text-[11px] font-medium text-slate-500 dark:text-gray-400 bg-slate-100 dark:bg-brand-dark-800 px-2 py-0.5 rounded border border-slate-200 dark:border-gray-700 whitespace-nowrap shrink-0">
                                {advanceFilters.projectId ? 'Filtro Ativo' : 'Consolidado'}
                            </span>
                        </div>
                    </div>

                    {/* Barra de Filtros de Adiantamentos */}
                    <div className="space-y-0">
                        <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 rounded-t-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                            {/* Esquerda: Pílulas de Obra e Atalhos */}
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <button
                                    type="button"
                                    onClick={() => setAdvanceFilters(prev => ({ ...prev, projectId: null }))}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                        !advanceFilters.projectId
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-slate-100 dark:bg-brand-dark-800 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-brand-dark-700'
                                    }`}
                                >
                                    Todas Obras
                                </button>
                                {projects.slice(0, 3).map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setAdvanceFilters(prev => ({ ...prev, projectId: prev.projectId === p.id ? null : p.id }))}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-medium max-w-[130px] truncate transition-all cursor-pointer ${
                                            advanceFilters.projectId === p.id
                                                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                                                : 'bg-slate-100 dark:bg-brand-dark-800 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-brand-dark-700'
                                        }`}
                                        title={p.name}
                                    >
                                        {p.name}
                                    </button>
                                ))}

                                <div className="hidden xl:block h-4 w-px bg-slate-200 dark:bg-gray-800 mx-1" />

                                <div className="hidden md:flex items-center gap-1">
                                    {QUICK_PERIOD_SHORTCUTS.slice(1).map(s => (
                                        <button
                                            key={s.label}
                                            type="button"
                                            onClick={() => applyQuickPeriodAdvances(s)}
                                            className="px-2 py-1 text-[11px] font-medium rounded-md text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-dark-800 transition-colors cursor-pointer"
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Direita: Busca e Botão Filtros */}
                            <div className="flex items-center gap-2">
                                <div className="relative w-52 sm:w-60">
                                    <SearchIcon className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        type="text"
                                        value={advanceFilters.searchTerm}
                                        onChange={(e) => setAdvanceFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                                        placeholder="Buscar medição..."
                                        className="h-8 pl-8 pr-7 text-xs bg-slate-50 dark:bg-brand-dark-800/80 border-slate-200 dark:border-gray-700"
                                    />
                                    {advanceFilters.searchTerm && (
                                        <button
                                            type="button"
                                            onClick={() => setAdvanceFilters(prev => ({ ...prev, searchTerm: '' }))}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            <XIcon className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setTempAdvanceFilters(advanceFilters); setAdvanceFilterSheetOpen(true); }}
                                    className="h-8 px-3 text-xs font-semibold border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-brand-dark-800 text-slate-700 dark:text-gray-300 gap-1.5 cursor-pointer"
                                >
                                    <FilterIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                    <span>Filtros</span>
                                    {activeAdvanceFiltersCount > 0 && (
                                        <span className="ml-1 flex items-center justify-center h-4.5 min-w-[18px] px-1 text-[10px] font-bold rounded-full bg-indigo-600 text-white">
                                            {activeAdvanceFiltersCount}
                                        </span>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Faixa de Filtros Ativos em Adiantamentos */}
                        {activeAdvanceFiltersCount > 0 && (
                            <div className="flex items-center justify-between gap-3 bg-indigo-50/60 dark:bg-indigo-950/20 border-x border-b border-indigo-200/80 dark:border-indigo-900/40 px-4 py-2 text-xs">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 text-xs">
                                        <FilterIcon className="h-3.5 w-3.5" /> Filtros ativos ({activeAdvanceFiltersCount}):
                                    </span>
                                    {advanceFilters.searchTerm && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                                            Termo: "{advanceFilters.searchTerm}"
                                        </span>
                                    )}
                                    {advanceFilters.collaboratorId && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                                            Colaborador: {collaborators.find(c => c.id === advanceFilters.collaboratorId)?.name}
                                        </span>
                                    )}
                                    {advanceFilters.projectId && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                                            Obra: {projects.find(p => p.id === advanceFilters.projectId)?.name}
                                        </span>
                                    )}
                                    {advanceFilters.serviceId && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                                            Filtrado por contrato
                                        </span>
                                    )}
                                    {(advanceFilters.dateRange?.from || advanceFilters.dateRange?.to) && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                                            Período: {advanceFilters.dateRange.from ? advanceFilters.dateRange.from.toLocaleDateString('pt-BR') : 'Início'} até {advanceFilters.dateRange.to ? advanceFilters.dateRange.to.toLocaleDateString('pt-BR') : 'Hoje'}
                                        </span>
                                    )}
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setAdvanceFilters({ searchTerm: '', collaboratorId: null, projectId: null, serviceId: null, dateRange: undefined })}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline h-7 px-2 font-semibold"
                                >
                                    Limpar todos
                                </Button>
                            </div>
                        )}

                        {/* Listagem de Adiantamentos */}
                        <div className="overflow-hidden rounded-b-xl border-x border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900 shadow-sm">
                            {isLoadingAdvances ? (
                                <>
                                    <div className="md:hidden p-4">
                                        <div className="grid grid-cols-1 gap-4">
                                            {Array.from({ length: 4 }).map((_, i) => <AdiantamentoCardSkeleton key={i} />)}
                                        </div>
                                    </div>
                                    <div className="hidden md:block w-full">
                                        <TableSkeleton />
                                    </div>
                                </>
                            ) : allAdvances.length === 0 ? (
                                <div className="text-center py-12 px-6 bg-slate-50/50 dark:bg-brand-dark-900/50 w-full">
                                    <div className="mx-auto p-3 bg-slate-100 dark:bg-gray-800 rounded-full w-fit mb-3">
                                        <DollarSignIcon className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Nenhum adiantamento encontrado</h3>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-gray-400 max-w-sm mx-auto">
                                        {activeAdvanceFiltersCount > 0 
                                            ? "Tente ajustar os critérios de filtro." 
                                            : "Adiantamentos e medições liberadas nos contratos aparecerão detalhados aqui."}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Mobile: Cards */}
                                    <div className="md:hidden p-3 grid grid-cols-1 gap-4">
                                        {allAdvances.map(advance => (
                                            <AdiantamentoCard
                                                key={advance.id}
                                                advance={advance}
                                                onEdit={(a) => { setSelectedAdvance(a); setEditAdvanceModalOpen(true); }}
                                                onDelete={(a) => { setAdvanceToDelete(a); setDeleteAdvanceModalOpen(true); }}
                                                onViewAttachment={advance.receipt_path ? handleViewAttachment : undefined}
                                            />
                                        ))}
                                    </div>

                                    {/* Desktop: Tabela de Adiantamentos */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-sm text-left text-slate-600 dark:text-gray-400">
                                            <thead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 bg-slate-50 dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#1E293B] sticky top-0 z-10 text-slate-500 dark:text-[#94A3B8]">
                                                <tr>
                                                    <th className="px-3 sm:px-4 py-3.5 font-semibold">Data Liberação</th>
                                                    <th className="px-3 sm:px-4 py-3.5 font-semibold">Medição / Observação</th>
                                                    <th className="px-3 sm:px-4 py-3.5 font-semibold">Contrato Vinculado</th>
                                                    <th className="px-3 sm:px-4 py-3.5 font-semibold">Prestador / Obra</th>
                                                    <th className="px-3 sm:px-4 py-3.5 font-semibold text-right whitespace-nowrap">Valor Liberado</th>
                                                    <th className="px-3 sm:px-4 py-3.5 font-semibold text-center">Comprovante</th>
                                                    <th className="px-2 sm:px-4 py-3.5 font-semibold text-center w-12 sm:w-16">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 bg-white dark:bg-[#111827]">
                                                {allAdvances.map((advance) => (
                                                    <tr 
                                                        key={advance.id} 
                                                        className="hover:bg-slate-50 dark:hover:bg-brand-dark-800/60 transition-colors cursor-pointer group"
                                                        onClick={() => { setSelectedAdvance(advance); setEditAdvanceModalOpen(true); }}
                                                    >
                                                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap font-medium text-slate-900 dark:text-white font-mono text-xs">
                                                            {formatDate(advance.payment_date)}
                                                        </td>
                                                        <td className="px-3 sm:px-4 py-3 max-w-xs truncate text-slate-700 dark:text-gray-300 text-xs" title={advance.description || ''}>
                                                            {advance.description || <span className="text-slate-400 italic">Sem descrição</span>}
                                                        </td>
                                                        <td className="px-3 sm:px-4 py-3 max-w-xs truncate font-medium text-slate-900 dark:text-white text-xs" title={advance.service_description}>
                                                            {advance.service_description}
                                                        </td>
                                                        <td className="px-3 sm:px-4 py-3">
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-slate-900 dark:text-white text-xs">{advance.collaborator_name || 'Sem colaborador'}</span>
                                                                <span className="text-[10px] text-slate-500 dark:text-gray-400">{advance.project_name || 'Sem obra'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono text-xs sm:text-sm">
                                                            {formatCurrency(advance.value)}
                                                        </td>
                                                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                                            {advance.receipt_path ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleViewAttachment(advance.receipt_path!)}
                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors cursor-pointer"
                                                                >
                                                                    <PaperclipIcon className="h-3 w-3" />
                                                                    <span>Anexo</span>
                                                                </button>
                                                            ) : (
                                                                <span className="text-xs text-slate-400">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        className="h-7 w-7 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-dark-800 rounded-lg cursor-pointer"
                                                                    >
                                                                        <MoreVerticalIcon className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-44 bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 shadow-xl rounded-xl p-1 z-30">
                                                                    {advance.receipt_path && (
                                                                        <DropdownMenuItem onSelect={() => handleViewAttachment(advance.receipt_path!)} className="text-xs py-2 px-2.5 rounded-lg cursor-pointer">
                                                                            <PaperclipIcon className="h-4 w-4 mr-2" /> Ver Comprovante
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuItem onSelect={() => { setSelectedAdvance(advance); setEditAdvanceModalOpen(true); }} className="text-xs py-2 px-2.5 rounded-lg cursor-pointer">
                                                                        <EditIcon className="h-4 w-4 mr-2 text-indigo-600 dark:text-indigo-400" /> Editar Medição
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem 
                                                                        onSelect={() => { setAdvanceToDelete(advance); setDeleteAdvanceModalOpen(true); }} 
                                                                        className="text-xs py-2 px-2.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer font-semibold"
                                                                    >
                                                                        <Trash2Icon className="h-4 w-4 mr-2 text-rose-600" /> Excluir Medição
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Sentinel de Carregamento Infinito */}
                                    <div ref={advancesSentinelRef} className="p-2 text-center border-t border-slate-100 dark:border-gray-800 shrink-0">
                                        {isFetchingNextPageAdvances ? (
                                            <div className="flex items-center justify-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                                                <div className="w-3.5 h-3.5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                                                <span>Carregando mais medições...</span>
                                            </div>
                                        ) : hasNextPageAdvances ? (
                                            <span className="text-[10px] text-slate-400">Role para carregar mais</span>
                                        ) : allAdvances.length > 0 ? (
                                            <span className="text-[10px] text-slate-400">Todas as {allAdvances.length} medições carregadas</span>
                                        ) : null}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* DRAWER DE FILTROS: SERVIÇOS                                    */}
            {/* ============================================================== */}
            <ResponsiveModal open={isServiceFilterSheetOpen} onOpenChange={setServiceFilterSheetOpen} displayMode="drawer">
                <ResponsiveModalContent size="sm">
                    <ResponsiveModalHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg border border-indigo-200 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400">
                                <FilterIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <ResponsiveModalTitle>Filtrar Serviços</ResponsiveModalTitle>
                                <ResponsiveModalDescription>Filtre por obra, colaborador ou período de execução</ResponsiveModalDescription>
                            </div>
                        </div>
                    </ResponsiveModalHeader>

                    <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-4 bg-slate-50/50 dark:bg-brand-dark-950/50">
                        {/* Atalhos Rápidos de Período */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                                    <CalendarIcon className="h-3.5 w-3.5 text-indigo-600" />
                                    Atalhos de Período
                                </Label>
                                {(tempServiceFilters.startDate || tempServiceFilters.endDate) && (
                                    <button
                                        type="button"
                                        onClick={() => setTempServiceFilters(f => ({ ...f, startDate: null, endDate: null }))}
                                        className="text-[11px] text-rose-500 hover:underline flex items-center gap-0.5 font-medium"
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
                                        onClick={() => {
                                            const today = new Date();
                                            today.setHours(0, 0, 0, 0);
                                            if (shortcut.isCurrentMonth) {
                                                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                                                setTempServiceFilters(f => ({ ...f, startDate: startOfMonth, endDate: today }));
                                            } else if (shortcut.daysAgo === 0) {
                                                setTempServiceFilters(f => ({ ...f, startDate: today, endDate: today }));
                                            } else {
                                                const pastDate = new Date(Date.now() - shortcut.daysAgo * 86400000);
                                                pastDate.setHours(0, 0, 0, 0);
                                                setTempServiceFilters(f => ({ ...f, startDate: pastDate, endDate: today }));
                                            }
                                        }}
                                        className="h-8 text-xs font-medium bg-white dark:bg-brand-dark-900 border-slate-200 dark:border-gray-800 hover:border-indigo-600 hover:text-indigo-600 justify-center"
                                    >
                                        {shortcut.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Filtro Obra / Projeto */}
                        <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-slate-200 dark:border-gray-800 space-y-2 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-gray-200 flex items-center gap-1.5">
                                <ConstructionIcon className="h-3.5 w-3.5 text-indigo-600" />
                                Obra / Projeto
                            </Label>
                            <Popover open={isProjectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between font-normal text-left h-9 px-3 text-xs bg-white dark:bg-brand-dark-950 border-slate-300 dark:border-gray-800 text-slate-900 dark:text-white">
                                        <span className="truncate">
                                            {tempServiceFilters.projectId
                                                ? projects.find(p => p.id === tempServiceFilters.projectId)?.name
                                                : "Todas as obras"}
                                        </span>
                                        <ChevronsUpDownIcon className="ml-2 h-4 w-4 text-slate-400 flex-shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                                    <Command>
                                        <CommandInput placeholder="Buscar obra..." value={projectSearch} onInput={(e) => setProjectSearch(e.currentTarget.value)} />
                                        <CommandList className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                            <CommandEmpty className="py-2 text-center text-xs text-slate-400">Nenhuma obra encontrada.</CommandEmpty>
                                            <CommandItem className="cursor-pointer text-xs" onSelect={() => {
                                                setTempServiceFilters(f => ({ ...f, projectId: null }));
                                                setProjectPopoverOpen(false);
                                            }}>
                                                -- Todas as obras --
                                            </CommandItem>
                                            {projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase())).map(p => (
                                                <CommandItem key={p.id} className="cursor-pointer text-xs" onSelect={() => {
                                                    setTempServiceFilters(f => ({ ...f, projectId: p.id }));
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

                        {/* Filtro Colaborador */}
                        <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-slate-200 dark:border-gray-800 space-y-2 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-gray-200 flex items-center gap-1.5">
                                <UserIcon className="h-3.5 w-3.5 text-indigo-600" />
                                Colaborador / Prestador
                            </Label>
                            <Popover open={isCollaboratorPopoverOpen} onOpenChange={setCollaboratorPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between font-normal text-left h-9 px-3 text-xs bg-white dark:bg-brand-dark-950 border-slate-300 dark:border-gray-800 text-slate-900 dark:text-white">
                                        <span className="truncate">
                                            {tempServiceFilters.collaboratorId
                                                ? collaborators.find(c => c.id === tempServiceFilters.collaboratorId)?.name
                                                : "Todos os colaboradores"}
                                        </span>
                                        <ChevronsUpDownIcon className="ml-2 h-4 w-4 text-slate-400 flex-shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                                    <Command>
                                        <CommandInput placeholder="Buscar colaborador..." value={collaboratorSearch} onInput={(e) => setCollaboratorSearch(e.currentTarget.value)} />
                                        <CommandList className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                            <CommandEmpty className="py-2 text-center text-xs text-slate-400">Nenhum colaborador encontrado.</CommandEmpty>
                                            <CommandItem className="cursor-pointer text-xs" onSelect={() => {
                                                setTempServiceFilters(f => ({ ...f, collaboratorId: null }));
                                                setCollaboratorPopoverOpen(false);
                                            }}>
                                                -- Todos os colaboradores --
                                            </CommandItem>
                                            {collaborators.filter(c => c.name.toLowerCase().includes(collaboratorSearch.toLowerCase())).map(c => (
                                                <CommandItem key={c.id} className="cursor-pointer text-xs" onSelect={() => {
                                                    setTempServiceFilters(f => ({ ...f, collaboratorId: c.id }));
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

                        {/* Intervalo de Datas */}
                        <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-slate-200 dark:border-gray-800 space-y-3 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-gray-200 flex items-center gap-1.5">
                                <CalendarIcon className="h-3.5 w-3.5 text-indigo-600" />
                                Intervalo de Datas
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label htmlFor="service_start_date" className="text-[10px] text-slate-500 uppercase font-semibold">Início</Label>
                                    <Input
                                        id="service_start_date"
                                        type="date"
                                        className="h-9 text-xs"
                                        value={tempServiceFilters.startDate ? toDateStr(tempServiceFilters.startDate) : ''}
                                        onChange={e => setTempServiceFilters(f => ({ ...f, startDate: e.target.value ? new Date(e.target.value + 'T00:00:00') : null }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="service_end_date" className="text-[10px] text-slate-500 uppercase font-semibold">Fim</Label>
                                    <Input
                                        id="service_end_date"
                                        type="date"
                                        className="h-9 text-xs"
                                        value={tempServiceFilters.endDate ? toDateStr(tempServiceFilters.endDate) : ''}
                                        onChange={e => setTempServiceFilters(f => ({ ...f, endDate: e.target.value ? new Date(e.target.value + 'T00:00:00') : null }))}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <ResponsiveModalFooter>
                        <Button 
                            variant="ghost" 
                            onClick={() => {
                                const cleared = { searchTerm: '', collaboratorId: null, projectId: null, startDate: null, endDate: null };
                                setTempServiceFilters(cleared);
                                setServiceFilters(cleared);
                                setServiceFilterSheetOpen(false);
                            }} 
                            className="text-xs text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
                        >
                            Limpar Filtros
                        </Button>
                        <Button 
                            onClick={() => { setServiceFilters(tempServiceFilters); setServiceFilterSheetOpen(false); }} 
                            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                        >
                            Aplicar Filtros
                        </Button>
                    </ResponsiveModalFooter>
                </ResponsiveModalContent>
            </ResponsiveModal>

            {/* ============================================================== */}
            {/* DRAWER DE FILTROS: ADIANTAMENTOS                               */}
            {/* ============================================================== */}
            <ResponsiveModal open={isAdvanceFilterSheetOpen} onOpenChange={setAdvanceFilterSheetOpen} displayMode="drawer">
                <ResponsiveModalContent size="sm">
                    <ResponsiveModalHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-200 dark:border-emerald-800/80 text-emerald-600 dark:text-emerald-400">
                                <FilterIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <ResponsiveModalTitle>Filtrar Extrato</ResponsiveModalTitle>
                                <ResponsiveModalDescription>Filtre adiantamentos por obra, colaborador ou período de liberação</ResponsiveModalDescription>
                            </div>
                        </div>
                    </ResponsiveModalHeader>

                    <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-4 bg-slate-50/50 dark:bg-brand-dark-950/50">
                        {/* Atalhos Rápidos de Período */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                                    <CalendarIcon className="h-3.5 w-3.5 text-emerald-500" />
                                    Atalhos de Período
                                </Label>
                                {(tempAdvanceFilters.dateRange?.from || tempAdvanceFilters.dateRange?.to) && (
                                    <button
                                        type="button"
                                        onClick={() => setTempAdvanceFilters(f => ({ ...f, dateRange: undefined }))}
                                        className="text-[11px] text-rose-500 hover:underline flex items-center gap-0.5 font-medium"
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
                                        onClick={() => {
                                            const today = new Date();
                                            today.setHours(0, 0, 0, 0);
                                            if (shortcut.isCurrentMonth) {
                                                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                                                setTempAdvanceFilters(f => ({ ...f, dateRange: { from: startOfMonth, to: today } }));
                                            } else if (shortcut.daysAgo === 0) {
                                                setTempAdvanceFilters(f => ({ ...f, dateRange: { from: today, to: today } }));
                                            } else {
                                                const pastDate = new Date(Date.now() - shortcut.daysAgo * 86400000);
                                                pastDate.setHours(0, 0, 0, 0);
                                                setTempAdvanceFilters(f => ({ ...f, dateRange: { from: pastDate, to: today } }));
                                            }
                                        }}
                                        className="h-8 text-xs font-medium bg-white dark:bg-brand-dark-900 border-slate-200 dark:border-gray-800 hover:border-emerald-500 hover:text-emerald-500 justify-center"
                                    >
                                        {shortcut.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Filtro Obra / Projeto */}
                        <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-slate-200 dark:border-gray-800 space-y-2 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-gray-200 flex items-center gap-1.5">
                                <ConstructionIcon className="h-3.5 w-3.5 text-indigo-600" />
                                Obra / Projeto
                            </Label>
                            <Popover open={isAdvProjectPopoverOpen} onOpenChange={setAdvProjectPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between font-normal text-left h-9 px-3 text-xs bg-white dark:bg-brand-dark-950 border-slate-300 dark:border-gray-800 text-slate-900 dark:text-white">
                                        <span className="truncate">
                                            {tempAdvanceFilters.projectId
                                                ? projects.find(p => p.id === tempAdvanceFilters.projectId)?.name
                                                : "Todas as obras"}
                                        </span>
                                        <ChevronsUpDownIcon className="ml-2 h-4 w-4 text-slate-400 flex-shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                                    <Command>
                                        <CommandInput placeholder="Buscar obra..." value={projectSearch} onInput={(e) => setProjectSearch(e.currentTarget.value)} />
                                        <CommandList className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                            <CommandEmpty className="py-2 text-center text-xs text-slate-400">Nenhuma obra encontrada.</CommandEmpty>
                                            <CommandItem className="cursor-pointer text-xs" onSelect={() => {
                                                setTempAdvanceFilters(f => ({ ...f, projectId: null }));
                                                setAdvProjectPopoverOpen(false);
                                            }}>
                                                -- Todas as obras --
                                            </CommandItem>
                                            {projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase())).map(p => (
                                                <CommandItem key={p.id} className="cursor-pointer text-xs" onSelect={() => {
                                                    setTempAdvanceFilters(f => ({ ...f, projectId: p.id }));
                                                    setAdvProjectPopoverOpen(false);
                                                }}>
                                                    {p.name}
                                                </CommandItem>
                                            ))}
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Filtro Colaborador */}
                        <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-slate-200 dark:border-gray-800 space-y-2 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-gray-200 flex items-center gap-1.5">
                                <UserIcon className="h-3.5 w-3.5 text-indigo-600" />
                                Colaborador / Prestador
                            </Label>
                            <Popover open={isAdvCollaboratorPopoverOpen} onOpenChange={setAdvCollaboratorPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between font-normal text-left h-9 px-3 text-xs bg-white dark:bg-brand-dark-950 border-slate-300 dark:border-gray-800 text-slate-900 dark:text-white">
                                        <span className="truncate">
                                            {tempAdvanceFilters.collaboratorId
                                                ? collaborators.find(c => c.id === tempAdvanceFilters.collaboratorId)?.name
                                                : "Todos os colaboradores"}
                                        </span>
                                        <ChevronsUpDownIcon className="ml-2 h-4 w-4 text-slate-400 flex-shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                                    <Command>
                                        <CommandInput placeholder="Buscar colaborador..." value={collaboratorSearch} onInput={(e) => setCollaboratorSearch(e.currentTarget.value)} />
                                        <CommandList className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                            <CommandEmpty className="py-2 text-center text-xs text-slate-400">Nenhum colaborador encontrado.</CommandEmpty>
                                            <CommandItem className="cursor-pointer text-xs" onSelect={() => {
                                                setTempAdvanceFilters(f => ({ ...f, collaboratorId: null }));
                                                setAdvCollaboratorPopoverOpen(false);
                                            }}>
                                                -- Todos os colaboradores --
                                            </CommandItem>
                                            {collaborators.filter(c => c.name.toLowerCase().includes(collaboratorSearch.toLowerCase())).map(c => (
                                                <CommandItem key={c.id} className="cursor-pointer text-xs" onSelect={() => {
                                                    setTempAdvanceFilters(f => ({ ...f, collaboratorId: c.id }));
                                                    setAdvCollaboratorPopoverOpen(false);
                                                }}>
                                                    {c.name}
                                                </CommandItem>
                                            ))}
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* DatePicker com Range */}
                        <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-slate-200 dark:border-gray-800 space-y-3 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-gray-200 flex items-center gap-1.5">
                                <CalendarIcon className="h-3.5 w-3.5 text-emerald-500" />
                                Período de Pagamento
                            </Label>
                            <DatePickerWithRange
                                date={tempAdvanceFilters.dateRange}
                                onDateChange={(range) => setTempAdvanceFilters(f => ({ ...f, dateRange: range }))}
                            />
                        </div>
                    </div>

                    <ResponsiveModalFooter>
                        <Button 
                            variant="ghost" 
                            onClick={() => {
                                const cleared = { searchTerm: '', collaboratorId: null, projectId: null, dateRange: undefined, serviceId: null };
                                setTempAdvanceFilters(cleared);
                                setAdvanceFilters(cleared);
                                setAdvanceFilterSheetOpen(false);
                            }} 
                            className="text-xs text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
                        >
                            Limpar Filtros
                        </Button>
                        <Button 
                            onClick={() => { setAdvanceFilters(tempAdvanceFilters); setAdvanceFilterSheetOpen(false); }} 
                            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                        >
                            Aplicar Filtros
                        </Button>
                    </ResponsiveModalFooter>
                </ResponsiveModalContent>
            </ResponsiveModal>

            {/* ============================================================== */}
            {/* MODAIS COMPARTILHADOS                                          */}
            {/* ============================================================== */}
            <Suspense fallback={<div />}>
                {isDetailsModalOpen && selectedService && (
                    <DetalhesServicoModal
                        isOpen={isDetailsModalOpen}
                        onClose={() => {
                            setDetailsModalOpen(false);
                            setSelectedService(null);
                        }}
                        onEdit={(s) => {
                            setDetailsModalOpen(false);
                            setSelectedService(s);
                            setEditServiceModalOpen(true);
                        }}
                        onDelete={(s) => {
                            setDetailsModalOpen(false);
                            setServiceToDelete(s);
                            setDeleteServiceModalOpen(true);
                        }}
                        onAddAdvance={(s) => {
                            setDetailsModalOpen(false);
                            setSelectedService(s);
                            setAdvanceModalOpen(true);
                        }}
                        service={selectedService}
                    />
                )}

                {isCreateServiceModalOpen && (
                    <ServiceModal
                        isOpen={isCreateServiceModalOpen}
                        onClose={() => {
                            setCreateServiceModalOpen(false);
                            queryClient.invalidateQueries({ queryKey: ['servicos'] });
                            queryClient.invalidateQueries({ queryKey: ['servicesSummary'] });
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
                            queryClient.invalidateQueries({ queryKey: ['servicos'] });
                            queryClient.invalidateQueries({ queryKey: ['servicesSummary'] });
                            queryClient.invalidateQueries({ queryKey: ['adiantamentos'] });
                            queryClient.invalidateQueries({ queryKey: ['advancesSummary'] });
                            queryClient.invalidateQueries({ queryKey: ['servico_adiantamentos'] });
                        }}
                        service={selectedService}
                        collaborators={collaborators}
                        projects={projects}
                    />
                )}

                {isAdvanceModalOpen && (
                    <AdvanceModal
                        isOpen={isAdvanceModalOpen}
                        onClose={() => {
                            setAdvanceModalOpen(false);
                            queryClient.invalidateQueries({ queryKey: ['servicos'] });
                            queryClient.invalidateQueries({ queryKey: ['servicesSummary'] });
                            queryClient.invalidateQueries({ queryKey: ['adiantamentos'] });
                            queryClient.invalidateQueries({ queryKey: ['advancesSummary'] });
                            queryClient.invalidateQueries({ queryKey: ['servico_adiantamentos'] });
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
                            queryClient.invalidateQueries({ queryKey: ['adiantamentos'] });
                            queryClient.invalidateQueries({ queryKey: ['advancesSummary'] });
                            queryClient.invalidateQueries({ queryKey: ['servico_adiantamentos'] });
                            queryClient.invalidateQueries({ queryKey: ['servicos'] });
                            queryClient.invalidateQueries({ queryKey: ['servicesSummary'] });
                        }}
                        advance={selectedAdvance}
                    />
                )}
            </Suspense>

            {/* Confirmação de Exclusão de Contrato de Serviço */}
            <ConfirmationModal
                isOpen={isDeleteServiceModalOpen}
                onClose={() => { setDeleteServiceModalOpen(false); setServiceToDelete(null); }}
                onConfirm={() => { if (serviceToDelete) deleteServiceMutation.mutate(serviceToDelete); }}
                title="Excluir Contrato de Serviço"
                description={
                    <div className="space-y-2">
                        <p>Tem certeza de que deseja excluir o contrato de serviço <strong>"{serviceToDelete?.description}"</strong>?</p>
                        <p className="text-xs text-rose-500 font-semibold">
                            Atenção: Todos os adiantamentos, medições e comprovantes anexos a este serviço serão removidos permanentemente do armazenamento.
                        </p>
                    </div>
                }
                confirmText="Excluir Contrato"
                isLoading={deleteServiceMutation.isPending}
            />

            {/* Confirmação de Exclusão de Adiantamento */}
            <ConfirmationModal
                isOpen={isDeleteAdvanceModalOpen}
                onClose={() => { setDeleteAdvanceModalOpen(false); setAdvanceToDelete(null); }}
                onConfirm={() => { if (advanceToDelete) deleteAdvanceMutation.mutate(advanceToDelete); }}
                title="Excluir Adiantamento"
                description={
                    <div className="space-y-2">
                        <p>Deseja excluir a liberação no valor de <strong>{formatCurrency(advanceToDelete?.value)}</strong> do serviço <strong>"{advanceToDelete?.service_description}"</strong>?</p>
                        <p className="text-xs text-amber-500">
                            Caso o serviço vinculado esteja concluído e passe a ter saldo pendente, seu status retornará automaticamente para "Em Andamento".
                        </p>
                    </div>
                }
                confirmText="Excluir Adiantamento"
                isLoading={deleteAdvanceMutation.isPending}
            />
        </div>
    );
};

export default Servicos;
