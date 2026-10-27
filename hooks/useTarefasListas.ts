import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Task, Project, Collaborator } from '../types';
import { EnrichedTask, TarefasFilters } from '../components/tarefas/types';
import { toISODate } from '../lib/taskParser';

// Abas da Central de Tarefas: Hoje & Amanhã, Programadas Futuras, Compras, Concluídas
export type TarefasTab = 'today' | 'upcoming' | 'purchases' | 'completed';

export interface TarefasCounts {
  today: number;
  upcoming: number;
  purchases: number;
  completed: number;
}

export const initialFilters: TarefasFilters = {
  project_id: null,
  responsavel_id: null,
  prioridade: 'all',
  start_date: null,
  end_date: null,
};

export interface UseTarefasListasParams {
  allTasks: Task[];
  projectsMap: Map<string, Project>;
  collaboratorsMap: Map<string, Collaborator>;
  isDesktop: boolean;
}

export interface UseTarefasListasReturn {
  todayStr: string;
  tomorrowStr: string;
  activeTab: TarefasTab;
  setActiveTab: React.Dispatch<React.SetStateAction<TarefasTab>>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  filters: TarefasFilters;
  setFilters: React.Dispatch<React.SetStateAction<TarefasFilters>>;
  isFilterDrawerOpen: boolean;
  setIsFilterDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  enrichedTasks: EnrichedTask[];
  activeFiltersCount: number;
  filteredTasks: EnrichedTask[];
  todayAndTomorrowTasks: EnrichedTask[];
  upcomingTasks: EnrichedTask[];
  purchaseTasks: EnrichedTask[];
  completedTasks: EnrichedTask[];
  counts: TarefasCounts;
  activeTabTasks: EnrichedTask[];
  selectedTask: EnrichedTask | null;
  setSelectedTask: React.Dispatch<React.SetStateAction<EnrichedTask | null>>;
  isMobileDetailDrawerOpen: boolean;
  setIsMobileDetailDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedTaskIndex: number;
  hasPrevTask: boolean;
  hasNextTask: boolean;
  handlePrevTask: () => void;
  handleNextTask: () => void;
  handleSelectTask: (task: EnrichedTask) => void;
  handleTabChange: (tab: TarefasTab) => void;
}

export function useTarefasListas({
  allTasks,
  projectsMap,
  collaboratorsMap,
  isDesktop,
}: UseTarefasListasParams): UseTarefasListasReturn {
  useLocation();
  useNavigate();

  const [activeTab, setActiveTab] = useState<TarefasTab>('today');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filters, setFilters] = useState<TarefasFilters>(initialFilters);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<EnrichedTask | null>(null);
  const [isMobileDetailDrawerOpen, setIsMobileDetailDrawerOpen] = useState<boolean>(false);

  // -------------------------------------------------------------
  // DATAS RELATIVAS ÚTEIS
  // -------------------------------------------------------------
  const todayStr = useMemo(() => toISODate(new Date()), []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toISODate(d);
  }, []);

  // -------------------------------------------------------------
  // CLASSIFICAÇÃO DAS TAREFAS POR DATA E PRAZO
  // -------------------------------------------------------------
  const enrichedTasks = useMemo<EnrichedTask[]>(() => {
    return allTasks.map((t) => {
      const p = projectsMap.get(t.project_id);
      const c = t.responsavel_execucao_id ? collaboratorsMap.get(t.responsavel_execucao_id) : null;
      const isPurchase =
        (t.observacoes || '').includes('[COMPRA]') ||
        (t.description || '').toLowerCase().includes('[compra]');
      const isCompleted = t.status === 'Concluída';
      const isDelayed = !isCompleted && !!t.data_fim_prevista && t.data_fim_prevista < todayStr;
      const isTodayTask = t.data_fim_prevista === todayStr;
      const isTomorrowTask = t.data_fim_prevista === tomorrowStr;
      const isUpcomingTask =
        !isCompleted && !!t.data_fim_prevista && t.data_fim_prevista > tomorrowStr;

      let daysDiff: number | null = null;
      if (t.data_fim_prevista) {
        const targetD = new Date(t.data_fim_prevista + 'T00:00:00');
        const nowD = new Date(todayStr + 'T00:00:00');
        daysDiff = Math.round((targetD.getTime() - nowD.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        ...t,
        projectName: p?.name || 'Obra sem nome',
        collaboratorName: c?.name || null,
        isPurchase,
        isCompleted,
        isDelayed,
        isTodayTask,
        isTomorrowTask,
        isUpcomingTask,
        daysDiff,
      };
    });
  }, [allTasks, projectsMap, collaboratorsMap, todayStr, tomorrowStr]);

  // Atualizar selectedTask se enrichedTasks mudar (após mutações)
  useEffect(() => {
    if (selectedTask) {
      const updated = enrichedTasks.find((t) => t.id === selectedTask.id);
      if (updated) {
        setSelectedTask(updated);
      }
    }
  }, [enrichedTasks]);

  // Contagem de filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.project_id) count++;
    if (filters.responsavel_id) count++;
    if (filters.prioridade !== 'all') count++;
    if (filters.start_date || filters.end_date) count++;
    return count;
  }, [filters]);

  // Filtragem por Obra, Responsável, Prioridade, Período e Busca
  const filteredTasks = useMemo(() => {
    return enrichedTasks.filter((t) => {
      if (filters.project_id && t.project_id !== filters.project_id) return false;
      if (filters.responsavel_id && t.responsavel_execucao_id !== filters.responsavel_id)
        return false;
      if (filters.prioridade !== 'all' && t.prioridade !== filters.prioridade) return false;
      if (filters.start_date && t.data_fim_prevista && t.data_fim_prevista < filters.start_date)
        return false;
      if (filters.end_date && t.data_fim_prevista && t.data_fim_prevista > filters.end_date)
        return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchTitle = (t.title || '').toLowerCase().includes(term);
        const matchCollab = (t.collaboratorName || '').toLowerCase().includes(term);
        const matchProject = (t.projectName || '').toLowerCase().includes(term);
        if (!matchTitle && !matchCollab && !matchProject) return false;
      }
      return true;
    });
  }, [enrichedTasks, filters, searchTerm]);

  // Aba 1: Hoje & Amanhã (inclui Atrasadas e tarefas sem data)
  const todayAndTomorrowTasks = useMemo(() => {
    return filteredTasks.filter(
      (t) =>
        !t.isCompleted &&
        !t.isPurchase &&
        (!t.data_fim_prevista || t.data_fim_prevista <= tomorrowStr)
    );
  }, [filteredTasks, tomorrowStr]);

  // Aba 2: Programadas Futuras (vencimento após amanhã)
  const upcomingTasks = useMemo(() => {
    return filteredTasks
      .filter(
        (t) =>
          !t.isCompleted &&
          !t.isPurchase &&
          !!t.data_fim_prevista &&
          t.data_fim_prevista > tomorrowStr
      )
      .sort((a, b) => (a.data_fim_prevista || '').localeCompare(b.data_fim_prevista || ''));
  }, [filteredTasks, tomorrowStr]);

  // Aba 3: Lista de Compras (apenas pendentes)
  const purchaseTasks = useMemo(() => {
    return filteredTasks.filter((t) => t.isPurchase && !t.isCompleted);
  }, [filteredTasks]);

  // Aba 5: Concluídas
  const completedTasks = useMemo(() => {
    return filteredTasks.filter((t) => t.isCompleted);
  }, [filteredTasks]);

  // Contadores para as Abas
  const counts = useMemo<TarefasCounts>(
    () => ({
      today: todayAndTomorrowTasks.length,
      upcoming: upcomingTasks.length,
      purchases: purchaseTasks.length,
      completed: completedTasks.length,
    }),
    [todayAndTomorrowTasks, upcomingTasks, purchaseTasks, completedTasks]
  );

  // Tarefas da Aba Ativa (ordenadas por prazo)
  const activeTabTasks = useMemo(() => {
    let list: EnrichedTask[] = [];
    if (activeTab === 'today') list = todayAndTomorrowTasks;
    else if (activeTab === 'upcoming') list = upcomingTasks;
    else if (activeTab === 'purchases') list = purchaseTasks;
    else if (activeTab === 'completed') list = completedTasks;

    return [...list].sort((a, b) => {
      if (a.data_fim_prevista && b.data_fim_prevista) {
        return a.data_fim_prevista.localeCompare(b.data_fim_prevista);
      }
      if (a.data_fim_prevista && !b.data_fim_prevista) return -1;
      if (!a.data_fim_prevista && b.data_fim_prevista) return 1;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  }, [activeTab, todayAndTomorrowTasks, upcomingTasks, purchaseTasks, completedTasks]);

  // Navegação Sequencial no Painel de Detalhes
  const selectedTaskIndex = useMemo(() => {
    if (!selectedTask) return -1;
    return activeTabTasks.findIndex((t) => t.id === selectedTask.id);
  }, [selectedTask, activeTabTasks]);

  const hasPrevTask = selectedTaskIndex > 0;
  const hasNextTask = selectedTaskIndex >= 0 && selectedTaskIndex < activeTabTasks.length - 1;

  const handlePrevTask = useCallback(() => {
    if (hasPrevTask) {
      setSelectedTask(activeTabTasks[selectedTaskIndex - 1]);
    }
  }, [hasPrevTask, selectedTaskIndex, activeTabTasks]);

  const handleNextTask = useCallback(() => {
    if (hasNextTask) {
      setSelectedTask(activeTabTasks[selectedTaskIndex + 1]);
    }
  }, [hasNextTask, selectedTaskIndex, activeTabTasks]);

  // Atalhos de Teclado no Split View (↑ / ↓ para navegar, Esc para fechar)
  useEffect(() => {
    if (!selectedTask || !isDesktop) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(activeTag)) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrevTask();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNextTask();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedTask(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTask, isDesktop, handlePrevTask, handleNextTask]);

  // Acompanhar linha selecionada com scroll automático
  useEffect(() => {
    if (!selectedTask) return;
    const el = document.getElementById(`task-row-${selectedTask.id}`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [selectedTask?.id]);

  const handleSelectTask = (task: EnrichedTask) => {
    setSelectedTask(task);
    if (!isDesktop) {
      setIsMobileDetailDrawerOpen(true);
    }
  };

  const handleTabChange = (tab: TarefasTab) => {
    setActiveTab(tab);
    setSelectedTask(null);
  };

  return {
    todayStr,
    tomorrowStr,
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    isFilterDrawerOpen,
    setIsFilterDrawerOpen,
    enrichedTasks,
    activeFiltersCount,
    filteredTasks,
    todayAndTomorrowTasks,
    upcomingTasks,
    purchaseTasks,
    completedTasks,
    counts,
    activeTabTasks,
    selectedTask,
    setSelectedTask,
    isMobileDetailDrawerOpen,
    setIsMobileDetailDrawerOpen,
    selectedTaskIndex,
    hasPrevTask,
    hasNextTask,
    handlePrevTask,
    handleNextTask,
    handleSelectTask,
    handleTabChange,
  };
}
