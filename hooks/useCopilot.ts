import { useState } from 'react';
import { Project, Collaborator, Task } from '../types';
import {
  ResolvedCopilotAction,
  ChatMessage,
  OpenServiceItem,
} from '../lib/copilotExecutor';
import { extrairErroCopilot, formatarMensagemErroCopilot } from '../lib/copilotErros';
import { montarContextoCopiloto, chamarCopiloto } from '../lib/copilotPayload';
import { useGravacaoAudio } from './useGravacaoAudio';
import { useCopilotHistorico } from './useCopilotHistorico';
import { useCopilotRespostas } from './useCopilotRespostas';

export interface UseCopilotParams {
  companyId?: string | null;
  userId?: string | null;
  projects: Project[];
  collaborators: Collaborator[];
  allTasks: Task[];
  projectsMap: Map<string, Project>;
  collaboratorsMap: Map<string, Collaborator>;
  openServices: OpenServiceItem[];
}

export interface UseCopilotReturn {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  chatMessages: ChatMessage[];
  chatInputText: string;
  onChatInputChange: (val: string) => void;
  onSendTextMessage: (textToSend?: string) => Promise<void>;
  isProcessingAudioIA: boolean;
  isRecordingAudio: boolean;
  recordingSeconds: number;
  onStartAudioRecording: () => Promise<void>;
  onStopAudioRecording: () => void;
  onCancelAudioRecording: () => void;
  onConfirmActions: (messageId: string, acoes: ResolvedCopilotAction[]) => Promise<void>;
  onCancelActions: (messageId: string) => void;
  onRefreshConsulta: (messageId: string, consultaIndex: number) => Promise<void>;
  onRetryTextMessage: (messageId: string, textToRetry: string) => Promise<void>;
  onClearConversation: () => void;
}

export function useCopilot({
  companyId,
  userId,
  projects,
  collaborators,
  allTasks,
  projectsMap,
  collaboratorsMap,
  openServices,
}: UseCopilotParams): UseCopilotReturn {
  const [chatInputText, setChatInputText] = useState<string>('');
  const [isChatExpanded, setIsChatExpanded] = useState<boolean>(false);
  const [isProcessingAudioIA, setIsProcessingAudioIA] = useState<boolean>(false);

  const { chatMessages, setChatMessages, limparConversa } = useCopilotHistorico(
    companyId,
    userId
  );

  const {
    handleProcessCopilotResponse,
    handleConfirmCopilotActions,
    handleCancelCopilotActions,
    handleRefreshConsulta,
  } = useCopilotRespostas({
    companyId,
    userId,
    projects,
    collaborators,
    allTasks,
    openServices,
    chatMessages,
    setChatMessages,
    setIsProcessingAudioIA,
  });

  const handleSendCopilotTextMessage = async (textToSend?: string) => {
    const text = (textToSend || chatInputText).trim();
    if (!text || isProcessingAudioIA) return;

    const nowIso = new Date().toISOString();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: timeStr,
      createdAt: nowIso,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInputText('');
    setIsProcessingAudioIA(true);

    try {
      const contexto = montarContextoCopiloto({
        projects,
        collaborators,
        allTasks,
        projectsMap,
        collaboratorsMap,
      });
      const response = await chamarCopiloto({
        textCommand: text,
        ...contexto,
      });

      if (response.erro || !response.result) {
        const erroInfo = response.erro || { codigo: 'ERRO_INTERNO' as const };
        const errorText = formatarMensagemErroCopilot({
          codigo: erroInfo.codigo,
          origem: 'texto',
          detalhe: erroInfo.detalhe,
        });

        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'ia',
          text: errorText,
          timestamp: timeStr,
          createdAt: new Date().toISOString(),
          retryText: text,
        };
        setChatMessages((prev) => [...prev, errorMsg]);
        return;
      }

      const res = response.result;
      const baseText = res.resumo_ia || 'Comando processado.';
      await handleProcessCopilotResponse(res, baseText);
    } catch (err: unknown) {
      console.warn('Erro ao processar mensagem no Copiloto:', err);
      const erroInfo = await extrairErroCopilot(err);
      const errorText = formatarMensagemErroCopilot({
        codigo: erroInfo.codigo,
        origem: 'texto',
        detalhe: erroInfo.detalhe,
      });

      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ia',
        text: errorText,
        timestamp: timeStr,
        createdAt: new Date().toISOString(),
        retryText: text,
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessingAudioIA(false);
    }
  };

  const handleRetryCopilotTextMessage = async (messageId: string, textToRetry: string) => {
    if (isProcessingAudioIA) return;

    setChatMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, reenviando: true } : m))
    );
    setIsProcessingAudioIA(true);

    try {
      const contexto = montarContextoCopiloto({
        projects,
        collaborators,
        allTasks,
        projectsMap,
        collaboratorsMap,
      });
      const response = await chamarCopiloto({
        textCommand: textToRetry,
        ...contexto,
      });

      if (response.erro || !response.result) {
        const erroInfo = response.erro || { codigo: 'ERRO_INTERNO' as const };
        const errorText = formatarMensagemErroCopilot({
          codigo: erroInfo.codigo,
          origem: 'texto',
          detalhe: erroInfo.detalhe,
        });

        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  text: errorText,
                  reenviando: false,
                  retryText: textToRetry,
                }
              : m
          )
        );
        return;
      }

      const res = response.result;
      const baseText = res.resumo_ia || 'Comando processado.';
      await handleProcessCopilotResponse(res, baseText, messageId);
    } catch (err: unknown) {
      console.warn('Erro ao reenviar mensagem no Copiloto:', err);
      const erroInfo = await extrairErroCopilot(err);
      const errorText = formatarMensagemErroCopilot({
        codigo: erroInfo.codigo,
        origem: 'texto',
        detalhe: erroInfo.detalhe,
      });

      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                text: errorText,
                reenviando: false,
                retryText: textToRetry,
              }
            : m
        )
      );
    } finally {
      setIsProcessingAudioIA(false);
    }
  };

  const processAudioWithGemini = async (blob: Blob, mimeType: string) => {
    setIsProcessingAudioIA(true);

    const nowIso = new Date().toISOString();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: '🎤 Mensagem de voz gravada...',
      timestamp: timeStr,
      createdAt: nowIso,
    };
    setChatMessages((prev) => [...prev, userMsg]);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          const base64 = res.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const audioBase64 = await base64Promise;

      const cleanMimeType = (mimeType || 'audio/webm').split(';')[0].trim();
      const contexto = montarContextoCopiloto({
        projects,
        collaborators,
        allTasks,
        projectsMap,
        collaboratorsMap,
      });

      const response = await chamarCopiloto({
        audioBase64,
        audioMimeType: cleanMimeType,
        ...contexto,
      });

      if (response.erro || !response.result) {
        const erroInfo = response.erro || { codigo: 'ERRO_INTERNO' as const };
        const errorText = formatarMensagemErroCopilot({
          codigo: erroInfo.codigo,
          origem: 'audio',
          detalhe: erroInfo.detalhe,
        });

        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'ia',
          text: errorText,
          timestamp: timeStr,
          createdAt: nowIso,
        };
        setChatMessages((prev) => [...prev, errorMsg]);
        return;
      }

      const res = response.result;
      const baseText = res.transcricao
        ? `Transcrição: "${res.transcricao}"\n\n${res.resumo_ia || 'Revise as ações identificadas antes de confirmar:'}`
        : res.resumo_ia || 'Revise as ações identificadas antes de confirmar:';

      await handleProcessCopilotResponse(res, baseText);
    } catch (err: unknown) {
      console.warn('Erro ao processar áudio no Copiloto:', err);
      const erroInfo = await extrairErroCopilot(err);
      const errorText = formatarMensagemErroCopilot({
        codigo: erroInfo.codigo,
        origem: 'audio',
        detalhe: erroInfo.detalhe,
      });

      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ia',
        text: errorText,
        timestamp: timeStr,
        createdAt: nowIso,
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessingAudioIA(false);
    }
  };

  const { isRecordingAudio, recordingSeconds, iniciar, parar, cancelar } =
    useGravacaoAudio(processAudioWithGemini);

  return {
    isExpanded: isChatExpanded,
    onToggleExpanded: () => setIsChatExpanded((prev) => !prev),
    chatMessages,
    chatInputText,
    onChatInputChange: setChatInputText,
    onSendTextMessage: handleSendCopilotTextMessage,
    isProcessingAudioIA,
    isRecordingAudio,
    recordingSeconds,
    onStartAudioRecording: iniciar,
    onStopAudioRecording: parar,
    onCancelAudioRecording: cancelar,
    onConfirmActions: handleConfirmCopilotActions,
    onCancelActions: handleCancelCopilotActions,
    onRefreshConsulta: handleRefreshConsulta,
    onRetryTextMessage: handleRetryCopilotTextMessage,
    onClearConversation: limparConversa,
  };
}
