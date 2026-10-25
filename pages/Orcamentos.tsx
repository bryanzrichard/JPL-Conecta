import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { useMediaQuery } from '../hooks/use-media-query';
import {
  Project,
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
  ConstructionIcon, BuildingIcon, SparklesIcon, TrendingUpIcon, FilterIcon,
  MoreVerticalIcon, PackageIcon
} from '../lib/icons';
import { formatCurrency, formatDateBR } from '../lib/utils';
import { formatApiError } from '../lib/handleError';
import { logAuditAction } from '../lib/auditLogger';

// Cores temáticas para as 11 categorias
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
      return 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-500/[0.12] dark:text-purple-400 dark:border-purple-500/20';
    case 'Gastos Gerais':
    default:
      return 'bg-[#F1F5F9] text-[#475569] border-slate-200 dark:bg-[#1E293B] dark:text-[#94A3B8] dark:border-slate-700/60';
  }
};

const getStatusBadge = (status: OrcamentoEtapaStatus) => {
  switch (status) {
    case 'Concluído':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#ECFDF5] text-[#047857] dark:bg-emerald-500/[0.12] dark:text-[#34D399] border border-emerald-200/80 dark:border-emerald-500/20 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Concluído
        </span>
      );
    case 'Em Execução':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#EEF2FF] text-[#4338CA] dark:bg-indigo-500/[0.12] dark:text-[#818CF8] border border-indigo-200/80 dark:border-indigo-500/20 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          Em Execução
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#FFFBEB] text-[#B45309] dark:bg-amber-500/[0.12] dark:text-amber-400 border border-amber-200/80 dark:border-amber-500/20 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Planejado
        </span>
      );
  }
};

export const Orcamentos: React.FC = () => {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Tab State: 'etapas' | 'categorias'
  const [activeTab, setActiveTab] = useState<'etapas' | 'categorias'>('etapas');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Split View Selection
  const [selectedEtapaId, setSelectedEtapaId] = useState<string | null>(null);

  // Modais
  const [isEtapaModalOpen, setIsEtapaModalOpen] = useState(false);
  const [etapaToEdit, setEtapaToEdit] = useState<OrcamentoEtapa | null>(null);
  const [etapaNameInput, setEtapaNameInput] = useState('');
  const [etapaOrdemInput, setEtapaOrdemInput] = useState<number>(1);
  const [etapaStatusInput, setEtapaStatusInput] = useState<OrcamentoEtapaStatus>('Planejado');

  // Modal Copiar de Outra Obra
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceProjectId, setCopySourceProjectId] = useState<string>('');

  // Confirmações de Exclusão
  const [etapaToDelete, setEtapaToDelete] = useState<OrcamentoEtapa | null>(null);
  const [itemToDelete, setItemToDelete] = useState<OrcamentoItem | null>(null);

  // Form Inline de Item
  const [newItemDescricao, setNewItemDescricao] = useState('');
  const [newItemTipo, setNewItemTipo] = useState<OrcamentoItemTipo>('material');
  const [newItemCategoria, setNewItemCategoria] = useState<CategoriaNota>('Estrutura e Fundação');
  const [newItemQtd, setNewItemQtd] = useState<string>('1');
  const [newItemValorUnit, setNewItemValorUnit] = useState<string>('');

  // Modal Edição de Item
  const [itemToEdit, setItemToEdit] = useState<OrcamentoItem | null>(null);
  const [editItemDescricao, setEditItemDescricao] = useState('');
  const [editItemTipo, setEditItemTipo] = useState<OrcamentoItemTipo>('material');
  const [editItemCategoria, setEditItemCategoria] = useState<CategoriaNota>('Estrutura e Fundação');
  const [editItemQtd, setEditItemQtd] = useState<string>('1');
  const [editItemValorUnit, setEditItemValorUnit] = useState<string>('');

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

  // Inicializar com a primeira obra
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // 2. Carregar Etapas da Obra Selecionada
  const { data: etapas = [], isLoading: isLoadingEtapas } = useQuery<OrcamentoEtapa[]>({
    queryKey: ['orcamento_etapas', profile?.company_id, selectedProjectId],
    queryFn: async () => {
      if (!profile?.company_id || !selectedProjectId) return [];
      const { data, error } = await (supabase as any)
        .from('orcamento_etapas')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('project_id', selectedProjectId)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id && !!selectedProjectId,
  });

  // 3. Carregar Todos os Itens da Obra Selecionada
  const { data: allItens = [], isLoading: isLoadingItens } = useQuery<OrcamentoItem[]>({
    queryKey: ['orcamento_itens', profile?.company_id, selectedProjectId],
    queryFn: async () => {
      if (!profile?.company_id || !selectedProjectId) return [];
      const { data, error } = await (supabase as any)
        .from('orcamento_itens')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('project_id', selectedProjectId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id && !!selectedProjectId,
  });

  // 4. Carregar Resumo por Categoria da RPC
  const { data: rpcCategorySummary = [], isLoading: isLoadingRpc } = useQuery<OrcamentoCategorySummary[]>({
    queryKey: ['rpc_orcamento_category_summary', profile?.company_id, selectedProjectId],
    queryFn: async () => {
      if (!profile?.company_id || !selectedProjectId) return [];
      const { data, error } = await (supabase as any).rpc('get_project_budget_by_category', {
        p_company_id: profile.company_id,
        p_project_id: selectedProjectId,
      });
      if (error) {
        console.warn('Erro ao chamar RPC get_project_budget_by_category, usando cálculo local:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!profile?.company_id && !!selectedProjectId,
  });

  // 5. Carregar Gastos Reais de Notas Fiscais da Obra
  const { data: notasFiscaisItens = [] } = useQuery<{ category: CategoriaNota; total_price: number }[]>({
    queryKey: ['notas_itens_by_project', profile?.company_id, selectedProjectId],
    queryFn: async () => {
      if (!profile?.company_id || !selectedProjectId) return [];
      const { data: notas, error: errNotas } = await (supabase as any)
        .from('notas_fiscais')
        .select('id')
        .eq('company_id', profile.company_id)
        .eq('project_id', selectedProjectId);
      if (errNotas || !notas || notas.length === 0) return [];

      const notaIds = notas.map((n: any) => n.id);
      const { data: itens, error: errItens } = await (supabase as any)
        .from('itens_nota_fiscal')
        .select('category, total_price')
        .in('nota_fiscal_id', notaIds);
      if (errItens) return [];
      return itens || [];
    },
    enabled: !!profile?.company_id && !!selectedProjectId,
  });

  // Mapa de itens agrupados por etapa
  const itensByEtapa = useMemo(() => {
    const map = new Map<string, OrcamentoItem[]>();
    allItens.forEach(it => {
      const arr = map.get(it.etapa_id) || [];
      arr.push(it);
      map.set(it.etapa_id, arr);
    });
    return map;
  }, [allItens]);

  // Etapas enriquecidas com totais calculados
  const enrichedEtapas = useMemo(() => {
    return etapas.map(etapa => {
      const itens = itensByEtapa.get(etapa.id) || [];
      const totalPrevisto = itens.reduce((s, it) => s + (Number(it.valor_total) || 0), 0);
      const totalMaterial = itens.filter(it => it.tipo === 'material').reduce((s, it) => s + (Number(it.valor_total) || 0), 0);
      const totalMaoDeObra = itens.filter(it => it.tipo === 'mao_de_obra').reduce((s, it) => s + (Number(it.valor_total) || 0), 0);
      const categoriesSet = new Set<CategoriaNota>();
      itens.forEach(it => {
        if (it.categoria) categoriesSet.add(it.categoria);
      });
      return {
        ...etapa,
        itens_count: itens.length,
        total_previsto: totalPrevisto,
        total_material: totalMaterial,
        total_mao_de_obra: totalMaoDeObra,
        categorias: Array.from(categoriesSet),
        itens,
      };
    });
  }, [etapas, itensByEtapa]);

  // Etapa Selecionada no Split View
  const selectedEtapa = useMemo(() => {
    if (!selectedEtapaId) return null;
    return enrichedEtapas.find(e => e.id === selectedEtapaId) || null;
  }, [selectedEtapaId, enrichedEtapas]);

  // Navegação sequencial nas etapas
  const selectedEtapaIndex = useMemo(() => {
    if (!selectedEtapa) return -1;
    return enrichedEtapas.findIndex(e => e.id === selectedEtapa.id);
  }, [selectedEtapa, enrichedEtapas]);

  const hasPrevEtapa = selectedEtapaIndex > 0;
  const hasNextEtapa = selectedEtapaIndex >= 0 && selectedEtapaIndex < enrichedEtapas.length - 1;

  const handlePrevEtapa = useCallback(() => {
    if (hasPrevEtapa) {
      setSelectedEtapaId(enrichedEtapas[selectedEtapaIndex - 1].id);
    }
  }, [hasPrevEtapa, selectedEtapaIndex, enrichedEtapas]);

  const handleNextEtapa = useCallback(() => {
    if (hasNextEtapa) {
      setSelectedEtapaId(enrichedEtapas[selectedEtapaIndex + 1].id);
    }
  }, [hasNextEtapa, selectedEtapaIndex, enrichedEtapas]);

  // Teclado: ↑, ↓, Esc
  useEffect(() => {
    if (!selectedEtapa || !isDesktop) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(activeTag)) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrevEtapa();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNextEtapa();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedEtapaId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEtapa, isDesktop, handlePrevEtapa, handleNextEtapa]);

  // Scroll sincronizado para linha ativa
  useEffect(() => {
    if (!selectedEtapaId) return;
    const el = document.getElementById(`etapa-row-${selectedEtapaId}`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [selectedEtapaId]);

  // KPIs da Obra Selecionada
  const kpis = useMemo(() => {
    const totalPrevisto = allItens.reduce((sum, it) => sum + (Number(it.valor_total) || 0), 0);
    const totalMaterial = allItens.filter(it => it.tipo === 'material').reduce((sum, it) => sum + (Number(it.valor_total) || 0), 0);
    const totalMaoDeObra = allItens.filter(it => it.tipo === 'mao_de_obra').reduce((sum, it) => sum + (Number(it.valor_total) || 0), 0);

    // Soma de notas fiscais
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
      etapasCount: etapas.length,
      itensCount: allItens.length,
    };
  }, [allItens, notasFiscaisItens, etapas]);

  // Resumo Previsto vs Realizado por Categoria (11 Categorias consolidadas)
  const categoryComparison = useMemo(() => {
    // Map de orçado material e mão de obra por categoria a partir dos itens
    const orcadoMap = new Map<string, { material: number; maoDeObra: number }>();
    CATEGORIA_NOTA_ENUM.forEach(cat => {
      orcadoMap.set(cat, { material: 0, maoDeObra: 0 });
    });

    allItens.forEach(it => {
      const current = orcadoMap.get(it.categoria) || { material: 0, maoDeObra: 0 };
      if (it.tipo === 'material') {
        current.material += Number(it.valor_total) || 0;
      } else {
        current.maoDeObra += Number(it.valor_total) || 0;
      }
      orcadoMap.set(it.categoria, current);
    });

    // Map de realizado notas por categoria
    const realizadoMap = new Map<string, number>();
    CATEGORIA_NOTA_ENUM.forEach(cat => realizadoMap.set(cat, 0));

    // Se a RPC retornou dados válidos, usa como fonte prioritária
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
      const saldo = orcado.material - realizado;
      const percentual = orcado.material > 0 ? (realizado / orcado.material) * 100 : realizado > 0 ? 100 : 0;

      return {
        categoria: cat,
        orcadoMaterial: orcado.material,
        orcadoMaoDeObra: orcado.maoDeObra,
        orcadoTotal: totalOrcado,
        realizadoNotas: realizado,
        saldo,
        percentual,
      };
    });
  }, [allItens, rpcCategorySummary, notasFiscaisItens]);

  // Contagem de categorias dentro da meta
  const categoriesStatus = useMemo(() => {
    let dentroDaMeta = 0;
    let estouradas = 0;
    categoryComparison.forEach(c => {
      if (c.orcadoMaterial > 0 || c.realizadoNotas > 0) {
        if (c.saldo >= 0) dentroDaMeta++;
        else estouradas++;
      }
    });
    return { dentroDaMeta, estouradas };
  }, [categoryComparison]);

  // --- MUTATIONS ---

  // Criar / Editar Etapa
  const saveEtapaMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id || !selectedProjectId) throw new Error('Obra não selecionada');
      if (!etapaNameInput.trim()) throw new Error('Nome da etapa é obrigatório');

      if (etapaToEdit) {
        const { error } = await (supabase as any)
          .from('orcamento_etapas')
          .update({
            nome: etapaNameInput.trim(),
            ordem: etapaOrdemInput,
            status: etapaStatusInput,
          })
          .eq('id', etapaToEdit.id)
          .eq('company_id', profile.company_id);
        if (error) throw error;
        logAuditAction(profile.company_id, user?.email, 'ATUALIZAR', `Etapa Orçamento: ${etapaNameInput}`);
      } else {
        const { data, error } = await (supabase as any)
          .from('orcamento_etapas')
          .insert({
            company_id: profile.company_id,
            project_id: selectedProjectId,
            nome: etapaNameInput.trim(),
            ordem: etapaOrdemInput,
            status: etapaStatusInput,
            created_by: user?.id,
          })
          .select()
          .single();
        if (error) throw error;
        logAuditAction(profile.company_id, user?.email, 'CRIAR', `Nova Etapa Orçamento: ${etapaNameInput}`);
        if (data) setSelectedEtapaId(data.id);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Sucesso!',
        description: etapaToEdit ? 'Etapa atualizada com sucesso.' : 'Nova etapa adicionada ao cronograma.',
      });
      queryClient.invalidateQueries({ queryKey: ['orcamento_etapas'] });
      setIsEtapaModalOpen(false);
      setEtapaToEdit(null);
      setEtapaNameInput('');
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Erro ao salvar etapa', description: formatApiError(err) });
    },
  });

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

  // Excluir Etapa
  const deleteEtapaMutation = useMutation({
    mutationFn: async (etapa: OrcamentoEtapa) => {
      if (!profile?.company_id) return;
      // 1. Excluir itens da etapa
      await (supabase as any)
        .from('orcamento_itens')
        .delete()
        .eq('etapa_id', etapa.id)
        .eq('company_id', profile.company_id);

      // 2. Excluir etapa
      const { error } = await (supabase as any)
        .from('orcamento_etapas')
        .delete()
        .eq('id', etapa.id)
        .eq('company_id', profile.company_id);
      if (error) throw error;

      logAuditAction(profile.company_id, user?.email, 'EXCLUIR', `Etapa Orçamento: ${etapa.nome}`);
    },
    onSuccess: () => {
      toast({ title: 'Etapa excluída', description: 'A etapa e seus itens foram removidos.' });
      queryClient.invalidateQueries({ queryKey: ['orcamento_etapas'] });
      queryClient.invalidateQueries({ queryKey: ['orcamento_itens'] });
      queryClient.invalidateQueries({ queryKey: ['rpc_orcamento_category_summary'] });
      if (selectedEtapaId === etapaToDelete?.id) setSelectedEtapaId(null);
      setEtapaToDelete(null);
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: formatApiError(err) });
    },
  });

  // Adicionar Item Rápido na Etapa Selecionada
  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id || !selectedEtapaId) throw new Error('Etapa não selecionada');
      if (!newItemDescricao.trim()) throw new Error('Descrição é obrigatória');

      const qtd = parseFloat(newItemQtd.replace(',', '.')) || 1;
      const unit = parseFloat(newItemValorUnit.replace(/\./g, '').replace(',', '.')) || 0;
      const total = qtd * unit;

      const { error } = await (supabase as any)
        .from('orcamento_itens')
        .insert({
          company_id: profile.company_id,
          project_id: selectedProjectId,
          etapa_id: selectedEtapaId,
          descricao: newItemDescricao.trim(),
          tipo: newItemTipo,
          categoria: newItemCategoria,
          quantidade: qtd,
          valor_unitario: unit,
        });
      if (error) throw error;
      logAuditAction(profile.company_id, user?.email, 'CRIAR', `Item Orçamento: ${newItemDescricao} (R$ ${total})`);
    },
    onSuccess: () => {
      toast({ title: 'Item adicionado!', description: 'Gasto orçado registrado na etapa.' });
      queryClient.invalidateQueries({ queryKey: ['orcamento_itens'] });
      queryClient.invalidateQueries({ queryKey: ['rpc_orcamento_category_summary'] });
      setNewItemDescricao('');
      setNewItemValorUnit('');
      setNewItemQtd('1');
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
      const total = qtd * unit;

      const { error } = await (supabase as any)
        .from('orcamento_itens')
        .update({
          descricao: editItemDescricao.trim(),
          tipo: editItemTipo,
          categoria: editItemCategoria,
          quantidade: qtd,
          valor_unitario: unit,
        })
        .eq('id', itemToEdit.id)
        .eq('company_id', profile.company_id);
      if (error) throw error;
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
      toast({ title: 'Item removido', description: 'Item de orçamento excluído da etapa.' });
      queryClient.invalidateQueries({ queryKey: ['orcamento_itens'] });
      queryClient.invalidateQueries({ queryKey: ['rpc_orcamento_category_summary'] });
      setItemToDelete(null);
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Erro ao excluir item', description: formatApiError(err) });
    },
  });

  // Copiar Orçamento de Outra Obra
  const copyBudgetMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id || !selectedProjectId || !copySourceProjectId) {
        throw new Error('Selecione a obra de origem e a obra de destino.');
      }
      if (selectedProjectId === copySourceProjectId) {
        throw new Error('A obra de origem deve ser diferente da obra de destino.');
      }

      // 1. Obter etapas da obra de origem
      const { data: sourceEtapas, error: errEtapas } = await (supabase as any)
        .from('orcamento_etapas')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('project_id', copySourceProjectId)
        .order('ordem');
      if (errEtapas) throw errEtapas;
      if (!sourceEtapas || sourceEtapas.length === 0) {
        throw new Error('A obra de origem não possui etapas cadastradas.');
      }

      // 2. Obter itens de todas as etapas de origem
      const sourceEtapaIds = sourceEtapas.map((e: any) => e.id);
      const { data: sourceItens, error: errItens } = await (supabase as any)
        .from('orcamento_itens')
        .select('*')
        .eq('company_id', profile.company_id)
        .in('etapa_id', sourceEtapaIds);
      if (errItens) throw errItens;

      // 3. Clonar etapas e mapear novos IDs
      let totalClonedItens = 0;
      for (const sEtapa of sourceEtapas) {
        const { data: newEtapa, error: errInsertEtapa } = await (supabase as any)
          .from('orcamento_etapas')
          .insert({
            company_id: profile.company_id,
            project_id: selectedProjectId,
            nome: sEtapa.nome,
            ordem: sEtapa.ordem,
            status: 'Planejado',
            created_by: user?.id,
          })
          .select()
          .single();
        if (errInsertEtapa) throw errInsertEtapa;

        // Inserir itens vinculados à nova etapa
        const itensForThisEtapa = (sourceItens || []).filter((it: any) => it.etapa_id === sEtapa.id);
        if (itensForThisEtapa.length > 0) {
          const itensToInsert = itensForThisEtapa.map((it: any) => ({
            company_id: profile.company_id,
            project_id: selectedProjectId,
            etapa_id: newEtapa.id,
            descricao: it.descricao,
            tipo: it.tipo,
            categoria: it.categoria,
            quantidade: it.quantidade,
            valor_unitario: it.valor_unitario,
          }));
          const { error: errInsertItens } = await (supabase as any)
            .from('orcamento_itens')
            .insert(itensToInsert);
          if (errInsertItens) throw errInsertItens;
          totalClonedItens += itensToInsert.length;
        }
      }

      logAuditAction(profile.company_id, user?.email, 'CRIAR', `Orçamento clonado para obra ${selectedProjectId}`);
      return { etapasCount: sourceEtapas.length, itensCount: totalClonedItens };
    },
    onSuccess: (res) => {
      toast({
        title: 'Orçamento clonado com sucesso!',
        description: `${res.etapasCount} etapas e ${res.itensCount} itens copiados para esta obra.`,
      });
      queryClient.invalidateQueries({ queryKey: ['orcamento_etapas'] });
      queryClient.invalidateQueries({ queryKey: ['orcamento_itens'] });
      queryClient.invalidateQueries({ queryKey: ['rpc_orcamento_category_summary'] });
      setIsCopyModalOpen(false);
      setCopySourceProjectId('');
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Erro ao copiar orçamento', description: formatApiError(err) });
    },
  });

  // Exportar CSV
  const handleExportCsv = useCallback(() => {
    if (!selectedProjectId) return;
    const currentProject = projects.find(p => p.id === selectedProjectId);
    const projectName = currentProject?.name || 'Obra';
    const timestamp = new Date().toISOString().split('T')[0];

    let csvContent = '\uFEFF'; // UTF-8 BOM

    if (activeTab === 'etapas') {
      csvContent += 'Etapa;Status;Ordem;Descrição do Item;Tipo;Categoria;Quantidade;Valor Unitário (R$);Valor Total (R$)\r\n';
      enrichedEtapas.forEach(etapa => {
        if (!etapa.itens || etapa.itens.length === 0) {
          csvContent += `"${etapa.nome}";"${etapa.status}";"${etapa.ordem}";"Sem itens cadastrados";"";"";"";"";"${(etapa.total_previsto || 0).toFixed(2)}"\r\n`;
        } else {
          etapa.itens.forEach(it => {
            csvContent += `"${etapa.nome}";"${etapa.status}";"${etapa.ordem}";"${it.descricao.replace(/"/g, '""')}";"${it.tipo === 'material' ? 'Material' : 'Mão de Obra'}";"${it.categoria}";"${it.quantidade}";"${it.valor_unitario.toFixed(2)}";"${it.valor_total.toFixed(2)}"\r\n`;
          });
        }
      });
    } else {
      csvContent += 'Categoria de Engenharia;Orçado Material (R$);Orçado Mão de Obra (R$);Orçado Total (R$);Gasto Real Notas (R$);Consumo (%);Saldo (R$);Status\r\n';
      categoryComparison.forEach(c => {
        const statusText = c.saldo >= 0 ? 'Dentro da Meta' : 'Acima do Orçado';
        csvContent += `"${c.categoria}";"${c.orcadoMaterial.toFixed(2)}";"${c.orcadoMaoDeObra.toFixed(2)}";"${c.orcadoTotal.toFixed(2)}";"${c.realizadoNotas.toFixed(2)}";"${c.percentual.toFixed(1)}%";"${c.saldo.toFixed(2)}";"${statusText}"\r\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `orcamento_${projectName.toLowerCase().replace(/\s+/g, '_')}_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Exportado com sucesso!', description: 'Arquivo CSV gerado.' });
  }, [activeTab, selectedProjectId, projects, enrichedEtapas, categoryComparison, toast]);

  // Abrir Modal de Nova Etapa
  const handleOpenNewEtapa = () => {
    setEtapaToEdit(null);
    setEtapaNameInput('');
    setEtapaOrdemInput((etapas.length > 0 ? Math.max(...etapas.map(e => e.ordem || 0)) : 0) + 1);
    setEtapaStatusInput('Planejado');
    setIsEtapaModalOpen(true);
  };

  // Abrir Modal de Editar Etapa
  const handleOpenEditEtapa = (etapa: OrcamentoEtapa) => {
    setEtapaToEdit(etapa);
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
    setEditItemQtd(String(item.quantidade));
    setEditItemValorUnit(String(item.valor_unitario));
  };

  const currentProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId);
  }, [projects, selectedProjectId]);

  return (
    <div className="w-full px-4 sm:px-6 py-5 space-y-4 animate-in fade-in-50">
      {/* ========================================================= */}
      {/* 1. CABEÇALHO & SELETOR DE OBRA                            */}
      {/* ========================================================= */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Esquerda: Identificação do Módulo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
            <CalculatorIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-[#F8FAFC] tracking-tight">
              Orçamentos & Planejamento
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
              Etapas executivas, insumos previstos e controle orçamentário por categoria de engenharia.
            </p>
          </div>
        </div>

        {/* Direita: Ações Rápidas */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCopyModalOpen(true)}
            disabled={!selectedProjectId || projects.length <= 1}
            className="h-9 text-xs font-semibold border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-brand-dark-800 gap-1.5 cursor-pointer"
            title="Copiar estrutura de etapas e insumos de outra obra"
          >
            <CopyIcon className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Copiar de Outra Obra</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={!selectedProjectId || (activeTab === 'etapas' && enrichedEtapas.length === 0)}
            className="h-9 text-xs font-semibold border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-brand-dark-800 gap-1.5 cursor-pointer"
            title="Exportar planilha de orçamento em CSV"
          >
            <DownloadIcon className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenNewEtapa}
            disabled={!selectedProjectId}
            className="h-9 text-xs font-bold bg-[#4F46E5] hover:bg-indigo-600 dark:bg-[#6366F1] dark:hover:bg-indigo-500 text-white gap-1.5 shadow-sm shadow-indigo-600/30 cursor-pointer"
          >
            <PlusIcon className="h-4 w-4" />
            <span>+ Nova Etapa</span>
          </Button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. BARRA DE CONTEXTO: SELETOR DE OBRA & ABAS DE VISÃO     */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl p-3 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Seletor da Obra Ativa */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ConstructionIcon className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] whitespace-nowrap">Obra em Análise:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedEtapaId(null);
              }}
              className="h-9 text-xs font-bold bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg px-2.5 py-1 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-xs truncate"
            >
              {projects.length === 0 ? (
                <option value="">Nenhuma obra cadastrada</option>
              ) : (
                projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.status ? `(${p.status})` : ''}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Abas de Visualização */}
        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#162235] p-1 border border-slate-200 dark:border-[#273549] self-start md:self-auto">
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
            <span>Por Etapas da Obra ({enrichedEtapas.length})</span>
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
      </div>

      {/* ========================================================= */}
      {/* 3. GRID DE 4 KPIS DINÂMICOS DA OBRA SELECIONADA           */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Orçamento Total Previsto */}
        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-4 rounded-xl shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <CalculatorIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">Orçamento Total Previsto</p>
              <p className="text-lg font-bold text-slate-800 dark:text-[#F8FAFC] truncate font-mono">
                {formatCurrency(kpis.totalPrevisto)}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-indigo-700 dark:text-[#818CF8] bg-[#EEF2FF] dark:bg-indigo-500/[0.12] px-2.5 py-0.5 rounded-full border border-indigo-200/80 dark:border-indigo-500/20 whitespace-nowrap shrink-0">
            {kpis.etapasCount} etapas
          </span>
        </div>

        {/* Card 2: Divisão Material vs Mão de Obra */}
        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-4 rounded-xl shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
              <PackageIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">Material vs. Mão de Obra</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 font-mono" title="Material">
                  📦 {formatCurrency(kpis.totalMaterial)}
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 font-mono" title="Mão de Obra">
                  👷 {formatCurrency(kpis.totalMaoDeObra)}
                </span>
              </div>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-800 whitespace-nowrap shrink-0">
            {kpis.itensCount} itens
          </span>
        </div>

        {/* Card 3: Gasto Realizado em Notas */}
        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-4 rounded-xl shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
              kpis.percentualConsumidoMaterial > 100
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-600'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
            }`}>
              <TrendingUpIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">Realizado em Notas Fiscais</p>
              <p className="text-lg font-bold text-slate-800 dark:text-[#F8FAFC] truncate font-mono">
                {formatCurrency(kpis.totalRealizadoNotas)}
              </p>
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${
            kpis.percentualConsumidoMaterial > 100
              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400'
              : kpis.percentualConsumidoMaterial > 85
              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
          }`}>
            {kpis.percentualConsumidoMaterial.toFixed(1)}% de materiais
          </span>
        </div>

        {/* Card 4: Saldo Disponível para Compras */}
        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-4 rounded-xl shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
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
            categoriesStatus.estouradas === 0
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
          }`}>
            {categoriesStatus.estouradas === 0 ? '11 metas em dia' : `${categoriesStatus.estouradas} acima da meta`}
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ABA 1: VISÃO POR ETAPAS EM SPLIT VIEW RETRÁTIL INLINE     */}
      {/* ========================================================= */}
      {activeTab === 'etapas' && (
        <div className="space-y-0">
          {/* Barra Superior Colada na Tabela */}
          <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-t-xl px-4 py-3 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC]">
                Cronograma Executivo de Etapas
              </span>
              <span className="text-xs text-slate-400">
                ({enrichedEtapas.length} etapas cadastradas nesta obra)
              </span>
            </div>

            <span className="text-xs text-slate-400 hidden sm:inline">
              Clique em uma etapa para visualizar ou adicionar insumos
            </span>
          </div>

          {/* Área em Split View Retrátil Inline */}
          <div className={`overflow-hidden rounded-b-xl border-x border-b border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111827] shadow-xs flex flex-col lg:flex-row ${
            selectedEtapa && isDesktop ? 'items-stretch' : ''
          }`}>
            {/* ----------------------------------------------------- */}
            {/* LADO ESQUERDO: TABELA RETRÁTIL DE ETAPAS               */}
            {/* ----------------------------------------------------- */}
            <div className={`flex flex-col ${
              selectedEtapa && isDesktop
                ? 'w-full lg:w-[48%] xl:w-[46%] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-gray-800'
                : 'w-full'
            }`}>
              <div className={`flex-1 overflow-x-auto ${selectedEtapa && isDesktop ? 'max-h-[calc(100vh-310px)] overflow-y-auto custom-scrollbar' : ''}`}>
                <table className="w-full text-sm text-left text-slate-600 dark:text-gray-400">
                  <thead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] bg-slate-50 dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#1E293B] sticky top-0 z-10">
                    <tr>
                      <th className="px-3 sm:px-4 py-3.5 font-semibold">Ordem & Etapa</th>
                      <th className="px-3 sm:px-4 py-3.5 font-semibold">Status</th>
                      <th className={selectedEtapa && isDesktop ? 'hidden' : 'px-4 py-3.5 font-semibold'}>Insumos & Categorias</th>
                      <th className={selectedEtapa && isDesktop ? 'hidden' : 'px-4 py-3.5 font-semibold text-right whitespace-nowrap'}>Material</th>
                      <th className={selectedEtapa && isDesktop ? 'hidden' : 'px-4 py-3.5 font-semibold text-right whitespace-nowrap'}>Mão de Obra</th>
                      <th className="px-3 sm:px-4 py-3.5 font-semibold text-right whitespace-nowrap">Total Previsto</th>
                      <th className="px-2 sm:px-4 py-3.5 font-semibold text-center w-12 sm:w-16">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800 bg-white dark:bg-[#111827]">
                    {isLoadingEtapas ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-gray-500">
                          Carregando etapas do orçamento...
                        </td>
                      </tr>
                    ) : enrichedEtapas.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center">
                          <div className="max-w-xs mx-auto space-y-2">
                            <CalculatorIcon className="h-8 w-8 mx-auto text-slate-300 dark:text-gray-600" />
                            <p className="font-semibold text-slate-700 dark:text-gray-300">Nenhuma etapa cadastrada</p>
                            <p className="text-slate-400 text-xs">
                              Crie sua primeira etapa executiva ou copie de outra obra.
                            </p>
                            <Button size="sm" onClick={handleOpenNewEtapa} className="mt-2 bg-indigo-600 text-white">
                              + Nova Etapa
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      enrichedEtapas.map((etapa) => {
                        const isSelected = selectedEtapa?.id === etapa.id;

                        return (
                          <tr
                            id={`etapa-row-${etapa.id}`}
                            key={etapa.id}
                            onClick={() => setSelectedEtapaId(etapa.id)}
                            className={`group cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[#F5F3FF] dark:bg-indigo-500/[0.08] border-l-4 border-[#818CF8] font-semibold text-slate-800 dark:text-[#F8FAFC]'
                                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            {/* 1. Ordem & Nome da Etapa */}
                            <td className="px-3 sm:px-4 py-3 min-w-0">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-[#1E293B] text-slate-600 dark:text-slate-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                                  {etapa.ordem}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <span className={`text-xs block truncate ${isSelected ? 'font-bold text-indigo-700 dark:text-indigo-300' : 'font-semibold text-slate-900 dark:text-white'}`} title={etapa.nome}>
                                    {etapa.nome}
                                  </span>
                                  {/* Subtítulo quando retraída */}
                                  {selectedEtapa && isDesktop && (
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        {etapa.itens_count} itens
                                      </span>
                                      {etapa.categorias?.slice(0, 2).map((cat) => (
                                        <span key={cat} className={`text-[9px] px-1 py-0.2 rounded border truncate max-w-[110px] ${getCategoryBadgeClass(cat)}`}>
                                          {cat}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* 2. Status */}
                            <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                              {getStatusBadge(etapa.status)}
                            </td>

                            {/* 3. Insumos & Categorias (oculto quando retraída) */}
                            <td className={selectedEtapa && isDesktop ? 'hidden' : 'px-4 py-3'}>
                              <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                                <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 mr-1">
                                  {etapa.itens_count} {etapa.itens_count === 1 ? 'item' : 'itens'}
                                </span>
                                {etapa.categorias?.slice(0, 3).map((cat) => (
                                  <span key={cat} className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${getCategoryBadgeClass(cat)}`}>
                                    {cat}
                                  </span>
                                ))}
                                {(etapa.categorias?.length || 0) > 3 && (
                                  <span className="text-[10px] text-slate-400">
                                    +{(etapa.categorias?.length || 0) - 3}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* 4. Previsto Material (oculto quando retraída) */}
                            <td className={selectedEtapa && isDesktop ? 'hidden' : 'px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-gray-300'}>
                              {formatCurrency(etapa.total_material || 0)}
                            </td>

                            {/* 5. Previsto Mão de Obra (oculto quando retraída) */}
                            <td className={selectedEtapa && isDesktop ? 'hidden' : 'px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-gray-300'}>
                              {formatCurrency(etapa.total_mao_de_obra || 0)}
                            </td>

                            {/* 6. Total Previsto da Etapa */}
                            <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                              {formatCurrency(etapa.total_previsto || 0)}
                            </td>

                            {/* 7. Ações */}
                            <td className="px-2 sm:px-4 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditEtapa(etapa)}
                                  className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-dark-800 cursor-pointer"
                                  title="Editar etapa"
                                >
                                  <EditIcon className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEtapaToDelete(etapa)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                                  title="Excluir etapa"
                                >
                                  <Trash2Icon className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Rodapé Fixo da Tabela de Etapas */}
              <div className="h-10 shrink-0 bg-white dark:bg-[#111827] border-t border-[#E2E8F0] dark:border-[#1E293B] px-4 flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
                <span>
                  Mostrando <strong className="text-slate-800 dark:text-white font-mono">{enrichedEtapas.length}</strong> etapas executivas
                </span>
                <span className="font-mono text-xs font-bold text-slate-800 dark:text-white">
                  Total da Obra: {formatCurrency(kpis.totalPrevisto)}
                </span>
              </div>
            </div>

            {/* ----------------------------------------------------- */}
            {/* LADO DIREITO: INSPECTOR INLINE DA ETAPA (SPLIT VIEW)  */}
            {/* ----------------------------------------------------- */}
            {selectedEtapa && isDesktop && (
              <div className="w-full lg:w-[52%] xl:w-[54%] flex flex-col bg-white dark:bg-[#111827] overflow-hidden animate-in fade-in-0 duration-150">
                {/* Header Fixo do Inspector */}
                <div className="h-14 px-4 sm:px-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-brand-dark-800/20">
                  {/* Esquerda: Nome e Seletor Rápido de Status */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider truncate">
                      {selectedEtapa.nome}
                    </span>

                    {/* Status rápido toggle */}
                    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#162235] p-0.5 border border-slate-200 dark:border-[#273549] text-xs">
                      {(['Planejado', 'Em Execução', 'Concluído'] as OrcamentoEtapaStatus[]).map(st => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => updateEtapaStatusMutation.mutate({ etapaId: selectedEtapa.id, status: st })}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                            selectedEtapa.status === st
                              ? 'bg-white dark:bg-[#1E293B] text-indigo-600 dark:text-indigo-400 shadow-xs'
                              : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Direita: Navegação [↑] [↓], Editar, Excluir, [✕] */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-mono text-slate-400 dark:text-gray-500 mr-1 hidden sm:inline">
                      {selectedEtapaIndex + 1} de {enrichedEtapas.length}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevEtapa}
                      disabled={!hasPrevEtapa}
                      className="h-8 w-8 p-0 border-slate-200 dark:border-gray-700 disabled:opacity-30 cursor-pointer"
                      title="Etapa anterior (Seta ↑)"
                    >
                      <ChevronUpIcon className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextEtapa}
                      disabled={!hasNextEtapa}
                      className="h-8 w-8 p-0 border-slate-200 dark:border-gray-700 disabled:opacity-30 cursor-pointer"
                      title="Próxima etapa (Seta ↓)"
                    >
                      <ChevronDownIcon className="h-4 w-4" />
                    </Button>

                    <div className="h-4 w-px bg-slate-200 dark:border-gray-800 mx-1" />

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditEtapa(selectedEtapa)}
                      className="h-8 px-2.5 text-xs font-semibold border-slate-200 dark:border-gray-700 gap-1 cursor-pointer"
                      title="Editar dados da etapa"
                    >
                      <EditIcon className="h-3.5 w-3.5 text-slate-500" />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEtapaToDelete(selectedEtapa)}
                      className="h-8 px-2 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                      title="Excluir etapa"
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedEtapaId(null)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                      title="Fechar inspector (Esc)"
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Conteúdo com Scroll Independente */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4 max-h-[calc(100vh-310px)]">
                  {/* Card de Resumo da Etapa */}
                  <div className="bg-slate-50 dark:bg-brand-dark-800/40 border border-slate-200/80 dark:border-gray-800 rounded-xl p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400">Total Orçado Nesta Etapa</span>
                      <p className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                        {formatCurrency(selectedEtapa.total_previsto || 0)}
                      </p>
                    </div>
                    <div className="text-right text-xs space-y-0.5">
                      <p className="font-mono text-slate-600 dark:text-gray-300">
                        📦 Material: <strong>{formatCurrency(selectedEtapa.total_material || 0)}</strong>
                      </p>
                      <p className="font-mono text-slate-600 dark:text-gray-300">
                        👷 Mão de Obra: <strong>{formatCurrency(selectedEtapa.total_mao_de_obra || 0)}</strong>
                      </p>
                    </div>
                  </div>

                  {/* FORMULÁRIO INLINE RÁPIDO DE ADIÇÃO DE ITEM (PREENCHIMENTO 100% MANUAL) */}
                  <div className="bg-white dark:bg-[#111827] border border-indigo-200/80 dark:border-indigo-900/60 rounded-xl p-3.5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <PlusIcon className="h-3.5 w-3.5" />
                        Adicionar Item / Gasto nesta Etapa
                      </span>
                      <span className="text-[11px] text-slate-400">Preenchimento Manual</span>
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
                            Descrição do Insumo ou Serviço *
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: Concreto Usinado FCK 25, Tábuas, Diária Pedreiro..."
                            value={newItemDescricao}
                            onChange={(e) => setNewItemDescricao(e.target.value)}
                            className="w-full h-8 px-2.5 text-xs bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            required
                          />
                        </div>

                        {/* 2. Tipo: Material ou Mão de Obra */}
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block mb-1">
                            Tipo *
                          </label>
                          <select
                            value={newItemTipo}
                            onChange={(e) => setNewItemTipo(e.target.value as OrcamentoItemTipo)}
                            className="w-full h-8 px-2 text-xs bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="material">📦 Material</option>
                            <option value="mao_de_obra">👷 Mão de Obra</option>
                          </select>
                        </div>

                        {/* 3. Categoria (11 Opções) */}
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block mb-1">
                            Categoria *
                          </label>
                          <select
                            value={newItemCategoria}
                            onChange={(e) => setNewItemCategoria(e.target.value as CategoriaNota)}
                            className="w-full h-8 px-2 text-xs bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate"
                          >
                            {CATEGORIA_NOTA_ENUM.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                        {/* 4. Quantidade */}
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block mb-1">
                            Qtd *
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={newItemQtd}
                            onChange={(e) => setNewItemQtd(e.target.value)}
                            className="w-full h-8 px-2.5 text-xs font-mono bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            required
                          />
                        </div>

                        {/* 5. Valor Unitário (R$) */}
                        <div className="sm:col-span-4">
                          <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block mb-1">
                            Valor Unitário (R$) *
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0,00"
                            value={newItemValorUnit}
                            onChange={(e) => setNewItemValorUnit(e.target.value)}
                            className="w-full h-8 px-2.5 text-xs font-mono bg-slate-50 dark:bg-[#162235] border border-slate-200 dark:border-[#273549] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            required
                          />
                        </div>

                        {/* 6. Total Calculado Dinamicamente */}
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                            Total Previsto
                          </label>
                          <div className="h-8 px-2.5 rounded-lg bg-slate-100 dark:bg-brand-dark-800 flex items-center font-mono font-bold text-xs text-slate-800 dark:text-white">
                            {formatCurrency(
                              (parseFloat(newItemQtd.replace(',', '.')) || 0) *
                              (parseFloat(newItemValorUnit.replace(',', '.')) || 0)
                            )}
                          </div>
                        </div>

                        {/* 7. Botão Adicionar */}
                        <div className="sm:col-span-2">
                          <Button
                            type="submit"
                            size="sm"
                            disabled={addItemMutation.isPending || !newItemDescricao.trim()}
                            className="w-full h-8 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-1 cursor-pointer"
                          >
                            <PlusIcon className="h-3.5 w-3.5" />
                            <span>Adicionar</span>
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* TABELA DE ITENS DA ETAPA */}
                  <div className="border border-slate-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 dark:bg-[#162235] px-3.5 py-2 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-gray-300">
                        Insumos & Serviços Cadastrados ({selectedEtapa.itens?.length || 0})
                      </span>
                    </div>

                    {(!selectedEtapa.itens || selectedEtapa.itens.length === 0) ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        Nenhum item adicionado a esta etapa. Preencha o formulário acima para orçar insumos ou mão de obra.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 bg-slate-50/70 dark:bg-[#111827] border-b border-slate-200 dark:border-gray-800">
                            <tr>
                              <th className="px-3 py-2 font-semibold">Descrição</th>
                              <th className="px-2 py-2 font-semibold whitespace-nowrap">Tipo</th>
                              <th className="px-2 py-2 font-semibold">Categoria</th>
                              <th className="px-2 py-2 font-semibold text-right">Qtd</th>
                              <th className="px-2 py-2 font-semibold text-right">Unitário</th>
                              <th className="px-3 py-2 font-semibold text-right">Total</th>
                              <th className="px-2 py-2 text-center w-12">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                            {selectedEtapa.itens.map(item => (
                              <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                                  {item.descricao}
                                </td>
                                <td className="px-2 py-2.5 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                    item.tipo === 'material'
                                      ? 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                  }`}>
                                    {item.tipo === 'material' ? '📦 Material' : '👷 Mão de Obra'}
                                  </span>
                                </td>
                                <td className="px-2 py-2.5 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium border ${getCategoryBadgeClass(item.categoria)}`}>
                                    {item.categoria}
                                  </span>
                                </td>
                                <td className="px-2 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-gray-300">
                                  {item.quantidade}
                                </td>
                                <td className="px-2 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-gray-300">
                                  {formatCurrency(item.valor_unitario)}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                                  {formatCurrency(item.valor_total)}
                                </td>
                                <td className="px-2 py-2.5 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditItem(item)}
                                      className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                                      title="Editar item"
                                    >
                                      <EditIcon className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setItemToDelete(item)}
                                      className="p-1 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                                      title="Excluir item"
                                    >
                                      <Trash2Icon className="h-3 w-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
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
      {/* ABA 2: VISÃO "PREVISTO VS. REALIZADO POR CATEGORIA"        */}
      {/* ========================================================= */}
      {activeTab === 'categorias' && (
        <div className="space-y-0">
          {/* Barra Superior Colada na Tabela */}
          <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-t-xl px-4 py-3 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC]">
                Controle Orçamentário Gerencial por Categoria de Engenharia
              </span>
              <span className="text-xs text-slate-400">
                (11 Categorias Oficiais do Sistema JPL Conecta)
              </span>
            </div>

            <span className="text-xs text-slate-400 font-mono">
              Base: Insumos Orçados vs. Notas Fiscais emitidas para {currentProject?.name}
            </span>
          </div>

          {/* Tabela de 11 Categorias */}
          <div className="overflow-hidden rounded-b-xl border-x border-b border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111827] shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600 dark:text-gray-400">
                <thead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] bg-slate-50 dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#1E293B] sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3.5 font-semibold">Categoria de Engenharia</th>
                    <th className="px-3 py-3.5 font-semibold text-right whitespace-nowrap">Orçado (Material)</th>
                    <th className="px-3 py-3.5 font-semibold text-right whitespace-nowrap">Orçado (Mão de Obra)</th>
                    <th className="px-3 py-3.5 font-semibold text-right whitespace-nowrap">Orçado Total</th>
                    <th className="px-3 py-3.5 font-semibold text-right whitespace-nowrap">Gasto Real (Notas Fiscais)</th>
                    <th className="px-4 py-3.5 font-semibold w-48">Consumo / Progresso</th>
                    <th className="px-4 py-3.5 font-semibold text-right whitespace-nowrap">Saldo da Categoria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800 bg-white dark:bg-[#111827]">
                  {categoryComparison.map(cat => {
                    const isExceeded = cat.saldo < 0;
                    const progressColor = cat.percentual > 100
                      ? 'bg-rose-500'
                      : cat.percentual > 85
                      ? 'bg-amber-500'
                      : 'bg-emerald-500';

                    return (
                      <tr key={cat.categoria} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        {/* 1. Nome da Categoria com Chip Temático */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getCategoryBadgeClass(cat.categoria)}`}>
                            {cat.categoria}
                          </span>
                        </td>

                        {/* 2. Orçado Material */}
                        <td className="px-3 py-3.5 text-right font-mono tabular-nums text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                          {formatCurrency(cat.orcadoMaterial)}
                        </td>

                        {/* 3. Orçado Mão de Obra */}
                        <td className="px-3 py-3.5 text-right font-mono tabular-nums text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                          {formatCurrency(cat.orcadoMaoDeObra)}
                        </td>

                        {/* 4. Orçado Total */}
                        <td className="px-3 py-3.5 text-right font-mono tabular-nums font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                          {formatCurrency(cat.orcadoTotal)}
                        </td>

                        {/* 5. Gasto Real Notas Fiscais */}
                        <td className={`px-3 py-3.5 text-right font-mono tabular-nums font-bold text-xs sm:text-sm ${
                          isExceeded ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                        }`}>
                          {formatCurrency(cat.realizadoNotas)}
                        </td>

                        {/* 6. Barra de Progresso / Consumo */}
                        <td className="px-4 py-3.5 min-w-[180px]">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span className="text-slate-400">Consumido:</span>
                              <span className={`font-bold ${
                                cat.percentual > 100 ? 'text-rose-600' : cat.percentual > 85 ? 'text-amber-600' : 'text-emerald-600'
                              }`}>
                                {cat.percentual.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-brand-dark-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
                                style={{ width: `${Math.min(cat.percentual, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* 7. Saldo da Categoria */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex flex-col items-end">
                            <span className={`font-mono font-bold text-xs sm:text-sm ${
                              isExceeded ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {isExceeded ? `-${formatCurrency(Math.abs(cat.saldo))}` : formatCurrency(cat.saldo)}
                            </span>
                            <span className={`text-[10px] font-semibold ${
                              isExceeded ? 'text-rose-500' : 'text-slate-400'
                            }`}>
                              {isExceeded ? 'Acima do Orçado' : 'Dentro da Meta'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Rodapé Consolidado */}
                <tfoot className="bg-slate-50 dark:bg-[#162235] border-t-2 border-slate-200 dark:border-gray-800 text-xs font-bold text-slate-800 dark:text-white">
                  <tr>
                    <td className="px-4 py-3">Total Consolidado da Obra</td>
                    <td className="px-3 py-3 text-right font-mono">{formatCurrency(kpis.totalMaterial)}</td>
                    <td className="px-3 py-3 text-right font-mono">{formatCurrency(kpis.totalMaoDeObra)}</td>
                    <td className="px-3 py-3 text-right font-mono text-indigo-600 dark:text-indigo-400">{formatCurrency(kpis.totalPrevisto)}</td>
                    <td className="px-3 py-3 text-right font-mono">{formatCurrency(kpis.totalRealizadoNotas)}</td>
                    <td className="px-4 py-3 text-center font-mono">
                      {kpis.percentualConsumidoMaterial.toFixed(1)}% consumido
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${kpis.saldoCompras >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(kpis.saldoCompras)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. MODAL: NOVA / EDITAR ETAPA                             */}
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
                  {etapaToEdit ? 'Editar Etapa do Cronograma' : 'Nova Etapa do Orçamento'}
                </ResponsiveModalTitle>
                <ResponsiveModalDescription>
                  Defina o nome da fase executiva e a sequência cronológica na obra.
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
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                Nome da Etapa Executiva *
              </label>
              <input
                type="text"
                placeholder="Ex: Serviços Preliminares, Viga Baldrame, Alvenaria Térreo..."
                value={etapaNameInput}
                onChange={(e) => setEtapaNameInput(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-brand-dark-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Ordem no Cronograma
                </label>
                <input
                  type="number"
                  min="1"
                  value={etapaOrdemInput}
                  onChange={(e) => setEtapaOrdemInput(parseInt(e.target.value) || 1)}
                  className="w-full h-9 px-3 text-xs font-mono bg-slate-50 dark:bg-brand-dark-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Status Inicial
                </label>
                <select
                  value={etapaStatusInput}
                  onChange={(e) => setEtapaStatusInput(e.target.value as OrcamentoEtapaStatus)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-brand-dark-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                disabled={saveEtapaMutation.isPending || !etapaNameInput.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
              >
                {saveEtapaMutation.isPending ? 'Salvando...' : etapaToEdit ? 'Salvar Alterações' : 'Criar Etapa'}
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
                <ResponsiveModalDescription>Altere as informações de custo e classificação do item.</ResponsiveModalDescription>
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
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                Descrição do Insumo ou Serviço *
              </label>
              <input
                type="text"
                value={editItemDescricao}
                onChange={(e) => setEditItemDescricao(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-brand-dark-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Tipo *
                </label>
                <select
                  value={editItemTipo}
                  onChange={(e) => setEditItemTipo(e.target.value as OrcamentoItemTipo)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-brand-dark-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="material">📦 Material</option>
                  <option value="mao_de_obra">👷 Mão de Obra</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Categoria *
                </label>
                <select
                  value={editItemCategoria}
                  onChange={(e) => setEditItemCategoria(e.target.value as CategoriaNota)}
                  className="w-full h-9 px-2 text-xs bg-slate-50 dark:bg-brand-dark-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate"
                >
                  {CATEGORIA_NOTA_ENUM.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Quantidade *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={editItemQtd}
                  onChange={(e) => setEditItemQtd(e.target.value)}
                  className="w-full h-9 px-3 text-xs font-mono bg-slate-50 dark:bg-brand-dark-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Valor Unitário (R$) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={editItemValorUnit}
                  onChange={(e) => setEditItemValorUnit(e.target.value)}
                  className="w-full h-9 px-3 text-xs font-mono bg-slate-50 dark:bg-brand-dark-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-brand-dark-800 p-2.5 rounded-lg flex items-center justify-between text-xs">
              <span className="text-slate-500">Novo Total Previsto:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {formatCurrency(
                  (parseFloat(editItemQtd.replace(',', '.')) || 0) *
                  (parseFloat(editItemValorUnit.replace(',', '.')) || 0)
                )}
              </span>
            </div>

            <ResponsiveModalFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItemToEdit(null)}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saveEditItemMutation.isPending || !editItemDescricao.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
              >
                {saveEditItemMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </ResponsiveModalFooter>
          </form>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* ========================================================= */}
      {/* 6. MODAL: COPIAR DE OUTRA OBRA                            */}
      {/* ========================================================= */}
      <ResponsiveModal open={isCopyModalOpen} onOpenChange={setIsCopyModalOpen}>
        <ResponsiveModalContent size="sm">
          <ResponsiveModalHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 flex items-center justify-center">
                <CopyIcon className="h-4 w-4" />
              </div>
              <div>
                <ResponsiveModalTitle>Copiar Orçamento de Outra Obra</ResponsiveModalTitle>
                <ResponsiveModalDescription>
                  Importe todas as etapas e itens já planejados em outro canteiro de obras para <strong>{currentProject?.name}</strong>.
                </ResponsiveModalDescription>
              </div>
            </div>
          </ResponsiveModalHeader>

          <div className="space-y-4 p-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                Selecione a Obra de Origem *
              </label>
              <select
                value={copySourceProjectId}
                onChange={(e) => setCopySourceProjectId(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-slate-50 dark:bg-brand-dark-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Selecione uma obra...</option>
                {projects
                  .filter(p => p.id !== selectedProjectId)
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-1">Aviso Importante:</p>
              <p>
                As etapas e insumos da obra selecionada serão clonados para esta obra atual com status inicial <em>Planejado</em>. Os itens existentes não serão apagados.
              </p>
            </div>

            <ResponsiveModalFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCopyModalOpen(false)}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => copyBudgetMutation.mutate()}
                disabled={copyBudgetMutation.isPending || !copySourceProjectId}
                className="bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
              >
                {copyBudgetMutation.isPending ? 'Copiando...' : 'Clonar Orçamento para Esta Obra'}
              </Button>
            </ResponsiveModalFooter>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* ========================================================= */}
      {/* 7. MODAIS DE CONFIRMAÇÃO DE EXCLUSÃO                      */}
      {/* ========================================================= */}
      <ConfirmationModal
        isOpen={!!etapaToDelete}
        onClose={() => setEtapaToDelete(null)}
        onConfirm={() => etapaToDelete && deleteEtapaMutation.mutate(etapaToDelete)}
        title="Excluir Etapa do Orçamento"
        description={
          <>
            Tem certeza que deseja excluir a etapa <strong>{etapaToDelete?.nome}</strong> e todos os seus itens orçados?
            Esta ação não poderá ser desfeita.
          </>
        }
        confirmText="Excluir Etapa"
        isLoading={deleteEtapaMutation.isPending}
      />

      <ConfirmationModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => itemToDelete && deleteItemMutation.mutate(itemToDelete)}
        title="Excluir Item do Orçamento"
        description={
          <>
            Tem certeza que deseja excluir o item <strong>{itemToDelete?.descricao}</strong> desta etapa?
          </>
        }
        confirmText="Excluir Item"
        isLoading={deleteItemMutation.isPending}
      />
    </div>
  );
};

export default Orcamentos;
