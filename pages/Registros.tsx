import React, { useState, useMemo, useEffect, lazy, Suspense, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { Supplier, Project, Collaborator, ProjectStatus } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
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
  MapPinIcon, CalendarIcon, CopyIcon, CheckIcon, ExternalLinkIcon,
  XIcon, ChevronLeftIcon, ChevronRightIcon, AlertTriangleIcon, FilterIcon
} from '../lib/icons';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from '../components/ui/DropdownMenu';

const SupplierModal = lazy(() => import('../components/registros/SupplierModal'));
const ProjectModal = lazy(() => import('../components/registros/ProjectModal'));
const CollaboratorModal = lazy(() => import('../components/registros/CollaboratorModal'));

type ActiveTab = 'suppliers' | 'projects' | 'collaborators';

const PAGE_SIZE = 15;

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

const Registros: React.FC = () => {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  // Navigation and Tab State
  const [activeTab, setActiveTab] = useState<ActiveTab>('suppliers');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);

  // Status Filter for Obras
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Selected item for Inspector Drawer
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | null>(null);

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
      setPage(0);
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset page and selection on tab change
  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setPage(0);
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

  // Global counts for tab badges
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

  // Query: Suppliers
  const { data: suppliersData, isLoading: isLoadingSuppliers } = useQuery<{ data: Supplier[]; count: number }>({
    queryKey: ['suppliers', profile?.company_id, page, debouncedSearch],
    queryFn: async () => {
      let query = (supabase as any)
        .from('suppliers')
        .select('*', { count: 'exact' })
        .eq('company_id', profile!.company_id);

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,cnpj.ilike.%${debouncedSearch}%,seller.ilike.%${debouncedSearch}%`);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count, error } = await query.order('name', { ascending: true }).range(from, to);
      if (error) throw error;
      return { data: (data as Supplier[]) || [], count: count ?? 0 };
    },
    enabled: !!profile?.company_id && activeTab === 'suppliers',
    placeholderData: (previousData) => previousData,
  });

  // Query: Projects
  const { data: projectsData, isLoading: isLoadingProjects } = useQuery<{ data: Project[]; count: number }>({
    queryKey: ['projects', profile?.company_id, page, debouncedSearch, statusFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from('projects')
        .select('*', { count: 'exact' })
        .eq('company_id', profile!.company_id);

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,manager.ilike.%${debouncedSearch}%,address_city.ilike.%${debouncedSearch}%`);
      }

      if (statusFilter !== 'todos') {
        query = query.eq('status', statusFilter);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
      if (error) throw error;
      return { data: (data as Project[]) || [], count: count ?? 0 };
    },
    enabled: !!profile?.company_id && activeTab === 'projects',
    placeholderData: (previousData) => previousData,
  });

  // Query: Collaborators
  const { data: collaboratorsData, isLoading: isLoadingCollaborators } = useQuery<{ data: Collaborator[]; count: number }>({
    queryKey: ['collaborators', profile?.company_id, page, debouncedSearch],
    queryFn: async () => {
      let query = (supabase as any)
        .from('collaborators')
        .select('*', { count: 'exact' })
        .eq('company_id', profile!.company_id);

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,role.ilike.%${debouncedSearch}%,document.ilike.%${debouncedSearch}%`);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count, error } = await query.order('name', { ascending: true }).range(from, to);
      if (error) throw error;
      return { data: (data as Collaborator[]) || [], count: count ?? 0 };
    },
    enabled: !!profile?.company_id && activeTab === 'collaborators',
    placeholderData: (previousData) => previousData,
  });

  // Keep selection synchronized with updated data
  useEffect(() => {
    if (activeTab === 'suppliers' && suppliersData?.data.length) {
      if (selectedSupplier) {
        const refreshed = suppliersData.data.find(s => s.id === selectedSupplier.id);
        if (refreshed) setSelectedSupplier(refreshed);
      }
    } else if (activeTab === 'projects' && projectsData?.data.length) {
      if (selectedProject) {
        const refreshed = projectsData.data.find(p => p.id === selectedProject.id);
        if (refreshed) setSelectedProject(refreshed);
      }
    } else if (activeTab === 'collaborators' && collaboratorsData?.data.length) {
      if (selectedCollaborator) {
        const refreshed = collaboratorsData.data.find(c => c.id === selectedCollaborator.id);
        if (refreshed) setSelectedCollaborator(refreshed);
      }
    }
  }, [suppliersData, projectsData, collaboratorsData, activeTab]);

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
          totalCount: suppliersData?.count ?? 0,
          totalPages: Math.ceil((suppliersData?.count ?? 0) / PAGE_SIZE),
          isLoading: isLoadingSuppliers,
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
          totalCount: projectsData?.count ?? 0,
          totalPages: Math.ceil((projectsData?.count ?? 0) / PAGE_SIZE),
          isLoading: isLoadingProjects,
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
          totalCount: collaboratorsData?.count ?? 0,
          totalPages: Math.ceil((collaboratorsData?.count ?? 0) / PAGE_SIZE),
          isLoading: isLoadingCollaborators,
          onAddNew: () => {
            setModalEditCollaborator(null);
            setIsCollaboratorModalOpen(true);
          }
        };
    }
  }, [activeTab, suppliersData, projectsData, collaboratorsData, isLoadingSuppliers, isLoadingProjects, isLoadingCollaborators]);

  // Helpers for Project status badges
  const getProjectStatusBadge = (status: ProjectStatus | string) => {
    switch (status) {
      case 'Concluído':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Concluído
          </span>
        );
      case 'Em Andamento':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Em Andamento
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Planejamento
          </span>
        );
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-brand-dark-950">
      {/* ========================================================= */}
      {/* 1. SUB-HEADER OPERACIONAL COMPACTO (Andar 1 & Andar 2)    */}
      {/* ========================================================= */}
      <header className="bg-white dark:bg-brand-dark-900 border-b border-slate-200 dark:border-gray-800 px-6 pt-4 pb-0 shrink-0">
        {/* Andar 1: Título Operacional + Ações Globais da Página */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Cadastros Gerais
            </h1>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Fornecedores homologados, canteiros de obras e mão de obra operacional qualificada.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="h-8 text-xs font-medium border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-brand-dark-800 gap-1.5"
              title={`Exportar ${tabConfig.title.toLowerCase()} em planilha CSV`}
            >
              <DownloadIcon className="h-3.5 w-3.5 text-slate-500 dark:text-gray-400" />
              <span>Exportar</span>
            </Button>

            <Button
              size="sm"
              onClick={tabConfig.onAddNew}
              className="h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 shadow-sm"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>+ Novo(a) {tabConfig.singular}</span>
            </Button>
          </div>
        </div>

        {/* Andar 2: Abas com Badges + Input de Busca Alinhado Horizontalmente */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-slate-100 dark:border-gray-800/80 pt-2">
          {/* Esquerda: Abas com Contadores */}
          <div className="flex items-center gap-6 overflow-x-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => handleTabChange('suppliers')}
              className={`flex items-center gap-2 pb-2.5 text-xs transition-colors border-b-2 font-medium whitespace-nowrap cursor-pointer ${
                activeTab === 'suppliers'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BuildingIcon className="h-4 w-4" />
              <span>Fornecedores</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                activeTab === 'suppliers'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                  : 'bg-slate-100 dark:bg-brand-dark-800 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-gray-700'
              }`}>
                {counts?.suppliers ?? 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('projects')}
              className={`flex items-center gap-2 pb-2.5 text-xs transition-colors border-b-2 font-medium whitespace-nowrap cursor-pointer ${
                activeTab === 'projects'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ConstructionIcon className="h-4 w-4" />
              <span>Obras</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                activeTab === 'projects'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                  : 'bg-slate-100 dark:bg-brand-dark-800 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-gray-700'
              }`}>
                {counts?.projects ?? 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('collaborators')}
              className={`flex items-center gap-2 pb-2.5 text-xs transition-colors border-b-2 font-medium whitespace-nowrap cursor-pointer ${
                activeTab === 'collaborators'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UsersIcon className="h-4 w-4" />
              <span>Colaboradores</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                activeTab === 'collaborators'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                  : 'bg-slate-100 dark:bg-brand-dark-800 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-gray-700'
              }`}>
                {counts?.collaborators ?? 0}
              </span>
            </button>
          </div>

          {/* Direita: Busca rápida e Filtros específicos */}
          <div className="flex items-center gap-2 pb-2">
            {activeTab === 'projects' && (
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
                className="h-8 text-xs bg-slate-50 dark:bg-brand-dark-800 border border-slate-200 dark:border-gray-700 rounded-lg px-2 text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="todos">Todos os Status</option>
                <option value="Planejamento">Planejamento</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Concluído">Concluído</option>
              </select>
            )}

            <div className="relative w-full sm:w-64">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={tabConfig.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-7 text-xs bg-slate-50 dark:bg-brand-dark-800 border border-slate-200 dark:border-gray-700 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. ÁREA OPERACIONAL EM SPLIT VIEW (Mestre - Detalhe)      */}
      {/* ========================================================= */}
      <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-brand-dark-950">
        {/* --------------------------------------------------------- */}
        {/* PAINEL ESQUERDO / CENTRAL: DATA GRID (Mestre)              */}
        {/* --------------------------------------------------------- */}
        <section className="flex-1 flex flex-col overflow-hidden p-4 min-w-0">
          <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm">
            
            {/* Tabela com Cabeçalho Fixo e Linhas de Alta Densidade */}
            <div className="flex-1 overflow-auto custom-scrollbar">
              {/* TABELA: FORNECEDORES */}
              {activeTab === 'suppliers' && (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-brand-dark-800/90 backdrop-blur-sm text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-slate-200 dark:border-gray-800 z-10">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Nome / Razão Social</th>
                      <th className="py-2.5 px-4 font-semibold whitespace-nowrap">CNPJ</th>
                      <th className="py-2.5 px-4 font-semibold">Vendedor / Contato</th>
                      <th className="py-2.5 px-4 font-semibold text-center">Avaliações</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800/60 text-xs">
                    {tabConfig.isLoading && !suppliersData ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-gray-500">
                          Carregando fornecedores...
                        </td>
                      </tr>
                    ) : !suppliersData || suppliersData.data.length === 0 ? (
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
                      suppliersData.data.map((supplier) => {
                        const isSelected = selectedSupplier?.id === supplier.id;
                        const whatsAppUrl = getWhatsAppUrl(supplier.seller_contact, supplier.seller || supplier.name);

                        return (
                          <tr
                            key={supplier.id}
                            onClick={() => setSelectedSupplier(supplier)}
                            className={`group cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-l-indigo-600'
                                : 'hover:bg-slate-50/80 dark:hover:bg-brand-dark-800/40'
                            }`}
                          >
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0 border border-indigo-100 dark:border-indigo-900/60">
                                  {supplier.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-slate-900 dark:text-white truncate" title={supplier.name}>
                                  {supplier.name}
                                </span>
                              </div>
                            </td>

                            <td className="py-2.5 px-4 whitespace-nowrap font-mono text-xs tabular-nums text-slate-600 dark:text-gray-300">
                              {formatCnpj(supplier.cnpj) || '-'}
                            </td>

                            <td className="py-2.5 px-4 text-slate-600 dark:text-gray-300">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate" title={supplier.seller || ''}>
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

                            <td className="py-2.5 px-4">
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

                            <td className="py-2.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-brand-dark-800/90 backdrop-blur-sm text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-slate-200 dark:border-gray-800 z-10">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Nome da Obra</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                      <th className="py-2.5 px-4 font-semibold">Mestre / Responsável</th>
                      <th className="py-2.5 px-4 font-semibold whitespace-nowrap">Cronograma</th>
                      <th className="py-2.5 px-4 font-semibold">Localização</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800/60 text-xs">
                    {tabConfig.isLoading && !projectsData ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-gray-500">
                          Carregando obras...
                        </td>
                      </tr>
                    ) : !projectsData || projectsData.data.length === 0 ? (
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
                      projectsData.data.map((project) => {
                        const isSelected = selectedProject?.id === project.id;

                        return (
                          <tr
                            key={project.id}
                            onClick={() => setSelectedProject(project)}
                            className={`group cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-l-indigo-600'
                                : 'hover:bg-slate-50/80 dark:hover:bg-brand-dark-800/40'
                            }`}
                          >
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0 border border-indigo-100 dark:border-indigo-900/60">
                                  {project.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-slate-900 dark:text-white truncate" title={project.name}>
                                  {project.name}
                                </span>
                              </div>
                            </td>

                            <td className="py-2.5 px-4">
                              {getProjectStatusBadge(project.status)}
                            </td>

                            <td className="py-2.5 px-4 text-slate-600 dark:text-gray-300">
                              <span className="truncate" title={project.manager || '-'}>
                                {project.manager || '-'}
                              </span>
                            </td>

                            <td className="py-2.5 px-4 whitespace-nowrap font-mono text-xs tabular-nums text-slate-500 dark:text-gray-400">
                              {project.start_date ? formatDateBR(project.start_date) : 'N/A'}
                              {' → '}
                              {project.end_date ? formatDateBR(project.end_date) : 'Em aberto'}
                            </td>

                            <td className="py-2.5 px-4 text-slate-600 dark:text-gray-300">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <MapPinIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="truncate" title={`${project.address_city || ''} - ${project.address_state || ''}`}>
                                  {project.address_city ? `${project.address_city} - ${project.address_state || ''}` : '-'}
                                </span>
                              </div>
                            </td>

                            <td className="py-2.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-brand-dark-800/90 backdrop-blur-sm text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-slate-200 dark:border-gray-800 z-10">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Nome</th>
                      <th className="py-2.5 px-4 font-semibold">Função</th>
                      <th className="py-2.5 px-4 font-semibold whitespace-nowrap">CPF / Documento</th>
                      <th className="py-2.5 px-4 font-semibold whitespace-nowrap">Contato</th>
                      <th className="py-2.5 px-4 font-semibold text-center">Avaliação</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800/60 text-xs">
                    {tabConfig.isLoading && !collaboratorsData ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-gray-500">
                          Carregando colaboradores...
                        </td>
                      </tr>
                    ) : !collaboratorsData || collaboratorsData.data.length === 0 ? (
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
                      collaboratorsData.data.map((collab) => {
                        const isSelected = selectedCollaborator?.id === collab.id;
                        const whatsAppUrl = getWhatsAppUrl(collab.phone, collab.name);

                        return (
                          <tr
                            key={collab.id}
                            onClick={() => setSelectedCollaborator(collab)}
                            className={`group cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-l-indigo-600'
                                : 'hover:bg-slate-50/80 dark:hover:bg-brand-dark-800/40'
                            }`}
                          >
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0 border border-indigo-100 dark:border-indigo-900/60">
                                  {collab.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-slate-900 dark:text-white truncate" title={collab.name}>
                                  {collab.name}
                                </span>
                              </div>
                            </td>

                            <td className="py-2.5 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-brand-dark-800 text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-gray-700/60 whitespace-nowrap">
                                {collab.role || 'Geral'}
                              </span>
                            </td>

                            <td className="py-2.5 px-4 whitespace-nowrap font-mono text-xs tabular-nums text-slate-600 dark:text-gray-300">
                              {formatDocument(collab.document)}
                            </td>

                            <td className="py-2.5 px-4 whitespace-nowrap text-slate-600 dark:text-gray-300">
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

                            <td className="py-2.5 px-4 text-center">
                              <div className="flex justify-center" title={`${collab.rating || 0} estrelas`}>
                                <StarRating rating={collab.rating} className="scale-75 origin-center" />
                              </div>
                            </td>

                            <td className="py-2.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
            </div>

            {/* Rodapé Fixo da Tabela com Paginação Compacta */}
            <div className="h-12 shrink-0 bg-white dark:bg-brand-dark-900 border-t border-slate-200 dark:border-gray-800 px-4 flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
              <div>
                <span>
                  Mostrando <strong className="text-slate-800 dark:text-white font-mono">{tabConfig.totalCount === 0 ? 0 : page * PAGE_SIZE + 1}</strong>
                  {' - '}
                  <strong className="text-slate-800 dark:text-white font-mono">
                    {Math.min((page + 1) * PAGE_SIZE, tabConfig.totalCount)}
                  </strong>
                  {' de '}
                  <strong className="text-slate-800 dark:text-white font-mono">{tabConfig.totalCount}</strong> registros
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-7 px-2.5 text-xs gap-1 border-slate-200 dark:border-gray-700"
                >
                  <ChevronLeftIcon className="h-3.5 w-3.5" />
                  <span>Anterior</span>
                </Button>

                <span className="px-2 font-mono text-[11px]">
                  Página {page + 1} de {Math.max(1, tabConfig.totalPages)}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(tabConfig.totalPages - 1, p + 1))}
                  disabled={page >= tabConfig.totalPages - 1 || tabConfig.totalPages === 0}
                  className="h-7 px-2.5 text-xs gap-1 border-slate-200 dark:border-gray-700"
                >
                  <span>Próximo</span>
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- */}
        {/* PAINEL DIREITO: INSPECTOR DRAWER (Detalhe Mestre-Detalhe) */}
        {/* --------------------------------------------------------- */}
        <aside className="w-96 xl:w-[420px] shrink-0 border-l border-slate-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900 flex flex-col overflow-hidden">
          
          {/* CASO 1: FORNECEDOR SELECIONADO */}
          {activeTab === 'suppliers' && selectedSupplier && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Header do Drawer */}
              <div className="h-14 px-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Dossiê do Fornecedor
                  </span>
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-200 text-[10px]">
                    Ativo
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSupplier(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-dark-800"
                  title="Fechar ficha de detalhes"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Conteúdo com Scroll Independente */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                {/* Bloco de Identificação */}
                <div className="flex items-start gap-3.5">
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
                  {selectedSupplier.seller_contact && getWhatsAppUrl(selectedSupplier.seller_contact, selectedSupplier.seller || selectedSupplier.name) ? (
                    <a
                      href={getWhatsAppUrl(selectedSupplier.seller_contact, selectedSupplier.seller || selectedSupplier.name)!}
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
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-brand-dark-800 dark:hover:bg-brand-dark-700 text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-gray-700 text-xs font-semibold transition-colors"
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

                {/* Seção: Performance & Auditoria */}
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

                {/* Histórico & Auditoria */}
                <div className="text-[11px] text-slate-400 dark:text-gray-500 space-y-1 pt-1">
                  <p>Cadastrado em: <span className="font-mono">{formatDateBR(selectedSupplier.created_at)}</span></p>
                  <p>ID do Registro: <span className="font-mono text-[10px]">{selectedSupplier.id}</span></p>
                </div>
              </div>

              {/* Rodapé Fixo do Drawer (Ações de Gestão) */}
              <div className="p-4 border-t border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-brand-dark-800/40 flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setModalEditSupplier(selectedSupplier);
                    setIsSupplierModalOpen(true);
                  }}
                  className="flex-1 h-8 text-xs font-semibold gap-1.5 border-slate-200 dark:border-gray-700"
                >
                  <EditIcon className="h-3.5 w-3.5 text-slate-500" />
                  <span>Editar</span>
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => {
                    setDeleteTarget({
                      id: selectedSupplier.id,
                      name: selectedSupplier.name,
                      entityName: 'Fornecedor',
                      tableName: 'suppliers',
                      queryKey: 'suppliers',
                    });
                  }}
                  className="h-8 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 dark:border-rose-900/60"
                  title="Excluir fornecedor"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigate(`/notas?busca=${encodeURIComponent(selectedSupplier.name)}`)}
                  className="h-8 text-xs font-semibold border-slate-200 dark:border-gray-700 gap-1 text-slate-700 dark:text-gray-300"
                  title="Ver Notas Fiscais vinculadas a este fornecedor"
                >
                  <span>Ver Notas</span>
                  <ExternalLinkIcon className="h-3 w-3 text-slate-400" />
                </Button>
              </div>
            </div>
          )}

          {/* CASO 2: OBRA SELECIONADA */}
          {activeTab === 'projects' && selectedProject && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Header do Drawer */}
              <div className="h-14 px-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Ficha Técnica da Obra
                  </span>
                  {getProjectStatusBadge(selectedProject.status)}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProject(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-dark-800"
                  title="Fechar ficha de detalhes"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Conteúdo com Scroll Independente */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                {/* Bloco de Identificação */}
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
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
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold transition-colors"
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

                {/* Histórico & Auditoria */}
                <div className="text-[11px] text-slate-400 dark:text-gray-500 space-y-1 pt-1">
                  <p>Criado em: <span className="font-mono">{formatDateBR(selectedProject.created_at)}</span></p>
                  <p>ID do Registro: <span className="font-mono text-[10px]">{selectedProject.id}</span></p>
                </div>
              </div>

              {/* Rodapé Fixo do Drawer (Ações de Gestão) */}
              <div className="p-4 border-t border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-brand-dark-800/40 flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setModalEditProject(selectedProject);
                    setIsProjectModalOpen(true);
                  }}
                  className="flex-1 h-8 text-xs font-semibold gap-1.5 border-slate-200 dark:border-gray-700"
                >
                  <EditIcon className="h-3.5 w-3.5 text-slate-500" />
                  <span>Editar</span>
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => {
                    setDeleteTarget({
                      id: selectedProject.id,
                      name: selectedProject.name,
                      entityName: 'Obra',
                      tableName: 'projects',
                      queryKey: 'projects',
                    });
                  }}
                  className="h-8 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 dark:border-rose-900/60"
                  title="Excluir obra"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigate(`/servicos?obra=${selectedProject.id}`)}
                  className="h-8 text-xs font-semibold border-slate-200 dark:border-gray-700 gap-1 text-slate-700 dark:text-gray-300"
                  title="Ver Ordens de Serviço desta obra"
                >
                  <span>Serviços</span>
                  <ExternalLinkIcon className="h-3 w-3 text-slate-400" />
                </Button>
              </div>
            </div>
          )}

          {/* CASO 3: COLABORADOR SELECIONADO */}
          {activeTab === 'collaborators' && selectedCollaborator && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Header do Drawer */}
              <div className="h-14 px-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Perfil do Colaborador
                  </span>
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-200 text-[10px]">
                    Equipe
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCollaborator(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-dark-800"
                  title="Fechar ficha de detalhes"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Conteúdo com Scroll Independente */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                {/* Bloco de Identificação */}
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
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
                  {selectedCollaborator.phone && getWhatsAppUrl(selectedCollaborator.phone, selectedCollaborator.name) ? (
                    <a
                      href={getWhatsAppUrl(selectedCollaborator.phone, selectedCollaborator.name)!}
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
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-brand-dark-800 dark:hover:bg-brand-dark-700 text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-gray-700 text-xs font-semibold transition-colors"
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

                {/* Seção: Dados Cadastrais */}
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

                {/* Histórico & Auditoria */}
                <div className="text-[11px] text-slate-400 dark:text-gray-500 space-y-1 pt-1">
                  <p>Cadastrado em: <span className="font-mono">{formatDateBR(selectedCollaborator.created_at)}</span></p>
                  <p>ID do Registro: <span className="font-mono text-[10px]">{selectedCollaborator.id}</span></p>
                </div>
              </div>

              {/* Rodapé Fixo do Drawer (Ações de Gestão) */}
              <div className="p-4 border-t border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-brand-dark-800/40 flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setModalEditCollaborator(selectedCollaborator);
                    setIsCollaboratorModalOpen(true);
                  }}
                  className="flex-1 h-8 text-xs font-semibold gap-1.5 border-slate-200 dark:border-gray-700"
                >
                  <EditIcon className="h-3.5 w-3.5 text-slate-500" />
                  <span>Editar</span>
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => {
                    setDeleteTarget({
                      id: selectedCollaborator.id,
                      name: selectedCollaborator.name,
                      entityName: 'Colaborador',
                      tableName: 'collaborators',
                      queryKey: 'collaborators',
                    });
                  }}
                  className="h-8 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 dark:border-rose-900/60"
                  title="Excluir colaborador"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigate(`/tarefas?responsavel=${selectedCollaborator.id}`)}
                  className="h-8 text-xs font-semibold border-slate-200 dark:border-gray-700 gap-1 text-slate-700 dark:text-gray-300"
                  title="Ver tarefas atribuídas a este colaborador"
                >
                  <span>Tarefas</span>
                  <ExternalLinkIcon className="h-3 w-3 text-slate-400" />
                </Button>
              </div>
            </div>
          )}

          {/* CASO 4: NENHUM ITEM SELECIONADO (Empty State do Inspector) */}
          {((activeTab === 'suppliers' && !selectedSupplier) ||
            (activeTab === 'projects' && !selectedProject) ||
            (activeTab === 'collaborators' && !selectedCollaborator)) && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-brand-dark-800/80 border border-slate-200 dark:border-gray-700 flex items-center justify-center text-slate-400 mb-4">
                {activeTab === 'suppliers' && <BuildingIcon className="h-7 w-7" />}
                {activeTab === 'projects' && <ConstructionIcon className="h-7 w-7" />}
                {activeTab === 'collaborators' && <UsersIcon className="h-7 w-7" />}
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-gray-200">
                Nenhum(a) {tabConfig.singular.toLowerCase()} selecionado(a)
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 max-w-xs leading-relaxed">
                Clique em qualquer linha da tabela à esquerda para inspecionar os detalhes cadastrais, contatos diretos e histórico completo.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* ========================================================= */}
      {/* 3. MODAIS OPERACIONAIS SUSPENSOS                           */}
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
