import React, { useState, useMemo } from 'react';
import { useToast } from '../contexts/ToastContext';
import { Project } from '../types';
import { EnrichedTask, TarefasFilters } from '../components/tarefas/types';
import {
  generateWhatsAppSchedule,
  copyTextToClipboard,
  openOfficialGroupLink,
  TaskForWhatsApp,
} from '../lib/whatsappGenerator';

export interface UsePautaWhatsAppParams {
  filteredTasks: EnrichedTask[];
  filters: TarefasFilters;
  projectsMap: Map<string, Project>;
  todayStr: string;
  tomorrowStr: string;
}

export interface UsePautaWhatsAppReturn {
  previewDateMode: 'today' | 'tomorrow';
  setPreviewDateMode: React.Dispatch<React.SetStateAction<'today' | 'tomorrow'>>;
  isCopiedSuccess: boolean;
  isMobileWhatsappPreviewOpen: boolean;
  setIsMobileWhatsappPreviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  whatsappTasks: TaskForWhatsApp[];
  targetDateObj: Date;
  selectedProjName: string | undefined;
  formattedWhatsAppText: string;
  dailyProgress: number;
  handleCopyWhatsApp: () => Promise<void>;
  handleDirectGroupSend: () => Promise<void>;
}

export function usePautaWhatsApp({
  filteredTasks,
  filters,
  projectsMap,
  todayStr,
  tomorrowStr,
}: UsePautaWhatsAppParams): UsePautaWhatsAppReturn {
  const { toast } = useToast();

  // WhatsApp Preview Controls
  const [previewDateMode, setPreviewDateMode] = useState<'today' | 'tomorrow'>('today');
  const [isCopiedSuccess, setIsCopiedSuccess] = useState<boolean>(false);
  const [isMobileWhatsappPreviewOpen, setIsMobileWhatsappPreviewOpen] = useState<boolean>(false);

  // -------------------------------------------------------------
  // GERAÇÃO DA PAUTA DO WHATSAPP (LIVE PREVIEW)
  // -------------------------------------------------------------
  const whatsappTasks = useMemo<TaskForWhatsApp[]>(() => {
    return filteredTasks
      .filter((t) => {
        if (previewDateMode === 'today') {
          return t.data_fim_prevista === todayStr || t.isDelayed || !t.data_fim_prevista;
        } else {
          return t.data_fim_prevista === tomorrowStr;
        }
      })
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        project_id: t.project_id,
        projectName: t.projectName,
        collaboratorName: t.collaboratorName || undefined,
        data_fim_prevista: t.data_fim_prevista,
        isPurchase: t.isPurchase,
        materiais_previstos: t.materiais_previstos,
      }));
  }, [filteredTasks, previewDateMode, todayStr, tomorrowStr]);

  const targetDateObj = useMemo(() => {
    const d = new Date();
    if (previewDateMode === 'tomorrow') {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }, [previewDateMode]);

  const selectedProjName = filters.project_id
    ? projectsMap.get(filters.project_id)?.name
    : undefined;

  const formattedWhatsAppText = useMemo(() => {
    return generateWhatsAppSchedule({
      tasks: whatsappTasks,
      targetDate: targetDateObj,
      isTomorrow: previewDateMode === 'tomorrow',
      specificProjectName: selectedProjName,
    });
  }, [whatsappTasks, targetDateObj, previewDateMode, selectedProjName]);

  const dailyProgress = useMemo(() => {
    if (whatsappTasks.length === 0) return 0;
    const completedCount = whatsappTasks.filter((t) => t.status === 'Concluída').length;
    return Math.round((completedCount / whatsappTasks.length) * 100);
  }, [whatsappTasks]);

  const handleCopyWhatsApp = async () => {
    const success = await copyTextToClipboard(formattedWhatsAppText);
    if (success) {
      setIsCopiedSuccess(true);
      toast({
        title: '📋 Pauta Copiada!',
        description: 'Texto formatado copiado. Agora basta colar no WhatsApp.',
      });
      setTimeout(() => setIsCopiedSuccess(false), 3000);
    }
  };

  const handleDirectGroupSend = async () => {
    const success = await copyTextToClipboard(formattedWhatsAppText);
    if (success) {
      setIsCopiedSuccess(true);
      setTimeout(() => setIsCopiedSuccess(false), 3500);
      toast({
        title: '📋 Pauta Copiada! Abrindo WhatsApp...',
        description: 'O grupo da JPL está abrindo na tela. Pressione Ctrl+V (ou Colar) e envie!',
      });
    }
    openOfficialGroupLink();
  };

  return {
    previewDateMode,
    setPreviewDateMode,
    isCopiedSuccess,
    isMobileWhatsappPreviewOpen,
    setIsMobileWhatsappPreviewOpen,
    whatsappTasks,
    targetDateObj,
    selectedProjName,
    formattedWhatsAppText,
    dailyProgress,
    handleCopyWhatsApp,
    handleDirectGroupSend,
  };
}
