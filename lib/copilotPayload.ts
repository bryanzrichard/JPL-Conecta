import { supabase } from './supabaseClient';
import { Project, Collaborator, Task } from '../types';
import { parseCompraItens } from './compraItens';
import { CopilotAction } from './copilotExecutor';
import { extrairErroCopilot, ExtrairErroResult } from './copilotErros';

export interface CopilotProjectItem {
  id: string;
  name: string;
}

export interface CopilotCollaboratorItem {
  id: string;
  name: string;
}

export interface CopilotPendingTaskCompraItem {
  nome: string;
  quantidade: number | null;
  unidade: string | null;
}

export interface CopilotPendingTaskItem {
  id: string;
  title: string;
  obra: string;
  responsavel: string | null | undefined;
  data_prevista: string | null;
  isPurchase: boolean;
  itens?: CopilotPendingTaskCompraItem[];
}

export interface ContextoCopiloto {
  projectsList: CopilotProjectItem[];
  collaboratorsList: CopilotCollaboratorItem[];
  pendingTasksList: CopilotPendingTaskItem[];
}

export interface MontarContextoCopilotoParams {
  projects: Project[];
  collaborators: Collaborator[];
  allTasks: Task[];
  projectsMap: Map<string, Project>;
  collaboratorsMap: Map<string, Collaborator>;
}

export function montarContextoCopiloto({
  projects,
  collaborators,
  allTasks,
  projectsMap,
  collaboratorsMap,
}: MontarContextoCopilotoParams): ContextoCopiloto {
  return {
    projectsList: projects.map((p) => ({ id: p.id, name: p.name })),
    collaboratorsList: collaborators.map((c) => ({ id: c.id, name: c.name })),
    pendingTasksList: allTasks
      .filter((t) => t.status !== 'Concluída')
      .map((t) => {
        const isPurchase =
          (t.observacoes || '').includes('[COMPRA]') ||
          (t.description || '').toLowerCase().includes('[compra]');
        const itens = isPurchase
          ? parseCompraItens(t.materiais_previstos)
              .filter((i) => !i.comprado)
              .map((i) => ({ nome: i.nome, quantidade: i.quantidade, unidade: i.unidade }))
          : undefined;
        return {
          id: t.id,
          title: t.title,
          obra: projectsMap.get(t.project_id)?.name || 'Geral',
          responsavel: t.responsavel_execucao_id
            ? collaboratorsMap.get(t.responsavel_execucao_id)?.name
            : null,
          data_prevista: t.data_fim_prevista,
          isPurchase,
          ...(itens && itens.length > 0 ? { itens } : {}),
        };
      }),
  };
}

export interface CopilotFunctionResult {
  resumo_ia?: string;
  transcricao?: string;
  acoes?: CopilotAction[];
}

export type CopilotInvokeBody = ContextoCopiloto &
  (
    | { textCommand: string; audioBase64?: undefined; audioMimeType?: undefined }
    | { audioBase64: string; audioMimeType: string; textCommand?: undefined }
  );

export type ChamarCopilotoResponse =
  | { result: CopilotFunctionResult; erro?: undefined }
  | { erro: ExtrairErroResult; result?: undefined };

export async function chamarCopiloto(
  body: CopilotInvokeBody
): Promise<ChamarCopilotoResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('processar-comando-voz', {
      body,
    });

    if (error || !data?.result) {
      const erro = await extrairErroCopilot(error);
      return { erro };
    }

    return { result: data.result as CopilotFunctionResult };
  } catch (err: unknown) {
    const erro = await extrairErroCopilot(err);
    return { erro };
  }
}
