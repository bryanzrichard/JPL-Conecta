import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { Task, Project, Collaborator } from '../types';
import { fetchOpenServices, OpenServiceItem } from '../lib/copilotExecutor';

export interface UseTarefasDadosReturn {
  projects: Project[];
  isLoadingProjects: boolean;
  collaborators: Collaborator[];
  isLoadingCollaborators: boolean;
  projectsMap: Map<string, Project>;
  collaboratorsMap: Map<string, Collaborator>;
  openServices: OpenServiceItem[];
  allTasks: Task[];
  isLoadingTasks: boolean;
}

export function useTarefasDados(companyId?: string | null): UseTarefasDadosReturn {
  // -------------------------------------------------------------
  // 1. CARREGAR PRÉ-REQUISITOS (OBRAS E COLABORADORES)
  // -------------------------------------------------------------
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ['projects', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', companyId)
        .order('name')
        .returns<Project[]>();
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: collaborators = [], isLoading: isLoadingCollaborators } = useQuery<Collaborator[]>({
    queryKey: ['collaborators', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('collaborators')
        .select('*')
        .eq('company_id', companyId)
        .order('name')
        .returns<Collaborator[]>();
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const projectsMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const collaboratorsMap = useMemo(
    () => new Map(collaborators.map((c) => [c.id, c])),
    [collaborators]
  );

  const { data: openServices = [] } = useQuery<OpenServiceItem[]>({
    queryKey: ['copilotOpenServices', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return fetchOpenServices(companyId);
    },
    enabled: !!companyId,
  });

  // -------------------------------------------------------------
  // 2. CARREGAR TAREFAS DO SUPABASE
  // -------------------------------------------------------------
  const { data: allTasks = [], isLoading: isLoadingTasks } = useQuery<Task[]>({
    queryKey: ['tasks', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          project_id,
          company_id,
          data_inicio_prevista,
          data_fim_prevista,
          status,
          prioridade,
          responsavel_execucao_id,
          created_by,
          materiais_previstos,
          equipamentos_utilizados,
          observacoes,
          custo_real,
          created_at,
          projects(name),
          collaborators:responsavel_execucao_id(name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .returns<Task[]>();

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  return {
    projects,
    isLoadingProjects,
    collaborators,
    isLoadingCollaborators,
    projectsMap,
    collaboratorsMap,
    openServices,
    allTasks,
    isLoadingTasks,
  };
}
