import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../contexts/ToastContext';
import { Project, Collaborator, Task } from '../types';
import {
  executeCopilotActions,
  buildActionReviewItems,
  resolveCopilotActions,
  CopilotAction,
  ResolvedCopilotAction,
  ChatMessage,
  OpenServiceItem,
  PendingReviewData,
} from '../lib/copilotExecutor';
import {
  resolverConsulta,
  executarConsulta,
  executarConsultasEmParalelo,
  ConsultaResultado,
} from '../lib/copilotConsultas';
import {
  saveCopilotHistory,
  executeGuardedConfirm,
} from '../lib/copilotHistorico';

export interface UseCopilotRespostasParams {
  companyId?: string | null;
  userId?: string | null;
  projects: Project[];
  collaborators: Collaborator[];
  allTasks: Task[];
  openServices: OpenServiceItem[];
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setIsProcessingAudioIA: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface UseCopilotRespostasReturn {
  handleProcessCopilotResponse: (
    res: { resumo_ia?: string; transcricao?: string; acoes?: CopilotAction[] },
    baseText: string,
    targetMessageId?: string
  ) => Promise<void>;
  handleConfirmCopilotActions: (
    messageId: string,
    acoes: ResolvedCopilotAction[]
  ) => Promise<void>;
  handleCancelCopilotActions: (messageId: string) => void;
  handleRefreshConsulta: (messageId: string, consultaIndex: number) => Promise<void>;
}

export function useCopilotRespostas({
  companyId,
  userId,
  projects,
  collaborators,
  allTasks,
  openServices,
  chatMessages,
  setChatMessages,
  setIsProcessingAudioIA,
}: UseCopilotRespostasParams): UseCopilotRespostasReturn {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleRefreshConsulta = async (messageId: string, consultaIndex: number) => {
    if (!companyId) return;
    const targetMsg = chatMessages.find((m) => m.id === messageId);
    if (!targetMsg || !targetMsg.consultas || !targetMsg.consultas[consultaIndex]) return;

    const alvo = targetMsg.consultas[consultaIndex];
    const resolvida = resolverConsulta(alvo.pedido, projects);
    const resultado = await executarConsulta(resolvida, companyId);

    setChatMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId || !msg.consultas) return msg;
        const updatedConsultas = [...msg.consultas];
        updatedConsultas[consultaIndex] = {
          ...resultado,
          executadoEm: new Date().toISOString(),
        };
        return {
          ...msg,
          consultas: updatedConsultas,
        };
      })
    );
  };

  const handleProcessCopilotResponse = async (
    res: { resumo_ia?: string; transcricao?: string; acoes?: CopilotAction[] },
    baseText: string,
    targetMessageId?: string
  ) => {
    const rawAcoes = res.acoes || [];
    const consultaActions = rawAcoes.filter((a) => a.tipo === 'CONSULTAR');
    const actionableActions = rawAcoes.filter(
      (a) => a.tipo !== 'CONVERSA_GERAL' && a.tipo !== 'CONSULTAR'
    );

    const nowIso = new Date().toISOString();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (consultaActions.length > 0) {
      const iaMsgId = targetMessageId || (Date.now() + 1).toString();

      // Monta os cards iniciais de consulta com indicador individual de carregamento
      const initialConsultas: ConsultaResultado[] = consultaActions.map((a) => {
        const resolvida = resolverConsulta(a.dados?.consulta || { tipo: 'GASTOS' }, projects);
        return {
          pedido: resolvida.pedido,
          obraNome: resolvida.obraNome,
          linhas: [],
          notas: [],
          total: 0,
          erro: resolvida.erro,
          carregando: !resolvida.erro,
          executadoEm: nowIso,
        };
      });

      // Se a mensagem misturar consultas com ações que gravam, prepara o card de confirmação
      let reviewData: PendingReviewData | undefined = undefined;
      if (actionableActions.length > 0) {
        const openTasksList = allTasks.filter((t) => t.status !== 'Concluída');
        const resolvedActions = resolveCopilotActions(
          actionableActions,
          projects,
          collaborators,
          openTasksList,
          openServices
        );
        const reviewItems = buildActionReviewItems(resolvedActions);
        reviewData = {
          acoes: resolvedActions,
          items: reviewItems,
          status: 'pending',
        };
      }

      const initialIaMsg: ChatMessage = {
        id: iaMsgId,
        sender: 'ia',
        text: baseText,
        timestamp: timeStr,
        createdAt: nowIso,
        consultas: initialConsultas,
        ...(reviewData ? { review: reviewData } : {}),
      };

      setChatMessages((prev) =>
        targetMessageId
          ? prev.map((m) => (m.id === targetMessageId ? initialIaMsg : m))
          : [...prev, initialIaMsg]
      );

      await executarConsultasEmParalelo(
        initialConsultas,
        companyId || '',
        (idx, finalResult) => {
          setChatMessages((prev) =>
            prev.map((m) => {
              if (m.id !== iaMsgId || !m.consultas) return m;
              const updated = [...m.consultas];
              updated[idx] = finalResult;
              return { ...m, consultas: updated };
            })
          );
        }
      );
    } else if (actionableActions.length > 0) {
      const openTasksList = allTasks.filter((t) => t.status !== 'Concluída');
      const resolvedActions = resolveCopilotActions(
        actionableActions,
        projects,
        collaborators,
        openTasksList,
        openServices
      );
      const reviewItems = buildActionReviewItems(resolvedActions);
      const iaMsg: ChatMessage = {
        id: targetMessageId || (Date.now() + 1).toString(),
        sender: 'ia',
        text: baseText,
        timestamp: timeStr,
        createdAt: nowIso,
        review: {
          acoes: resolvedActions,
          items: reviewItems,
          status: 'pending',
        },
      };
      setChatMessages((prev) =>
        targetMessageId
          ? prev.map((m) => (m.id === targetMessageId ? iaMsg : m))
          : [...prev, iaMsg]
      );
    } else {
      const iaMsg: ChatMessage = {
        id: targetMessageId || (Date.now() + 1).toString(),
        sender: 'ia',
        text: baseText,
        timestamp: timeStr,
        createdAt: nowIso,
      };
      setChatMessages((prev) =>
        targetMessageId
          ? prev.map((m) => (m.id === targetMessageId ? iaMsg : m))
          : [...prev, iaMsg]
      );
    }
  };

  const handleConfirmCopilotActions = async (messageId: string, acoes: ResolvedCopilotAction[]) => {
    if (!companyId || !userId) return;

    await executeGuardedConfirm({
      messageId,
      getStatus: () => {
        const msg = chatMessages.find((m) => m.id === messageId);
        return msg?.review?.status;
      },
      onSetStatus: (status) => {
        setChatMessages((prev) => {
          const next = prev.map((msg) =>
            msg.id === messageId && msg.review
              ? {
                  ...msg,
                  review: { ...msg.review, status },
                }
              : msg
          );
          saveCopilotHistory(companyId, userId, next);
          return next;
        });
      },
      onExecute: async () => {
        setIsProcessingAudioIA(true);
        try {
          const cardResults = await executeCopilotActions({
            acoes,
            companyId,
            userId,
            projects,
            collaborators,
          });

          setChatMessages((prev) => {
            const next = prev.map((msg) =>
              msg.id === messageId && msg.review
                ? {
                    ...msg,
                    cards: cardResults,
                  }
                : msg
            );
            saveCopilotHistory(companyId, userId, next);
            return next;
          });

          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['collaborators'] });
          queryClient.invalidateQueries({ queryKey: ['servicos'] });
          queryClient.invalidateQueries({ queryKey: ['adiantamentos'] });
          queryClient.invalidateQueries({ queryKey: ['servicesSummary'] });
          queryClient.invalidateQueries({ queryKey: ['advancesSummary'] });
          queryClient.invalidateQueries({ queryKey: ['copilotOpenServices'] });
        } catch (err: unknown) {
          console.warn('Erro ao executar ações do Copiloto:', err);
          const msgText = err instanceof Error ? err.message : 'Erro ao gravar';
          toast({
            variant: 'destructive',
            title: 'Erro ao executar ações',
            description: msgText,
          });
          throw err;
        } finally {
          setIsProcessingAudioIA(false);
        }
      },
    });
  };

  const handleCancelCopilotActions = (messageId: string) => {
    setChatMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId && msg.review
          ? {
              ...msg,
              review: { ...msg.review, status: 'cancelled' },
            }
          : msg
      )
    );
    toast({
      title: 'Ações canceladas',
      description: 'Nenhum registro foi alterado no banco.',
    });
  };

  return {
    handleProcessCopilotResponse,
    handleConfirmCopilotActions,
    handleCancelCopilotActions,
    handleRefreshConsulta,
  };
}
