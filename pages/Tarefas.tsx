import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { useMediaQuery } from '../hooks/use-media-query';
import { Task, Project, Collaborator, Service } from '../types';
import { Button } from '../components/ui/Button';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { ResponsiveModal, ResponsiveModalContent } from '../components/ui/ResponsiveModal';
import TarefasTable from '../components/tarefas/TarefasTable';
import TaskDetailPanel from '../components/tarefas/TaskDetailPanel';
import PautaWhatsAppPanel from '../components/tarefas/PautaWhatsAppPanel';
import TaskFormDrawer from '../components/tarefas/TaskFormDrawer';
import FiltrosTarefas from '../components/tarefas/FiltrosTarefas';
import { EnrichedTask, TarefasFilters } from '../components/tarefas/types';
import {
  PlusIcon, XIcon, ClipboardListIcon,
  CalendarIcon, ConstructionIcon, UserIcon,
  Trash2Icon, EditIcon, FilterIcon, SparklesIcon,
  ShoppingBagIcon, CopyIcon, SendIcon, MicIcon, MicOffIcon,
  AlertTriangleIcon, CheckCircle2Icon, BotIcon, ClockIcon, BellIcon
} from '../lib/icons';
import { parseQuickTask, toISODate, ParsedTaskResult } from '../lib/taskParser';
import {
  generateWhatsAppSchedule,
  copyTextToClipboard,
  openOfficialGroupLink,
  TaskForWhatsApp
} from '../lib/whatsappGenerator';
import {
  executeCopilotActions,
  buildActionReviewItems,
  resolveCopilotActions,
  fetchOpenServices,
  CopilotAction,
  ResolvedCopilotAction,
  ChatMessage,
  OpenServiceItem,
} from '../lib/copilotExecutor';
import { CopilotPanel } from '../components/tarefas/CopilotPanel';
import { formatApiError } from '../lib/handleError';
import { formatDateBR } from '../lib/utils';

// Abas da Central de Tarefas: Hoje & Amanhã, Programadas Futuras, Compras, Alertas, Concluídas
type TarefasTab = 'today' | 'upcoming' | 'purchases' | 'alerts' | 'completed';

const initialFilters: TarefasFilters = {
  project_id: null,
  responsavel_id: null,
  prioridade: 'all',
  start_date: null,
  end_date: null,
};

export const Tarefas: React.FC = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // -------------------------------------------------------------
  // ESTADOS DA TELA
  // -------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<TarefasTab>('today');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Filtros em Gaveta
  const [filters, setFilters] = useState<TarefasFilters>(initialFilters);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);

  // Split View & Seleção de Tarefa
  const [selectedTask, setSelectedTask] = useState<EnrichedTask | null>(null);
  const [isMobileDetailDrawerOpen, setIsMobileDetailDrawerOpen] = useState<boolean>(false);

  // Quick Command Input State & Gravador com IA (Gemini Flash)
  const [quickInputText, setQuickInputText] = useState<string>('');
  const [isRecordingAudio, setIsRecordingAudio] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isProcessingAudioIA, setIsProcessingAudioIA] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Estados do Chat Copiloto JPL (Estilo WhatsApp)
  const [chatInputText, setChatInputText] = useState<string>('');
  const [isChatExpanded, setIsChatExpanded] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // WhatsApp Preview Controls
  const [previewDateMode, setPreviewDateMode] = useState<'today' | 'tomorrow'>('today');
  const [isCopiedSuccess, setIsCopiedSuccess] = useState<boolean>(false);
  const [isMobileWhatsappPreviewOpen, setIsMobileWhatsappPreviewOpen] = useState<boolean>(false);

  // Modais de Criação / Edição em Gaveta e Exclusão
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState<boolean>(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // -------------------------------------------------------------
  // 1. CARREGAR PRÉ-REQUISITOS (OBRAS E COLABORADORES)
  // -------------------------------------------------------------
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ['projects', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name');
      if (error) throw error;
      return (data || []) as Project[];
    },
    enabled: !!profile?.company_id,
  });

  const { data: collaborators = [], isLoading: isLoadingCollaborators } = useQuery<Collaborator[]>({
    queryKey: ['collaborators', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from('collaborators')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name');
      if (error) throw error;
      return (data || []) as Collaborator[];
    },
    enabled: !!profile?.company_id,
  });

  const projectsMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const collaboratorsMap = useMemo(() => new Map(collaborators.map(c => [c.id, c])), [collaborators]);

  const { data: openServices = [] } = useQuery<OpenServiceItem[]>({
    queryKey: ['copilotOpenServices', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      return fetchOpenServices(profile.company_id);
    },
    enabled: !!profile?.company_id,
  });

  // -------------------------------------------------------------
  // 2. CARREGAR TAREFAS DO SUPABASE
  // -------------------------------------------------------------
  const { data: allTasks = [], isLoading: isLoadingTasks } = useQuery<Task[]>({
    queryKey: ['tasks', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
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
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as unknown as Task[]) || [];
    },
    enabled: !!profile?.company_id,
  });

  // -------------------------------------------------------------
  // 3. AUTO-FEED: GATILHOS AUTOMÁTICOS DE OUTROS MÓDULOS
  // -------------------------------------------------------------
  const { data: activeServices = [] } = useQuery<Service[]>({
    queryKey: ['active_services_for_tasks', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from('servicos')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('status', 'Em Andamento');
      if (error) return [];
      return (data || []) as Service[];
    },
    enabled: !!profile?.company_id,
  });

  const { data: pendingAiCount = 0 } = useQuery<number>({
    queryKey: ['pending_ai_jobs_for_tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('ai_process_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['pending', 'processing', 'completed']);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  const { data: activeOrcamentoEtapas = [] } = useQuery<{ id: string; nome: string; project_id: string; status: string; ordem: number }[]>({
    queryKey: ['active_orcamento_etapas_for_tasks', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from('orcamento_etapas')
        .select('id, nome, project_id, status, ordem')
        .eq('company_id', profile.company_id)
        .eq('status', 'Em Execução');
      if (error) return [];
      return (data || []) as { id: string; nome: string; project_id: string; status: string; ordem: number }[];
    },
    enabled: !!profile?.company_id,
  });

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
  // GRAVADOR DE ÁUDIO COM IA (MEDIARECORDER & GEMINI FLASH)
  // -------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        } catch (_) {}
      }
    };
  }, []);

  const startAudioRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({
          variant: 'destructive',
          title: 'Gravação não suportada',
          description: 'Seu navegador não suporta captura direta de microfone.',
        });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size > 500) {
          await processAudioWithGemini(audioBlob, mimeType);
        } else {
          setIsRecordingAudio(false);
        }
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      console.warn('Falha ao abrir microfone:', err);
      toast({
        variant: 'destructive',
        title: 'Microfone Bloqueado',
        description: 'Clique no ícone de cadeado na barra de endereço (ao lado de https://...) e permita o microfone.',
      });
      setIsRecordingAudio(false);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingAudio(false);
  };

  const cancelAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    audioChunksRef.current = [];
    setIsRecordingAudio(false);
    setRecordingSeconds(0);
  };

  // -------------------------------------------------------------
  // ENVIO DE MENSAGENS AO COPILOTO IA (TEXTO OU ÁUDIO)
  // -------------------------------------------------------------
  const handleSendCopilotTextMessage = async (textToSend?: string) => {
    const text = (textToSend || chatInputText).trim();
    if (!text || isProcessingAudioIA) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInputText('');
    setIsProcessingAudioIA(true);

    try {
      const { data, error } = await supabase.functions.invoke('processar-comando-voz', {
        body: {
          textCommand: text,
          projectsList: projects.map((p) => ({ id: p.id, name: p.name })),
          collaboratorsList: collaborators.map((c) => ({ id: c.id, name: c.name })),
          pendingTasksList: allTasks
            .filter((t) => t.status !== 'Concluída')
            .map((t) => ({
              id: t.id,
              title: t.title,
              obra: projectsMap.get(t.project_id)?.name || 'Geral',
              responsavel: t.responsavel_execucao_id ? collaboratorsMap.get(t.responsavel_execucao_id)?.name : null,
              data_prevista: t.data_fim_prevista,
              isPurchase: (t.observacoes || '').includes('[COMPRA]') || (t.description || '').toLowerCase().includes('[compra]'),
            })),
        },
      });

      if (error || !data?.result) {
        let errorDetail = error?.message || 'Falha ao processar com o Gemini Flash';
        throw new Error(errorDetail);
      }

      const res = data.result;
      const actionableActions = (res.acoes || []).filter(
        (a: CopilotAction) => a.tipo !== 'CONVERSA_GERAL'
      );

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
        const iaMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'ia',
          text: res.resumo_ia || 'Revise as ações identificadas antes de confirmar:',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          review: {
            acoes: resolvedActions,
            items: reviewItems,
            status: 'pending',
          },
        };
        setChatMessages((prev) => [...prev, iaMsg]);
      } else {
        const iaMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'ia',
          text: res.resumo_ia || 'Comando processado.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages((prev) => [...prev, iaMsg]);
      }
    } catch (err: unknown) {
      console.warn('Erro ao processar mensagem no Copiloto:', err);
      const msgText = err instanceof Error ? err.message : 'Erro na Edge Function';
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ia',
        text: `⚠️ Não consegui concluir a ação: ${msgText}. Verifique o deploy de "processar-comando-voz" ou a API_KEY no Supabase.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessingAudioIA(false);
    }
  };

  const handleConfirmCopilotActions = async (messageId: string, acoes: ResolvedCopilotAction[]) => {
    if (!profile?.company_id || !user?.id) return;
    setIsProcessingAudioIA(true);
    try {
      const cardResults = await executeCopilotActions({
        acoes,
        companyId: profile.company_id,
        userId: user.id,
        projects,
        collaborators,
      });

      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId && msg.review
            ? {
                ...msg,
                review: { ...msg.review, status: 'confirmed' },
                cards: cardResults,
              }
            : msg
        )
      );

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['adiantamentos'] });
      queryClient.invalidateQueries({ queryKey: ['servicesSummary'] });
      queryClient.invalidateQueries({ queryKey: ['advancesSummary'] });
      queryClient.invalidateQueries({ queryKey: ['copilotOpenServices'] });

      toast({
        title: '✅ Ações executadas!',
        description: `${acoes.length} ação(ões) gravada(s) no sistema com sucesso.`,
      });
    } catch (err: unknown) {
      console.warn('Erro ao executar ações do Copiloto:', err);
      const msgText = err instanceof Error ? err.message : 'Erro ao gravar';
      toast({
        variant: 'destructive',
        title: 'Erro ao executar ações',
        description: msgText,
      });
    } finally {
      setIsProcessingAudioIA(false);
    }
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

  const processAudioWithGemini = async (blob: Blob, mimeType: string) => {
    setIsProcessingAudioIA(true);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: '🎤 Mensagem de voz gravada...',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

      const { data, error } = await supabase.functions.invoke('processar-comando-voz', {
        body: {
          audioBase64,
          audioMimeType: cleanMimeType,
          projectsList: projects.map((p) => ({ id: p.id, name: p.name })),
          collaboratorsList: collaborators.map((c) => ({ id: c.id, name: c.name })),
          pendingTasksList: allTasks
            .filter((t) => t.status !== 'Concluída')
            .map((t) => ({
              id: t.id,
              title: t.title,
              obra: projectsMap.get(t.project_id)?.name || 'Geral',
              responsavel: t.responsavel_execucao_id ? collaboratorsMap.get(t.responsavel_execucao_id)?.name : null,
              data_prevista: t.data_fim_prevista,
              isPurchase: (t.observacoes || '').includes('[COMPRA]') || (t.description || '').toLowerCase().includes('[compra]'),
            })),
        },
      });

      if (error || !data?.result) {
        let errorDetail = error?.message || 'Falha ao processar com Gemini Flash';
        throw new Error(errorDetail);
      }

      const res = data.result;
      const actionableActions = (res.acoes || []).filter(
        (a: CopilotAction) => a.tipo !== 'CONVERSA_GERAL'
      );

      const baseText = res.transcricao
        ? `Transcrição: "${res.transcricao}"\n\n${res.resumo_ia || 'Revise as ações identificadas antes de confirmar:'}`
        : res.resumo_ia || 'Revise as ações identificadas antes de confirmar:';

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
        const iaMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'ia',
          text: baseText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          review: {
            acoes: resolvedActions,
            items: reviewItems,
            status: 'pending',
          },
        };
        setChatMessages((prev) => [...prev, iaMsg]);
      } else {
        const iaMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'ia',
          text: baseText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages((prev) => [...prev, iaMsg]);
      }
    } catch (err: unknown) {
      console.warn('Erro ao processar áudio no Copiloto:', err);
      const msgText = err instanceof Error ? err.message : 'Erro na Edge Function';
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ia',
        text: `⚠️ Não consegui transcrever o áudio: ${msgText}. Verifique o deploy de "processar-comando-voz" ou a API_KEY no Supabase.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessingAudioIA(false);
      setIsRecordingAudio(false);
    }
  };

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
  // NOTIFICAÇÕES NATIVAS DO SMARTPHONE / COMPUTADOR
  // -------------------------------------------------------------
  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  });

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast({
        variant: 'destructive',
        title: 'Notificações não suportadas',
        description: 'Seu navegador não possui suporte a notificações nativas.',
      });
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setHasNotificationPermission(true);

        const pendentesHoje = todayAndTomorrowTasks.filter(t => t.isTodayTask || t.isDelayed);
        const pendentesAmanha = todayAndTomorrowTasks.filter(t => t.isTomorrowTask);

        let textoCorpo = 'Lembretes automáticos ativados no seu aparelho!';
        if (pendentesHoje.length > 0 || pendentesAmanha.length > 0) {
          textoCorpo = `Você tem ${pendentesHoje.length} tarefa(s) para hoje e ${pendentesAmanha.length} para amanhã.`;
        }

        toast({
          title: '🔔 Lembretes Ativos!',
          description: textoCorpo,
        });

        new Notification('JPL Conecta 🏗️ — Lembrete de Tarefas', {
          body: textoCorpo,
          icon: '/favicon.ico',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Notificações Bloqueadas',
          description: 'Clique no ícone de cadeado na barra do navegador e permita as Notificações.',
        });
      }
    } catch (e) {
      console.warn('Erro ao solicitar permissão de notificações:', e);
    }
  };

  // -------------------------------------------------------------
  // CLASSIFICAÇÃO DAS TAREFAS POR DATA E PRAZO
  // -------------------------------------------------------------
  const enrichedTasks = useMemo<EnrichedTask[]>(() => {
    return allTasks.map(t => {
      const p = projectsMap.get(t.project_id);
      const c = t.responsavel_execucao_id ? collaboratorsMap.get(t.responsavel_execucao_id) : null;
      const isPurchase = (t.observacoes || '').includes('[COMPRA]') || (t.description || '').toLowerCase().includes('[compra]');
      const isCompleted = t.status === 'Concluída';
      const isDelayed = !isCompleted && !!t.data_fim_prevista && t.data_fim_prevista < todayStr;
      const isTodayTask = t.data_fim_prevista === todayStr;
      const isTomorrowTask = t.data_fim_prevista === tomorrowStr;
      const isUpcomingTask = !isCompleted && !!t.data_fim_prevista && t.data_fim_prevista > tomorrowStr;

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
      const updated = enrichedTasks.find(t => t.id === selectedTask.id);
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
      if (filters.responsavel_id && t.responsavel_execucao_id !== filters.responsavel_id) return false;
      if (filters.prioridade !== 'all' && t.prioridade !== filters.prioridade) return false;
      if (filters.start_date && t.data_fim_prevista && t.data_fim_prevista < filters.start_date) return false;
      if (filters.end_date && t.data_fim_prevista && t.data_fim_prevista > filters.end_date) return false;
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
    return filteredTasks.filter(t => !t.isCompleted && !t.isPurchase && (!t.data_fim_prevista || t.data_fim_prevista <= tomorrowStr));
  }, [filteredTasks, tomorrowStr]);

  // Aba 2: Programadas Futuras (vencimento após amanhã)
  const upcomingTasks = useMemo(() => {
    return filteredTasks
      .filter(t => !t.isCompleted && !t.isPurchase && !!t.data_fim_prevista && t.data_fim_prevista > tomorrowStr)
      .sort((a, b) => (a.data_fim_prevista || '').localeCompare(b.data_fim_prevista || ''));
  }, [filteredTasks, tomorrowStr]);

  // Aba 3: Lista de Compras
  const purchaseTasks = useMemo(() => {
    return filteredTasks.filter(t => t.isPurchase);
  }, [filteredTasks]);

  // Aba 5: Concluídas
  const completedTasks = useMemo(() => {
    return filteredTasks.filter(t => t.isCompleted);
  }, [filteredTasks]);

  // Alertas Automáticos derivados de outros módulos (Aba 4)
  const autoAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      type: 'servico' | 'nota' | 'orcamento';
      title: string;
      subtitle: string;
      project_id?: string;
      projectName?: string;
      date?: string;
      severity: 'warning' | 'info' | 'critical';
    }> = [];

    const today = new Date();
    activeServices.forEach(srv => {
      if (filters.project_id && srv.project_id !== filters.project_id) return;

      const pName = srv.project_id ? projectsMap.get(srv.project_id)?.name : 'Geral';
      const cName = srv.collaborator_id ? collaboratorsMap.get(srv.collaborator_id)?.name : 'Empreiteiro';

      if (srv.end_date) {
        const endDate = new Date(srv.end_date);
        const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 3) {
          alerts.push({
            id: `srv-${srv.id}`,
            type: 'servico',
            title: `Vistoriar Entrega de Empreitada: ${srv.description}`,
            subtitle: `${cName} • ${pName} • Prazo até ${srv.end_date}`,
            project_id: srv.project_id || undefined,
            projectName: pName,
            date: srv.end_date,
            severity: diffDays < 0 ? 'critical' : 'warning',
          });
        }
      }
    });

    if (pendingAiCount > 0) {
      alerts.push({
        id: 'ai-notes-pending',
        type: 'nota',
        title: `${pendingAiCount} nota(s) fiscal(is) aguardando revisão na IA`,
        subtitle: 'Confirme categorias, itens e fornecedores para manter os orçamentos conciliados.',
        severity: 'info',
      });
    }

    activeOrcamentoEtapas.forEach(etp => {
      if (filters.project_id && etp.project_id !== filters.project_id) return;
      const pName = projectsMap.get(etp.project_id)?.name || 'Obra';
      alerts.push({
        id: `etp-${etp.id}`,
        type: 'orcamento',
        title: `Etapa em Execução: ${etp.ordem}. ${etp.nome}`,
        subtitle: `${pName} • Cronograma ativo no canteiro`,
        project_id: etp.project_id,
        projectName: pName,
        severity: 'info',
      });
    });

    return alerts;
  }, [activeServices, pendingAiCount, activeOrcamentoEtapas, filters.project_id, projectsMap, collaboratorsMap]);

  // Contadores para as Abas
  const counts = useMemo(() => ({
    today: todayAndTomorrowTasks.length,
    upcoming: upcomingTasks.length,
    purchases: purchaseTasks.filter(t => !t.isCompleted).length,
    alerts: autoAlerts.length,
    completed: completedTasks.length,
  }), [todayAndTomorrowTasks, upcomingTasks, purchaseTasks, autoAlerts, completedTasks]);

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
    return activeTabTasks.findIndex(t => t.id === selectedTask.id);
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

  // -------------------------------------------------------------
  // GERAÇÃO DA PAUTA DO WHATSAPP (LIVE PREVIEW)
  // -------------------------------------------------------------
  const whatsappTasks = useMemo(() => {
    return filteredTasks
      .filter(t => {
        if (previewDateMode === 'today') {
          return t.data_fim_prevista === todayStr || t.isDelayed || !t.data_fim_prevista;
        } else {
          return t.data_fim_prevista === tomorrowStr;
        }
      })
      .map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        project_id: t.project_id,
        projectName: t.projectName,
        collaboratorName: t.collaboratorName || undefined,
        data_fim_prevista: t.data_fim_prevista,
        isPurchase: t.isPurchase,
      } as TaskForWhatsApp));
  }, [filteredTasks, previewDateMode, todayStr, tomorrowStr]);

  const targetDateObj = useMemo(() => {
    const d = new Date();
    if (previewDateMode === 'tomorrow') {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }, [previewDateMode]);

  const selectedProjName = filters.project_id ? projectsMap.get(filters.project_id)?.name : undefined;

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
    const completedCount = whatsappTasks.filter(t => t.status === 'Concluída').length;
    return Math.round((completedCount / whatsappTasks.length) * 100);
  }, [whatsappTasks]);

  // -------------------------------------------------------------
  // MUTATIONS (CRIAR, TOGGLE, REAGENDAR, EXCLUIR)
  // -------------------------------------------------------------
  const createQuickTaskMutation = useMutation({
    mutationFn: async (parsed: ParsedTaskResult) => {
      if (!profile?.company_id) throw new Error('Empresa não identificada');
      if (!parsed.title.trim()) throw new Error('Digite o título da pendência');

      const targetProjectId = parsed.project_id || projects[0]?.id;
      if (!targetProjectId) throw new Error('Cadastre pelo menos uma obra para vincular a tarefa');

      const insertPayload = {
        company_id: profile.company_id,
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
        created_by: user?.id || '',
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
    mutationFn: async ({ taskId, newStatus }: { taskId: string; newStatus: 'Concluída' | 'Planejada' }) => {
      if (!profile?.company_id) return;
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId)
        .eq('company_id', profile.company_id);
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
      if (!profile?.company_id) return;
      const { error } = await supabase
        .from('tasks')
        .update({
          data_inicio_prevista: newDate,
          data_fim_prevista: newDate,
          status: 'Planejada',
        })
        .eq('id', taskId)
        .eq('company_id', profile.company_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Reagendado!', description: 'Data da tarefa atualizada com sucesso.' });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!profile?.company_id) return;
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('company_id', profile.company_id);
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

  const convertAlertToTask = (alert: { id: string; title: string; project_id?: string; date?: string }) => {
    const targetDate = alert.date || todayStr;
    createQuickTaskMutation.mutate({
      raw: alert.title,
      title: alert.title,
      project_id: alert.project_id || fallbackProjId,
      responsavel_execucao_id: null,
      data_fim_prevista: targetDate,
      isTomorrow: targetDate === tomorrowStr,
      isToday: targetDate === todayStr,
      isPurchase: false,
    });
  };

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

  const handleSelectTask = (task: EnrichedTask) => {
    setSelectedTask(task);
    if (!isDesktop) {
      setIsMobileDetailDrawerOpen(true);
    }
  };

  const handleOpenEditDrawer = (task: Task) => {
    setTaskToEdit(task);
    setIsFormDrawerOpen(true);
  };

  const handleTabChange = (tab: TarefasTab) => {
    setActiveTab(tab);
    setSelectedTask(null);
  };

  return (
    <div className="w-full px-3 sm:px-5 lg:px-6 py-4 space-y-4 animate-in fade-in-50">
      {/* ========================================================= */}
      {/* 1. CABEÇALHO DA CENTRAL DE AÇÃO                           */}
      {/* ========================================================= */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 shrink-0">
            <ClipboardListIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-[#F8FAFC] tracking-tight flex items-center gap-2">
              Tarefas & Programação de Obra
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400">
                Central Rápida
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
              Pendências do canteiro, lista de compras e gerador automático de pauta para o WhatsApp da equipe.
            </p>
          </div>
        </div>

        {/* Botões do Topo */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão de Notificações / Lembretes */}
          <button
            type="button"
            onClick={requestNotificationPermission}
            className={`h-8 px-2.5 sm:px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
              hasNotificationPermission
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 dark:bg-[#111827] dark:hover:bg-slate-800 dark:text-gray-200 dark:border-gray-800'
            }`}
            title={hasNotificationPermission ? 'Lembretes ativos no seu aparelho (clique para testar)' : 'Ativar lembretes no smartphone ou computador'}
          >
            <BellIcon className={`h-3.5 w-3.5 ${hasNotificationPermission ? 'text-amber-600 dark:text-amber-400 fill-amber-500/20' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">
              {hasNotificationPermission ? 'Lembretes Ativos' : 'Ativar Lembretes'}
            </span>
            {hasNotificationPermission && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          {/* Botão Oficial do Grupo WhatsApp */}
          <button
            type="button"
            onClick={openOfficialGroupLink}
            className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            title="Abrir Grupo Oficial do WhatsApp da JPL Construtora"
          >
            <SendIcon className="h-3.5 w-3.5" />
            <span>Grupo WhatsApp</span>
          </button>

          {/* Botão Ver Pauta no Mobile */}
          <div className="lg:hidden">
            <Button
              size="sm"
              onClick={() => setIsMobileWhatsappPreviewOpen(true)}
              className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
            >
              <CopyIcon className="h-3.5 w-3.5 mr-1" />
              <span>Ver Pauta</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. COPILOTO JPL — CHAT & VOZ WHATSAPP-STYLE COM GEMINI IA  */}
      {/* ========================================================= */}
      <CopilotPanel
        isExpanded={isChatExpanded}
        onToggleExpanded={() => setIsChatExpanded((prev) => !prev)}
        chatMessages={chatMessages}
        chatInputText={chatInputText}
        onChatInputChange={setChatInputText}
        onSendTextMessage={handleSendCopilotTextMessage}
        isProcessingAudioIA={isProcessingAudioIA}
        isRecordingAudio={isRecordingAudio}
        recordingSeconds={recordingSeconds}
        onStartAudioRecording={startAudioRecording}
        onStopAudioRecording={stopAudioRecording}
        onCancelAudioRecording={cancelAudioRecording}
        onConfirmActions={handleConfirmCopilotActions}
        onCancelActions={handleCancelCopilotActions}
      />

      {/* ========================================================= */}
      {/* 3. BARRA DE ABAS, BUSCA, FILTROS E NOVA TAREFA            */}
      {/* ========================================================= */}
      <div className="space-y-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-t-xl px-4 py-3 shadow-xs">
          {/* Abas */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-brand-dark-900 p-1 border border-slate-200/80 dark:border-gray-800 text-xs font-semibold overflow-x-auto">
            <button
              type="button"
              onClick={() => handleTabChange('today')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'today'
                  ? 'bg-white dark:bg-[#1F2937] text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
              }`}
            >
              <span>📅 Hoje & Amanhã</span>
              {counts.today > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 text-[10px]">
                  {counts.today}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('upcoming')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'upcoming'
                  ? 'bg-white dark:bg-[#1F2937] text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
              }`}
            >
              <span>🗓️ Programadas</span>
              {counts.upcoming > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 text-[10px]">
                  {counts.upcoming}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('purchases')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'purchases'
                  ? 'bg-white dark:bg-[#1F2937] text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
              }`}
            >
              <span>🛒 Lista de Compras</span>
              {counts.purchases > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 text-[10px]">
                  {counts.purchases}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('alerts')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'alerts'
                  ? 'bg-white dark:bg-[#1F2937] text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
              }`}
            >
              <span>⚠️ Alertas Automáticos</span>
              {counts.alerts > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 text-[10px]">
                  {counts.alerts}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('completed')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'completed'
                  ? 'bg-white dark:bg-[#1F2937] text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
              }`}
            >
              <span>✅ Concluídas</span>
              {counts.completed > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 dark:bg-gray-800 dark:text-gray-300 text-[10px]">
                  {counts.completed}
                </span>
              )}
            </button>
          </div>

          {/* Direita: Busca, Filtros e Nova Tarefa */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-48 sm:w-56">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar pendências..."
                className="w-full h-8 pl-8 pr-7 text-xs bg-slate-50 dark:bg-brand-dark-800/80 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <FilterIcon className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-400" />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Botão Filtros */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFilterDrawerOpen(true)}
              className="h-8 px-3 text-xs font-semibold border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-brand-dark-800 text-slate-700 dark:text-gray-300 gap-1.5 cursor-pointer"
            >
              <FilterIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="ml-1 flex items-center justify-center h-4.5 min-w-[18px] px-1 text-[10px] font-bold rounded-full bg-emerald-600 text-white">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            {/* Botão Nova Tarefa */}
            <Button
              size="sm"
              onClick={() => {
                setTaskToEdit(null);
                setIsFormDrawerOpen(true);
              }}
              className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs cursor-pointer"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>+ Nova Tarefa</span>
            </Button>
          </div>
        </div>

        {/* Faixa de Filtros Ativos (se houver) */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center justify-between gap-3 bg-emerald-50/60 dark:bg-emerald-950/20 border-x border-b border-emerald-200/80 dark:border-emerald-900/40 px-4 py-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <FilterIcon className="h-3.5 w-3.5" /> Filtros ativos ({activeFiltersCount}):
              </span>
              {filters.project_id && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                  Obra: {projectsMap.get(filters.project_id)?.name || 'Obra'}
                </span>
              )}
              {filters.responsavel_id && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                  Responsável: {collaboratorsMap.get(filters.responsavel_id)?.name || 'Responsável'}
                </span>
              )}
              {filters.prioridade !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                  Prioridade: {filters.prioridade}
                </span>
              )}
              {(filters.start_date || filters.end_date) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-gray-200 font-medium text-xs">
                  Período: {filters.start_date ? formatDateBR(filters.start_date) : 'Início'} até {filters.end_date ? formatDateBR(filters.end_date) : 'Hoje'}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters(initialFilters)}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline h-7 px-2 font-semibold cursor-pointer"
            >
              Limpar todos
            </Button>
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. ÁREA PRINCIPAL: TABELA + PAINEL DE DETALHE             */}
        {/* ========================================================= */}
        {activeTab === 'alerts' ? (
          /* ABA ALERTAS: LISTA PRÓPRIA, SEM TABELA E SEM PAINEL */
          <div className="p-4 bg-white dark:bg-[#111827] rounded-b-xl border-x border-b border-slate-200/80 dark:border-gray-800 shadow-xs space-y-3">
            {autoAlerts.length === 0 ? (
              <div className="py-16 text-center bg-slate-50/50 dark:bg-brand-dark-900/50 border border-dashed border-slate-200 dark:border-gray-800 rounded-2xl p-6">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                  <CheckCircle2Icon className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                  Nenhum alerta pendente nos outros módulos!
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Todos os contratos de serviços, notas e etapas estão dentro dos prazos operacionais.
                </p>
              </div>
            ) : (
              autoAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3.5 rounded-xl border bg-slate-50/70 dark:bg-[#1F2937]/50 border-slate-200/80 dark:border-gray-800 flex items-start justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        alert.severity === 'critical'
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                          : alert.severity === 'warning'
                          ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                          : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
                      }`}
                    >
                      <AlertTriangleIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 dark:text-white block">
                        {alert.title}
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                        {alert.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {alert.type === 'nota' ? (
                      <Button
                        size="sm"
                        onClick={() => navigate('/notas')}
                        className="h-7 text-xs bg-indigo-600 text-white cursor-pointer"
                      >
                        Ir p/ Notas
                      </Button>
                    ) : alert.type === 'servico' ? (
                      <Button
                        size="sm"
                        onClick={() => convertAlertToTask(alert)}
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer font-bold"
                        title="Transformar este alerta em uma tarefa oficial no canteiro"
                      >
                        + Criar Tarefa
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => navigate('/orcamentos')}
                        className="h-7 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-gray-200 cursor-pointer"
                      >
                        Ver Orçamento
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* DEMAIS ABAS: SPLIT VIEW (TABELA À ESQUERDA + PAINEL À DIREITA) */
          <div
            className={`overflow-hidden rounded-b-xl border-x border-b border-slate-200/80 dark:border-gray-800 bg-white dark:bg-[#111827] shadow-xs flex flex-col lg:flex-row ${
              selectedTask && isDesktop ? 'items-stretch' : ''
            }`}
          >
            {/* LADO ESQUERDO: TABELA RETRÁTIL */}
            <div
              className={`${
                selectedTask && isDesktop
                  ? 'w-full lg:w-[48%] xl:w-[46%] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-gray-800'
                  : 'w-full lg:w-[58%] xl:w-[60%]'
              }`}
            >
              <TarefasTable
                tasks={activeTabTasks}
                selectedTaskId={selectedTask?.id || null}
                onSelectTask={handleSelectTask}
                onToggleStatus={(task) =>
                  toggleTaskStatusMutation.mutate({
                    taskId: task.id,
                    newStatus: task.isCompleted ? 'Planejada' : 'Concluída',
                  })
                }
                onRescheduleTomorrow={(task) =>
                  rescheduleTaskMutation.mutate({ taskId: task.id, newDate: tomorrowStr })
                }
                isDetailOpen={!!selectedTask && isDesktop}
                emptyMessage={
                  activeTab === 'purchases'
                    ? 'Nenhum material pendente de compra!'
                    : activeTab === 'completed'
                    ? 'Nenhuma tarefa concluída nesta visualização!'
                    : 'Tudo em dia nesta visão!'
                }
                emptySubtitle={
                  activeTab === 'purchases'
                    ? 'Adicione itens de compra com o botão "+ Nova Tarefa" ou pelo Copiloto.'
                    : 'Nenhuma pendência encontrada para os filtros selecionados.'
                }
              />
            </div>

            {/* LADO DIREITO (DESKTOP): PAINEL DE DETALHE OU PAUTA WHATSAPP */}
            {isDesktop && (
              <div
                className={`w-full ${
                  selectedTask ? 'lg:w-[52%] xl:w-[54%]' : 'lg:w-[42%] xl:w-[40%]'
                } shrink-0 min-h-[480px] max-h-[calc(100vh-270px)] overflow-hidden flex flex-col animate-in fade-in-0 duration-150 p-3 sm:p-4`}
              >
                {selectedTask ? (
                  <TaskDetailPanel
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onEdit={handleOpenEditDrawer}
                    onDelete={(task) => setTaskToDelete(task)}
                    onToggleStatus={(task) =>
                      toggleTaskStatusMutation.mutate({
                        taskId: task.id,
                        newStatus: task.isCompleted ? 'Planejada' : 'Concluída',
                      })
                    }
                    onRescheduleTomorrow={(task) =>
                      rescheduleTaskMutation.mutate({ taskId: task.id, newDate: tomorrowStr })
                    }
                    onPrevTask={handlePrevTask}
                    onNextTask={handleNextTask}
                    hasPrev={hasPrevTask}
                    hasNext={hasNextTask}
                    currentIndex={selectedTaskIndex}
                    totalCount={activeTabTasks.length}
                  />
                ) : (
                  <PautaWhatsAppPanel
                    previewDateMode={previewDateMode}
                    setPreviewDateMode={setPreviewDateMode}
                    dailyProgress={dailyProgress}
                    formattedWhatsAppText={formattedWhatsAppText}
                    handleDirectGroupSend={handleDirectGroupSend}
                    handleCopyWhatsApp={handleCopyWhatsApp}
                    isCopiedSuccess={isCopiedSuccess}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 5. GAVETAS & MODAIS                                       */}
      {/* ========================================================= */}
      {/* Drawer de Formulário de Tarefa (Criar / Editar) */}
      <TaskFormDrawer
        isOpen={isFormDrawerOpen}
        onClose={() => {
          setIsFormDrawerOpen(false);
          setTaskToEdit(null);
        }}
        taskToEdit={taskToEdit}
        projects={projects}
        collaborators={collaborators}
        isLoadingPrerequisites={isLoadingProjects || isLoadingCollaborators}
      />

      {/* Drawer de Filtros */}
      <FiltrosTarefas
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={filters}
        onApplyFilters={(newFilters) => setFilters(newFilters)}
        projects={projects}
        collaborators={collaborators}
      />

      {/* Painel de Detalhes no Celular (Gaveta / Bottom Sheet) */}
      {!isDesktop && selectedTask && (
        <ResponsiveModal
          open={isMobileDetailDrawerOpen}
          onOpenChange={setIsMobileDetailDrawerOpen}
          displayMode="drawer"
        >
          <ResponsiveModalContent size="md">
            <TaskDetailPanel
              task={selectedTask}
              onClose={() => setIsMobileDetailDrawerOpen(false)}
              onEdit={(task) => {
                setIsMobileDetailDrawerOpen(false);
                handleOpenEditDrawer(task);
              }}
              onDelete={(task) => {
                setIsMobileDetailDrawerOpen(false);
                setTaskToDelete(task);
              }}
              onToggleStatus={(task) =>
                toggleTaskStatusMutation.mutate({
                  taskId: task.id,
                  newStatus: task.isCompleted ? 'Planejada' : 'Concluída',
                })
              }
              onRescheduleTomorrow={(task) =>
                rescheduleTaskMutation.mutate({ taskId: task.id, newDate: tomorrowStr })
              }
              onPrevTask={handlePrevTask}
              onNextTask={handleNextTask}
              hasPrev={hasPrevTask}
              hasNext={hasNextTask}
              currentIndex={selectedTaskIndex}
              totalCount={activeTabTasks.length}
            />
          </ResponsiveModalContent>
        </ResponsiveModal>
      )}

      {/* Pauta do WhatsApp no Celular (Gaveta / Bottom Sheet) */}
      {!isDesktop && (
        <ResponsiveModal
          open={isMobileWhatsappPreviewOpen}
          onOpenChange={setIsMobileWhatsappPreviewOpen}
          displayMode="drawer"
        >
          <ResponsiveModalContent size="md">
            <PautaWhatsAppPanel
              previewDateMode={previewDateMode}
              setPreviewDateMode={setPreviewDateMode}
              dailyProgress={dailyProgress}
              formattedWhatsAppText={formattedWhatsAppText}
              handleDirectGroupSend={handleDirectGroupSend}
              handleCopyWhatsApp={handleCopyWhatsApp}
              isCopiedSuccess={isCopiedSuccess}
              onClose={() => setIsMobileWhatsappPreviewOpen(false)}
            />
          </ResponsiveModalContent>
        </ResponsiveModal>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmationModal
        isOpen={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onConfirm={() => taskToDelete && deleteTaskMutation.mutate(taskToDelete.id)}
        title="Excluir Pendência"
        description={`Tem certeza que deseja excluir "${taskToDelete?.title}"?`}
        isLoading={deleteTaskMutation.isPending}
      />
    </div>
  );
};

export default Tarefas;
