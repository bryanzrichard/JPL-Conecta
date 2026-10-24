import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabaseClient';
import { ServiceWithDetails, AdvanceWithDetails, Collaborator, Project, SERVICE_STATUSES, ServiceStatus } from '../types';
import { formatCurrency, formatDateBR as formatDate, openStorageFile } from '../lib/utils';
import { formatApiError } from '../lib/handleError';
import { deleteServiceWithAttachments, deleteAdvanceWithAttachment } from '../components/servicos/serviceActions';

// UI Components
import { PageHeader } from '../components/ui/PageHeader';
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

// Icons
import {
    BriefcaseIcon, PlusIcon, DollarSignIcon, TrendingUpIcon, FilterIcon,
    UserIcon, ConstructionIcon, CalendarIcon, ChevronsUpDownIcon,
    MoreVerticalIcon, XIcon, EditIcon, Trash2Icon, PaperclipIcon,
    SearchIcon, CheckCircle2Icon, ExternalLinkIcon
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

const PAGE_SIZE = 10;

// Formata Date em yyyy-MM-dd no fuso local (evita deslocamento de dia causado por toISOString/UTC)
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

        // Limpar parâmetros da URL preservando outros possíveis
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
                        const total_advances = (data.adiantamentos || []).reduce((acc: number, curr: any) => acc + (Number(curr.value) || 0), 0);
                        const formattedService: ServiceWithDetails = {
                            ...data,
                            collaborator_name: data.collaborators?.name || null,
                            project_name: data.projects?.name || null,
                            total_advances,
                            remaining_value: Math.max(0, (Number(data.total_value) || 0) - total_advances),
                        };
                        setSelectedService(formattedService);
                        setDetailsModalOpen(true);
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
                        .maybeSingle();

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
    }, [location.search, location.state, profile?.company_id, navigate]);

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
            const total_advances = (s.adiantamentos || []).reduce((acc: number, curr: any) => acc + (Number(curr.value) || 0), 0);
            const remaining_value = Math.max(0, (Number(s.total_value) || 0) - total_advances);
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

    // Resumo de KPIs de Serviços (Cálculo adaptado ao filtro ativo)
    const { data: servicesSummary } = useQuery({
        queryKey: ['servicesSummary', profile?.company_id, serviceFilters, serviceStatusFilter],
        queryFn: async () => {
            if (!profile?.company_id) return { totalValue: 0, totalPaid: 0, remainingValue: 0, count: 0 };

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
            queryClient.invalidateQueries({ queryKey: ['services_dashboard'] });
        },
        onError: (err) => {
            toast({ variant: 'destructive', title: 'Erro!', description: formatApiError(err) });
        },
        onSettled: () => {
            setDeleteServiceModalOpen(false);
            setServiceToDelete(null);
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
            query = query.or(`description.ilike.%${filters.searchTerm}%,servicos.description.ilike.%${filters.searchTerm}%`);
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
                query = query.or(`description.ilike.%${advanceFilters.searchTerm}%,servicos.description.ilike.%${advanceFilters.searchTerm}%`);
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
            queryClient.invalidateQueries({ queryKey: ['services_dashboard'] });
        },
        onError: (err) => {
            toast({ variant: 'destructive', title: 'Erro!', description: formatApiError(err) });
        },
        onSettled: () => {
            setDeleteAdvanceModalOpen(false);
            setAdvanceToDelete(null);
        }
    });

    // Ação: "Ver Adiantamentos" de um serviço -> troca para Aba 2 filtrando pelo serviço
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
            setTempServiceFilters(f => ({ ...f, startDate: startOfMonth, endDate: today }));
            return;
        }

        if (shortcut.daysAgo === 0) {
            setTempServiceFilters(f => ({ ...f, startDate: today, endDate: today }));
            return;
        }

        const pastDate = new Date(Date.now() - shortcut.daysAgo * 86400000);
        pastDate.setHours(0, 0, 0, 0);
        setTempServiceFilters(f => ({ ...f, startDate: pastDate, endDate: today }));
    };

    // Atalhos de Período para Adiantamentos
    const applyQuickPeriodAdvances = (shortcut: typeof QUICK_PERIOD_SHORTCUTS[number]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (shortcut.isCurrentMonth) {
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            setTempAdvanceFilters(f => ({ ...f, dateRange: { from: startOfMonth, to: today } }));
            return;
        }

        if (shortcut.daysAgo === 0) {
            setTempAdvanceFilters(f => ({ ...f, dateRange: { from: today, to: today } }));
            return;
        }

        const pastDate = new Date(Date.now() - shortcut.daysAgo * 86400000);
        pastDate.setHours(0, 0, 0, 0);
        setTempAdvanceFilters(f => ({ ...f, dateRange: { from: pastDate, to: today } }));
    };

    return (
        <div className="space-y-6">
            {/* Header com Ações Principais */}
            <PageHeader
                icon={BriefcaseIcon}
                title="Serviços & Adiantamentos"
                description="Controle global de contratos de serviços, medições e extrato de adiantamentos financeiros."
                actions={
                    <div className="flex items-center gap-2">
                        <Button 
                            onClick={() => { setSelectedService(null); setCreateServiceModalOpen(true); }}
                            className="bg-brand-blue-600 hover:bg-brand-blue-500 text-white font-semibold text-xs sm:text-sm"
                        >
                            <PlusIcon className="h-4 w-4 mr-2" />
                            Novo Contrato
                        </Button>
                    </div>
                }
            />

            {/* Sistema de Abas no Topo */}
            <div className="border-b border-gray-200 dark:border-gray-800">
                <nav className="flex space-x-6 sm:space-x-8" aria-label="Abas">
                    <button
                        onClick={() => handleTabChange('servicos')}
                        className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
                            activeTab === 'servicos'
                                ? 'border-brand-blue-500 text-brand-blue-600 dark:text-brand-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                        }`}
                    >
                        <BriefcaseIcon className="h-4 w-4" />
                        <span>Contratos de Serviços</span>
                        <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-brand-dark-800 text-gray-600 dark:text-gray-400">
                            {servicesSummary?.count ?? '...'}
                        </span>
                    </button>

                    <button
                        onClick={() => handleTabChange('adiantamentos')}
                        className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
                            activeTab === 'adiantamentos'
                                ? 'border-brand-blue-500 text-brand-blue-600 dark:text-brand-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                        }`}
                    >
                        <DollarSignIcon className="h-4 w-4" />
                        <span>Extrato de Adiantamentos</span>
                        <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-brand-dark-800 text-gray-600 dark:text-gray-400">
                            {advancesSummary?.count ?? '...'}
                        </span>
                    </button>
                </nav>
            </div>

            {/* ============================================================== */}
            {/* CONTEÚDO DA ABA 1: CONTRATOS DE SERVIÇOS                       */}
            {/* ============================================================== */}
            {activeTab === 'servicos' && (
                <div className="space-y-6">
                    {/* Painel de KPIs de Serviços (Adaptado ao Filtro) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-brand-dark-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-4">
                            <div className="p-2.5 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20 text-brand-blue-600 dark:text-brand-blue-400 shrink-0">
                                <DollarSignIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Contratado ({serviceStatusFilter})</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white truncate">
                                    {formatCurrency(servicesSummary?.totalValue || 0)}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-brand-dark-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-4">
                            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                                <CheckCircle2Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Pago / Adiantado</p>
                                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 truncate">
                                    {formatCurrency(servicesSummary?.totalPaid || 0)}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-brand-dark-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-4">
                            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                                <TrendingUpIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Saldo Restante a Pagar</p>
                                <p className="text-xl font-bold text-amber-600 dark:text-amber-400 truncate">
                                    {formatCurrency(servicesSummary?.remainingValue || 0)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Barra de Filtros: Pílulas de Status + Busca + Gatilho Drawer */}
                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Pílulas Rápidas de Status */}
                            <div className="inline-flex rounded-lg bg-gray-100 dark:bg-brand-dark-900 p-1 border border-gray-200 dark:border-gray-800 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setServiceStatusFilter('Em Andamento')}
                                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                                        serviceStatusFilter === 'Em Andamento'
                                            ? 'bg-white dark:bg-brand-blue-600 text-brand-blue-600 dark:text-white shadow-sm font-bold'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    Em Andamento
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setServiceStatusFilter('Concluído')}
                                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                                        serviceStatusFilter === 'Concluído'
                                            ? 'bg-white dark:bg-brand-blue-600 text-brand-blue-600 dark:text-white shadow-sm font-bold'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    Concluídos
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setServiceStatusFilter('Todos')}
                                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                                        serviceStatusFilter === 'Todos'
                                            ? 'bg-white dark:bg-brand-blue-600 text-brand-blue-600 dark:text-white shadow-sm font-bold'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    Todos
                                </button>
                            </div>

                            {/* Campo de Busca Rápida */}
                            <div className="relative flex-1 sm:w-64">
                                <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Buscar serviço..."
                                    value={serviceFilters.searchTerm}
                                    onChange={(e) => setServiceFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                                    className="pl-9 h-9 text-xs bg-white dark:bg-brand-dark-900 border-gray-200 dark:border-gray-800"
                                />
                                {serviceFilters.searchTerm && (
                                    <button 
                                        onClick={() => setServiceFilters(prev => ({ ...prev, searchTerm: '' }))}
                                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                                    >
                                        <XIcon className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Botão Drawer de Filtros */}
                        <Button
                            variant="outline"
                            onClick={() => { setTempServiceFilters(serviceFilters); setServiceFilterSheetOpen(true); }}
                            className="relative h-9 px-3.5 text-xs font-semibold border-gray-300 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:text-brand-blue-600 dark:hover:text-brand-blue-400"
                        >
                            <FilterIcon className="h-4 w-4 mr-2 text-brand-blue-500" />
                            <span>Filtros Avançados</span>
                            {activeServiceFiltersCount > 0 && (
                                <span className="ml-2 flex items-center justify-center h-5 min-w-[20px] px-1 text-[10px] font-bold rounded-full bg-brand-blue-600 text-white">
                                    {activeServiceFiltersCount}
                                </span>
                            )}
                        </Button>
                    </div>

                    {/* Faixa de Filtros Ativos */}
                    {activeServiceFiltersCount > 0 && (
                        <div className="flex items-center justify-between gap-3 bg-brand-blue-50/50 dark:bg-brand-blue-950/30 border border-brand-blue-200 dark:border-brand-blue-900/50 px-4 py-2 rounded-xl text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-brand-blue-700 dark:text-brand-blue-300 flex items-center gap-1.5">
                                    <FilterIcon className="h-3.5 w-3.5" /> Filtros ({activeServiceFiltersCount}):
                                </span>
                                {serviceFilters.searchTerm && (
                                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                                        Termo: "{serviceFilters.searchTerm}"
                                    </span>
                                )}
                                {serviceFilters.collaboratorId && (
                                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                                        Colaborador: {collaborators.find(c => c.id === serviceFilters.collaboratorId)?.name}
                                    </span>
                                )}
                                {serviceFilters.projectId && (
                                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                                        Obra: {projects.find(p => p.id === serviceFilters.projectId)?.name}
                                    </span>
                                )}
                                {(serviceFilters.startDate || serviceFilters.endDate) && (
                                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                                        Período: {serviceFilters.startDate ? serviceFilters.startDate.toLocaleDateString('pt-BR') : 'Início'} até {serviceFilters.endDate ? serviceFilters.endDate.toLocaleDateString('pt-BR') : 'Hoje'}
                                    </span>
                                )}
                            </div>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setServiceFilters({ searchTerm: '', collaboratorId: null, projectId: null, startDate: null, endDate: null })}
                                className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:underline h-7 px-2"
                            >
                                Limpar filtros
                            </Button>
                        </div>
                    )}

                    {/* Conteúdo: Listagem de Serviços */}
                    {isLoadingServices ? (
                        <>
                            <div className="md:hidden grid grid-cols-1 gap-4">
                                {Array.from({ length: 4 }).map((_, i) => <ServicoCardSkeleton key={i} />)}
                            </div>
                            <TableSkeleton />
                        </>
                    ) : allServices.length === 0 ? (
                        <div className="text-center py-12 px-6 bg-white dark:bg-brand-dark-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                            <div className="mx-auto p-3 bg-gray-100 dark:bg-gray-800 rounded-full w-fit mb-3">
                                <BriefcaseIcon className="h-8 w-8 text-brand-blue-500" />
                            </div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">Nenhum serviço encontrado</h3>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {activeServiceFiltersCount > 0 
                                    ? "Tente relaxar os filtros aplicados." 
                                    : "Clique em 'Novo Contrato' acima para cadastrar um novo contrato de prestação de serviço."}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile: Cards */}
                            <div className="md:hidden grid grid-cols-1 gap-4">
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

                            {/* Desktop: Tabela de Serviços */}
                            <div className="hidden md:block overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900 shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                                        <thead className="text-xs text-gray-400 uppercase bg-gray-50/60 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                                            <tr>
                                                <th className="px-6 py-3.5 font-semibold">Status</th>
                                                <th className="px-6 py-3.5 font-semibold">Descrição do Escopo</th>
                                                <th className="px-6 py-3.5 font-semibold">Prestador / Obra</th>
                                                <th className="px-6 py-3.5 font-semibold">Cronograma</th>
                                                <th className="px-6 py-3.5 font-semibold text-right">Contratado</th>
                                                <th className="px-6 py-3.5 font-semibold text-right">Falta Pagar</th>
                                                <th className="px-6 py-3.5 font-semibold text-center w-16">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {allServices.map((service) => {
                                                const isCompleted = service.status === 'Concluído';
                                                return (
                                                    <tr 
                                                        key={service.id} 
                                                        className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer group"
                                                        onClick={() => { setSelectedService(service); setDetailsModalOpen(true); }}
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <Badge className={isCompleted 
                                                                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' 
                                                                : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'}
                                                            >
                                                                {service.status}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white max-w-xs truncate" title={service.description}>
                                                            {service.description}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-gray-900 dark:text-white">{service.collaborator_name || 'Sem colaborador'}</span>
                                                                <span className="text-xs text-gray-500 dark:text-gray-400">{service.project_name || 'Sem obra'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                                            <div>{formatDate(service.start_date)}</div>
                                                            <div>até {formatDate(service.end_date)}</div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900 dark:text-white">
                                                            {formatCurrency(service.total_value)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right font-bold">
                                                            <span className={service.remaining_value > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}>
                                                                {formatCurrency(service.remaining_value)}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        className="h-8 w-8 text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                                    >
                                                                        <MoreVerticalIcon className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onSelect={() => { setSelectedService(service); setDetailsModalOpen(true); }}>
                                                                        <EyeIcon className="h-4 w-4 mr-2 text-brand-blue-500" /> Visualizar Detalhes
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onSelect={() => { setSelectedService(service); setAdvanceModalOpen(true); }}>
                                                                        <PlusIcon className="h-4 w-4 mr-2 text-emerald-500" /> Novo Adiantamento
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onSelect={() => { setSelectedService(service); setEditServiceModalOpen(true); }}>
                                                                        <EditIcon className="h-4 w-4 mr-2 text-brand-blue-500" /> Editar Contrato
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onSelect={() => handleViewAdvancesForService(service)}>
                                                                        <DollarSignIcon className="h-4 w-4 mr-2 text-amber-500" /> Ver no Extrato
                                                                    </DropdownMenuItem>
                                                                    {service.receipt_path && (
                                                                        <DropdownMenuItem onSelect={() => handleViewAttachment(service.receipt_path!)}>
                                                                            <PaperclipIcon className="h-4 w-4 mr-2" /> Ver Anexo
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuItem 
                                                                        onSelect={() => { setServiceToDelete(service); setDeleteServiceModalOpen(true); }} 
                                                                        className="text-red-500 hover:!text-red-400"
                                                                    >
                                                                        <Trash2Icon className="h-4 w-4 mr-2" /> Excluir Contrato
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

                            {/* Sentinel de Carregamento Infinito */}
                            <div ref={servicesSentinelRef} className="py-2 text-center">
                                {isFetchingNextPageServices ? (
                                    <p className="text-xs text-gray-400 animate-pulse">Carregando mais serviços...</p>
                                ) : hasNextPageServices ? (
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => fetchNextPageServices()}
                                        className="text-xs text-brand-blue-600 dark:text-brand-blue-400"
                                    >
                                        Carregar mais serviços
                                    </Button>
                                ) : (
                                    <p className="text-xs text-gray-400">Todos os {allServices.length} contratos foram carregados.</p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ============================================================== */}
            {/* CONTEÚDO DA ABA 2: EXTRATO DE ADIANTAMENTOS                   */}
            {/* ============================================================== */}
            {activeTab === 'adiantamentos' && (
                <div className="space-y-6">
                    {/* Painel de KPIs de Adiantamentos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-brand-dark-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-4">
                            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                                <DollarSignIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Liberado em Adiantamentos</p>
                                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 truncate">
                                    {formatCurrency(advancesSummary?.totalPaid || 0)}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-brand-dark-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-4">
                            <div className="p-2.5 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20 text-brand-blue-600 dark:text-brand-blue-400 shrink-0">
                                <CheckCircle2Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Medições Registradas</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white truncate">
                                    {advancesSummary?.count || 0} liberações
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Barra de Filtros de Adiantamentos */}
                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                        <div className="relative flex-1 sm:max-w-md">
                            <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar medição ou serviço..."
                                value={advanceFilters.searchTerm}
                                onChange={(e) => setAdvanceFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                                className="pl-9 h-9 text-xs bg-white dark:bg-brand-dark-900 border-gray-200 dark:border-gray-800"
                            />
                            {advanceFilters.searchTerm && (
                                <button 
                                    onClick={() => setAdvanceFilters(prev => ({ ...prev, searchTerm: '' }))}
                                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        <Button
                            variant="outline"
                            onClick={() => { setTempAdvanceFilters(advanceFilters); setAdvanceFilterSheetOpen(true); }}
                            className="relative h-9 px-3.5 text-xs font-semibold border-gray-300 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:text-brand-blue-600 dark:hover:text-brand-blue-400"
                        >
                            <FilterIcon className="h-4 w-4 mr-2 text-brand-blue-500" />
                            <span>Filtros do Extrato</span>
                            {activeAdvanceFiltersCount > 0 && (
                                <span className="ml-2 flex items-center justify-center h-5 min-w-[20px] px-1 text-[10px] font-bold rounded-full bg-brand-blue-600 text-white">
                                    {activeAdvanceFiltersCount}
                                </span>
                            )}
                        </Button>
                    </div>

                    {/* Faixa de Filtros Ativos em Adiantamentos */}
                    {activeAdvanceFiltersCount > 0 && (
                        <div className="flex items-center justify-between gap-3 bg-brand-blue-50/50 dark:bg-brand-blue-950/30 border border-brand-blue-200 dark:border-brand-blue-900/50 px-4 py-2 rounded-xl text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-brand-blue-700 dark:text-brand-blue-300 flex items-center gap-1.5">
                                    <FilterIcon className="h-3.5 w-3.5" /> Filtros ({activeAdvanceFiltersCount}):
                                </span>
                                {advanceFilters.searchTerm && (
                                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                                        Termo: "{advanceFilters.searchTerm}"
                                    </span>
                                )}
                                {advanceFilters.collaboratorId && (
                                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                                        Colaborador: {collaborators.find(c => c.id === advanceFilters.collaboratorId)?.name}
                                    </span>
                                )}
                                {advanceFilters.projectId && (
                                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                                        Obra: {projects.find(p => p.id === advanceFilters.projectId)?.name}
                                    </span>
                                )}
                                {(advanceFilters.dateRange?.from || advanceFilters.dateRange?.to) && (
                                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                                        Período: {advanceFilters.dateRange.from ? advanceFilters.dateRange.from.toLocaleDateString('pt-BR') : 'Início'} até {advanceFilters.dateRange.to ? advanceFilters.dateRange.to.toLocaleDateString('pt-BR') : 'Hoje'}
                                    </span>
                                )}
                            </div>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setAdvanceFilters({ searchTerm: '', collaboratorId: null, projectId: null, dateRange: undefined })}
                                className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:underline h-7 px-2"
                            >
                                Limpar filtros
                            </Button>
                        </div>
                    )}

                    {/* Conteúdo: Listagem de Adiantamentos */}
                    {isLoadingAdvances ? (
                        <>
                            <div className="md:hidden grid grid-cols-1 gap-4">
                                {Array.from({ length: 4 }).map((_, i) => <AdiantamentoCardSkeleton key={i} />)}
                            </div>
                            <TableSkeleton />
                        </>
                    ) : allAdvances.length === 0 ? (
                        <div className="text-center py-12 px-6 bg-white dark:bg-brand-dark-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                            <div className="mx-auto p-3 bg-gray-100 dark:bg-gray-800 rounded-full w-fit mb-3">
                                <DollarSignIcon className="h-8 w-8 text-emerald-500" />
                            </div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">Nenhum adiantamento encontrado</h3>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {activeAdvanceFiltersCount > 0 
                                    ? "Tente ajustar os critérios de filtro." 
                                    : "Adiantamentos registrados nos contratos de serviços aparecerão detalhados aqui."}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile: Cards */}
                            <div className="md:hidden grid grid-cols-1 gap-4">
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
                            <div className="hidden md:block overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900 shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                                        <thead className="text-xs text-gray-400 uppercase bg-gray-50/60 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                                            <tr>
                                                <th className="px-6 py-3.5 font-semibold">Data da Liberação</th>
                                                <th className="px-6 py-3.5 font-semibold">Medição / Observação</th>
                                                <th className="px-6 py-3.5 font-semibold">Contrato Vinculado</th>
                                                <th className="px-6 py-3.5 font-semibold">Prestador / Obra</th>
                                                <th className="px-6 py-3.5 font-semibold text-right">Valor Liberado</th>
                                                <th className="px-6 py-3.5 font-semibold text-center">Comprovante</th>
                                                <th className="px-6 py-3.5 font-semibold text-center w-16">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {allAdvances.map((advance) => (
                                                <tr 
                                                    key={advance.id} 
                                                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer group"
                                                    onClick={() => { setSelectedAdvance(advance); setEditAdvanceModalOpen(true); }}
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                                                        {formatDate(advance.payment_date)}
                                                    </td>
                                                    <td className="px-6 py-4 max-w-xs truncate text-gray-700 dark:text-gray-300" title={advance.description || ''}>
                                                        {advance.description || <span className="text-gray-400 italic">Sem descrição</span>}
                                                    </td>
                                                    <td className="px-6 py-4 max-w-xs truncate font-medium text-gray-900 dark:text-white" title={advance.service_description}>
                                                        {advance.service_description}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-gray-900 dark:text-white">{advance.collaborator_name || 'Sem colaborador'}</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">{advance.project_name || 'Sem obra'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                        {formatCurrency(advance.value)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                                        {advance.receipt_path ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleViewAttachment(advance.receipt_path!)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-brand-blue-500/10 text-brand-blue-600 dark:text-brand-blue-400 hover:bg-brand-blue-500/20 transition-colors"
                                                            >
                                                                <PaperclipIcon className="h-3.5 w-3.5" />
                                                                <span>Anexo</span>
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                                >
                                                                    <MoreVerticalIcon className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                {advance.receipt_path && (
                                                                    <DropdownMenuItem onSelect={() => handleViewAttachment(advance.receipt_path!)}>
                                                                        <PaperclipIcon className="h-4 w-4 mr-2" /> Ver Comprovante
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuItem onSelect={() => { setSelectedAdvance(advance); setEditAdvanceModalOpen(true); }}>
                                                                    <EditIcon className="h-4 w-4 mr-2 text-brand-blue-500" /> Editar Adiantamento
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem 
                                                                    onSelect={() => { setAdvanceToDelete(advance); setDeleteAdvanceModalOpen(true); }} 
                                                                    className="text-red-500 hover:!text-red-400"
                                                                >
                                                                    <Trash2Icon className="h-4 w-4 mr-2" /> Excluir Adiantamento
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

                            {/* Sentinel de Carregamento Infinito */}
                            <div ref={advancesSentinelRef} className="py-2 text-center">
                                {isFetchingNextPageAdvances ? (
                                    <p className="text-xs text-gray-400 animate-pulse">Carregando mais adiantamentos...</p>
                                ) : hasNextPageAdvances ? (
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => fetchNextPageAdvances()}
                                        className="text-xs text-brand-blue-600 dark:text-brand-blue-400"
                                    >
                                        Carregar mais adiantamentos
                                    </Button>
                                ) : (
                                    <p className="text-xs text-gray-400">Todas as {allAdvances.length} medições foram carregadas.</p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ============================================================== */}
            {/* DRAWER DE FILTROS: SERVIÇOS                                    */}
            {/* ============================================================== */}
            <ResponsiveModal open={isServiceFilterSheetOpen} onOpenChange={setServiceFilterSheetOpen} displayMode="drawer">
                <ResponsiveModalContent size="sm">
                    <ResponsiveModalHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand-blue-500/10 rounded-lg border border-brand-blue-500/20 text-brand-blue-500">
                                <FilterIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <ResponsiveModalTitle>Filtrar Serviços</ResponsiveModalTitle>
                                <ResponsiveModalDescription>Filtre por obra, colaborador ou período de execução</ResponsiveModalDescription>
                            </div>
                        </div>
                    </ResponsiveModalHeader>

                    <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-4 bg-gray-50/50 dark:bg-brand-dark-950/50">
                        {/* Atalhos Rápidos de Período */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                    <CalendarIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                                    Atalhos de Período
                                </Label>
                                {(tempServiceFilters.startDate || tempServiceFilters.endDate) && (
                                    <button
                                        type="button"
                                        onClick={() => setTempServiceFilters(f => ({ ...f, startDate: null, endDate: null }))}
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
                                        onClick={() => applyQuickPeriodServices(shortcut)}
                                        className="h-8 text-xs font-medium bg-white dark:bg-brand-dark-900 border-gray-200 dark:border-gray-800 hover:border-brand-blue-500 hover:text-brand-blue-500 justify-center"
                                    >
                                        {shortcut.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Filtro Obra / Projeto */}
                        <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                <ConstructionIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                                Obra / Projeto
                            </Label>
                            <Popover open={isProjectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between font-normal text-left h-9 px-3 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white">
                                        <span className="truncate">
                                            {tempServiceFilters.projectId
                                                ? projects.find(p => p.id === tempServiceFilters.projectId)?.name
                                                : "Todas as obras"}
                                        </span>
                                        <ChevronsUpDownIcon className="ml-2 h-4 w-4 text-gray-400 flex-shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                                    <Command>
                                        <CommandInput placeholder="Buscar obra..." value={projectSearch} onInput={(e) => setProjectSearch(e.currentTarget.value)} />
                                        <CommandList className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                            <CommandEmpty className="py-2 text-center text-xs text-gray-400">Nenhuma obra encontrada.</CommandEmpty>
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
                        <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                <UserIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                                Colaborador / Prestador
                            </Label>
                            <Popover open={isCollaboratorPopoverOpen} onOpenChange={setCollaboratorPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between font-normal text-left h-9 px-3 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white">
                                        <span className="truncate">
                                            {tempServiceFilters.collaboratorId
                                                ? collaborators.find(c => c.id === tempServiceFilters.collaboratorId)?.name
                                                : "Todos os colaboradores"}
                                        </span>
                                        <ChevronsUpDownIcon className="ml-2 h-4 w-4 text-gray-400 flex-shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                                    <Command>
                                        <CommandInput placeholder="Buscar colaborador..." value={collaboratorSearch} onInput={(e) => setCollaboratorSearch(e.currentTarget.value)} />
                                        <CommandList className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                            <CommandEmpty className="py-2 text-center text-xs text-gray-400">Nenhum colaborador encontrado.</CommandEmpty>
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
                        <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                <CalendarIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                                Intervalo de Datas
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label htmlFor="service_start_date" className="text-[10px] text-gray-500 uppercase font-semibold">Início</Label>
                                    <Input
                                        id="service_start_date"
                                        type="date"
                                        className="h-9 text-xs"
                                        value={tempServiceFilters.startDate ? toDateStr(tempServiceFilters.startDate) : ''}
                                        onChange={e => setTempServiceFilters(f => ({ ...f, startDate: e.target.value ? new Date(e.target.value + 'T00:00:00') : null }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="service_end_date" className="text-[10px] text-gray-500 uppercase font-semibold">Fim</Label>
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
                            className="text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                        >
                            Limpar Filtros
                        </Button>
                        <Button 
                            onClick={() => { setServiceFilters(tempServiceFilters); setServiceFilterSheetOpen(false); }} 
                            className="text-xs bg-brand-blue-600 hover:bg-brand-blue-500 text-white font-bold"
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
                            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                <FilterIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <ResponsiveModalTitle>Filtrar Extrato</ResponsiveModalTitle>
                                <ResponsiveModalDescription>Filtre adiantamentos por obra, colaborador ou período de liberação</ResponsiveModalDescription>
                            </div>
                        </div>
                    </ResponsiveModalHeader>

                    <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-4 bg-gray-50/50 dark:bg-brand-dark-950/50">
                        {/* Atalhos Rápidos de Período */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                    <CalendarIcon className="h-3.5 w-3.5 text-emerald-500" />
                                    Atalhos de Período
                                </Label>
                                {(tempAdvanceFilters.dateRange?.from || tempAdvanceFilters.dateRange?.to) && (
                                    <button
                                        type="button"
                                        onClick={() => setTempAdvanceFilters(f => ({ ...f, dateRange: undefined }))}
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
                                        onClick={() => applyQuickPeriodAdvances(shortcut)}
                                        className="h-8 text-xs font-medium bg-white dark:bg-brand-dark-900 border-gray-200 dark:border-gray-800 hover:border-emerald-500 hover:text-emerald-500 justify-center"
                                    >
                                        {shortcut.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Filtro Obra / Projeto */}
                        <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                <ConstructionIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                                Obra / Projeto
                            </Label>
                            <Popover open={isAdvProjectPopoverOpen} onOpenChange={setAdvProjectPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between font-normal text-left h-9 px-3 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white">
                                        <span className="truncate">
                                            {tempAdvanceFilters.projectId
                                                ? projects.find(p => p.id === tempAdvanceFilters.projectId)?.name
                                                : "Todas as obras"}
                                        </span>
                                        <ChevronsUpDownIcon className="ml-2 h-4 w-4 text-gray-400 flex-shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                                    <Command>
                                        <CommandInput placeholder="Buscar obra..." value={projectSearch} onInput={(e) => setProjectSearch(e.currentTarget.value)} />
                                        <CommandList className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                            <CommandEmpty className="py-2 text-center text-xs text-gray-400">Nenhuma obra encontrada.</CommandEmpty>
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
                        <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                <UserIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                                Colaborador / Prestador
                            </Label>
                            <Popover open={isAdvCollaboratorPopoverOpen} onOpenChange={setAdvCollaboratorPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between font-normal text-left h-9 px-3 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white">
                                        <span className="truncate">
                                            {tempAdvanceFilters.collaboratorId
                                                ? collaborators.find(c => c.id === tempAdvanceFilters.collaboratorId)?.name
                                                : "Todos os colaboradores"}
                                        </span>
                                        <ChevronsUpDownIcon className="ml-2 h-4 w-4 text-gray-400 flex-shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                                    <Command>
                                        <CommandInput placeholder="Buscar colaborador..." value={collaboratorSearch} onInput={(e) => setCollaboratorSearch(e.currentTarget.value)} />
                                        <CommandList className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                            <CommandEmpty className="py-2 text-center text-xs text-gray-400">Nenhum colaborador encontrado.</CommandEmpty>
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
                        <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
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
                                const cleared = { searchTerm: '', collaboratorId: null, projectId: null, dateRange: undefined };
                                setTempAdvanceFilters(cleared);
                                setAdvanceFilters(cleared);
                                setAdvanceFilterSheetOpen(false);
                            }} 
                            className="text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
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

                {isAdvanceModalOpen && selectedService && (
                    <AdvanceModal
                        isOpen={isAdvanceModalOpen}
                        onClose={() => {
                            setAdvanceModalOpen(false);
                            setSelectedService(null);
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
                        <p className="text-xs text-red-500 font-semibold">
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