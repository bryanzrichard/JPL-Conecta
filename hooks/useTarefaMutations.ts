import React, { useState, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { Task, Project, Collaborator } from '../types';
import { EnrichedTask, TarefasFilters } from '../components/tarefas/types';
import { parseQuickTask, toISODate, ParsedTaskResult } from '../lib/taskParser';
import { formatApiError } from '../lib/handleError';

export interface UseTarefaMutationsParams {
  companyId?: string | null;
  userId?: string | null;
  projects: Project[];
  collaborators: Collaborator[];
  projectsMap: Map<string, Project>;
  filters: TarefasFilters;
  tomorrowStr: string;
  selectedTask: EnrichedTask | null;
  setSelectedTask: React.Dispatch<React.SetStateAction<EnrichedTask | null>>;
  taskToDelete: Task | null;
  setTaskToDelete: React.Dispatch<React.SetStateAction<Task | null>>;
}

export function useTarefaMutations({
  companyId,
  userId,
  projects,
  collaborators,
  projectsMap,
  filters,
  tomorrowStr,
  selectedTask,
  setSelectedTask,
  taskToDelete,
  setTaskToDelete,
}: UseTarefaMutationsParams) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Quick Command Input State & Gravador com IA (Gemini Flash)
  const [quickInputText, setQuickInputText] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------
  // PARSER EM TEMPO REAL DO QUICK INPUT
  // -------------------------------------------------------------
  const fallbackProjId = filters.project_id || (projects[0]?.id || null);
  const parsedPreview: ParsedTaskResult = useMemo(() => {
    if (!quickInputText.trim()) {
      return {
        raw: '',
        title: '',
        project_id: fallbackProjId,
        projectName: projectsMap.get(fallbackProjId || '')?.name,
        responsavel_execucao_id: null,
        data_fim_prevista: toISODate(new Date()),
        isTomorrow: false,
        isToday: true,
        isPurchase: false,
      };
    }
    return parseQuickTask(quickInputText, projects, collaborators, fallbackProjId);
  }, [quickInputText, projects, collaborators, fallbackProjId, projectsMap]);

  // -------------------------------------------------------------
  // MUTATIONS (CRIAR, TOGGLE, REAGENDAR, EXCLUIR)
  // -------------------------------------------------------------
  const createQuickTaskMutation = useMutation({
    mutationFn: async (parsed: ParsedTaskResult) => {
      if (!companyId) throw new Error('Empresa não identificada');
      if (!parsed.title.trim()) throw new Error('Digite o título da pendência');

      const targetProjectId = parsed.project_id || projects[0]?.id;
      if (!targetProjectId) throw new Error('Cadastre pelo menos uma obra para vincular a tarefa');

      const insertPayload = {
        company_id: companyId,
        project_id: targetProjectId,
        title: parsed.title.trim(),
        description: parsed.isPurchase ? '[COMPRA] Item para cotação e compra rápida' : '',
        status: 'Planejada' as const,
        prioridade: parsed.isPurchase ? ('Alta' as const) : ('Média' as const),
        responsavel_execucao_id: parsed.responsavel_execucao_id || null,
        data_inicio_prevista: parsed.data_fim_prevista,
        data_fim_prevista: parsed.data_fim_prevista,
        observacoes: parsed.isPurchase ? '[COMPRA]' : null,
        materiais_previstos: null,
        equipamentos_utilizados: null,
        custo_real: 0,
        created_by: userId || '',
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setQuickInputText('');
      toast({
        title: '⚡ Pendência registrada!',
        description: `Adicionada para ${data.data_fim_prevista === tomorrowStr ? 'Amanhã' : 'Hoje'} com sucesso.`,
      });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar pendência',
        description: formatApiError(err),
      });
    },
  });

  const toggleTaskStatusMutation = useMutation({
    mutationFn: async ({
      taskId,
      newStatus,
    }: {
      taskId: string;
      newStatus: 'Concluída' | 'Planejada';
    }) => {
      if (!companyId) return;
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId)
        .eq('company_id', companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar status',
        description: formatApiError(err),
      });
    },
  });

  const rescheduleTaskMutation = useMutation({
    mutationFn: async ({ taskId, newDate }: { taskId: string; newDate: string }) => {
      if (!companyId) return;
      const { error } = await supabase
        .from('tasks')
        .update({
          data_inicio_prevista: newDate,
          data_fim_prevista: newDate,
          status: 'Planejada',
        })
        .eq('id', taskId)
        .eq('company_id', companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Reagendado!', description: 'Data da tarefa atualizada com sucesso.' });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!companyId) return;
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('company_id', companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setTaskToDelete(null);
      if (selectedTask?.id === taskToDelete?.id) {
        setSelectedTask(null);
      }
      toast({ title: 'Excluído', description: 'Pendência removida do sistema.' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: formatApiError(err),
      });
    },
  });

  return {
    quickInputText,
    setQuickInputText,
    inputRef,
    fallbackProjId,
    parsedPreview,
    createQuickTaskMutation,
    toggleTaskStatusMutation,
    rescheduleTaskMutation,
    deleteTaskMutation,
  };
}
