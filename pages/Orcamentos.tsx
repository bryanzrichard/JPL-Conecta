import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { useMediaQuery } from '../hooks/use-media-query';
import {
  Project,
  Collaborator,
  CATEGORIA_NOTA_ENUM,
  CategoriaNota,
  OrcamentoEtapa,
  OrcamentoItem,
  OrcamentoEtapaStatus,
  OrcamentoItemTipo,
  OrcamentoCategorySummary
} from '../types';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../components/ui/ResponsiveModal';
import {
  CalculatorIcon, PieChartIcon, PlusIcon, DownloadIcon, CopyIcon,
  Trash2Icon, EditIcon, CheckIcon, XIcon, ChevronUpIcon, ChevronDownIcon,
  ChevronRightIcon, ConstructionIcon, BuildingIcon, SparklesIcon, TrendingUpIcon,
  FilterIcon, MoreVerticalIcon, PackageIcon, SearchIcon, UserIcon, GripVerticalIcon
} from '../lib/icons';
import { formatCurrency, formatDateBR } from '../lib/utils';
import { formatApiError } from '../lib/handleError';
import { logAuditAction } from '../lib/auditLogger';

// Cores temáticas para as 11 categorias de material
const getCategoryBadgeClass = (category: string) => {
  switch (category) {
    case 'Serviços Preliminares e Terraplenagem':
      return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/[0.12] dark:text-amber-300 dark:border-amber-500/20';
    case 'Estrutura e Fundação':
      return 'bg-[#EEF2FF] text-[#4338CA] border-indigo-200/80 dark:bg-indigo-500/[0.12] dark:text-[#818CF8] dark:border-indigo-500/20';
    case 'Carpintaria e Marcenaria':
      return 'bg-amber-100/60 text-amber-900 border-amber-300/80 dark:bg-amber-600/[0.15] dark:text-amber-200 dark:border-amber-500/30';
    case 'Alvenaria e Vedação':
      return 'bg-[#FFFBEB] text-[#B45309] border-amber-200/80 dark:bg-amber-500/[0.12] dark:text-[#FBBF24] dark:border-amber-500/20';
    case 'Cobertura e Impermeabilização':
      return 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-500/[0.12] dark:text-teal-300 dark:border-teal-500/20';
    case 'Instalação Hidráulica':
      return 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-500/[0.12] dark:text-cyan-400 dark:border-cyan-500/20';
    case 'Instalação Elétrica':
      return 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-500/[0.12] dark:text-yellow-400 dark:border-yellow-500/20';
    case 'Acabamento e Revestimento':
      return 'bg-[#ECFDF5] text-[#047857] border-emerald-200/80 dark:bg-emerald-500/[0.12] dark:text-[#34D399] dark:border-emerald-500/20';
    case 'Esquadrias e Vidros':
      return 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-500/[0.12] dark:text-sky-300 dark:border-sky-500/20';
    case 'Pintura':
      return 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-500/[0.12] dark:text-purple-300 dark:border-purple-500/20';
    case 'Gastos Gerais':
    default:
      return 'bg-[#F1F5F9] text-[#475569] border-slate-200 dark:bg-slate-500/[0.12] dark:text-[#94A3B8] dark:border-slate-500/20';
  }
};

// Badges de Status da Etapa
const renderStatusBadge = (status: OrcamentoEtapaStatus) => {
  switch (status) {
    case 'Concluído':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Concluído
        </span>
      );
    case 'Em Execução':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Em Execução
        </span>
      );
    case 'Planejado':
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-gray-300 dark:border-gray-700">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Planejado
        </span>
      );
  }
};

// Interface para Etapa Enriquecida com Hierarquia e Totais
interface EnrichedSubEtapa extends OrcamentoEtapa {
  isSubPasso: true;
  parentNome?: string;
  subIndex: number;
  itens: OrcamentoItem[];
  itens_count: number;
  totalPrevisto: number;
  totalMaterial: number;
  totalMaoDeObra: number;
}

interface EnrichedMainEtapa extends OrcamentoEtapa {
  isSubPasso: false;
  subPassos: EnrichedSubEtapa[];
  itens: OrcamentoItem[];
  allStageItens: OrcamentoItem[];
  itens_count: number;
  direct_itens_count: number;
  totalPrevisto: number;
  totalMaterial: number;
  totalMaoDeObra: number;
}

export const Orcamentos: React.FC = () => {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Tab State: 'etapas' | 'categorias'
  const [activeTab, setActiveTab] = useState<'etapas' | 'categorias'>('etapas');

  // Filtros Úteis na Página
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Split View Selection: ID da etapa ou sub-passo ativo para o Inspector
  const [selectedEtapaId, setSelectedEtapaId] = useState<string | null>(null);

  // Controle de Árvore: Quais etapas principais estão expandidas (padrão: todas expandidas)
  const [expandedEtapaIds, setExpandedEtapaIds] = useState<Set<string>>(new Set());

  // Modal de Criação / Edição de Etapa ou Sub-passo
  const [isEtapaModalOpen, setIsEtapaModalOpen] = useState(false);
  const [etapaToEdit, setEtapaToEdit] = useState<OrcamentoEtapa | null>(null);
  const [etapaProjectIdInput, setEtapaProjectIdInput] = useState<string>('');
  const [etapaParentId, setEtapaParentId] = useState<string | null>(null);
  const [etapaNameInput, setEtapaNameInput] = useState('');
  const [etapaOrdemInput, setEtapaOrdemInput] = useState<number>(1);
  const [etapaStatusInput, setEtapaStatusInput] = useState<OrcamentoEtapaStatus>('Planejado');

  // Modal Copiar de Outra Obra
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceProjectId, setCopySourceProjectId] = useState<string>('');
  const [copyTargetProjectId, setCopyTargetProjectId] = useState<string>('');

  // Confirmações de Exclusão
  const [etapaToDelete, setEtapaToDelete] = useState<OrcamentoEtapa | null>(null);
  const [itemToDelete, setItemToDelete] = useState<OrcamentoItem | null>(null);

  // Form Inline de Item no Inspector
  const [newItemDescricao, setNewItemDescricao] = useState('');
  const [newItemTipo, setNewItemTipo] = useState<OrcamentoItemTipo>('material');
  const [newItemCategoria, setNewItemCategoria] = useState<CategoriaNota>('Estrutura e Fundação');
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string>('');
  const [collabSearchText, setCollabSearchText] = useState<string>('');
  const [isCollabDropdownOpen, setIsCollabDropdownOpen] = useState<boolean>(false);
  const collabDropdownRef = useRef<HTMLDivElement>(null);
  const [newItemQtd, setNewItemQtd] = useState<string>('1');
  const [newItemValorUnit, setNewItemValorUnit] = useState<string>('');

  // Drag and Drop State para Reordenar Sub-passos
  const [draggedSubId, setDraggedSubId] = useState<string | null>(null);
  const [dragOverSubId, setDragOverSubId] = useState<string | null>(null);

  // Modal Edição de Item
  const [itemToEdit, setItemToEdit] = useState<OrcamentoItem | null>(null);
  const [editItemDescricao, setEditItemDescricao] = useState('');
  const [editItemTipo, setEditItemTipo] = useState<OrcamentoItemTipo>('material');
  const [editItemCategoria, setEditItemCategoria] = useState<CategoriaNota>('Estrutura e Fundação');
  const [editItemCollaboratorId, setEditItemCollaboratorId] = useState<string>('');
  const [editCollabSearchText, setEditCollabSearchText] = useState<string>('');
  const [isEditCollabDropdownOpen, setIsEditCollabDropdownOpen] = useState<boolean>(false);
  const editCollabDropdownRef = useRef<HTMLDivElement>(null);
  const [editItemQtd, setEditItemQtd] = useState<string>('1');
  const [editItemValorUnit, setEditItemValorUnit] = useState<string>('');

  // Fechar dropdown de colaboradores ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (collabDropdownRef.current && !collabDropdownRef.current.contains(e.target as Node)) {
        setIsCollabDropdownOpen(false);
      }
      if (editCollabDropdownRef.current && !editCollabDropdownRef.current.contains(e.target as Node)) {
        setIsEditCollabDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Carregar Obras
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ['projects', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await (supabase as any)
        .from('projects')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Mapa de Obras por ID para acesso rápido
  const projectsMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  // Inicializar o filtro de obra com a primeira obra cadastrada (se houver)
  useEffect(() => {
    if (selectedProjectFilter === 'all' && projects.length > 0) {
      setSelectedProjectFilter(projects[0].id);
    }
  }, [projects]);

  // Obra ativa derivada do filtro
  const effectiveProjectId = selectedProjectFilter !== 'all' ? selectedProjectFilter : null;

  // 2. Carregar Colaboradores para Mão de Obra
  const { data: collaborators = [] } = useQuery<Collaborator[]>({
    queryKey: ['collaborators_for_orcamento', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await (supabase as any)
        .from('collaborators')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Mapa de colaboradores por ID
  const collaboratorsMap = useMemo(() => new Map(collaborators.map(c => [c.id, c])), [collaborators]);

  // 3. Carregar Etapas da Obra (ou de todas as obras da empresa)
  const { data: etapas = [], isLoading: isLoadingEtapas } = useQuery<OrcamentoEtapa[]>({
    queryKey: ['orcamento_etapas', profile?.company_id, selectedProjectFilter],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      let query = (supabase as any)
        .from('orcamento_etapas')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: true });

      if (selectedProjectFilter !== 'all') {
        query = query.eq('project_id', selectedProjectFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // 4. Carregar Todos os Itens de Orçamento da Obra (ou de todas as obras)
  const { data: allItens = [], isLoading: isLoadingItens } = useQuery<OrcamentoItem[]>({
    queryKey: ['orcamento_itens', profile?.company_id, selectedProjectFilter],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      let query = (supabase as any)
        .from('orcamento_itens')
        .select('*')
        .eq('company_id', profile.company_id);

      if (selectedProjectFilter !== 'all') {
        query = query.eq('project_id', selectedProjectFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // 5. Carregar Resumo por Categoria da RPC (quando uma obra específica estiver filtrada)
  const { data: rpcCategorySummary = [], isLoading: isLoadingRpc } = useQuery<OrcamentoCategorySummary[]>({
    queryKey: ['rpc_orcamento_category_summary', profile?.company_id, effectiveProjectId],
    queryFn: async () => {
      if (!profile?.company_id || !effectiveProjectId) return [];
      const { data, error } = await (supabase as any).rpc('get_project_budget_by_category', {
        p_company_id: profile.company_id,
        p_project_id: effectiveProjectId,
      });
      if (error) {
        console.warn('Erro ao chamar RPC get_project_budget_by_category, usando cálculo local:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!profile?.company_id && !!effectiveProjectId,
  });

  // 6. Carregar Gastos Reais de Notas Fiscais
  const { data: notasFiscaisItens = [] } = useQuery<{ category: CategoriaNota; total_price: number }[]>({
    queryKey: ['notas_itens_by_project', profile?.company_id, selectedProjectFilter],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      let nfQuery = (supabase as any)
        .from('notas_fiscais')
        .select('id')
        .eq('company_id', profile.company_id);

      if (selectedProjectFilter !== 'all') {
        nfQuery = nfQuery.eq('project_id', selectedProjectFilter);
      }

      const { data: notas, error: errNotas } = await nfQuery;
      if (errNotas || !notas || notas.length === 0) return [];

      const notaIds = notas.map((n: any) => n.id);
      const { data: itens, error: errItens } = await (supabase as any)
        .from('itens_nota_fiscal')
        .select('category, total_price')
        .in('nota_fiscal_id', notaIds);
      if (errItens) return [];

      return (itens || []).map((it: any) => ({
        category: it.category as CategoriaNota,
        total_price: Number(it.total_price) || 0,
      }));
    },
    enabled: !!profile?.company_id,
  });

  // -------------------------------------------------------------
  // ESTRUTURAÇÃO HIERÁRQUICA: ETAPAS PRINCIPAIS & SUB-PASSOS
  // -------------------------------------------------------------
  const { rawMainEtapas, rawSubPassosByParent, allEtapasMap } = useMemo(() => {
    const allMap = new Map<string, OrcamentoEtapa>();
    etapas.forEach(e => allMap.set(e.id, e));

    const mains: OrcamentoEtapa[] = [];
    const subMap = new Map<string, OrcamentoEtapa[]>();

    etapas.forEach(e => {
      // Se possui parent_id e a etapa pai existe, classifica como sub-passo
      if (e.parent_id && allMap.has(e.parent_id)) {
        const list = subMap.get(e.parent_id) || [];
        list.push(e);
        subMap.set(e.parent_id, list);
      } else {
        mains.push(e);
      }
    });

    // Ordenar sub-passos por ordem
    subMap.forEach(list => list.sort((a, b) => (a.ordem || 1) - (b.ordem || 1)));

    return { rawMainEtapas: mains, rawSubPassosByParent: subMap, allEtapasMap: allMap };
  }, [etapas]);

  // Auto-expandir todas as etapas principais uma vez no primeiro carregamento
  const hasInitializedExpand = useRef(false);
  useEffect(() => {
    if (!hasInitializedExpand.current && rawMainEtapas.length > 0) {
      setExpandedEtapaIds(new Set(rawMainEtapas.map(m => m.id)));
      hasInitializedExpand.current = true;
    }
  }, [rawMainEtapas]);

  // Alternar expansão de sub-passos
  const toggleExpand = (etapaId: string) => {
    setExpandedEtapaIds(prev => {
      const next = new Set(prev);
      if (next.has(etapaId)) next.delete(etapaId);
      else next.add(etapaId);
      return next;
    });
  };

  // Mapa de itens agrupados por etapa_id
  const itensByEtapa = useMemo(() => {
    const map = new Map<string, OrcamentoItem[]>();
    allItens.forEach(it => {
      if (it && it.etapa_id) {
        const arr = map.get(it.etapa_id) || [];
        arr.push(it);
        map.set(it.etapa_id, arr);
      }
    });
    return map;
  }, [allItens]);

  // Enriquecer Etapas Principais e Sub-passos com somas consolidadas
  const enrichedMainEtapas: EnrichedMainEtapa[] = useMemo(() => {
    return rawMainEtapas.map(main => {
      const directItens = itensByEtapa.get(main.id) || [];
      const subPassosRaw = rawSubPassosByParent.get(main.id) || [];

      // Enriquecer cada sub-passo
      const subPassosEnriched: EnrichedSubEtapa[] = subPassosRaw.map((sub, idx) => {
        const subItens = itensByEtapa.get(sub.id) || [];
        const totalPrevisto = subItens.reduce((s, it) => s + (Number(it.valor_total) || 0), 0);
        const totalMaterial = subItens.filter(it => it.tipo === 'material').reduce((s, it) => s + (Number(it.valor_total) || 0), 0);
        const totalMaoDeObra = subItens.filter(it => it.tipo === 'mao_de_obra').reduce((s, it) => s + (Number(it.valor_total) || 0), 0);
        return {
          ...sub,
          isSubPasso: true as const,
          parentNome: main.nome,
          subIndex: idx + 1,
          itens: subItens,
          itens_count: subItens.length,
          totalPrevisto,
          totalMaterial,
          totalMaoDeObra,
        };
      });

      // Totalizadores da etapa principal (itens diretos + itens de todos os sub-passos)
      const allSubItens = subPassosEnriched.flatMap(s => s.itens || []);
      const allStageItens = [...directItens, ...allSubItens];

      const directTotal = directItens.reduce((s, it) => s + (Number(it.valor_total) || 0), 0);
      const directMat = directItens.filter(it => it.tipo === 'material').reduce((s, it) => s + (Number(it.valor_total) || 0), 0);
      const directMo = directItens.filter(it => it.tipo === 'mao_de_obra').reduce((s, it) => s + (Number(it.valor_total) || 0), 0);

      const subTotal = subPassosEnriched.reduce((s, sp) => s + (Number(sp.totalPrevisto) || 0), 0);
      const subMat = subPassosEnriched.reduce((s, sp) => s + (Number(sp.totalMaterial) || 0), 0);
      const subMo = subPassosEnriched.reduce((s, sp) => s + (Number(sp.totalMaoDeObra) || 0), 0);

      return {
        ...main,
        isSubPasso: false as const,
        subPassos: subPassosEnriched,
        itens: directItens,
        allStageItens,
        itens_count: allStageItens.length,
        direct_itens_count: directItens.length,
        totalPrevisto: directTotal + subTotal,
        totalMaterial: directMat + subMat,
        totalMaoDeObra: directMo + subMo,
      };
    });
  }, [rawMainEtapas, rawSubPassosByParent, itensByEtapa]);

  // Filtragem rápida por termo de busca
  const filteredMainEtapas = useMemo(() => {
    if (!searchTerm.trim()) return enrichedMainEtapas;
    const term = searchTerm.toLowerCase();

    return enrichedMainEtapas.filter(main => {
      const matchMainName = main.nome.toLowerCase().includes(term);
      const matchSubName = (main.subPassos || []).some(sp => sp.nome.toLowerCase().includes(term));
      const matchItems = (main.allStageItens || []).some(it => it.descricao.toLowerCase().includes(term));
      return matchMainName || matchSubName || matchItems;
    });
  }, [enrichedMainEtapas, searchTerm]);

  // Selecionar a primeira etapa apenas uma vez no carregamento inicial da página
  const hasInitializedSelection = useRef(false);
  useEffect(() => {
    if (!hasInitializedSelection.current && enrichedMainEtapas.length > 0) {
      setSelectedEtapaId(enrichedMainEtapas[0].id);
      hasInitializedSelection.current = true;
    }
  }, [enrichedMainEtapas]);

  // Etapa ou sub-passo atualmente selecionado para o Inspector
  const selectedEtapaOrSub = useMemo(() => {
    if (!selectedEtapaId) return null;
    for (const main of enrichedMainEtapas) {
      if (main.id === selectedEtapaId) return main;
      for (const sub of (main.subPassos || [])) {
        if (sub.id === selectedEtapaId) return sub;
      }
    }
    return null;
  }, [enrichedMainEtapas, selectedEtapaId]);

  // Obra vinculada à etapa selecionada
  const selectedEtapaProject = useMemo(() => {
    if (!selectedEtapaOrSub) return null;
    return projectsMap.get(selectedEtapaOrSub.project_id);
  }, [selectedEtapaOrSub, projectsMap]);

  // Etapa Principal pai se o selecionado for um sub-passo
  const parentOfSelectedSub = useMemo(() => {
    if (!selectedEtapaOrSub || !(selectedEtapaOrSub as any).isSubPasso) return null;
    const parentId = (selectedEtapaOrSub as any).parent_id;
    return enrichedMainEtapas.find(m => m.id === parentId) || null;
  }, [selectedEtapaOrSub, enrichedMainEtapas]);

  // -------------------------------------------------------------
  // KPIS DINÂMICOS DA PÁGINA
  // -------------------------------------------------------------
  const kpis = useMemo(() => {
    const totalPrevisto = allItens.reduce((sum, it) => sum + (Number(it.valor_total) || 0), 0);
    const totalMaterial = allItens.filter(it => it.tipo === 'material').reduce((sum, it) => sum + (Number(it.valor_total) || 0), 0);
    const totalMaoDeObra = allItens.filter(it => it.tipo === 'mao_de_obra').reduce((sum, it) => sum + (Number(it.valor_total) || 0), 0);
    const totalRealizadoNotas = notasFiscaisItens.reduce((sum, n) => sum + (Number(n.total_price) || 0), 0);

    const percentualConsumidoMaterial = totalMaterial > 0 ? (totalRealizadoNotas / totalMaterial) * 100 : 0;
    const saldoCompras = totalMaterial - totalRealizadoNotas;

    return {
      totalPrevisto,
      totalMaterial,
      totalMaoDeObra,
      totalRealizadoNotas,
      percentualConsumidoMaterial,
      saldoCompras,
      etapasCount: rawMainEtapas.length,
      subPassosCount: Array.from(rawSubPassosByParent.values()).reduce((sum, l) => sum + l.length, 0),
      itensCount: allItens.length,
    };
  }, [allItens, notasFiscaisItens, rawMainEtapas, rawSubPassosByParent]);

  // Resumo Previsto vs Realizado por Categoria (11 Categorias consolidadas)
  const categoryComparison = useMemo(() => {
    const orcadoMap = new Map<string, { material: number;毛: number }>();
    CATEGORIA_NOTA_ENUM.forEach(cat => orcadoMap.set(cat, { material: 0, maoDeObra: 0 }));

    allItens.forEach(it => {
      const current = orcadoMap.get(it.categoria) || { material: 0, maoDeObra: 0 };
      if (it.tipo === 'material') {
        current.material += Number(it.valor_total) || 0;
      } else {
        current.maoDeObra += Number(it.valor_total) || 0;
      }
      orcadoMap.set(it.categoria, current);
    });

    const realizadoMap = new Map<string, number>();
    CATEGORIA_NOTA_ENUM.forEach(cat => realizadoMap.set(cat, 0));

    if (rpcCategorySummary.length > 0) {
      rpcCategorySummary.forEach(r => {
        if (r.categoria) {
          realizadoMap.set(r.categoria, Number(r.realizado_notas) || 0);
        }
      });
    } else {
      notasFiscaisItens.forEach(n => {
        const cur = realizadoMap.get(n.category) || 0;
        realizadoMap.set(n.category, cur + (Number(n.total_price) || 0));
      });
    }

    return CATEGORIA_NOTA_ENUM.map(cat => {
      const orcado = orcadoMap.get(cat) || { material: 0, maoDeObra: 0 };
      const realizado = realizadoMap.get(cat) || 0;
      const totalOrcado = orcado.material + orcado.maoDeObra;
      const percentualConsumido = orcado.material > 0 ? (realizado / orcado.material) * 100 : 0;
      const saldo = orcado.material - realizado;

      return {
        categoria: cat,
        orcadoMaterial: orcado.material,
        orcadoMaoDeObra: orcado.maoDeObra,
        orcadoTotal: totalOrcado,
        realizadoNotas: realizado,
        percentualConsumido,
        saldo,
      };
    });
  }, [allItens, rpcCategorySummary, notasFiscaisItens]);

  // -------------------------------------------------------------
  // MUTATIONS (CRIAR, EDITAR, EXCLUIR, REORDENAR)
  // -------------------------------------------------------------

  // Salvar Nova Etapa ou Sub-passo (Criação ou Edição)
  const saveEtapaMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error('Empresa não identificada');
      if (!etapaProjectIdInput) throw new Error('Selecione a obra de destino');
      if (!etapaNameInput.trim()) throw new Error('O nome da etapa é obrigatório');

      if (etapaToEdit) {
        // Atualização
        const updatePayload: any = {
          nome: etapaNameInput.trim(),
          ordem: etapaOrdemInput,
          status: etapaStatusInput,
        };
        if (etapaParentId !== undefined) {
          updatePayload.parent_id = etapaParentId;
        }

        const { error } = await (supabase as any)
          .from('orcamento_etapas')
          .update(updatePayload)
          .eq('id', etapaToEdit.id)
          .eq('company_id', profile.company_id);
        if (error) throw error;
        logAuditAction(profile.company_id, user?.email, 'ATUALIZAR', `Etapa Orçamento: ${etapaNameInput}`);
      } else {
        // Inserção com fallback resiliente para parent_id
        const insertPayload: any = {
          company_id: profile.company_id,
          project_id: etapaProjectIdInput,
          nome: etapaNameInput.trim(),
          ordem: etapaOrdemInput,
          status: etapaStatusInput,
          created_by: user?.id,
        };
        if (etapaParentId) {
          insertPayload.parent_id = etapaParentId;
        }

        try {
          const { data, error } = await (supabase as any)
            .from('orcamento_etapas')
            .insert(insertPayload)
            .select()
            .single();

          if (error) {
            if (error.message?.includes('parent_id') || error.code === '42703') {
              delete insertPayload.parent_id;
              insertPayload.nome = etapaParentId ? `[Sub-passo] ${etapaNameInput.trim()}` : etapaNameInput.trim();
              const { data: dRetry, error: errRetry } = await (supabase as any)
                .from('orcamento_etapas')
                .insert(insertPayload)
                .select()
                .single();
              if (errRetry) throw errRetry;
              if (dRetry) setSelectedEtapaId(dRetry.id);
            } else {
              throw error;
            }
          } else {
            if (data) {
              setSelectedEtapaId(data.id);
              if (etapaParentId) {
                setExpandedEtapaIds(prev => new Set([...prev, etapaParentId]));
              }
            }
          }
        } catch (err) {
          throw err;
        }

        logAuditAction(profile.company_id, user?.email, 'CRIAR', `Nova Etapa Orçamento: ${etapaNameInput}`);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Sucesso!',
        description: etapaToEdit ? 'Etapa atualizada com sucesso.' : 'Etapa cadastrada no planejamento executivo.',
      });
      queryClient.invalidateQueries({ queryKey: ['orcamento_etapas'] });
      setIsEtapaModalOpen(false);
      setEtapaToEdit(null);
      setEtapaNameInput('');
      setEtapaParentId(null);
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Erro ao salvar etapa', description: formatApiError(err) });
    },
  });

  // Reordenar Sub-passos via Drag and Drop
  const reorderSubEtapasMutation = useMutation({
    mutationFn: async ({ parentId, reorderedSubs }: { parentId: string; reorderedSubs: { id: string; ordem: number }[] }) => {
      if (!profile?.company_id) return;
      const updates = reorderedSubs.map(sub =>
        (supabase as any)
          .from('orcamento_etapas')
          .update({ ordem: sub.ordem })
          .eq('id', sub.id)
          .eq('company_id', profile.company_id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamento_etapas'] });
      toast({ title: 'Ordem atualizada!', description: 'Sub-passos reordenados com sucesso.' });
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Erro ao reordenar', description: formatApiError(err) });
    },
  });

  // Handler para reordenar sub-passos
  const handleReorderSubs = (parentId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const parent = enrichedMainEtapas.find(m => m.id === parentId);
    if (!parent) return;

    const list = [...parent.subPassos];
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);

    const reorderedSubs = list.map((sub, idx) => ({
      id: sub.id,
      ordem: idx + 1,
    }));

    reorderSubEtapasMutation.mutate({ parentId, reorderedSubs });
  };

  // Atualizar Status Rápido da Etapa
  const updateEtapaStatusMutation = useMutation({
    mutationFn: async ({ etapaId, status }: { etapaId: string; status: OrcamentoEtapaStatus }) => {
      if (!profile?.company_id) return;
      const { error } = await (supabase as any)
        .from('orcamento_etapas')
        .update({ status })
        .eq('id', etapaId)
        .eq('company_id', profile.company_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamento_etapas'] });
    },
  });

  // Excluir Etapa (exclui itens e sub-passos filhos)
  const deleteEtapaMutation = useMutation({
    mutationFn: async (etapa: OrcamentoEtapa) => {
      if (!profile?.company_id) return;

      // 1. Excluir itens vinculados a esta etapa
      try {
        await (supabase as any)
          .from('orcamento_itens')
          .delete()
          .eq('etapa_id', etapa.id)
          .eq('company_id', profile.company_id);
      } catch (e) {
        console.warn('Erro ao limpar itens da etapa:', e);
      }

      // 2. Se for etapa principal, excluir sub-passos vinculados
      const subPassos = rawSubPassosByParent.get(etapa.id) || [];
      for (const sub of subPassos) {
        try {
          await (supabase as any)
            .from('orcamento_itens')
            .delete()
            .eq('etapa_id', sub.id)
            .eq('company_id', profile.company_id);
          await (supabase as any)
            .from('orcamento_etapas')
            .delete()
            .eq('id', sub.id)
            .eq('company_id', profile.company_id);
        } catch (e) {
          console.warn('Erro ao limpar sub-passo:', e);
        }
      }

      // 3. Excluir a própria etapa
      const { error } = await (supabase as any)
        .from('orcamento_etapas')
        .delete()
        .eq('id', etapa.id)
        .eq('company_id', profile.company_id);
      if (error) throw error;

      logAuditAction(profile.company_id, user?.email, 'EXCLUIR', `Etapa Orçamento: ${etapa.nome}`);
    },
    onSuccess: () => {
      toast({ title: 'Etapa excluída', description: 'A etapa e seus vínculos foram removidos.' });
      queryClient.invalidateQueries({ queryKey: ['orcamento_etapas'] });
      queryClient.invalidateQueries({ queryKey: ['orcamento_itens'] });
      queryClient.invalidateQueries({ queryKey: ['rpc_orcamento_category_summary'] });
      if (selectedEtapaId === etapaToDelete?.id) {
        setSelectedEtapaId(null);
      }
      setEtapaToDelete(null);
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: formatApiError(err) });
      setEtapaToDelete(null);
    },
  });

  // Adicionar Insumo Rápido na Etapa / Sub-passo Selecionado
  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id || !selectedEtapaOrSub) throw new Error('Etapa não selecionada');
      if (!newItemDescricao.trim()) throw new Error('Descrição do insumo ou serviço é obrigatória');

      const targetProjectId = selectedEtapaOrSub.project_id;
      const qtd = parseFloat(newItemQtd.replace(',', '.')) || 1;
      const unit = parseFloat(newItemValorUnit.replace(/\./g, '').replace(',', '.')) || 0;
      const total = qtd * unit;

      const itemPayload: any = {
        company_id: profile.company_id,
        project_id: targetProjectId,
        etapa_id: selectedEtapaOrSub.id,
        descricao: newItemDescricao.trim(),
        tipo: newItemTipo,
        categoria: newItemTipo === 'material' ? newItemCategoria : 'Gastos Gerais',
        quantidade: qtd,
        valor_unitario: unit,
      };

      if (newItemTipo === 'mao_de_obra' && selectedCollaboratorId) {
        itemPayload.collaborator_id = selectedCollaboratorId;
      }

      try {
        const { error } = await (supabase as any).from('orcamento_itens').insert(itemPayload);
        if (error) {
          if (error.message?.includes('collaborator_id') || error.code === '42703') {
            const collab = collaboratorsMap.get(selectedCollaboratorId);
            delete itemPayload.collaborator_id;
            if (collab) {
              itemPayload.descricao = `[${collab.name}] ${newItemDescricao.trim()}`;
            }
            const { error: errRetry } = await (supabase as any).from('orcamento_itens').insert(itemPayload);
            if (errRetry) throw errRetry;
          } else {
            throw error;
          }
        }
      } catch (err) {
        throw err;
      }

      logAuditAction(profile.company_id, user?.email, 'CRIAR', `Item Orçamento: ${newItemDescricao} (R$ ${total})`);
    },
    onSuccess: () => {
      toast({ title: 'Item adicionado!', description: 'Gasto orçado registrado com sucesso.' });
      queryClient.invalidateQueries({ queryKey: ['orcamento_itens'] });
      queryClient.invalidateQueries({ queryKey: ['rpc_orcamento_category_summary'] });
      setNewItemDescricao('');
      setNewItemValorUnit('');
      setNewItemQtd('1');
      setSelectedCollaboratorId('');
      setCollabSearchText('');
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Erro ao adicionar item', description: formatApiError(err) });
    },
  });

  // Salvar Edição de Item
  const saveEditItemMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id || !itemToEdit) return;
      const qtd = parseFloat(editItemQtd.replace(',', '.')) || 1;
      const unit = parseFloat(editItemValorUnit.replace(/\./g, '').replace(',', '.')) || 0;

      const updatePayload: any = {
        descricao: editItemDescricao.trim(),
        tipo: editItemTipo,
        categoria: editItemTipo === 'material' ? editItemCategoria : 'Gastos Gerais',
        quantidade: qtd,
        valor_unitario: unit,
      };

      if (editItemTipo === 'mao_de_obra') {
        updatePayload.collaborator_id = editItemCollaboratorId || null;
      }

      try {
        const { error } = await (supabase as any)
          .from('orcamento_itens')
          .update(updatePayload)
          .eq('id', itemToEdit.id)
          .eq('company_id', profile.company_id);
        if (error) {
          if (error.message?.includes('collaborator_id') || error.code === '42703') {
            delete updatePayload.collaborator_id;
            const { error: errRetry } = await (supabase as any)
              .from('orcamento_itens')
              .update(updatePayload)
              .eq('id', itemToEdit.id)
              .eq('company_id', profile.company_id);
            if (errRetry) throw errRetry;
          } else {
            throw error;
          }
        }
      } catch (err) {
        throw err;
      }
    },
    onSuccess: () => {
      toast({ title: 'Item atualizado!', description: 'Alterações salvas com sucesso.' });
      queryClient.invalidateQueries({ queryKey: ['orcamento_itens'] });
      queryClient.invalidateQueries({ queryKey: ['rpc_orcamento_category_summary'] });
      setItemToEdit(null);
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Erro ao editar item', description: formatApiError(err) });
    },
  });

  // Excluir Item
  const deleteItemMutation = useMutation({
    mutationFn: async (item: OrcamentoItem) => {
      if (!profile?.company_id) return;
      const { error } = await (supabase as any)
        .from('orcamento_itens')
        .delete()
        .eq('id', item.id)
        .eq('company_id', profile.company_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Item removido', description: 'Item excluído com sucesso.' });
      queryClient.invalidateQueries({ queryKey: ['orcamento_itens'] });
      queryClient.invalidateQueries({ queryKey: ['rpc_orcamento_category_summary'] });
      setItemToDelete(null);
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Erro ao excluir item', description: formatApiError(err) });
      setItemToDelete(null);
    },
  });

  // Copiar Orçamento de Outra Obra (Clonagem com Preservação de Sub-passos)
  const copyBudgetMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id || !copySourceProjectId || !copyTargetProjectId) {
        throw new Error('Selecione a obra de origem e a obra de destino.');
      }
      if (copySourceProjectId === copyTargetProjectId) {
        throw new Error('A obra de origem deve ser diferente da obra de destino.');
      }

      // 1. Carregar etapas da obra de origem
      const { data: sourceEtapas, error: errEtapas } = await (supabase as any)
        .from('orcamento_etapas')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('project_id', copySourceProjectId)
        .order('ordem', { ascending: true });
      if (errEtapas) throw errEtapas;
      if (!sourceEtapas || sourceEtapas.length === 0) {
        throw new Error('A obra de origem não possui etapas cadastradas.');
      }

      // 2. Carregar itens da obra de origem
      const { data: sourceItens, error: errItens } = await (supabase as any)
        .from('orcamento_itens')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('project_id', copySourceProjectId);
      if (errItens) throw errItens;

      // 3. Separar principais e sub-passos
      const sourceMains = sourceEtapas.filter((e: any) => !e.parent_id);
      const sourceSubs = sourceEtapas.filter((e: any) => !!e.parent_id);

      const oldToNewEtapaId = new Map<string, string>();
      let totalClonedItens = 0;

      // Clonar etapas principais primeiro
      for (const sEtapa of sourceMains) {
        const { data: newMain, error: errMain } = await (supabase as any)
          .from('orcamento_etapas')
          .insert({
            company_id: profile.company_id,
            project_id: copyTargetProjectId,
            nome: sEtapa.nome,
            ordem: sEtapa.ordem,
            status: 'Planejado',
            created_by: user?.id,
          })
          .select()
          .single();
        if (errMain) throw errMain;
        oldToNewEtapaId.set(sEtapa.id, newMain.id);

        // Inserir itens diretos da etapa principal
        const itensForMain = (sourceItens || []).filter((it: any) => it.etapa_id === sEtapa.id);
        if (itensForMain.length > 0) {
          const payload = itensForMain.map((it: any) => ({
            company_id: profile.company_id,
            project_id: copyTargetProjectId,
            etapa_id: newMain.id,
            descricao: it.descricao,
            tipo: it.tipo,
            categoria: it.categoria,
            collaborator_id: it.collaborator_id || null,
            quantidade: it.quantidade,
            valor_unitario: it.valor_unitario,
          }));
          const { error: errInsertItens } = await (supabase as any).from('orcamento_itens').insert(payload);
          if (errInsertItens) throw errInsertItens;
          totalClonedItens += payload.length;
        }
      }

      // Clonar sub-passos vinculando ao novo ID pai
      for (const sSub of sourceSubs) {
        const newParentId = oldToNewEtapaId.get(sSub.parent_id);
        const subPayload: any = {
          company_id: profile.company_id,
          project_id: copyTargetProjectId,
          nome: sSub.nome,
          ordem: sSub.ordem,
          status: 'Planejado',
          created_by: user?.id,
        };
        if (newParentId) subPayload.parent_id = newParentId;

        const { data: newSub, error: errSub } = await (supabase as any)
          .from('orcamento_etapas')
          .insert(subPayload)
          .select()
          .single();
        if (errSub) throw errSub;
        oldToNewEtapaId.set(sSub.id, newSub.id);

        // Inserir itens do sub-passo
        const itensForSub = (sourceItens || []).filter((it: any) => it.etapa_id === sSub.id);
        if (itensForSub.length > 0) {
          const payload = itensForSub.map((it: any) => ({
            company_id: profile.company_id,
            project_id: copyTargetProjectId,
            etapa_id: newSub.id,
            descricao: it.descricao,
            tipo: it.tipo,
            categoria: it.categoria,
            collaborator_id: it.collaborator_id || null,
            quantidade: it.quantidade,
            valor_unitario: it.valor_unitario,
          }));
          const { error: errInsertItens } = await (supabase as any).from('orcamento_itens').insert(payload);
          if (errInsertItens) throw errInsertItens;
          totalClonedItens += payload.length;
        }
      }

      logAuditAction(profile.company_id, user?.email, 'CRIAR', `Orçamento clonado de ${copySourceProjectId} para ${copyTargetProjectId}`);
      return { etapasCount: sourceEtapas.length, itensCount: totalClonedItens };
    },
    onSuccess: (res) => {
      toast({
        title: 'Orçamento clonado com sucesso!',
        description: `${res.etapasCount} etapas e ${res.itensCount} insumos duplicados na obra de destino.`,
      });
      queryClient.invalidateQueries({ queryKey: ['orcamento_etapas'] });
      queryClient.invalidateQueries({ queryKey: ['orcamento_itens'] });
      queryClient.invalidateQueries({ queryKey: ['rpc_orcamento_category_summary'] });
      setIsCopyModalOpen(false);
      if (copyTargetProjectId) setSelectedProjectFilter(copyTargetProjectId);
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Erro ao clonar orçamento', description: formatApiError(err) });
    },
  });

  // Exportar Planilha em CSV com UTF-8 BOM
  const handleExportCsv = () => {
    try {
      let csvContent = '\uFEFF';
      csvContent += 'Obra;Tipo;Etapa Principal;Sub-passo;Status;Descricao;Tipo Insumo;Categoria / Prestador;Quantidade;Valor Unitario (R$);Valor Total (R$)\r\n';

      enrichedMainEtapas.forEach((main) => {
        const projectName = projectsMap.get(main.project_id)?.name || 'Obra';

        // Itens diretos da etapa principal
        (main.itens || []).forEach((it) => {
          const prestadorOuCat = it.tipo === 'mao_de_obra'
            ? (collaboratorsMap.get(it.collaborator_id || '')?.name || 'Mão de Obra')
            : it.categoria;

          csvContent += `"${projectName}";"Etapa Principal";"${main.nome}";"-";"${main.status}";"${it.descricao.replace(/"/g, '""')}";"${it.tipo === 'material' ? 'Material' : 'Mão de Obra'}";"${prestadorOuCat}";"${it.quantidade}";"${it.valor_unitario.toFixed(2)}";"${it.valor_total.toFixed(2)}"\r\n`;
        });

        // Sub-passos e seus itens
        (main.subPassos || []).forEach((sub) => {
          (sub.itens || []).forEach((it) => {
            const prestadorOuCat = it.tipo === 'mao_de_obra'
              ? (collaboratorsMap.get(it.collaborator_id || '')?.name || 'Mão de Obra')
              : it.categoria;

            csvContent += `"${projectName}";"Sub-passo";"${main.nome}";"${sub.nome}";"${sub.status}";"${it.descricao.replace(/"/g, '""')}";"${it.tipo === 'material' ? 'Material' : 'Mão de Obra'}";"${prestadorOuCat}";"${it.quantidade}";"${it.valor_unitario.toFixed(2)}";"${it.valor_total.toFixed(2)}"\r\n`;
          });
        });
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `orcamento_planejamento_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: 'Exportado!', description: 'Arquivo CSV gerado com sucesso.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao exportar', description: 'Não foi possível gerar a planilha.' });
    }
  };

  // Abrir Modal para Criar Nova Etapa Principal (com auto-ordem sequencial)
  const handleOpenNewEtapa = () => {
    const targetProj = effectiveProjectId || (projects[0]?.id || '');
    const existingMains = rawMainEtapas.filter(m => m.project_id === targetProj);
    const nextOrdem = existingMains.length > 0 ? Math.max(...existingMains.map(m => m.ordem || 0)) + 1 : 1;

    setEtapaToEdit(null);
    setEtapaProjectIdInput(targetProj);
    setEtapaParentId(null);
    setEtapaNameInput('');
    setEtapaOrdemInput(nextOrdem);
    setEtapaStatusInput('Planejado');
    setIsEtapaModalOpen(true);
  };

  // Abrir Modal para Criar Sub-passo vinculado a uma Etapa Principal (com auto-ordem sequencial)
  const handleOpenNewSubPasso = (parentEtapa: EnrichedMainEtapa) => {
    const existingSubs = rawSubPassosByParent.get(parentEtapa.id) || [];
    const nextSubOrdem = existingSubs.length > 0 ? Math.max(...existingSubs.map(s => s.ordem || 0)) + 1 : 1;

    setEtapaToEdit(null);
    setEtapaProjectIdInput(parentEtapa.project_id);
    setEtapaParentId(parentEtapa.id);
    setEtapaNameInput('');
    setEtapaOrdemInput(nextSubOrdem);
    setEtapaStatusInput('Planejado');
    setIsEtapaModalOpen(true);
  };

  // Abrir Modal de Editar Etapa
  const handleOpenEditEtapa = (etapa: OrcamentoEtapa) => {
    setEtapaToEdit(etapa);
    setEtapaProjectIdInput(etapa.project_id);
    setEtapaParentId(etapa.parent_id || null);
    setEtapaNameInput(etapa.nome);
    setEtapaOrdemInput(etapa.ordem || 1);
    setEtapaStatusInput(etapa.status);
    setIsEtapaModalOpen(true);
  };

  // Abrir Modal de Edição de Item
  const handleOpenEditItem = (item: OrcamentoItem) => {
    setItemToEdit(item);
    setEditItemDescricao(item.descricao);
    setEditItemTipo(item.tipo);
    setEditItemCategoria(item.categoria);
    setEditItemCollaboratorId(item.collaborator_id || '');
    const collab = item.collaborator_id ? collaboratorsMap.get(item.collaborator_id) : null;
    setEditCollabSearchText(collab ? `${collab.name}${collab.role ? ` (${collab.role})` : ''}` : '');
    setEditItemQtd(String(item.quantidade));
    setEditItemValorUnit(String(item.valor_unitario));
  };

  // Sub-passos da etapa principal selecionada (se for etapa principal)
  const currentSubPassos = useMemo(() => {
    if (!selectedEtapaOrSub || (selectedEtapaOrSub as any).isSubPasso) return [];
    return (selectedEtapaOrSub as EnrichedMainEtapa).subPassos || [];
  }, [selectedEtapaOrSub]);

  return (
    <div className="w-full px-3 sm:px-5 lg:px-6 py-4 space-y-4 animate-in fade-in-50">
      {/* ========================================================= */}
      {/* 1. CABEÇALHO & AÇÕES RÁPIDAS                              */}
      {/* ========================================================= */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-1 border-b border-slate-200/80 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
            <CalculatorIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-[#F8FAFC] tracking-tight">
              Orçamentos & Planejamento
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
              Estrutura Analítica (EAP), sub-passos executivos, insumos e conciliação por categoria.
            </p>
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCopySourceProjectId(effectiveProjectId || projects[0]?.id || '');
              setCopyTargetProjectId('');
              setIsCopyModalOpen(true);
            }}
            disabled={projects.length <= 1}
            className="h-8 text-xs font-semibold border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-brand-dark-800 gap-1.5 cursor-pointer"
            title="Copiar estrutura de etapas e insumos de outra obra"
          >
            <CopyIcon className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Copiar Orçamento</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={enrichedMainEtapas.length === 0}
            className="h-8 text-xs font-semibold border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-brand-dark-800 gap-1.5 cursor-pointer"
            title="Exportar planilha de orçamento em CSV"
          >
            <DownloadIcon className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenNewEtapa}
            disabled={projects.length === 0}
            className="h-8 text-xs font-bold bg-[#4F46E5] hover:bg-indigo-600 dark:bg-[#6366F1] dark:hover:bg-indigo-500 text-white gap-1.5 shadow-sm shadow-indigo-600/30 cursor-pointer"
          >
            <PlusIcon className="h-4 w-4" />
            <span>+ Nova Etapa</span>
          </Button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. BARRA DE FERRAMENTAS & FILTROS ÚTEIS NA PÁGINA         */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl p-2.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Abas de Visualização (Etapas vs Categorias) */}
        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#162235] p-1 border border-slate-200/80 dark:border-[#273549]">
          <button
            type="button"
            onClick={() => setActiveTab('etapas')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'etapas'
                ? 'bg-white dark:bg-[#1E293B] text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ConstructionIcon className="h-3.5 w-3.5" />
            <span>Por Etapas & Sub-passos ({filteredMainEtapas.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categorias')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'categorias'
                ? 'bg-white dark:bg-[#1E293B] text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PieChartIcon className="h-3.5 w-3.5" />
            <span>Previsto vs. Realizado (11 Categorias)</span>
          </button>
        </div>

        {/* Filtros da Página: Obra Ativa e Busca Textual */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor Rápido de Obra */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549]">
            <BuildingIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400">Obra:</span>
            <select
              value={selectedProjectFilter}
              onChange={(e) => {
                setSelectedProjectFilter(e.target.value);
                setSelectedEtapaId(null);
              }}
              className="text-xs font-bold bg-transparent text-slate-800 dark:text-white focus:outline-none cursor-pointer max-w-[220px] truncate"
            >
              <option value="all">Todas as Obras ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative">
            <SearchIcon className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar etapa, sub-passo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. CARDS DE KPIS DO ORÇAMENTO                             */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Orçamento Total */}
        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <CalculatorIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">Orçamento Total Previsto</p>
              <p className="text-lg font-bold text-slate-800 dark:text-[#F8FAFC] truncate font-mono">
                {formatCurrency(kpis.totalPrevisto)}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-gray-700 whitespace-nowrap shrink-0">
            {kpis.etapasCount} etapas • {kpis.subPassosCount} sub-passos
          </span>
        </div>

        {/* Card 2: Material vs Mão de Obra */}
        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <PieChartIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">Material vs. Mão de Obra</p>
              <div className="flex items-center gap-2 text-xs font-mono font-bold mt-0.5 truncate">
                <span className="text-indigo-600 dark:text-indigo-400" title="Total Material">
                  Mat: {formatCurrency(kpis.totalMaterial)}
                </span>
                <span className="text-slate-300 dark:text-gray-600">|</span>
                <span className="text-emerald-600 dark:text-emerald-400" title="Total Mão de Obra">
                  M.O: {formatCurrency(kpis.totalMaoDeObra)}
                </span>
              </div>
            </div>
          </div>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shrink-0">
            {kpis.totalPrevisto > 0 ? `${Math.round((kpis.totalMaterial / kpis.totalPrevisto) * 100)}% Mat` : '0%'}
          </span>
        </div>

        {/* Card 3: Gasto Realizado em Notas */}
        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <TrendingUpIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">Gasto Realizado em Notas</p>
              <p className="text-lg font-bold text-slate-800 dark:text-[#F8FAFC] truncate font-mono">
                {formatCurrency(kpis.totalRealizadoNotas)}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-gray-700 whitespace-nowrap shrink-0">
            {kpis.percentualConsumidoMaterial.toFixed(1)}% consumido
          </span>
        </div>

        {/* Card 4: Saldo Disponível para Compras */}
        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
              kpis.saldoCompras >= 0
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-600'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-600'
            }`}>
              <SparklesIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">Saldo p/ Compras de Material</p>
              <p className={`text-lg font-bold truncate font-mono ${
                kpis.saldoCompras >= 0 ? 'text-slate-800 dark:text-[#F8FAFC]' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {formatCurrency(kpis.saldoCompras)}
              </p>
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${
            kpis.saldoCompras >= 0
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400'
          }`}>
            {kpis.saldoCompras >= 0 ? 'Saldo Positivo' : 'Estourado'}
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ABA 1: VISÃO POR ETAPAS & SUB-PASSOS EM SPLIT VIEW        */}
      {/* ========================================================= */}
      {activeTab === 'etapas' && (
        <div className="space-y-0">
          {/* Barra Superior Colada na Tabela */}
          <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-t-xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC]">
                Cronograma Executivo & Sub-passos
              </span>
              <span className="text-xs text-slate-400">
                ({filteredMainEtapas.length} etapas principais)
              </span>
            </div>

            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Clique em uma etapa ou sub-passo para abrir o painel de insumos à direita
            </span>
          </div>

          {/* Área em Split View Retrátil Inline */}
          <div className={`overflow-hidden rounded-b-xl border-x border-b border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111827] shadow-xs flex flex-col lg:flex-row ${
            selectedEtapaOrSub && isDesktop ? 'items-stretch' : ''
          }`}>
            {/* ----------------------------------------------------- */}
            {/* LADO ESQUERDO: TABELA RETRÁTIL EM ÁRVORE               */}
            {/* ----------------------------------------------------- */}
            <div className={`flex flex-col ${
              selectedEtapaOrSub && isDesktop
                ? 'w-full lg:w-[48%] xl:w-[46%] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-gray-800'
                : 'w-full'
            }`}>
              <div className={`flex-1 overflow-x-auto ${selectedEtapaOrSub && isDesktop ? 'max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar' : ''}`}>
                <table className="w-full text-sm text-left text-slate-600 dark:text-gray-400">
                  <thead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] bg-slate-50 dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#1E293B] sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-3 font-semibold">Etapa & Sub-passos</th>
                      <th className="px-2 py-3 font-semibold">Status</th>
                      <th className={selectedEtapaOrSub && isDesktop ? 'hidden' : 'px-3 py-3 font-semibold text-right whitespace-nowrap'}>Material</th>
                      <th className={selectedEtapaOrSub && isDesktop ? 'hidden' : 'px-3 py-3 font-semibold text-right whitespace-nowrap'}>Mão de Obra</th>
                      <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Total</th>
                      <th className="px-2 py-3 font-semibold text-center w-20">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800/80 bg-white dark:bg-[#111827]">
                    {isLoadingEtapas ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-gray-500">
                          Carregando cronograma executivo...
                        </td>
                      </tr>
                    ) : filteredMainEtapas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center">
                          <div className="max-w-xs mx-auto space-y-2">
                            <CalculatorIcon className="h-8 w-8 mx-auto text-slate-300 dark:text-gray-600" />
                            <p className="font-semibold text-slate-700 dark:text-gray-300">Nenhuma etapa encontrada</p>
                            <p className="text-slate-400 text-xs">
                              Crie sua primeira etapa executiva para esta obra.
                            </p>
                            <Button size="sm" onClick={handleOpenNewEtapa} className="mt-2 bg-indigo-600 text-white cursor-pointer">
                              + Nova Etapa
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredMainEtapas.map((main) => {
                        const isMainSelected = selectedEtapaOrSub?.id === main.id;
                        const isExpanded = expandedEtapaIds.has(main.id);
                        const hasSubPassos = (main.subPassos || []).length > 0;
                        const projectName = projectsMap.get(main.project_id)?.name;

                        return (
                          <React.Fragment key={main.id}>
                            {/* LINHA DA ETAPA PRINCIPAL */}
                            <tr
                              id={`etapa-row-${main.id}`}
                              onClick={() => setSelectedEtapaId(main.id)}
                              className={`group transition-colors cursor-pointer ${
                                isMainSelected
                                  ? 'bg-[#F5F3FF] dark:bg-indigo-500/[0.12] border-l-4 border-[#818CF8]'
                                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'
                              }`}
                            >
                              {/* Nome da Etapa Principal com Botão de Expandir */}
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  {/* Botão de Toggle de Sub-passos */}
                                  {hasSubPassos ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleExpand(main.id);
                                      }}
                                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-500 dark:text-gray-400 cursor-pointer"
                                      title={isExpanded ? 'Recolher sub-passos' : 'Expandir sub-passos'}
                                    >
                                      {isExpanded ? (
                                        <ChevronDownIcon className="h-3.5 w-3.5" />
                                      ) : (
                                        <ChevronRightIcon className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="w-5" />
                                  )}

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-xs text-slate-800 dark:text-[#F8FAFC]">
                                        {main.ordem}. {main.nome}
                                      </span>
                                      {hasSubPassos && (
                                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300">
                                          {main.subPassos.length} sub-passos
                                        </span>
                                      )}
                                    </div>
                                    {selectedProjectFilter === 'all' && projectName && (
                                      <p className="text-[10px] text-slate-400 mt-0.5 truncate flex items-center gap-1">
                                        <BuildingIcon className="h-2.5 w-2.5" /> {projectName}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Status */}
                              <td className="px-2 py-2.5 whitespace-nowrap">
                                {renderStatusBadge(main.status)}
                              </td>

                              {/* Material */}
                              <td className={selectedEtapaOrSub && isDesktop ? 'hidden' : 'px-3 py-2.5 text-right font-mono text-xs text-indigo-600 dark:text-indigo-400 whitespace-nowrap'}>
                                {formatCurrency(main.totalMaterial)}
                              </td>

                              {/* Mão de Obra */}
                              <td className={selectedEtapaOrSub && isDesktop ? 'hidden' : 'px-3 py-2.5 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap'}>
                                {formatCurrency(main.totalMaoDeObra)}
                              </td>

                              {/* Total Previsto */}
                              <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                {formatCurrency(main.totalPrevisto)}
                              </td>

                              {/* Ações */}
                              <td className="px-2 py-2.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1">
                                  {/* Botão Rápido + Sub-passo */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenNewSubPasso(main);
                                    }}
                                    className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                                    title="Adicionar sub-passo dentro desta etapa"
                                  >
                                    <PlusIcon className="h-3.5 w-3.5" />
                                  </button>
                                  {/* Editar */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditEtapa(main);
                                    }}
                                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-brand-dark-800 text-slate-400 hover:text-slate-700 cursor-pointer"
                                    title="Editar etapa"
                                  >
                                    <EditIcon className="h-3.5 w-3.5" />
                                  </button>
                                  {/* Excluir */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEtapaToDelete(main);
                                    }}
                                    className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 cursor-pointer"
                                    title="Excluir etapa e seus sub-passos"
                                  >
                                    <Trash2Icon className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* LINHAS DOS SUB-PASSOS (QUANDO EXPANDIDO) */}
                            {isExpanded && (main.subPassos || []).map((sub) => {
                              const isSubSelected = selectedEtapaOrSub?.id === sub.id;

                              return (
                                <tr
                                  key={sub.id}
                                  id={`etapa-row-${sub.id}`}
                                  onClick={() => setSelectedEtapaId(sub.id)}
                                  className={`group transition-colors cursor-pointer bg-slate-50/40 dark:bg-slate-900/30 ${
                                    isSubSelected
                                      ? 'bg-[#F5F3FF] dark:bg-indigo-500/[0.12] border-l-4 border-[#818CF8]'
                                      : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                                  }`}
                                >
                                  {/* Nome Indentado com Conector Visual de Árvore */}
                                  <td className="px-3 py-2 pl-9">
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-300 dark:text-gray-600 font-mono text-xs select-none">
                                        └─
                                      </span>
                                      <span className="font-medium text-xs text-slate-700 dark:text-gray-200">
                                        {main.ordem}.{sub.subIndex} {sub.nome}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        ({sub.itens_count} insumos)
                                      </span>
                                    </div>
                                  </td>

                                  {/* Status do Sub-passo */}
                                  <td className="px-2 py-2 whitespace-nowrap">
                                    {renderStatusBadge(sub.status)}
                                  </td>

                                  {/* Material */}
                                  <td className={selectedEtapaOrSub && isDesktop ? 'hidden' : 'px-3 py-2 text-right font-mono text-xs text-indigo-500 dark:text-indigo-400 whitespace-nowrap'}>
                                    {formatCurrency(sub.totalMaterial)}
                                  </td>

                                  {/* Mão de Obra */}
                                  <td className={selectedEtapaOrSub && isDesktop ? 'hidden' : 'px-3 py-2 text-right font-mono text-xs text-emerald-500 dark:text-emerald-400 whitespace-nowrap'}>
                                    {formatCurrency(sub.totalMaoDeObra)}
                                  </td>

                                  {/* Total do Sub-passo */}
                                  <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-slate-700 dark:text-gray-200 whitespace-nowrap">
                                    {formatCurrency(sub.totalPrevisto)}
                                  </td>

                                  {/* Ações do Sub-passo */}
                                  <td className="px-2 py-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenEditEtapa(sub);
                                        }}
                                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-brand-dark-800 text-slate-400 hover:text-slate-700 cursor-pointer"
                                        title="Editar sub-passo"
                                      >
                                        <EditIcon className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEtapaToDelete(sub);
                                        }}
                                        className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 cursor-pointer"
                                        title="Excluir sub-passo"
                                      >
                                        <Trash2Icon className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ----------------------------------------------------- */}
            {/* LADO DIREITO: INSPECTOR INLINE DE INSUMOS & MÃO DE OBRA */}
            {/* ----------------------------------------------------- */}
            {selectedEtapaOrSub && (
              <div className="w-full lg:w-[52%] xl:w-[54%] p-4 space-y-4 bg-white dark:bg-[#111827] flex flex-col justify-between">
                <div className="space-y-3.5">
                  {/* Cabeçalho do Inspector */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-gray-800">
                    <div className="min-w-0">
                      {/* Breadcrumb de navegação de volta se for sub-passo */}
                      {(selectedEtapaOrSub as any).isSubPasso && parentOfSelectedSub && (
                        <button
                          type="button"
                          onClick={() => setSelectedEtapaId(parentOfSelectedSub.id)}
                          className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 mb-1.5 cursor-pointer"
                        >
                          ← Voltar para {parentOfSelectedSub.ordem}. {parentOfSelectedSub.nome}
                        </button>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          (selectedEtapaOrSub as any).isSubPasso
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300'
                        }`}>
                          {(selectedEtapaOrSub as any).isSubPasso ? 'Sub-passo Executivo' : 'Etapa Principal'}
                        </span>
                        {selectedEtapaProject && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <BuildingIcon className="h-3 w-3" /> {selectedEtapaProject.name}
                          </span>
                        )}
                      </div>
                      <h2 className="text-base font-bold text-slate-800 dark:text-white mt-1">
                        {selectedEtapaOrSub.nome}
                      </h2>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Seletor Rápido de Status */}
                      <select
                        value={selectedEtapaOrSub.status}
                        onChange={(e) => updateEtapaStatusMutation.mutate({ etapaId: selectedEtapaOrSub.id, status: e.target.value as OrcamentoEtapaStatus })}
                        className="h-8 text-xs font-semibold bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg px-2 text-slate-700 dark:text-gray-200 cursor-pointer"
                      >
                        <option value="Planejado">Planejado</option>
                        <option value="Em Execução">Em Execução</option>
                        <option value="Concluído">Concluído</option>
                      </select>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedEtapaId(null)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                        title="Fechar painel"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* SEÇÃO DE SUB-PASSOS ARRASTÁVEIS (QUANDO ETAPA PRINCIPAL) */}
                  {!(selectedEtapaOrSub as any).isSubPasso && (
                    <div className="bg-slate-50/70 dark:bg-[#162235]/60 border border-slate-200/80 dark:border-[#273549] rounded-xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-white block">
                            Sub-passos Executivos ({currentSubPassos.length})
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Arraste e solte para definir a ordem cronológica
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleOpenNewSubPasso(selectedEtapaOrSub as EnrichedMainEtapa)}
                          className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1 cursor-pointer font-bold shrink-0"
                        >
                          <PlusIcon className="h-3 w-3" />
                          <span>+ Sub-passo</span>
                        </Button>
                      </div>

                      {currentSubPassos.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-gray-800 rounded-lg">
                          Esta etapa ainda não possui sub-passos. Clique em &quot;+ Sub-passo&quot; para detalhar a execução (ex: Gabarito, Gaiolas, Estacas).
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {currentSubPassos.map((sub, idx) => {
                            const isDragging = draggedSubId === sub.id;
                            const isOver = dragOverSubId === sub.id;

                            return (
                              <div
                                key={sub.id}
                                draggable={true}
                                onDragStart={() => setDraggedSubId(sub.id)}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  if (dragOverSubId !== sub.id) setDragOverSubId(sub.id);
                                }}
                                onDragLeave={() => {
                                  if (dragOverSubId === sub.id) setDragOverSubId(null);
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setDragOverSubId(null);
                                  setDraggedSubId(null);
                                  if (draggedSubId) {
                                    const fromIdx = currentSubPassos.findIndex(s => s.id === draggedSubId);
                                    if (fromIdx !== -1) handleReorderSubs(selectedEtapaOrSub.id, fromIdx, idx);
                                  }
                                }}
                                onDragEnd={() => {
                                  setDraggedSubId(null);
                                  setDragOverSubId(null);
                                }}
                                onClick={() => setSelectedEtapaId(sub.id)}
                                className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 select-none cursor-pointer ${
                                  isDragging
                                    ? 'opacity-40 border-indigo-400 bg-indigo-50/50 scale-[0.98]'
                                    : isOver
                                    ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                                    : 'bg-white dark:bg-[#111827] border-slate-200/80 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className="cursor-grab active:cursor-grabbing p-1 -m-1 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200"
                                    title="Arraste para reposicionar a ordem cronológica"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <GripVerticalIcon className="h-4 w-4" />
                                  </div>
                                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50">
                                    {selectedEtapaOrSub.ordem}.{idx + 1}
                                  </span>
                                  <span className="font-semibold text-xs text-slate-800 dark:text-white truncate">
                                    {sub.nome}
                                  </span>
                                  <span className="text-[10px] text-slate-400 shrink-0">
                                    ({sub.itens_count} insumos)
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                    {formatCurrency(sub.totalPrevisto)}
                                  </span>
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => handleReorderSubs(selectedEtapaOrSub.id, idx, idx - 1)}
                                      className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                      title="Mover para cima"
                                    >
                                      <ChevronUpIcon className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === currentSubPassos.length - 1}
                                      onClick={() => handleReorderSubs(selectedEtapaOrSub.id, idx, idx + 1)}
                                      className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                      title="Mover para baixo"
                                    >
                                      <ChevronDownIcon className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditEtapa(sub)}
                                      className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                                      title="Editar sub-passo"
                                    >
                                      <EditIcon className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEtapaToDelete(sub)}
                                      className="p-1 rounded text-rose-400 hover:text-rose-600 cursor-pointer"
                                      title="Excluir sub-passo"
                                    >
                                      <Trash2Icon className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* FORMULÁRIO RÁPIDO DE ADIÇÃO DE INSUMO OU MÃO DE OBRA */}
                  <div className="bg-slate-50/70 dark:bg-[#162235]/60 border border-slate-200/80 dark:border-[#273549] rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-gray-200 flex items-center gap-1.5">
                        <PlusIcon className="h-3.5 w-3.5 text-indigo-600" />
                        Adicionar ao Orçamento
                      </span>

                      {/* Alternador de Tipo: Material vs Mão de Obra */}
                      <div className="inline-flex rounded-lg bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-gray-700 text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() => setNewItemTipo('material')}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            newItemTipo === 'material'
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
                          }`}
                        >
                          📦 Material
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewItemTipo('mao_de_obra')}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            newItemTipo === 'mao_de_obra'
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
                          }`}
                        >
                          👷 Mão de Obra
                        </button>
                      </div>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        addItemMutation.mutate();
                      }}
                      className="space-y-2.5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        {/* 1. Descrição */}
                        <div className="sm:col-span-6">
                          <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block mb-1">
                            Descrição do Insumo ou Tarefa *
                          </label>
                          <input
                            type="text"
                            placeholder={newItemTipo === 'material' ? 'Ex: Concreto Usinado FCK 25, Tábuas de Pinho...' : 'Ex: Diária de Pedreiro, Armação de Ferragem, Carpintaria...'}
                            value={newItemDescricao}
                            onChange={(e) => setNewItemDescricao(e.target.value)}
                            className="w-full h-8 px-2.5 text-xs bg-white dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            required
                          />
                        </div>

                        {/* 2. Categoria (para Material) OU Barra de Busca de Colaborador (para Mão de Obra) */}
                        <div className="sm:col-span-6">
                          {newItemTipo === 'material' ? (
                            <div>
                              <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block mb-1">
                                Categoria do Material *
                              </label>
                              <select
                                value={newItemCategoria}
                                onChange={(e) => setNewItemCategoria(e.target.value as CategoriaNota)}
                                className="w-full h-8 px-2 text-xs bg-white dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate"
                              >
                                {CATEGORIA_NOTA_ENUM.map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="relative" ref={collabDropdownRef}>
                              <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block mb-1">
                                Colaborador / Prestador de Serviço *
                              </label>
                              <div className="relative">
                                <SearchIcon className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                  type="text"
                                  placeholder="Digite o nome do colaborador..."
                                  value={collabSearchText}
                                  onChange={(e) => {
                                    setCollabSearchText(e.target.value);
                                    setIsCollabDropdownOpen(true);
                                  }}
                                  onFocus={() => setIsCollabDropdownOpen(true)}
                                  className="w-full h-8 pl-8 pr-7 text-xs bg-white dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                {selectedCollaboratorId && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedCollaboratorId('');
                                      setCollabSearchText('');
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs cursor-pointer"
                                    title="Limpar seleção"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>

                              {isCollabDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto custom-scrollbar bg-white dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg shadow-xl z-30 py-1">
                                  {collaborators
                                    .filter(c => c.name.toLowerCase().includes(collabSearchText.toLowerCase()) || (c.role && c.role.toLowerCase().includes(collabSearchText.toLowerCase())))
                                    .map((c) => (
                                      <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedCollaboratorId(c.id);
                                          setCollabSearchText(c.name + (c.role ? ` (${c.role})` : ''));
                                          setIsCollabDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-between cursor-pointer transition-colors"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <UserIcon className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                          <span className="font-semibold text-slate-800 dark:text-white truncate">{c.name}</span>
                                        </div>
                                        {c.role && (
                                          <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">{c.role}</span>
                                        )}
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 3. Quantidade */}
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block mb-1">
                            Qtd. *
                          </label>
                          <input
                            type="text"
                            placeholder="1"
                            value={newItemQtd}
                            onChange={(e) => setNewItemQtd(e.target.value)}
                            className="w-full h-8 px-2 text-xs bg-white dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            required
                          />
                        </div>

                        {/* 4. Valor Unitário (R$) */}
                        <div className="sm:col-span-4">
                          <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block mb-1">
                            Valor Unitário (R$) *
                          </label>
                          <input
                            type="text"
                            placeholder="0,00"
                            value={newItemValorUnit}
                            onChange={(e) => setNewItemValorUnit(e.target.value)}
                            className="w-full h-8 px-2 text-xs bg-white dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            required
                          />
                        </div>

                        {/* 5. Total Estimado & Botão Adicionar */}
                        <div className="sm:col-span-5 flex items-end gap-2">
                          <div className="flex-1 bg-white dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg px-2 h-8 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">Total:</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-white font-mono">
                              {formatCurrency(
                                (parseFloat(newItemQtd.replace(',', '.')) || 0) *
                                (parseFloat(newItemValorUnit.replace(/\./g, '').replace(',', '.')) || 0)
                              )}
                            </span>
                          </div>

                          <Button
                            type="submit"
                            size="sm"
                            disabled={addItemMutation.isPending || !newItemDescricao.trim()}
                            className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-1 cursor-pointer shrink-0"
                          >
                            <PlusIcon className="h-3.5 w-3.5" />
                            <span>Adicionar</span>
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* TABELA DE ITENS DA ETAPA OU SUB-PASSO */}
                  <div className="border border-slate-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 dark:bg-[#162235] px-3.5 py-2 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-gray-300">
                        Insumos Cadastrados nesta Etapa ({((selectedEtapaOrSub as any).itens || []).length})
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-800 dark:text-white">
                        Subtotal: {formatCurrency(
                          ((selectedEtapaOrSub as any).itens || []).reduce((s: number, it: OrcamentoItem) => s + (Number(it.valor_total) || 0), 0)
                        )}
                      </span>
                    </div>

                    {(!((selectedEtapaOrSub as any).itens) || (selectedEtapaOrSub as any).itens.length === 0) ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        Nenhum insumo cadastrado diretamente nesta etapa. Use o formulário acima para registrar materiais ou mão de obra.
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-xs text-left text-slate-600 dark:text-gray-300">
                          <thead className="text-[10px] uppercase font-semibold text-slate-400 bg-slate-50/70 dark:bg-slate-800/50 sticky top-0 z-10 border-b border-slate-100 dark:border-gray-800">
                            <tr>
                              <th className="px-3 py-2">Item / Tarefa</th>
                              <th className="px-2 py-2">Tipo / Responsável</th>
                              <th className="px-2 py-2 text-right">Qtd</th>
                              <th className="px-2 py-2 text-right">Unitário</th>
                              <th className="px-2 py-2 text-right">Total</th>
                              <th className="px-2 py-2 text-center w-14">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                            {((selectedEtapaOrSub as any).itens as OrcamentoItem[]).map((item) => {
                              const collab = item.collaborator_id ? collaboratorsMap.get(item.collaborator_id) : null;

                              return (
                                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                  <td className="px-3 py-2 font-medium text-slate-800 dark:text-white">
                                    {item.descricao}
                                  </td>
                                  <td className="px-2 py-2">
                                    {item.tipo === 'mao_de_obra' ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
                                        <UserIcon className="h-2.5 w-2.5" />
                                        {collab ? collab.name : 'Mão de Obra'}
                                      </span>
                                    ) : (
                                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getCategoryBadgeClass(item.categoria)}`}>
                                        {item.categoria}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-2 py-2 text-right font-mono">
                                    {item.quantidade}
                                  </td>
                                  <td className="px-2 py-2 text-right font-mono">
                                    {formatCurrency(item.valor_unitario)}
                                  </td>
                                  <td className="px-2 py-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                                    {formatCurrency(item.valor_total)}
                                  </td>
                                  <td className="px-2 py-2 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditItem(item)}
                                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                                        title="Editar insumo"
                                      >
                                        <EditIcon className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setItemToDelete(item)}
                                        className="p-1 rounded text-rose-400 hover:text-rose-600 cursor-pointer"
                                        title="Excluir insumo"
                                      >
                                        <Trash2Icon className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 2: PREVISTO VS REALIZADO (11 CATEGORIAS)              */}
      {/* ========================================================= */}
      {activeTab === 'categorias' && (
        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#E2E8F0] dark:border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-[#F8FAFC]">
                Controle Orçamentário por Categoria de Engenharia Civil
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8]">
                Comparativo automático entre o orçamento previsto e os lançamentos fiscais consolidados.
              </p>
            </div>
            <span className="text-xs text-slate-400">
              11 Categorias Padronizadas
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600 dark:text-gray-300">
              <thead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] bg-slate-50 dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#1E293B] sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3.5 font-semibold">Categoria</th>
                  <th className="px-4 py-3.5 font-semibold text-right whitespace-nowrap">Orçado Material</th>
                  <th className="px-4 py-3.5 font-semibold text-right whitespace-nowrap">Orçado Mão de Obra</th>
                  <th className="px-4 py-3.5 font-semibold text-right whitespace-nowrap">Orçado Total</th>
                  <th className="px-4 py-3.5 font-semibold text-right whitespace-nowrap">Realizado Notas</th>
                  <th className="px-4 py-3.5 font-semibold text-center w-48">Consumo</th>
                  <th className="px-4 py-3.5 font-semibold text-right whitespace-nowrap">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {categoryComparison.map((cat) => {
                  const percent = Math.min(cat.percentualConsumido, 100);
                  const isEstourado = cat.saldo < 0;

                  return (
                    <tr key={cat.categoria} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs border ${getCategoryBadgeClass(cat.categoria)}`}>
                          {cat.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(cat.orcadoMaterial)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(cat.orcadoMaoDeObra)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {formatCurrency(cat.orcadoTotal)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-700 dark:text-gray-200">
                        {formatCurrency(cat.realizadoNotas)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                            <span>{cat.percentualConsumido.toFixed(1)}%</span>
                            {isEstourado && <span className="text-rose-500 font-bold">Acima da meta</span>}
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-gray-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isEstourado
                                  ? 'bg-rose-500'
                                  : percent > 80
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-mono text-xs font-bold ${
                        isEstourado ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {formatCurrency(cat.saldo)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. MODAL: NOVA / EDITAR ETAPA OU SUB-PASSO                */}
      {/* ========================================================= */}
      <ResponsiveModal open={isEtapaModalOpen} onOpenChange={setIsEtapaModalOpen}>
        <ResponsiveModalContent size="sm">
          <ResponsiveModalHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 flex items-center justify-center">
                <ConstructionIcon className="h-4 w-4" />
              </div>
              <div>
                <ResponsiveModalTitle>
                  {etapaToEdit
                    ? (etapaParentId ? 'Editar Sub-passo' : 'Editar Etapa Principal')
                    : (etapaParentId ? 'Novo Sub-passo Executivo' : 'Nova Etapa do Orçamento')}
                </ResponsiveModalTitle>
                <ResponsiveModalDescription>
                  Estrutura Analítica do Projeto (EAP) e sequenciamento cronológico na obra.
                </ResponsiveModalDescription>
              </div>
            </div>
          </ResponsiveModalHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveEtapaMutation.mutate();
            }}
            className="space-y-3.5 p-4"
          >
            {/* 1. Obra de Destino */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                Obra Vinculada *
              </label>
              <select
                value={etapaProjectIdInput}
                onChange={(e) => {
                  const newProj = e.target.value;
                  setEtapaProjectIdInput(newProj);
                  setEtapaParentId(null);
                  if (!etapaToEdit) {
                    const existingMains = rawMainEtapas.filter(m => m.project_id === newProj);
                    const nextOrdem = existingMains.length > 0 ? Math.max(...existingMains.map(m => m.ordem || 0)) + 1 : 1;
                    setEtapaOrdemInput(nextOrdem);
                  }
                }}
                disabled={!!etapaToEdit}
                className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                required
              >
                <option value="">Selecione a Obra...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* 2. Seleção de Nível: Etapa Principal vs Sub-passo (Apenas ao criar) */}
            {!etapaToEdit && (
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1.5">
                  Nível da Etapa
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEtapaParentId(null);
                      const existingMains = rawMainEtapas.filter(m => m.project_id === etapaProjectIdInput);
                      const nextOrdem = existingMains.length > 0 ? Math.max(...existingMains.map(m => m.ordem || 0)) + 1 : 1;
                      setEtapaOrdemInput(nextOrdem);
                    }}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 cursor-pointer transition-all ${
                      !etapaParentId
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'bg-slate-50 dark:bg-[#162235] border-slate-200 dark:border-[#273549] text-slate-600 dark:text-gray-400 font-medium'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                    <div>
                      <p className="text-xs">Etapa Principal</p>
                      <p className="text-[10px] opacity-75 font-normal">Ex: Viga Baldrame, Fundação</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const availableMains = enrichedMainEtapas.filter(m => !etapaProjectIdInput || m.project_id === etapaProjectIdInput);
                      const defaultParent = availableMains[0]?.id || '';
                      setEtapaParentId(defaultParent || 'new');
                      if (defaultParent) {
                        const existingSubs = rawSubPassosByParent.get(defaultParent) || [];
                        const nextSubOrdem = existingSubs.length > 0 ? Math.max(...existingSubs.map(s => s.ordem || 0)) + 1 : 1;
                        setEtapaOrdemInput(nextSubOrdem);
                      } else {
                        setEtapaOrdemInput(1);
                      }
                    }}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 cursor-pointer transition-all ${
                      etapaParentId
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'bg-slate-50 dark:bg-[#162235] border-slate-200 dark:border-[#273549] text-slate-600 dark:text-gray-400 font-medium'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <p className="text-xs">Sub-passo</p>
                      <p className="text-[10px] opacity-75 font-normal">Ex: Gabarito, Gaiolas, Estacas</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* 3. Se for sub-passo: Seletor da Etapa Principal Pai */}
            {etapaParentId && (
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Vincular à Etapa Principal *
                </label>
                <select
                  value={etapaParentId}
                  onChange={(e) => {
                    const newParent = e.target.value;
                    setEtapaParentId(newParent);
                    if (!etapaToEdit) {
                      const existingSubs = rawSubPassosByParent.get(newParent) || [];
                      const nextSubOrdem = existingSubs.length > 0 ? Math.max(...existingSubs.map(s => s.ordem || 0)) + 1 : 1;
                      setEtapaOrdemInput(nextSubOrdem);
                    }
                  }}
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  required
                >
                  <option value="">Selecione a Etapa Principal...</option>
                  {enrichedMainEtapas
                    .filter(m => !etapaProjectIdInput || m.project_id === etapaProjectIdInput)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.ordem}. {m.nome}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* 4. Nome da Etapa ou Sub-passo */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                {etapaParentId ? 'Nome do Sub-passo *' : 'Nome da Etapa Principal *'}
              </label>
              <input
                type="text"
                placeholder={etapaParentId ? 'Ex: Gabarito de Locação, Gaiolas e Armação, Estacas...' : 'Ex: Viga Baldrame, Fundação, Estrutura, Alvenaria...'}
                value={etapaNameInput}
                onChange={(e) => setEtapaNameInput(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* 5. Ordem Cronológica (Calculada automaticamente, mas editável) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Ordem Cronológica
                </label>
                <input
                  type="number"
                  min="1"
                  value={etapaOrdemInput}
                  onChange={(e) => setEtapaOrdemInput(parseInt(e.target.value, 10) || 1)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* 6. Status Inicial */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Status
                </label>
                <select
                  value={etapaStatusInput}
                  onChange={(e) => setEtapaStatusInput(e.target.value as OrcamentoEtapaStatus)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="Planejado">Planejado</option>
                  <option value="Em Execução">Em Execução</option>
                  <option value="Concluído">Concluído</option>
                </select>
              </div>
            </div>

            <ResponsiveModalFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEtapaModalOpen(false)}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saveEtapaMutation.isPending || !etapaNameInput.trim() || !etapaProjectIdInput}
                className="bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
              >
                {saveEtapaMutation.isPending ? 'Salvando...' : etapaToEdit ? 'Salvar Alterações' : 'Criar no Cronograma'}
              </Button>
            </ResponsiveModalFooter>
          </form>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* ========================================================= */}
      {/* 5. MODAL: EDITAR ITEM DO ORÇAMENTO                        */}
      {/* ========================================================= */}
      <ResponsiveModal open={!!itemToEdit} onOpenChange={(open) => !open && setItemToEdit(null)}>
        <ResponsiveModalContent size="sm">
          <ResponsiveModalHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 flex items-center justify-center">
                <EditIcon className="h-4 w-4" />
              </div>
              <div>
                <ResponsiveModalTitle>Editar Insumo do Orçamento</ResponsiveModalTitle>
                <ResponsiveModalDescription>Atualize os valores estimados ou o prestador responsável.</ResponsiveModalDescription>
              </div>
            </div>
          </ResponsiveModalHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveEditItemMutation.mutate();
            }}
            className="space-y-3 p-4"
          >
            {/* Alternador de Tipo */}
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-gray-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-gray-300">Tipo de Insumo</span>
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-gray-700 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setEditItemTipo('material')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${editItemTipo === 'material' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 dark:text-gray-400'}`}
                >
                  Material
                </button>
                <button
                  type="button"
                  onClick={() => setEditItemTipo('mao_de_obra')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${editItemTipo === 'mao_de_obra' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 dark:text-gray-400'}`}
                >
                  Mão de Obra
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">Descrição</label>
              <input
                type="text"
                value={editItemDescricao}
                onChange={(e) => setEditItemDescricao(e.target.value)}
                className="w-full h-8 px-2.5 text-xs bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white"
                required
              />
            </div>

            {editItemTipo === 'material' ? (
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">Categoria do Material</label>
                <select
                  value={editItemCategoria}
                  onChange={(e) => setEditItemCategoria(e.target.value as CategoriaNota)}
                  className="w-full h-8 px-2 text-xs bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white"
                >
                  {CATEGORIA_NOTA_ENUM.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="relative" ref={editCollabDropdownRef}>
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">Colaborador / Prestador de Serviço</label>
                <div className="relative">
                  <SearchIcon className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Digite o nome do colaborador..."
                    value={editCollabSearchText}
                    onChange={(e) => {
                      setEditCollabSearchText(e.target.value);
                      setIsEditCollabDropdownOpen(true);
                    }}
                    onFocus={() => setIsEditCollabDropdownOpen(true)}
                    className="w-full h-8 pl-8 pr-7 text-xs bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white"
                  />
                  {editItemCollaboratorId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditItemCollaboratorId('');
                        setEditCollabSearchText('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {isEditCollabDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto custom-scrollbar bg-white dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg shadow-xl z-30 py-1">
                    {collaborators
                      .filter(c => c.name.toLowerCase().includes(editCollabSearchText.toLowerCase()) || (c.role && c.role.toLowerCase().includes(editCollabSearchText.toLowerCase())))
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setEditItemCollaboratorId(c.id);
                            setEditCollabSearchText(c.name + (c.role ? ` (${c.role})` : ''));
                            setIsEditCollabDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-between cursor-pointer"
                        >
                          <span className="font-semibold text-slate-800 dark:text-white">{c.name}</span>
                          {c.role && <span className="text-[10px] text-slate-400 font-mono">{c.role}</span>}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">Quantidade</label>
                <input
                  type="text"
                  value={editItemQtd}
                  onChange={(e) => setEditItemQtd(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">Valor Unitário (R$)</label>
                <input
                  type="text"
                  value={editItemValorUnit}
                  onChange={(e) => setEditItemValorUnit(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white font-mono"
                  required
                />
              </div>
            </div>

            <ResponsiveModalFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setItemToEdit(null)} className="cursor-pointer">
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={saveEditItemMutation.isPending} className="bg-indigo-600 text-white cursor-pointer">
                Salvar Alterações
              </Button>
            </ResponsiveModalFooter>
          </form>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* ========================================================= */}
      {/* 6. MODAL: CLONAR ORÇAMENTO DE OUTRA OBRA                  */}
      {/* ========================================================= */}
      <ResponsiveModal open={isCopyModalOpen} onOpenChange={setIsCopyModalOpen}>
        <ResponsiveModalContent size="sm">
          <ResponsiveModalHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 flex items-center justify-center">
                <CopyIcon className="h-4 w-4" />
              </div>
              <div>
                <ResponsiveModalTitle>Copiar Orçamento Entre Obras</ResponsiveModalTitle>
                <ResponsiveModalDescription>
                  Duplica etapas, sub-passos e insumos de uma obra de referência para a nova obra.
                </ResponsiveModalDescription>
              </div>
            </div>
          </ResponsiveModalHeader>

          <div className="space-y-4 p-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                Obra de Origem (Modelo / Referência) *
              </label>
              <select
                value={copySourceProjectId}
                onChange={(e) => setCopySourceProjectId(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">Selecione a obra de origem...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                Obra de Destino (Onde serão criadas as etapas) *
              </label>
              <select
                value={copyTargetProjectId}
                onChange={(e) => setCopyTargetProjectId(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">Selecione a obra de destino...</option>
                {projects
                  .filter((p) => p.id !== copySourceProjectId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-bold">Aviso de Duplicação:</p>
              <p>
                Todas as etapas principais, sub-passos hierárquicos e seus itens serão copiados para a obra de destino com status inicial &quot;Planejado&quot;.
              </p>
            </div>

            <ResponsiveModalFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCopyModalOpen(false)} className="cursor-pointer">
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => copyBudgetMutation.mutate()}
                disabled={copyBudgetMutation.isPending || !copySourceProjectId || !copyTargetProjectId}
                className="bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
              >
                {copyBudgetMutation.isPending ? 'Copiando...' : 'Confirmar Cópia'}
              </Button>
            </ResponsiveModalFooter>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* ========================================================= */}
      {/* 7. CONFIRMAÇÃO DE EXCLUSÃO DE ETAPA OU ITEM               */}
      {/* ========================================================= */}
      {etapaToDelete && (
        <ConfirmationModal
          isOpen={true}
          title={etapaToDelete.parent_id ? 'Excluir Sub-passo' : 'Excluir Etapa Principal'}
          description={
            etapaToDelete.parent_id
              ? `Tem certeza que deseja excluir o sub-passo "${etapaToDelete.nome}"? Todos os insumos deste sub-passo serão removidos.`
              : `Tem certeza que deseja excluir "${etapaToDelete.nome}"? Todos os sub-passos e insumos vinculados a esta etapa também serão removidos.`
          }
          confirmText="Excluir Definitivamente"
          isLoading={deleteEtapaMutation.isPending}
          onConfirm={() => deleteEtapaMutation.mutate(etapaToDelete)}
          onClose={() => setEtapaToDelete(null)}
        />
      )}

      {itemToDelete && (
        <ConfirmationModal
          isOpen={true}
          title="Excluir Insumo"
          description={`Tem certeza que deseja remover o item "${itemToDelete.descricao}" do orçamento?`}
          confirmText="Remover Item"
          isLoading={deleteItemMutation.isPending}
          onConfirm={() => deleteItemMutation.mutate(itemToDelete)}
          onClose={() => setItemToDelete(null)}
        />
      )}
    </div>
  );
};

export default Orcamentos;
