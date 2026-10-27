import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { ChatMessage } from '../lib/copilotExecutor';
import {
  loadCopilotHistory,
  saveCopilotHistory,
  clearCopilotHistory,
} from '../lib/copilotHistorico';

export interface UseCopilotHistoricoReturn {
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  limparConversa: () => void;
}

export function useCopilotHistorico(
  companyId?: string | null,
  userId?: string | null
): UseCopilotHistoricoReturn {
  const { toast } = useToast();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const hasLoadedHistoryRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | number | null>(null);

  // Carrega o histórico salvo no navegador ao identificar o usuário e a empresa
  useEffect(() => {
    if (!companyId || !userId) return;
    const userKey = `${companyId}:${userId}`;
    if (hasLoadedHistoryRef.current === userKey) return;
    hasLoadedHistoryRef.current = userKey;

    const initialHistory = loadCopilotHistory(companyId, userId, (msg) => {
      toast({
        variant: 'default',
        title: 'Aviso',
        description: msg,
      });
    });
    setChatMessages(initialHistory);
  }, [companyId, userId, toast]);

  // Salva a conversa com debounce mínimo de 300ms entre gravações
  useEffect(() => {
    if (!companyId || !userId) return;
    const userKey = `${companyId}:${userId}`;
    if (hasLoadedHistoryRef.current !== userKey) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current as NodeJS.Timeout);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveCopilotHistory(companyId, userId, chatMessages, (msg) => {
        toast({
          variant: 'default',
          title: 'Aviso',
          description: msg,
        });
      });
    }, 350);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current as NodeJS.Timeout);
      }
    };
  }, [chatMessages, companyId, userId, toast]);

  const limparConversa = () => {
    setChatMessages([]);
    if (companyId && userId) {
      clearCopilotHistory(companyId, userId);
    }
  };

  return {
    chatMessages,
    setChatMessages,
    limparConversa,
  };
}
