import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { initialFilters, TarefasTab } from './useTarefasListas';
import { EnrichedTask, TarefasFilters } from '../components/tarefas/types';
import { Task } from '../types';

export interface UseTarefasDeepLinkParams {
  allTasks: Task[];
  enrichedTasks: EnrichedTask[];
  isLoadingTasks: boolean;
  setSearchTerm: (term: string) => void;
  setFilters: (filters: TarefasFilters) => void;
  setActiveTab: (tab: TarefasTab) => void;
  setSelectedTask: (task: EnrichedTask | null) => void;
  setIsMobileDetailDrawerOpen: (open: boolean) => void;
  isDesktop: boolean;
  tomorrowStr: string;
}

/**
 * Hook para interceptar deep link ?tarefa=<id> na página de Tarefas:
 * - Localiza a tarefa na lista carregada
 * - Se não existir, emite toast "Tarefa não encontrada" e limpa a URL
 * - Limpa filtros e termo de busca para garantir visibilidade
 * - Direciona para a aba apropriada (Concluídas, Compras, Próximas ou Hoje)
 * - Seleciona a tarefa (painel desktop ou gaveta mobile)
 * - Rola suavemente até o elemento na tabela
 * - Remove ?tarefa=<id> da URL com navigate replace
 */
export function useTarefasDeepLink({
  enrichedTasks,
  isLoadingTasks,
  setSearchTerm,
  setFilters,
  setActiveTab,
  setSelectedTask,
  setIsMobileDetailDrawerOpen,
  isDesktop,
  tomorrowStr,
}: UseTarefasDeepLinkParams) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const handledTarefaIdRef = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetTarefaId = params.get('tarefa');

    if (!targetTarefaId) {
      handledTarefaIdRef.current = null;
      return;
    }

    if (handledTarefaIdRef.current === targetTarefaId) {
      return;
    }

    // Se os dados ainda estão sendo carregados pela primeira vez, aguarda
    if (isLoadingTasks) {
      return;
    }

    handledTarefaIdRef.current = targetTarefaId;

    const task = enrichedTasks.find((t) => t.id === targetTarefaId);

    if (!task) {
      toast.error('Tarefa não encontrada');
      navigate('/tarefas', { replace: true });
      return;
    }

    // 1. Limpar filtros e termo de busca
    setSearchTerm('');
    setFilters(initialFilters);

    // 2. Determinar a aba correta
    if (task.isCompleted) {
      setActiveTab('completed');
    } else if (task.isPurchase) {
      setActiveTab('purchases');
    } else if (
      task.data_fim_prevista &&
      task.data_fim_prevista > tomorrowStr
    ) {
      setActiveTab('upcoming');
    } else {
      setActiveTab('today');
    }

    // 3. Selecionar a tarefa para abrir o painel ou gaveta
    setSelectedTask(task);
    if (!isDesktop) {
      setIsMobileDetailDrawerOpen(true);
    }

    // 4. Rolar até a linha da tarefa
    setTimeout(() => {
      const el = document.getElementById(`task-row-${task.id}`);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, 150);

    // 5. Remover o parâmetro da URL com replace
    navigate('/tarefas', { replace: true });
  }, [
    location.search,
    isLoadingTasks,
    enrichedTasks,
    setSearchTerm,
    setFilters,
    setActiveTab,
    setSelectedTask,
    setIsMobileDetailDrawerOpen,
    isDesktop,
    tomorrowStr,
    navigate,
    toast,
  ]);
}
