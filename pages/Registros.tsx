import React, { useState, useMemo, useEffect, lazy, Suspense, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useInfiniteQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useMediaQuery } from '../hooks/use-media-query';
import { Supplier, Project, Collaborator, ProjectStatus } from '../types';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { StarRating } from '../components/ui/StarRating';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { formatApiError } from '../lib/handleError';
import { logAuditAction } from '../lib/auditLogger';
import { formatCnpj, formatDateBR } from '../lib/utils';
import { useToast } from '../contexts/ToastContext';
import { 
  BuildingIcon, ConstructionIcon, UsersIcon, PlusIcon, SearchIcon, 
  DownloadIcon, EditIcon, Trash2Icon, MoreVerticalIcon, PhoneIcon,
  MapPinIcon, CopyIcon, CheckIcon, ExternalLinkIcon, XIcon,
  ChevronUpIcon, ChevronDownIcon
} from '../lib/icons';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from '../components/ui/DropdownMenu';

const SupplierModal = lazy(() => import('../components/registros/SupplierModal'));
const ProjectModal = lazy(() => import('../components/registros/ProjectModal'));
const CollaboratorModal = lazy(() => import('../components/registros/CollaboratorModal'));

type ActiveTab = 'suppliers' | 'projects' | 'collaborators';

const PAGE_SIZE = 20;

// Format helper for documents (CPF 11 digits or CNPJ 14 digits)
const formatDocument = (doc?: string | null): string => {
  if (!doc) return '-';
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  if (clean.length === 14) {
    return formatCnpj(clean);
  }
  return doc;
};

// Format helper for phone numbers
const formatPhoneNumber = (phone?: string | null): string => {
  if (!phone) return '-';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }
  if (clean.length === 10) {
    return clean.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }
  return phone;
};

// WhatsApp link generator (extracts digits and ensures 55 prefix)
const getWhatsAppUrl = (phone?: string | null, name?: string): string | null => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const fullPhone = digits.startsWith('55') ? digits : `55${digits}`;
  const text = name ? `Olá ${name}, tudo bem? Entro em contato através do JPL Conecta.` : 'Olá! Entro em contato através do JPL Conecta.';
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`;
};

// Helper to calculate effective project status based on schedule dates
export const getEffectiveProjectStatus = (project: {
  status?: ProjectStatus | string;
  start_date?: string | null;
  end_date?: string | null;
}): ProjectStatus => {
  if (project.status === 'Concluído') return 'Concluído';

  const todayStr = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD'
  if (project.end_date) {
    const cleanEnd = project.end_date.includes('T') ? project.end_date.split('T')[0] : project.end_date;
    if (cleanEnd <= todayStr) {
      return 'Concluído';
    }
  }

  if (project.start_date) {
    const cleanStart = project.start_date.includes('T') ? project.start_date.split('T')[0] : project.start_date;
    if (cleanStart <= todayStr) {
      return 'Em Andamento';
    }
  }

  return (project.status as ProjectStatus) || 'Planejamento';
};

const Registros: React.FC = () => {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Navigation and Tab State
  const [activeTab, setActiveTab] = useState<ActiveTab>('suppliers');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Status Filter for Obras
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Selected item for Split View Inspector
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | null>(null);

  // Sentinel and sequential navigation refs for infinite scroll
  const tableSentinelRef = useRef<HTMLDivElement | null>(null);
  const pendingAdvanceAfterFetchRef = useRef(false);

  // Modal states
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false);
  
  // Modal Edit Target
  const [modalEditSupplier, setModalEditSupplier] = useState<Supplier | null>(null);
  const [modalEditProject, setModalEditProject] = useState<Project | null>(null);
  const [modalEditCollaborator, setModalEditCollaborator] = useState<Collaborator | null>(null);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    entityName: string;
    tableName: string;
    queryKey: string;
  } | null>(null);

  // Clipboard copy state for visual feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast({ title: 'Copiado!', description: `${label} copiado para a área de transferência.` });
    setTimeout(() => {
      setCopiedKey(prev => prev === key ? null : prev);
    }, 2000);
  };

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset selection on tab change
  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('todos');
    setSelectedSupplier(null);
    setSelectedProject(null);
    setSelectedCollaborator(null);
  };

  // URL Deep Linking handler: ?editar={tipo}_{id}
  const handledEditRef = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const editParam = params.get('editar') || (location.state as any)?.editId;
    if (!editParam || !profile?.company_id) return;
    if (handledEditRef.current === editParam) return;

    handledEditRef.current = editParam;
    navigate(location.pathname, { replace: true, state: {} });

    const openDeepLink = async () => {
      if (editParam.startsWith('fornecedor_')) {
        const id = editParam.replace('fornecedor_', '');
        setActiveTab('suppliers');
        const { data } = await (supabase as any)
          .from('suppliers')
          .select('*')
          .eq('id', id)
          .eq('company_id', profile.company_id)
          .maybeSingle();
        if (data) {
          setSelectedSupplier(data);
          setModalEditSupplier(data);
          setIsSupplierModalOpen(true);
        }
      } else if (editParam.startsWith('obra_')) {
        const id = editParam.replace('obra_', '');
        setActiveTab('projects');
        const { data } = await (supabase as any)
          .from('projects')
          .select('*')
          .eq('id', id)
          .eq('company_id', profile.company_id)
          .maybeSingle();
        if (data) {
          setSelectedProject(data);
          setModalEditProject(data);
          setIsProjectModalOpen(true);
        }
      } else if (editParam.startsWith('colaborador_')) {
        const id = editParam.replace('colaborador_', '');
        setActiveTab('collaborators');
        const { data } = await (supabase as any)
          .from('collaborators')
          .select('*')
          .eq('id', id)
          .eq('company_id', profile.company_id)
          .maybeSingle();
        if (data) {
          setSelectedCollaborator(data);
          setModalEditCollaborator(data);
          setIsCollaboratorModalOpen(true);
        }
      }
    };

    openDeepLink();
  }, [location.search, location.state, location.pathname, profile?.company_id, navigate]);

  // Global counts for tab badges and top summary cards
  const { data: counts } = useQuery({
    queryKey: ['registros_counts', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return { suppliers: 0, projects: 0, collaborators: 0 };
      const [supRes, projRes, colRes] = await Promise.all([
        (supabase as any).from('suppliers').select('*', { count: 'exact', head: true }).eq('company_id', profile.company_id),
        (supabase as any).from('projects').select('*', { count: 'exact', head: true }).eq('company_id', profile.company_id),
        (supabase as any).from('collaborators').select('*', { count: 'exact', head: true }).eq('company_id', profile.company_id),
      ]);
      return {
        suppliers: supRes.count ?? 0,
        projects: projRes.count ?? 0,
        collaborators: colRes.count ?? 0,
      };
    },
    enabled: !!profile?.company_id,
  });

  // Query: Suppliers (Infinite Scroll)
  const {
    data: suppliersData,
    fetchNextPage: fetchNextSuppliers,
    hasNextPage: hasNextSuppliers,
    isFetchingNextPage: isFetchingNextSuppliers,
    isLoading: isLoadingSuppliers,
  } = useInfiniteQuery({
    queryKey: ['suppliers', profile?.company_id, debouncedSearch],
    queryFn: async ({ pageParam = 0 }) => {
      let query = (supabase as any)
        .from('suppliers')
        .select('*', { count: 'exact' })
        .eq('company_id', profile!.company_id);

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,cnpj.ilike.%${debouncedSearch}%,seller.ilike.%${debouncedSearch}%`);
      }

      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count, error } = await query.order('name', { ascending: true }).range(from, to);
      if (error) throw error;
      return {
        data: (data as Supplier[]) || [],
        count: count ?? 0,
        nextPage: data && data.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    enabled: !!profile?.company_id && activeTab === 'suppliers',
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  });

  // Query: Projects (Infinite Scroll)
  const {
    data: projectsData,
    fetchNextPage: fetchNextProjects,
    hasNextPage: hasNextProjects,
    isFetchingNextPage: isFetchingNextProjects,
    isLoading: isLoadingProjects,
  } = useInfiniteQuery({
    queryKey: ['projects', profile?.company_id, debouncedSearch, statusFilter],
    queryFn: async ({ pageParam = 0 }) => {
      const todayStr = new Date().toLocaleDateString('en-CA');
      let query = (supabase as any)
        .from('projects')
        .select('*', { count: 'exact' })
        .eq('company_id', profile!.company_id);

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,manager.ilike.%${debouncedSearch}%,address_city.ilike.%${debouncedSearch}%`);
      }

      if (statusFilter === 'Concluído') {
        query = query.or(`status.eq.Concluído,end_date.lte.${todayStr}`);
      } else if (statusFilter === 'Em Andamento') {
        query = query.eq('status', 'Em Andamento').or(`end_date.is.null,end_date.gt.${todayStr}`);
      } else if (statusFilter === 'Planejamento') {
        query = query.eq('status', 'Planejamento');
      }

      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
      if (error) throw error;

      const mapped = ((data as Project[]) || []).map(p => ({
        ...p,
        status: getEffectiveProjectStatus(p)
      }));

      // Background auto-sync out-of-sync projects to Supabase (somente na 1ª página)
      if (pageParam === 0) {
        const outOfSync = ((data as Project[]) || []).filter(p => {
          const cleanEnd = p.end_date ? (p.end_date.includes('T') ? p.end_date.split('T')[0] : p.end_date) : '';
          return p.status !== 'Concluído' && cleanEnd && cleanEnd <= todayStr;
        });

        if (outOfSync.length > 0 && profile?.company_id) {
          const ids = outOfSync.map(p => p.id);
          (supabase as any)
            .from('projects')
            .update({ status: 'Concluído' })
            .in('id', ids)
            .eq('company_id', profile.company_id)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ['registros_counts'] });
            })
            .catch((err: any) => console.error('Erro ao sincronizar status da obra:', err));
        }
      }

      return {
        data: mapped,
        count: count ?? 0,
        nextPage: data && data.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    enabled: !!profile?.company_id && activeTab === 'projects',
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  });

  // Query: Collaborators (Infinite Scroll)
  const {
    data: collaboratorsData,
    fetchNextPage: fetchNextCollaborators,
    hasNextPage: hasNextCollaborators,
    isFetchingNextPage: isFetchingNextCollaborators,
    isLoading: isLoadingCollaborators,
  } = useInfiniteQuery({
    queryKey: ['collaborators', profile?.company_id, debouncedSearch],
    queryFn: async ({ pageParam = 0 }) => {
      let query = (supabase as any)
        .from('collaborators')
        .select('*', { count: 'exact' })
        .eq('company_id', profile!.company_id);

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,role.ilike.%${debouncedSearch}%,document.ilike.%${debouncedSearch}%`);
      }

      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count, error } = await query.order('name', { ascending: true }).range(from, to);
      if (error) throw error;
      return {
        data: (data as Collaborator[]) || [],
        count: count ?? 0,
        nextPage: data && data.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    enabled: !!profile?.company_id && activeTab === 'collaborators',
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  });

  // Flattened lists for infinite scroll
  const allSuppliers = useMemo(() => suppliersData?.pages.flatMap(p => p.data) ?? [], [suppliersData]);
  const allProjects = useMemo(() => projectsData?.pages.flatMap(p => p.data) ?? [], [projectsData]);
  const allCollaborators = useMemo(() => collaboratorsData?.pages.flatMap(p => p.data) ?? [], [collaboratorsData]);

  // Keep selection synchronized with updated data
  useEffect(() => {
    if (activeTab === 'suppliers' && allSuppliers.length) {
      if (selectedSupplier) {
        const refreshed = allSuppliers.find(s => s.id === selectedSupplier.id);
        if (refreshed) setSelectedSupplier(refreshed);
      }
    } else if (activeTab === 'projects' && allProjects.length) {
      if (selectedProject) {
        const refreshed = allProjects.find(p => p.id === selectedProject.id);
        if (refreshed) setSelectedProject(refreshed);
      }
    } else if (activeTab === 'collaborators' && allCollaborators.length) {
      if (selectedCollaborator) {
        const refreshed = allCollaborators.find(c => c.id === selectedCollaborator.id);
        if (refreshed) setSelectedCollaborator(refreshed);
      }
    }
  }, [allSuppliers, allProjects, allCollaborators, activeTab]);

  // Generic Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (target: NonNullable<typeof deleteTarget>) => {
      const { error } = await (supabase as any)
        .from(target.tableName)
        .delete()
        .eq('id', target.id)
        .eq('company_id', profile!.company_id);
      if (error) throw error;

      logAuditAction(
        profile?.company_id,
        user?.email,
        'EXCLUIR',
        `${target.entityName}: ${target.name}`,
        { id: target.id, entity: target.entityName }
      );
    },
    onSuccess: (_, target) => {
      toast({ title: 'Sucesso!', description: `${target.entityName} excluído(a) com sucesso.` });
      queryClient.invalidateQueries({ queryKey: [target.queryKey] });
      queryClient.invalidateQueries({ queryKey: ['registros_counts'] });

      // Clear selection if deleted
      if (activeTab === 'suppliers' && selectedSupplier?.id === target.id) setSelectedSupplier(null);
      if (activeTab === 'projects' && selectedProject?.id === target.id) setSelectedProject(null);
      if (activeTab === 'collaborators' && selectedCollaborator?.id === target.id) setSelectedCollaborator(null);
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Erro!', description: formatApiError(err) });
    },
    onSettled: () => {
      setDeleteTarget(null);
    }
  });

  // Current active list
  const activeList = useMemo(() => {
    if (activeTab === 'suppliers') return allSuppliers;
    if (activeTab === 'projects') return allProjects;
    return allCollaborators;
  }, [activeTab, allSuppliers, allProjects, allCollaborators]);

  // Active tab pagination controller
  const activePagination = useMemo(() => {
    if (activeTab === 'suppliers') {
      return {
        fetchNextPage: fetchNextSuppliers,
        hasNextPage: !!hasNextSuppliers,
        isFetchingNextPage: !!isFetchingNextSuppliers,
        totalCount: suppliersData?.pages[0]?.count ?? 0,
        isLoading: isLoadingSuppliers,
      };
    }
    if (activeTab === 'projects') {
      return {
        fetchNextPage: fetchNextProjects,
        hasNextPage: !!hasNextProjects,
        isFetchingNextPage: !!isFetchingNextProjects,
        totalCount: projectsData?.pages[0]?.count ?? 0,
        isLoading: isLoadingProjects,
      };
    }
    return {
      fetchNextPage: fetchNextCollaborators,
      hasNextPage: !!hasNextCollaborators,
      isFetchingNextPage: !!isFetchingNextCollaborators,
      totalCount: collaboratorsData?.pages[0]?.count ?? 0,
      isLoading: isLoadingCollaborators,
    };
  }, [
    activeTab,
    fetchNextSuppliers, hasNextSuppliers, isFetchingNextSuppliers, suppliersData, isLoadingSuppliers,
    fetchNextProjects, hasNextProjects, isFetchingNextProjects, projectsData, isLoadingProjects,
    fetchNextCollaborators, hasNextCollaborators, isFetchingNextCollaborators, collaboratorsData, isLoadingCollaborators,
  ]);

  const selectedIndex = useMemo(() => {
    if (activeTab === 'suppliers') {
      if (!selectedSupplier) return -1;
      return allSuppliers.findIndex(s => s.id === selectedSupplier.id);
    }
    if (activeTab === 'projects') {
      if (!selectedProject) return -1;
      return allProjects.findIndex(p => p.id === selectedProject.id);
    }
    if (activeTab === 'collaborators') {
      if (!selectedCollaborator) return -1;
      return allCollaborators.findIndex(c => c.id === selectedCollaborator.id);
    }
    return -1;
  }, [activeTab, selectedSupplier, selectedProject, selectedCollaborator, allSuppliers, allProjects, allCollaborators]);

  const hasSelectedItem = !!(selectedSupplier || selectedProject || selectedCollaborator);
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < activeList.length - 1;

  const handlePrev = useCallback(() => {
    if (!hasPrev) return;
    const prevItem = activeList[selectedIndex - 1];
    if (!prevItem) return;
    if (activeTab === 'suppliers') setSelectedSupplier(prevItem as Supplier);
    else if (activeTab === 'projects') setSelectedProject(prevItem as Project);
    else setSelectedCollaborator(prevItem as Collaborator);
  }, [hasPrev, activeList, selectedIndex, activeTab]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      const nextItem = activeList[selectedIndex + 1];
      if (nextItem) {
        if (activeTab === 'suppliers') setSelectedSupplier(nextItem as Supplier);
        else if (activeTab === 'projects') setSelectedProject(nextItem as Project);
        else setSelectedCollaborator(nextItem as Collaborator);
      }
      // Se estiver nos últimos 3 itens e houver próxima página, pré-carrega em background!
      if (selectedIndex >= activeList.length - 3 && activePagination.hasNextPage && !activePagination.isFetchingNextPage) {
        activePagination.fetchNextPage();
      }
    } else if (activePagination.hasNextPage && !activePagination.isFetchingNextPage) {
      pendingAdvanceAfterFetchRef.current = true;
      activePagination.fetchNextPage();
    }
  }, [hasNext, activeList, selectedIndex, activeTab, activePagination]);

  // Avançar automaticamente para o item recém-carregado quando pendingAdvanceAfterFetchRef for true
  useEffect(() => {
    if (pendingAdvanceAfterFetchRef.current && activeList.length > 0) {
      pendingAdvanceAfterFetchRef.current = false;
      if (selectedIndex >= 0 && selectedIndex < activeList.length - 1) {
        const nextItem = activeList[selectedIndex + 1];
        if (nextItem) {
          if (activeTab === 'suppliers') setSelectedSupplier(nextItem as Supplier);
          else if (activeTab === 'projects') setSelectedProject(nextItem as Project);
          else setSelectedCollaborator(nextItem as Collaborator);
        }
      }
    }
  }, [activeList, selectedIndex, activeTab]);

  // Observer para scroll infinito automático via IntersectionObserver
  useEffect(() => {
    const sentinel = tableSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && activePagination.hasNextPage && !activePagination.isFetchingNextPage) {
        activePagination.fetchNextPage();
      }
    }, { threshold: 0.1 });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activePagination.hasNextPage, activePagination.isFetchingNextPage, activePagination.fetchNextPage]);

  // Scroll listener no container interno
  const handleTableScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceToBottom < 200 && activePagination.hasNextPage && !activePagination.isFetchingNextPage) {
      activePagination.fetchNextPage();
    }
  }, [activePagination]);

  // Scroll listener na janela (quando a página toda rola sem split view desktop)
  useEffect(() => {
    if (hasSelectedItem && isDesktop) return;

    const handleWindowScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 300) {
        if (activePagination.hasNextPage && !activePagination.isFetchingNextPage) {
          activePagination.fetchNextPage();
        }
      }
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, [hasSelectedItem, isDesktop, activePagination]);

  const handleCloseDetail = useCallback(() => {
    setSelectedSupplier(null);
    setSelectedProject(null);
    setSelectedCollaborator(null);
  }, []);

  // Keyboard navigation: ArrowUp, ArrowDown, Esc
  useEffect(() => {
    if (!hasSelectedItem || !isDesktop) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(activeTag)) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseDetail();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasSelectedItem, isDesktop, handlePrev, handleNext, handleCloseDetail]);

  // Acompanhar a linha selecionada ao navegar pelas setas
  useEffect(() => {
    const currentId = selectedSupplier?.id || selectedProject?.id || selectedCollaborator?.id;
    if (!currentId) return;

    const prefix = activeTab === 'suppliers' ? 'supplier-row-' : activeTab === 'projects' ? 'project-row-' : 'collaborator-row-';
    const el = document.getElementById(`${prefix}${currentId}`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [selectedSupplier?.id, selectedProject?.id, selectedCollaborator?.id, activeTab]);

  // Quick edit & delete handlers for the detail panel topbar
  const handleEditCurrent = () => {
    if (activeTab === 'suppliers' && selectedSupplier) {
      setModalEditSupplier(selectedSupplier);
      setIsSupplierModalOpen(true);
    } else if (activeTab === 'projects' && selectedProject) {
      setModalEditProject(selectedProject);
      setIsProjectModalOpen(true);
    } else if (activeTab === 'collaborators' && selectedCollaborator) {
      setModalEditCollaborator(selectedCollaborator);
      setIsCollaboratorModalOpen(true);
    }
  };

  const handleDeleteCurrent = () => {
    if (activeTab === 'suppliers' && selectedSupplier) {
      setDeleteTarget({
        id: selectedSupplier.id,
        name: selectedSupplier.name,
        entityName: 'Fornecedor',
        tableName: 'suppliers',
        queryKey: 'suppliers',
      });
    } else if (activeTab === 'projects' && selectedProject) {
      setDeleteTarget({
        id: selectedProject.id,
        name: selectedProject.name,
        entityName: 'Obra',
        tableName: 'projects',
        queryKey: 'projects',
      });
    } else if (activeTab === 'collaborators' && selectedCollaborator) {
      setDeleteTarget({
        id: selectedCollaborator.id,
        name: selectedCollaborator.name,
        entityName: 'Colaborador',
        tableName: 'collaborators',
        queryKey: 'collaborators',
      });
    }
  };

  // Export to CSV with UTF-8 BOM
  const handleExportCsv = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      let csvContent = '\uFEFF'; // UTF-8 Byte Order Mark
      const timestamp = new Date().toISOString().split('T')[0];

      if (activeTab === 'suppliers') {
        const { data: allSuppliers } = await (supabase as any)
          .from('suppliers')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('name', { ascending: true });

        const headers = ['Nome / Razão Social', 'CNPJ', 'Vendedor', 'Contato', 'Avaliação Serviço', 'Avaliação Entrega'];
        csvContent += headers.map(h => `"${h}"`).join(';') + '\r\n';

        (allSuppliers || []).forEach((s: Supplier) => {
          const row = [
            s.name || '',
            formatCnpj(s.cnpj),
            s.seller || '',
            s.seller_contact || '',
            s.service_rating || 0,
            s.delivery_rating || 0,
          ];
          csvContent += row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';') + '\r\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `fornecedores_jpl_${timestamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({ title: 'Exportado com sucesso!', description: 'Arquivo CSV de fornecedores baixado.' });

      } else if (activeTab === 'projects') {
        const { data: allProjects } = await (supabase as any)
          .from('projects')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false });

        const headers = ['Nome da Obra', 'Status', 'Mestre de Obra', 'Data Início', 'Data Fim', 'Cidade', 'Estado', 'Endereço', 'CEP'];
        csvContent += headers.map(h => `"${h}"`).join(';') + '\r\n';

        (allProjects || []).forEach((p: Project) => {
          const row = [
            p.name || '',
            p.status || '',
            p.manager || '',
            p.start_date ? formatDateBR(p.start_date) : '',
            p.end_date ? formatDateBR(p.end_date) : '',
            p.address_city || '',
            p.address_state || '',
            `${p.address_street || ''} ${p.address_number || ''}`.trim(),
            p.address_zip || '',
          ];
          csvContent += row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';') + '\r\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `obras_jpl_${timestamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({ title: 'Exportado com sucesso!', description: 'Arquivo CSV de obras baixado.' });

      } else {
        const { data: allCollaborators } = await (supabase as any)
          .from('collaborators')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('name', { ascending: true });

        const headers = ['Nome do Colaborador', 'Função', 'Telefone', 'Documento / CPF', 'Avaliação', 'Observações'];
        csvContent += headers.map(h => `"${h}"`).join(';') + '\r\n';

        (allCollaborators || []).forEach((c: Collaborator) => {
          const row = [
            c.name || '',
            c.role || '',
            formatPhoneNumber(c.phone),
            formatDocument(c.document),
            c.rating || 0,
            c.observations || '',
          ];
          csvContent += row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';') + '\r\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `colaboradores_jpl_${timestamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({ title: 'Exportado com sucesso!', description: 'Arquivo CSV de colaboradores baixado.' });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao exportar', description: 'Não foi possível gerar o arquivo CSV.' });
    }
  }, [activeTab, profile?.company_id, toast]);

  // Current entity configuration based on active tab
  const tabConfig = useMemo(() => {
    switch (activeTab) {
      case 'suppliers':
        return {
          title: 'Fornecedores',
          singular: 'Fornecedor',
          searchPlaceholder: 'Buscar fornecedor por nome, CNPJ ou vendedor...',
          totalCount: activePagination.totalCount,
          isLoading: activePagination.isLoading,
          onAddNew: () => {
            setModalEditSupplier(null);
            setIsSupplierModalOpen(true);
          }
        };
      case 'projects':
        return {
          title: 'Obras',
          singular: 'Obra',
          searchPlaceholder: 'Buscar obra por nome, mestre ou cidade...',
          totalCount: activePagination.totalCount,
          isLoading: activePagination.isLoading,
          onAddNew: () => {
            setModalEditProject(null);
            setIsProjectModalOpen(true);
          }
        };
      case 'collaborators':
        return {
          title: 'Colaboradores',
          singular: 'Colaborador',
          searchPlaceholder: 'Buscar colaborador por nome, função ou CPF...',
          totalCount: activePagination.totalCount,
          isLoading: activePagination.isLoading,
          onAddNew: () => {
            setModalEditCollaborator(null);
            setIsCollaboratorModalOpen(true);
          }
        };
    }
  }, [activeTab, activePagination]);

  // Helpers for Project status badges
  const getProjectStatusBadge = (status: ProjectStatus | string) => {
    switch (status) {
      case 'Concluído':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#ECFDF5] text-[#047857] dark:bg-emerald-500/[0.12] dark:text-[#34D399] border border-emerald-200/80 dark:border-emerald-500/20 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Concluído
          </span>
        );
      case 'Em Andamento':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#EEF2FF] text-[#4338CA] dark:bg-indigo-500/[0.12] dark:text-[#818CF8] border border-indigo-200/80 dark:border-indigo-500/20 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Em Andamento
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#FFFBEB] text-[#B45309] dark:bg-amber-500/[0.12] dark:text-amber-400 border border-amber-200/80 dark:border-amber-500/20 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Planejamento
          </span>
        );
    }
  };

  // Render detail panel body
  const renderDetailContent = () => {
    if (activeTab === 'suppliers' && selectedSupplier) {
      const whatsAppUrl = getWhatsAppUrl(selectedSupplier.seller_contact, selectedSupplier.seller || selectedSupplier.name);
      return (
        <div className="space-y-4">
          {/* Card de Identificação */}
          <div className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50 dark:bg-brand-dark-800/60 border border-slate-200 dark:border-gray-800">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              {selectedSupplier.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight break-words">
                {selectedSupplier.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                Fornecedor Homologado JPL
              </p>
            </div>
          </div>

          {/* Grid de Ações Rápidas */}
          <div className="grid grid-cols-2 gap-2">
            {selectedSupplier.seller_contact && whatsAppUrl ? (
              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold transition-colors"
              >
                <PhoneIcon className="h-3.5 w-3.5" />
                <span>WhatsApp</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-brand-dark-800 text-slate-400 border border-slate-200 dark:border-gray-700 text-xs font-medium cursor-not-allowed"
              >
                <PhoneIcon className="h-3.5 w-3.5" />
                <span>Sem Telefone</span>
              </button>
            )}

            {selectedSupplier.cnpj ? (
              <button
                type="button"
                onClick={() => handleCopy(selectedSupplier.cnpj!, 'cnpj', 'CNPJ')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-brand-dark-800 dark:hover:bg-brand-dark-700 text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-gray-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                {copiedKey === 'cnpj' ? <CheckIcon className="h-3.5 w-3.5 text-emerald-500" /> : <CopyIcon className="h-3.5 w-3.5 text-slate-400" />}
                <span>{copiedKey === 'cnpj' ? 'Copiado!' : 'Copiar CNPJ'}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-brand-dark-800 text-slate-400 border border-slate-200 dark:border-gray-700 text-xs font-medium cursor-not-allowed"
              >
                <CopyIcon className="h-3.5 w-3.5" />
                <span>Sem CNPJ</span>
              </button>
            )}
          </div>

          {/* Seção: Dados Fiscais & Cadastrais */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-brand-dark-800/60 border border-slate-200 dark:border-gray-800 space-y-3">
            <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">
              Dados Fiscais & Cadastrais
            </span>
            
            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-slate-400 dark:text-gray-500">CNPJ</p>
                <p className="font-mono text-xs font-semibold text-slate-800 dark:text-gray-200 tabular-nums">
                  {formatCnpj(selectedSupplier.cnpj) || 'Não informado'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-gray-700/60">
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-gray-500">Vendedor</p>
                  <p className="text-xs font-medium text-slate-800 dark:text-gray-200 truncate">
                    {selectedSupplier.seller || 'Não informado'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-gray-500">Contato Direto</p>
                  <p className="font-mono text-xs font-medium text-slate-800 dark:text-gray-200 truncate">
                    {selectedSupplier.seller_contact || 'Não informado'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Seção: Performance & Avaliação */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-brand-dark-800/60 border border-slate-200 dark:border-gray-800 space-y-3">
            <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">
              Avaliação de Performance
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-brand-dark-900 border border-slate-200/80 dark:border-gray-800 space-y-1">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Qualidade do Serviço</p>
                <StarRating rating={selectedSupplier.service_rating} />
                <p className="text-[10px] font-mono text-slate-400">{selectedSupplier.service_rating || 0} / 5 estrelas</p>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-brand-dark-900 border border-slate-200/80 dark:border-gray-800 space-y-1">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Pontualidade Entrega</p>
                <StarRating rating={selectedSupplier.delivery_rating} />
                <p className="text-[10px] font-mono text-slate-400">{selectedSupplier.delivery_rating || 0} / 5 estrelas</p>
              </div>
            </div>
          </div>

          {/* Ação cruzada: Ver Notas Fiscais */}
          <div className="pt-1">
            <Button
              variant="outline"
              onClick={() => navigate(`/notas?busca=${encodeURIComponent(selectedSupplier.name)}`)}
              className="w-full h-9 text-xs font-semibold border-slate-200 dark:border-gray-700 gap-1.5 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-brand-dark-800 cursor-pointer"
            >
              <span>Ver Notas Fiscais vinculadas a este fornecedor</span>
              <ExternalLinkIcon className="h-3.5 w-3.5 text-slate-400" />
            </Button>
          </div>

          {/* Histórico & Auditoria */}
          <div className="text-[11px] text-slate-400 dark:text-gray-500 space-y-1 pt-1 border-t border-slate-200/60 dark:border-gray-800">
            <p>Cadastrado em: <span className="font-mono">{formatDateBR(selectedSupplier.created_at)}</span></p>
            <p>ID do Registro: <span className="font-mono text-[10px]">{selectedSupplier.id}</span></p>
          </div>
        </div>
      );
    }

    if (activeTab === 'projects' && selectedProject) {
      return (
        <div className="space-y-4">
          {/* Card de Identificação */}
          <div className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50 dark:bg-brand-dark-800/60 border border-slate-200 dark:border-gray-800">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
              {selectedProject.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight break-words">
                {selectedProject.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                <MapPinIcon className="h-3 w-3 text-slate-400" />
                <span>{selectedProject.address_city ? `${selectedProject.address_city} - ${selectedProject.address_state || ''}` : 'Local não informado'}</span>
              </p>
            </div>
          </div>

          {/* Grid de Ações Rápidas */}
          <div className="grid grid-cols-2 gap-2">
            {selectedProject.address_street || selectedProject.address_city ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${selectedProject.address_street || ''} ${selectedProject.address_number || ''}, ${selectedProject.address_city || ''} ${selectedProject.address_state || ''}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-brand-dark-800 dark:hover:bg-brand-dark-700 text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-gray-700 text-xs font-semibold transition-colors"
              >
                <MapPinIcon className="h-3.5 w-3.5 text-indigo-500" />
                <span>Ver no Maps</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-brand-dark-800 text-slate-400 border border-slate-200 dark:border-gray-700 text-xs font-medium cursor-not-allowed"
              >
                <MapPinIcon className="h-3.5 w-3.5" />
                <span>Sem Endereço</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate(`/tarefas?obra=${selectedProject.id}`)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>Ver Tarefas</span>
              <ExternalLinkIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Seção: Gestão Operacional & Cronograma */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-brand-dark-800/60 border border-slate-200 dark:border-gray-800 space-y-3">
            <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">
              Gestão & Cronograma
            </span>

            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-slate-400 dark:text-gray-500">Mestre de Obra / Responsável</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-gray-200">
                  {selectedProject.manager || 'Não definido'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-gray-700/60">
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-gray-500">Data de Início</p>
                  <p className="font-mono text-xs font-medium text-slate-800 dark:text-gray-200 tabular-nums">
                    {selectedProject.start_date ? formatDateBR(selectedProject.start_date) : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-gray-500">Previsão de Término</p>
                  <p className="font-mono text-xs font-medium text-slate-800 dark:text-gray-200 tabular-nums">
                    {selectedProject.end_date ? formatDateBR(selectedProject.end_date) : 'Em aberto'}
                  </p>
                </div>
              </div>

              {selectedProject.end_date && (selectedProject.end_date.includes('T') ? selectedProject.end_date.split('T')[0] : selectedProject.end_date) <= new Date().toLocaleDateString('en-CA') && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-gray-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-gray-400 font-medium">Status do Cronograma:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                    ✓ Prazo finalizado (Concluída)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Seção: Endereço do Canteiro */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-brand-dark-800/60 border border-slate-200 dark:border-gray-800 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">
              Endereço do Canteiro
            </span>

            <div className="text-xs text-slate-700 dark:text-gray-300 space-y-0.5">
              <p className="font-medium">
                {selectedProject.address_street || 'Rua não informada'}
                {selectedProject.address_number ? `, nº ${selectedProject.address_number}` : ''}
              </p>
              {selectedProject.address_district && (
                <p className="text-slate-500 dark:text-gray-400">Bairro: {selectedProject.address_district}</p>
              )}
              <p className="text-slate-500 dark:text-gray-400">
                {selectedProject.address_city || 'Cidade N/D'} - {selectedProject.address_state || 'UF'}
              </p>
              {selectedProject.address_zip && (
                <p className="font-mono text-[11px] text-slate-400">CEP: {selectedProject.address_zip}</p>
              )}
            </div>
          </div>

          {/* Ação cruzada: Ver Serviços da Obra */}
          <div className="pt-1">
            <Button
              variant="outline"
              onClick={() => navigate(`/servicos?obra=${selectedProject.id}`)}
              className="w-full h-9 text-xs font-semibold border-slate-200 dark:border-gray-700 gap-1.5 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-brand-dark-800 cursor-pointer"
            >
              <span>Ver Ordens de Serviço vinculadas a esta obra</span>
              <ExternalLinkIcon className="h-3.5 w-3.5 text-slate-400" />
            </Button>
          </div>

          {/* Histórico & Auditoria */}
          <div className="text-[11px] text-slate-400 dark:text-gray-500 space-y-1 pt-1 border-t border-slate-200/60 dark:border-gray-800">
            <p>Criado em: <span className="font-mono">{formatDateBR(selectedProject.created_at)}</span></p>
            <p>ID do Registro: <span className="font-mono text-[10px]">{selectedProject.id}</span></p>
          </div>
        </div>
      );
    }

    if (activeTab === 'collaborators' && selectedCollaborator) {
      const whatsAppUrl = getWhatsAppUrl(selectedCollaborator.phone, selectedCollaborator.name);
      return (
        <div className="space-y-4">
          {/* Card de Identificação */}
          <div className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50 dark:bg-brand-dark-800/60 border border-slate-200 dark:border-gray-800">
            <div className="w-12 h-12 rounded-xl bg-amber-600 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-amber-600/20 shrink-0">
              {selectedCollaborator.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight break-words">
                {selectedCollaborator.name}
              </h2>
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-brand-dark-800 text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-gray-700/60">
                {selectedCollaborator.role || 'Operacional Geral'}
              </span>
            </div>
          </div>

          {/* Grid de Ações Rápidas */}
          <div className="grid grid-cols-2 gap-2">
            {selectedCollaborator.phone && whatsAppUrl ? (
              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold transition-colors"
              >
                <PhoneIcon className="h-3.5 w-3.5" />
                <span>WhatsApp</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-brand-dark-800 text-slate-400 border border-slate-200 dark:border-gray-700 text-xs font-medium cursor-not-allowed"
              >
                <PhoneIcon className="h-3.5 w-3.5" />
                <span>Sem Telefone</span>
              </button>
            )}

            {selectedCollaborator.document ? (
              <button
                type="button"
                onClick={() => handleCopy(selectedCollaborator.document!, 'doc', 'Documento/CPF')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-brand-dark-800 dark:hover:bg-brand-dark-700 text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-gray-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                {copiedKey === 'doc' ? <CheckIcon className="h-3.5 w-3.5 text-emerald-500" /> : <CopyIcon className="h-3.5 w-3.5 text-slate-400" />}
                <span>{copiedKey === 'doc' ? 'Copiado!' : 'Copiar CPF'}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-brand-dark-800 text-slate-400 border border-slate-200 dark:border-gray-700 text-xs font-medium cursor-not-allowed"
              >
                <CopyIcon className="h-3.5 w-3.5" />
                <span>Sem CPF</span>
              </button>
            )}
          </div>

          {/* Seção: Dados Cadastrais & Contato */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-brand-dark-800/60 border border-slate-200 dark:border-gray-800 space-y-3">
            <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">
              Dados Cadastrais & Contato
            </span>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-gray-500">Documento / CPF</p>
                  <p className="font-mono text-xs font-semibold text-slate-800 dark:text-gray-200 tabular-nums">
                    {formatDocument(selectedCollaborator.document)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-gray-500">Telefone / Contato</p>
                  <p className="font-mono text-xs font-semibold text-slate-800 dark:text-gray-200 tabular-nums">
                    {formatPhoneNumber(selectedCollaborator.phone)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Seção: Avaliação & Desempenho */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-brand-dark-800/60 border border-slate-200 dark:border-gray-800 space-y-3">
            <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">
              Avaliação & Performance
            </span>

            <div className="p-2.5 rounded-lg bg-white dark:bg-brand-dark-900 border border-slate-200/80 dark:border-gray-800 space-y-1">
              <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Qualificação Técnica</p>
              <StarRating rating={selectedCollaborator.rating} />
              <p className="text-[10px] font-mono text-slate-400">{selectedCollaborator.rating || 0} / 5 estrelas</p>
            </div>

            {selectedCollaborator.observations && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-gray-700/60">
                <p className="text-[10px] text-slate-400 dark:text-gray-500 font-semibold uppercase">Observações Internas</p>
                <p className="text-xs text-slate-700 dark:text-gray-300 mt-1 whitespace-pre-wrap leading-relaxed">
                  {selectedCollaborator.observations}
                </p>
              </div>
            )}
          </div>

          {/* Ação cruzada: Ver Tarefas do Colaborador */}
          <div className="pt-1">
            <Button
              variant="outline"
              onClick={() => navigate(`/tarefas?responsavel=${selectedCollaborator.id}`)}
              className="w-full h-9 text-xs font-semibold border-slate-200 dark:border-gray-700 gap-1.5 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-brand-dark-800 cursor-pointer"
            >
              <span>Ver tarefas atribuídas a este colaborador</span>
              <ExternalLinkIcon className="h-3.5 w-3.5 text-slate-400" />
            </Button>
          </div>

          {/* Histórico & Auditoria */}
          <div className="text-[11px] text-slate-400 dark:text-gray-500 space-y-1 pt-1 border-t border-slate-200/60 dark:border-gray-800">
            <p>Cadastrado em: <span className="font-mono">{formatDateBR(selectedCollaborator.created_at)}</span></p>
            <p>ID do Registro: <span className="font-mono text-[10px]">{selectedCollaborator.id}</span></p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="w-full space-y-4 animate-in fade-in-50">
      {/* ========================================================= */}
      {/* 1. CABEÇALHO OPERACIONAL ENXUTO (PADRÃO NOTAS & SERVIÇOS) */}
      {/* ========================================================= */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
            <BuildingIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-[#F8FAFC] tracking-tight">
              Cadastros Gerais
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
              Fornecedores homologados, canteiros de obras e mão de obra operacional qualificada.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-9 text-xs font-semibold border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-brand-dark-800 gap-1.5 cursor-pointer"
            title={`Exportar ${tabConfig.title.toLowerCase()} em formato CSV`}
          >
            <DownloadIcon className="h-4 w-4 text-slate-500 dark:text-gray-400" />
            <span>Exportar CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={tabConfig.onAddNew}
            className="h-9 text-xs font-bold bg-[#4F46E5] hover:bg-indigo-600 dark:bg-[#6366F1] dark:hover:bg-indigo-500 text-white gap-1.5 shadow-sm shadow-indigo-600/30 cursor-pointer"
          >
            <PlusIcon className="h-4 w-4" />
            <span>+ Novo(a) {tabConfig.singular}</span>
          </Button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. SISTEMA DE ABAS (PADRÃO SERVIÇOS & EXTRATO)            */}
      {/* ========================================================= */}
      <div className="border-b border-slate-200 dark:border-gray-800">
        <nav className="flex space-x-6 sm:space-x-8" aria-label="Abas">
          <button
            type="button"
            onClick={() => handleTabChange('suppliers')}
            className={`pb-2.5 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'suppliers'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <BuildingIcon className="h-4 w-4" />
            <span>Fornecedores</span>
            <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-brand-dark-800 text-slate-600 dark:text-gray-400 font-semibold font-mono">
              {counts?.suppliers ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('projects')}
            className={`pb-2.5 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'projects'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <ConstructionIcon className="h-4 w-4" />
            <span>Obras & Canteiros</span>
            <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-brand-dark-800 text-slate-600 dark:text-gray-400 font-semibold font-mono">
              {counts?.projects ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('collaborators')}
            className={`pb-2.5 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'collaborators'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <UsersIcon className="h-4 w-4" />
            <span>Colaboradores & Equipe</span>
            <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-brand-dark-800 text-slate-600 dark:text-gray-400 font-semibold font-mono">
              {counts?.collaborators ?? 0}
            </span>
          </button>
        </nav>
      </div>

      {/* ========================================================= */}
      {/* 3. BARRA DE FILTROS E ÁREA OPERACIONAL EM SPLIT VIEW      */}
      {/* ========================================================= */}
      <div className="space-y-0">
        {/* Barra de Controle e Filtros Rápidos (Colada no topo da tabela) */}
        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-t-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          {/* Esquerda: Quick-filter pills para Status de Obras ou Título Contextual */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {activeTab === 'projects' ? (
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#162235] p-0.5 border border-slate-200 dark:border-[#273549] text-xs">
                {['todos', 'Em Andamento', 'Planejamento', 'Concluído'].map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer font-semibold ${
                      statusFilter === st
                        ? 'bg-white dark:bg-[#1E293B] text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {st === 'todos' ? 'Todos os Status' : st}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8]">
                {activeTab === 'suppliers' ? 'Listagem de Fornecedores Homologados' : 'Quadro de Profissionais & Mão de Obra'}
              </span>
            )}
          </div>

          {/* Direita: Campo de Busca Rápida */}
          <div className="relative w-full sm:w-72">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={tabConfig.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-8 pr-7 text-xs bg-slate-50 dark:bg-brand-dark-800/80 border border-slate-200 dark:border-gray-700 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 4. ÁREA OPERACIONAL EM SPLIT VIEW (MESTRE - DETALHE) */}
        <div className={`overflow-hidden rounded-b-xl border-x border-b border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111827] shadow-xs flex flex-col lg:flex-row ${
          hasSelectedItem && isDesktop ? 'items-stretch' : ''
        }`}>
        
        {/* --------------------------------------------------------- */}
        {/* LADO ESQUERDO: TABELA RETRÁTIL                            */}
        {/* --------------------------------------------------------- */}
        <div className={`flex flex-col ${
          hasSelectedItem && isDesktop
            ? 'w-full lg:w-[48%] xl:w-[46%] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-gray-800'
            : 'w-full'
        }`}>
          <div 
            onScroll={handleTableScroll}
            className={`flex-1 overflow-x-auto ${hasSelectedItem && isDesktop ? 'max-h-[calc(100vh-270px)] overflow-y-auto custom-scrollbar' : ''}`}
          >
            
            {/* TABELA: FORNECEDORES */}
            {activeTab === 'suppliers' && (
              <table className="w-full text-sm text-left text-slate-600 dark:text-gray-400">
                <thead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] bg-slate-50 dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#1E293B] sticky top-0 z-10">
                  <tr>
                    <th className="px-3 sm:px-4 py-3.5 font-semibold">Fornecedor / Razão Social</th>
                    <th className="px-3 sm:px-4 py-3.5 font-semibold whitespace-nowrap">CNPJ</th>
                    <th className={hasSelectedItem && isDesktop ? 'hidden' : 'px-4 py-3.5 font-semibold'}>Vendedor / Contato</th>
                    <th className={hasSelectedItem && isDesktop ? 'hidden' : 'px-4 py-3.5 font-semibold text-center'}>Avaliações</th>
                    <th className="px-2 sm:px-4 py-3.5 font-semibold text-center w-12 sm:w-16">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800 bg-white dark:bg-[#111827]">
                  {tabConfig.isLoading && allSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-gray-500">
                        Carregando fornecedores...
                      </td>
                    </tr>
                  ) : allSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <div className="max-w-xs mx-auto space-y-2">
                          <BuildingIcon className="h-8 w-8 mx-auto text-slate-300 dark:text-gray-600" />
                          <p className="font-semibold text-slate-700 dark:text-gray-300">Nenhum fornecedor encontrado</p>
                          <p className="text-slate-400 text-xs">
                            {debouncedSearch ? 'Tente ajustar os termos da busca.' : 'Cadastre seu primeiro fornecedor homologado.'}
                          </p>
                          <Button size="sm" onClick={tabConfig.onAddNew} className="mt-2 bg-indigo-600 text-white">
                            + Novo Fornecedor
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    allSuppliers.map((supplier) => {
                      const isSelected = selectedSupplier?.id === supplier.id;
                      const whatsAppUrl = getWhatsAppUrl(supplier.seller_contact, supplier.seller || supplier.name);

                      return (
                        <tr
                          id={`supplier-row-${supplier.id}`}
                          key={supplier.id}
                          onClick={() => setSelectedSupplier(supplier)}
                          className={`group cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#F5F3FF] dark:bg-indigo-500/[0.08] border-l-4 border-[#818CF8] font-semibold text-slate-800 dark:text-[#F8FAFC]'
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          {/* 1. Nome / Razão Social */}
                          <td className="px-3 sm:px-4 py-3 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0 border border-indigo-100 dark:border-indigo-900/60">
                                {supplier.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className={`text-xs block truncate ${isSelected ? 'font-bold text-indigo-700 dark:text-indigo-300' : 'font-semibold text-slate-900 dark:text-white'}`} title={supplier.name}>
                                  {supplier.name}
                                </span>
                                {hasSelectedItem && isDesktop && supplier.seller && (
                                  <span className="text-[10px] text-slate-500 dark:text-gray-400 block truncate">
                                    {supplier.seller} {supplier.seller_contact ? `• ${supplier.seller_contact}` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 2. CNPJ */}
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap font-mono text-xs tabular-nums text-slate-600 dark:text-gray-300">
                            {formatCnpj(supplier.cnpj) || '-'}
                          </td>

                          {/* 3. Vendedor / Contato (oculto quando retraído) */}
                          <td className={hasSelectedItem && isDesktop ? 'hidden' : 'px-4 py-3 text-slate-600 dark:text-gray-300'}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="truncate text-xs font-medium" title={supplier.seller || ''}>
                                {supplier.seller || '-'}
                              </span>
                              {supplier.seller_contact && (
                                <span className="font-mono text-[11px] text-slate-400 dark:text-gray-500 whitespace-nowrap">
                                  • {supplier.seller_contact}
                                </span>
                              )}
                              {whatsAppUrl && (
                                <a
                                  href={whatsAppUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Conversar no WhatsApp"
                                  className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0 transition-colors"
                                >
                                  <PhoneIcon className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </td>

                          {/* 4. Avaliações (oculto quando retraído) */}
                          <td className={hasSelectedItem && isDesktop ? 'hidden' : 'px-4 py-3'}>
                            <div className="flex items-center justify-center gap-3">
                              <div className="flex items-center gap-1" title={`Serviço: ${supplier.service_rating || 0} estrelas`}>
                                <span className="text-[10px] text-slate-400 uppercase font-semibold">S:</span>
                                <StarRating rating={supplier.service_rating} className="scale-75 origin-left" />
                              </div>
                              <div className="flex items-center gap-1" title={`Entrega: ${supplier.delivery_rating || 0} estrelas`}>
                                <span className="text-[10px] text-slate-400 uppercase font-semibold">E:</span>
                                <StarRating rating={supplier.delivery_rating} className="scale-75 origin-left" />
                              </div>
                            </div>
                          </td>

                          {/* 5. Ações */}
                          <td className="px-2 sm:px-4 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="h-7 w-7 border-slate-200 dark:border-gray-700">
                                  <MoreVerticalIcon className="h-3.5 w-3.5 text-slate-500" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setModalEditSupplier(supplier);
                                    setIsSupplierModalOpen(true);
                                  }}
                                >
                                  <EditIcon className="h-3.5 w-3.5 mr-2 text-slate-500" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setDeleteTarget({
                                      id: supplier.id,
                                      name: supplier.name,
                                      entityName: 'Fornecedor',
                                      tableName: 'suppliers',
                                      queryKey: 'suppliers',
                                    });
                                  }}
                                  className="text-rose-600 dark:text-rose-400 focus:text-rose-600"
                                >
                                  <Trash2Icon className="h-3.5 w-3.5 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* TABELA: OBRAS */}
            {activeTab === 'projects' && (
              <table className="w-full text-sm text-left text-slate-600 dark:text-gray-400">
                <thead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] bg-slate-50 dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#1E293B] sticky top-0 z-10">
                  <tr>
                    <th className="px-3 sm:px-4 py-3.5 font-semibold">Nome da Obra</th>
                    <th className="px-3 sm:px-4 py-3.5 font-semibold">Status</th>
                    <th className={hasSelectedItem && isDesktop ? 'hidden' : 'px-4 py-3.5 font-semibold'}>Mestre / Responsável</th>
                    <th className={hasSelectedItem && isDesktop ? 'hidden' : 'px-4 py-3.5 font-semibold whitespace-nowrap'}>Cronograma</th>
                    <th className={hasSelectedItem && isDesktop ? 'hidden' : 'px-4 py-3.5 font-semibold'}>Localização</th>
                    <th className="px-2 sm:px-4 py-3.5 font-semibold text-center w-12 sm:w-16">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800 bg-white dark:bg-[#111827]">
                  {tabConfig.isLoading && allProjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-gray-500">
                        Carregando obras...
                      </td>
                    </tr>
                  ) : allProjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="max-w-xs mx-auto space-y-2">
                          <ConstructionIcon className="h-8 w-8 mx-auto text-slate-300 dark:text-gray-600" />
                          <p className="font-semibold text-slate-700 dark:text-gray-300">Nenhuma obra cadastrada</p>
                          <p className="text-slate-400 text-xs">
                            {debouncedSearch ? 'Tente ajustar os filtros ou a busca.' : 'Cadastre sua primeira obra ou canteiro de obras.'}
                          </p>
                          <Button size="sm" onClick={tabConfig.onAddNew} className="mt-2 bg-indigo-600 text-white">
                            + Nova Obra
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    allProjects.map((project) => {
                      const isSelected = selectedProject?.id === project.id;

                      return (
                        <tr
                          id={`project-row-${project.id}`}
                          key={project.id}
                          onClick={() => setSelectedProject(project)}
                          className={`group cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#F5F3FF] dark:bg-indigo-500/[0.08] border-l-4 border-[#818CF8] font-semibold text-slate-800 dark:text-[#F8FAFC]'
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          {/* 1. Nome da Obra */}
                          <td className="px-3 sm:px-4 py-3 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0 border border-emerald-100 dark:border-emerald-900/60">
                                {project.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className={`text-xs block truncate ${isSelected ? 'font-bold text-indigo-700 dark:text-indigo-300' : 'font-semibold text-slate-900 dark:text-white'}`} title={project.name}>
                                  {project.name}
                                </span>
                                {hasSelectedItem && isDesktop && (
                                  <span className="text-[10px] text-slate-500 dark:text-gray-400 block truncate">
                                    {project.address_city ? `${project.address_city} • ` : ''}{project.manager || 'Sem mestre'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 2. Status */}
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                            {getProjectStatusBadge(project.status)}
                          </td>

                          {/* 3. Mestre / Responsável (oculto quando retraído) */}
                          <td className={hasSelectedItem && isDesktop ? 'hidden' : 'px-4 py-3 text-slate-600 dark:text-gray-300'}>
                            <span className="truncate text-xs font-medium block" title={project.manager || '-'}>
                              {project.manager || '-'}
                            </span>
                          </td>

                          {/* 4. Cronograma (oculto quando retraído) */}
                          <td className={hasSelectedItem && isDesktop ? 'hidden' : 'px-4 py-3 whitespace-nowrap font-mono text-xs tabular-nums text-slate-500 dark:text-gray-400'}>
                            {project.start_date ? formatDateBR(project.start_date) : 'N/A'}
                            {' → '}
                            {project.end_date ? formatDateBR(project.end_date) : 'Em aberto'}
                          </td>

                          {/* 5. Localização (oculto quando retraído) */}
                          <td className={hasSelectedItem && isDesktop ? 'hidden' : 'px-4 py-3 text-slate-600 dark:text-gray-300'}>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <MapPinIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="truncate text-xs" title={`${project.address_city || ''} - ${project.address_state || ''}`}>
                                {project.address_city ? `${project.address_city} - ${project.address_state || ''}` : '-'}
                              </span>
                            </div>
                          </td>

                          {/* 6. Ações */}
                          <td className="px-2 sm:px-4 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="h-7 w-7 border-slate-200 dark:border-gray-700">
                                  <MoreVerticalIcon className="h-3.5 w-3.5 text-slate-500" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setModalEditProject(project);
                                    setIsProjectModalOpen(true);
                                  }}
                                >
                                  <EditIcon className="h-3.5 w-3.5 mr-2 text-slate-500" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setDeleteTarget({
                                      id: project.id,
                                      name: project.name,
                                      entityName: 'Obra',
                                      tableName: 'projects',
                                      queryKey: 'projects',
                                    });
                                  }}
                                  className="text-rose-600 dark:text-rose-400 focus:text-rose-600"
                                >
                                  <Trash2Icon className="h-3.5 w-3.5 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* TABELA: COLABORADORES */}
            {activeTab === 'collaborators' && (
              <table className="w-full text-sm text-left text-slate-600 dark:text-gray-400">
                <thead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] bg-slate-50 dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#1E293B] sticky top-0 z-10">
                  <tr>
                    <th className="px-3 sm:px-4 py-3.5 font-semibold">Nome</th>
                    <th className="px-3 sm:px-4 py-3.5 font-semibold">Função</th>
                    <th className="px-3 sm:px-4 py-3.5 font-semibold whitespace-nowrap">CPF / Documento</th>
                    <th className={hasSelectedItem && isDesktop ? 'hidden' : 'px-4 py-3.5 font-semibold whitespace-nowrap'}>Contato</th>
                    <th className={hasSelectedItem && isDesktop ? 'hidden' : 'px-4 py-3.5 font-semibold text-center'}>Avaliação</th>
                    <th className="px-2 sm:px-4 py-3.5 font-semibold text-center w-12 sm:w-16">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800 bg-white dark:bg-[#111827]">
                  {tabConfig.isLoading && allCollaborators.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-gray-500">
                        Carregando colaboradores...
                      </td>
                    </tr>
                  ) : allCollaborators.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="max-w-xs mx-auto space-y-2">
                          <UsersIcon className="h-8 w-8 mx-auto text-slate-300 dark:text-gray-600" />
                          <p className="font-semibold text-slate-700 dark:text-gray-300">Nenhum colaborador encontrado</p>
                          <p className="text-slate-400 text-xs">
                            {debouncedSearch ? 'Tente ajustar os termos da busca.' : 'Cadastre seus profissionais de equipe.'}
                          </p>
                          <Button size="sm" onClick={tabConfig.onAddNew} className="mt-2 bg-indigo-600 text-white">
                            + Novo Colaborador
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    allCollaborators.map((collab) => {
                      const isSelected = selectedCollaborator?.id === collab.id;
                      const whatsAppUrl = getWhatsAppUrl(collab.phone, collab.name);

                      return (
                        <tr
                          id={`collaborator-row-${collab.id}`}
                          key={collab.id}
                          onClick={() => setSelectedCollaborator(collab)}
                          className={`group cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#F5F3FF] dark:bg-indigo-500/[0.08] border-l-4 border-[#818CF8] font-semibold text-slate-800 dark:text-[#F8FAFC]'
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          {/* 1. Nome */}
                          <td className="px-3 sm:px-4 py-3 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center text-xs shrink-0 border border-amber-100 dark:border-amber-900/60">
                                {collab.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className={`text-xs block truncate ${isSelected ? 'font-bold text-indigo-700 dark:text-indigo-300' : 'font-semibold text-slate-900 dark:text-white'}`} title={collab.name}>
                                  {collab.name}
                                </span>
                                {hasSelectedItem && isDesktop && (
                                  <span className="text-[10px] text-slate-500 dark:text-gray-400 block truncate">
                                    {collab.role || 'Operacional Geral'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 2. Função */}
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-brand-dark-800 text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-gray-700/60 whitespace-nowrap">
                              {collab.role || 'Geral'}
                            </span>
                          </td>

                          {/* 3. CPF / Documento */}
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap font-mono text-xs tabular-nums text-slate-600 dark:text-gray-300">
                            {formatDocument(collab.document)}
                          </td>

                          {/* 4. Contato (oculto quando retraído) */}
                          <td className={hasSelectedItem && isDesktop ? 'hidden' : 'px-4 py-3 whitespace-nowrap text-slate-600 dark:text-gray-300'}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-xs tabular-nums">
                                {formatPhoneNumber(collab.phone)}
                              </span>
                              {whatsAppUrl && (
                                <a
                                  href={whatsAppUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Conversar no WhatsApp"
                                  className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0 transition-colors"
                                >
                                  <PhoneIcon className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </td>

                          {/* 5. Avaliação (oculto quando retraído) */}
                          <td className={hasSelectedItem && isDesktop ? 'hidden' : 'px-4 py-3 text-center'}>
                            <div className="flex justify-center" title={`${collab.rating || 0} estrelas`}>
                              <StarRating rating={collab.rating} className="scale-75 origin-center" />
                            </div>
                          </td>

                          {/* 6. Ações */}
                          <td className="px-2 sm:px-4 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="h-7 w-7 border-slate-200 dark:border-gray-700">
                                  <MoreVerticalIcon className="h-3.5 w-3.5 text-slate-500" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setModalEditCollaborator(collab);
                                    setIsCollaboratorModalOpen(true);
                                  }}
                                >
                                  <EditIcon className="h-3.5 w-3.5 mr-2 text-slate-500" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setDeleteTarget({
                                      id: collab.id,
                                      name: collab.name,
                                      entityName: 'Colaborador',
                                      tableName: 'collaborators',
                                      queryKey: 'collaborators',
                                    });
                                  }}
                                  className="text-rose-600 dark:text-rose-400 focus:text-rose-600"
                                >
                                  <Trash2Icon className="h-3.5 w-3.5 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* Sentinel de Scroll Infinito Automático (Sem necessidade de clicar em botões) */}
            <div ref={tableSentinelRef} className="p-3 text-center border-t border-slate-100 dark:border-gray-800">
              {activePagination.isFetchingNextPage ? (
                <div className="flex items-center justify-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  <div className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                  <span>Carregando mais {tabConfig.title.toLowerCase()}...</span>
                </div>
              ) : activePagination.hasNextPage ? (
                <span className="text-[11px] text-slate-400">Role ou use as setas para carregar mais</span>
              ) : activeList.length > 0 ? (
                <span className="text-[11px] text-slate-400">Todos os {activeList.length} {tabConfig.title.toLowerCase()} carregados</span>
              ) : null}
            </div>
          </div>

          {/* Rodapé Fixo Informativo da Tabela com Status do Scroll Infinito */}
          <div className="h-10 shrink-0 bg-white dark:bg-[#111827] border-t border-[#E2E8F0] dark:border-[#1E293B] px-4 flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
            <div>
              <span>
                Mostrando <strong className="text-slate-800 dark:text-white font-mono">{activeList.length}</strong>
                {' de '}
                <strong className="text-slate-800 dark:text-white font-mono">{activePagination.totalCount}</strong> {tabConfig.title.toLowerCase()}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {activePagination.isFetchingNextPage ? (
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1.5">
                  <div className="w-3 h-3 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                  Carregando...
                </span>
              ) : activePagination.hasNextPage ? (
                <span className="text-[11px] text-slate-400 font-medium">
                  Role para carregar mais
                </span>
              ) : activeList.length > 0 ? (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  ✓ Completo
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------- */}
        {/* LADO DIREITO: PAINEL DE INSPEÇÃO RETRÁTIL INLINE          */}
        {/* --------------------------------------------------------- */}
        {hasSelectedItem && isDesktop && (
          <div className="w-full lg:w-[52%] xl:w-[54%] flex flex-col bg-white dark:bg-[#111827] overflow-hidden animate-in fade-in-0 duration-150">
            {/* Topbar Fixa do Painel com Navegação Sequencial */}
            <div className="h-14 px-4 sm:px-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-brand-dark-800/20">
              {/* Esquerda: Identificador da entidade */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider truncate">
                  {activeTab === 'suppliers' ? 'Dossiê do Fornecedor' : activeTab === 'projects' ? 'Ficha da Obra' : 'Perfil do Colaborador'}
                </span>
                {activeTab === 'suppliers' && (
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-200 text-[10px]">
                    Ativo
                  </Badge>
                )}
                {activeTab === 'projects' && selectedProject && getProjectStatusBadge(selectedProject.status)}
                {activeTab === 'collaborators' && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                    Equipe
                  </Badge>
                )}
              </div>

              {/* Direita: Controles [↑] [↓] (X de Y), Editar, Excluir, [✕] */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-mono text-slate-400 dark:text-gray-500 mr-1 hidden sm:inline">
                  {selectedIndex + 1} de {activePagination.totalCount}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  className="h-8 w-8 p-0 border-slate-200 dark:border-gray-700 disabled:opacity-30 cursor-pointer"
                  title="Item anterior (Seta ↑)"
                >
                  <ChevronUpIcon className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                  disabled={!hasNext && !activePagination.hasNextPage}
                  className="h-8 w-8 p-0 border-slate-200 dark:border-gray-700 disabled:opacity-30 cursor-pointer"
                  title="Próximo item (Seta ↓)"
                >
                  <ChevronDownIcon className="h-4 w-4" />
                </Button>

                <div className="h-4 w-px bg-slate-200 dark:border-gray-800 mx-1" />

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditCurrent}
                  className="h-8 px-2.5 text-xs font-semibold border-slate-200 dark:border-gray-700 gap-1 cursor-pointer"
                  title="Editar este registro"
                >
                  <EditIcon className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Editar</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteCurrent}
                  className="h-8 px-2 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                  title="Excluir este registro"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>

                <div className="h-4 w-px bg-slate-200 dark:border-gray-800 mx-1" />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseDetail}
                  className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  title="Fechar painel (Esc)"
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Conteúdo com Scroll Independente */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 max-h-[calc(100vh-270px)]">
              {renderDetailContent()}
            </div>
          </div>
        )}
      </div>
    </div>

      {/* ========================================================= */}
      {/* 5. SLIDE-OVER DRAWER PARA DISPOSITIVOS MÓVEIS (< 1024px)  */}
      {/* ========================================================= */}
      {hasSelectedItem && !isDesktop && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in-50">
          <div className="w-full max-w-md h-full bg-white dark:bg-[#111827] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Topbar do Drawer Mobile */}
            <div className="h-14 px-4 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-brand-dark-800/20">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {activeTab === 'suppliers' ? 'Dossiê do Fornecedor' : activeTab === 'projects' ? 'Ficha da Obra' : 'Perfil do Colaborador'}
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditCurrent}
                  className="h-8 px-2.5 text-xs font-semibold border-slate-200 dark:border-gray-700 gap-1 cursor-pointer"
                >
                  <EditIcon className="h-3.5 w-3.5 text-slate-500" />
                  <span>Editar</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteCurrent}
                  className="h-8 px-2 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseDetail}
                  className="h-8 w-8 p-0 text-slate-400"
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Corpo do Drawer Mobile */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
              {renderDetailContent()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. MODAIS OPERACIONAIS SUSPENSOS                           */}
      {/* ========================================================= */}
      <Suspense fallback={null}>
        {isSupplierModalOpen && (
          <SupplierModal
            isOpen={isSupplierModalOpen}
            onClose={() => {
              setIsSupplierModalOpen(false);
              setModalEditSupplier(null);
            }}
            supplier={modalEditSupplier}
          />
        )}

        {isProjectModalOpen && (
          <ProjectModal
            isOpen={isProjectModalOpen}
            onClose={() => {
              setIsProjectModalOpen(false);
              setModalEditProject(null);
            }}
            project={modalEditProject}
          />
        )}

        {isCollaboratorModalOpen && (
          <CollaboratorModal
            isOpen={isCollaboratorModalOpen}
            onClose={() => {
              setIsCollaboratorModalOpen(false);
              setModalEditCollaborator(null);
            }}
            collaborator={modalEditCollaborator}
          />
        )}
      </Suspense>

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        title={`Confirmar Exclusão de ${deleteTarget?.entityName || 'Registro'}`}
        description={
          <>
            Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação removerá o registro permanentemente do sistema.
          </>
        }
        confirmText="Excluir Definitivamente"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default Registros;
