import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { useMediaQuery } from '../hooks/use-media-query';
import { Task, Project, Collaborator, Service } from '../types';
import { Button } from '../components/ui/Button';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import CreateTaskModal from '../components/home/CreateTaskModal';
import {
  PlusIcon, CheckIcon, XIcon, ClipboardListIcon,
  CalendarIcon, ConstructionIcon, UserIcon, BuildingIcon,
  Trash2Icon, EditIcon, FilterIcon, SparklesIcon,
  ShoppingBagIcon, CopyIcon, SendIcon, MicIcon, MicOffIcon,
  AlertTriangleIcon, CheckCircle2Icon
} from '../lib/icons';
import { parseQuickTask, toISODate, checkSpeechRecognitionSupport, ParsedTaskResult } from '../lib/taskParser';
import {
  generateWhatsAppSchedule,
  copyTextToClipboard,
  openWhatsAppWebWithText,
  openOfficialGroupLink,
  TaskForWhatsApp
} from '../lib/whatsappGenerator';
import { formatApiError } from '../lib/handleError';

// Abas da Central de Tarefas
type TarefasTab = 'today' | 'purchases' | 'alerts' | 'completed';

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
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Quick Command Input State
  const [quickInputText, setQuickInputText] = useState<string>('');
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // WhatsApp Preview Controls
  const [previewDateMode, setPreviewDateMode] = useState<'today' | 'tomorrow'>('today');
  const [isCopiedSuccess, setIsCopiedSuccess] = useState<boolean>(false);
  const [isMobileWhatsappPreviewOpen, setIsMobileWhatsappPreviewOpen] = useState<boolean>(false);

  // Modais de Criação Detalhada e Exclusão
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // -------------------------------------------------------------
  // 1. CARREGAR PRÉ-REQUISITOS (OBRAS E COLABORADORES)
  // -------------------------------------------------------------
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ['projects', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await (supabase as any)
        .from('projects')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: collaborators = [], isLoading: isLoadingCollaborators } = useQuery<Collaborator[]>({
    queryKey: ['collaborators', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await (supabase as any)
        .from('collaborators')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const projectsMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const collaboratorsMap = useMemo(() => new Map(collaborators.map(c => [c.id, c])), [collaborators]);

  // -------------------------------------------------------------
  // 2. CARREGAR TAREFAS DO SUPABASE
  // -------------------------------------------------------------
  const { data: allTasks = [], isLoading: isLoadingTasks } = useQuery<Task[]>({
    queryKey: ['tasks', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await (supabase as any)
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
  // Contratos de Serviços ativos próximos do vencimento
  const { data: activeServices = [] } = useQuery<Service[]>({
    queryKey: ['active_services_for_tasks', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await (supabase as any)
        .from('servicos')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('status', 'Em Andamento');
      if (error) return [];
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Notas com IA pendente
  const { data: pendingAiCount = 0 } = useQuery<number>({
    queryKey: ['pending_ai_jobs_for_tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await (supabase as any)
        .from('ai_process_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['pending', 'processing', 'completed']);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  // Etapas de Orçamento em Execução
  const { data: activeOrcamentoEtapas = [] } = useQuery<any[]>({
    queryKey: ['active_orcamento_etapas_for_tasks', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await (supabase as any)
        .from('orcamento_etapas')
        .select('id, nome, project_id, status, ordem')
        .eq('company_id', profile.company_id)
        .eq('status', 'Em Execução');
      if (error) return [];
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // -------------------------------------------------------------
  // PARSER EM TEMPO REAL DO QUICK INPUT
  // -------------------------------------------------------------
  const fallbackProjId = selectedProjectFilter !== 'all' ? selectedProjectFilter : (projects[0]?.id || null);
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
  // DITADO POR VOZ (WEB SPEECH API NATIVA COM PERMISSÃO E RESILIÊNCIA)
  // -------------------------------------------------------------
  const isSpeechSupported = useMemo(() => checkSpeechRecognitionSupport(), []);

  const toggleVoiceRecording = async () => {
    // 1. Se já estiver gravando, parar a escuta
    if (isListeningVoice) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn('Erro ao interromper reconhecimento de voz:', e);
        }
      }
      setIsListeningVoice(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast({
        variant: 'destructive',
        title: 'Microfone não suportado no navegador',
        description: 'Seu navegador atual não possui suporte nativo à digitação por voz. Recomendamos usar o Google Chrome ou Microsoft Edge no PC ou smartphone.',
      });
      return;
    }

    // 2. Solicitar permissão de microfone antecipadamente caso não tenha sido concedida
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Liberar as faixas do stream imediatamente para deixar o microfone disponível para o SpeechRecognition
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (permError: any) {
      console.warn('Permissão de microfone negada ou erro ao solicitar:', permError);
      toast({
        variant: 'destructive',
        title: 'Acesso ao Microfone Bloqueado',
        description: 'Clique no ícone de cadeado ao lado do endereço do site (URL) no navegador e altere "Microfone" para Permitir.',
      });
      return;
    }

    // 3. Inicializar e configurar a instância de SpeechRecognition
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListeningVoice(true);
        toast({
          title: '🎙️ Ouvindo... Pode falar!',
          description: 'Fale sua pendência com calma (ex: "Lázaro conferir nível da viga no Estrela Dalva amanhã").',
        });
      };

      recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript;
        }
        if (fullTranscript) {
          setQuickInputText(fullTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Erro SpeechRecognition:', event.error);
        setIsListeningVoice(false);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          toast({
            variant: 'destructive',
            title: 'Permissão de Microfone Negada',
            description: 'Autorize o microfone no ícone de cadeado do seu navegador para poder ditar.',
          });
        } else if (event.error === 'no-speech') {
          toast({
            variant: 'destructive',
            title: 'Nenhuma voz detectada',
            description: 'Não detectamos som. Fale mais perto do microfone e tente novamente.',
          });
        } else if (event.error === 'audio-capture') {
          toast({
            variant: 'destructive',
            title: 'Nenhum microfone encontrado',
            description: 'Verifique se há um microfone conectado e selecionado no seu sistema.',
          });
        } else if (event.error === 'network') {
          toast({
            variant: 'destructive',
            title: 'Falha temporária de rede',
            description: 'O serviço de voz do navegador teve uma oscilação na conexão. Tente novamente.',
          });
        }
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
        if (inputRef.current) {
          inputRef.current.focus();
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Falha ao iniciar reconhecimento de voz:', err);
      setIsListeningVoice(false);
      toast({
        variant: 'destructive',
        title: 'Falha ao ligar microfone',
        description: 'Não foi possível inicializar a escuta de voz. Tente novamente.',
      });
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
  // CLASSIFICAÇÃO DAS TAREFAS
  // -------------------------------------------------------------
  const enrichedTasks = useMemo(() => {
    return allTasks.map(t => {
      const p = projectsMap.get(t.project_id);
      const c = t.responsavel_execucao_id ? collaboratorsMap.get(t.responsavel_execucao_id) : null;
      const isPurchase = (t.observacoes || '').includes('[COMPRA]') || (t.description || '').toLowerCase().includes('[compra]');
      const isCompleted = t.status === 'Concluída';
      const isDelayed = !isCompleted && t.data_fim_prevista && t.data_fim_prevista < todayStr;
      const isTodayTask = t.data_fim_prevista === todayStr;
      const isTomorrowTask = t.data_fim_prevista === tomorrowStr;

      return {
        ...t,
        projectName: p?.name || 'Obra sem nome',
        collaboratorName: c?.name || null,
        isPurchase,
        isCompleted,
        isDelayed,
        isTodayTask,
        isTomorrowTask,
      };
    });
  }, [allTasks, projectsMap, collaboratorsMap, todayStr, tomorrowStr]);

  // Filtragem por Obra e Busca
  const filteredTasks = useMemo(() => {
    return enrichedTasks.filter(t => {
      if (selectedProjectFilter !== 'all' && t.project_id !== selectedProjectFilter) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchTitle = (t.title || '').toLowerCase().includes(term);
        const matchCollab = (t.collaboratorName || '').toLowerCase().includes(term);
        const matchProject = (t.projectName || '').toLowerCase().includes(term);
        if (!matchTitle && !matchCollab && !matchProject) return false;
      }
      return true;
    });
  }, [enrichedTasks, selectedProjectFilter, searchTerm]);

  // Tarefas da Aba 1 (Hoje & Amanhã)
  const todayAndTomorrowTasks = useMemo(() => {
    return filteredTasks.filter(t => !t.isCompleted && !t.isPurchase);
  }, [filteredTasks]);

  // Tarefas da Aba 2 (Lista de Compras da Semana)
  const purchaseTasks = useMemo(() => {
    return filteredTasks.filter(t => t.isPurchase);
  }, [filteredTasks]);

  // Tarefas da Aba 4 (Concluídas)
  const completedTasks = useMemo(() => {
    return filteredTasks.filter(t => t.isCompleted);
  }, [filteredTasks]);

  // Alertas Automáticos derivados de outros módulos (Aba 3)
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

    // 1. Serviços com prazo próximo ou vencido
    const today = new Date();
    activeServices.forEach(srv => {
      if (selectedProjectFilter !== 'all' && srv.project_id !== selectedProjectFilter) return;

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

    // 2. Notas com IA pendente
    if (pendingAiCount > 0) {
      alerts.push({
        id: 'ai-notes-pending',
        type: 'nota',
        title: `${pendingAiCount} nota(s) fiscal(is) aguardando revisão na IA`,
        subtitle: 'Confirme categorias, itens e fornecedores para manter os orçamentos conciliados.',
        severity: 'info',
      });
    }

    // 3. Etapas de orçamento em execução no canteiro
    activeOrcamentoEtapas.forEach(etp => {
      if (selectedProjectFilter !== 'all' && etp.project_id !== selectedProjectFilter) return;
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
  }, [activeServices, pendingAiCount, activeOrcamentoEtapas, selectedProjectFilter, projectsMap, collaboratorsMap]);

  // Contadores para as Abas
  const counts = useMemo(() => ({
    today: todayAndTomorrowTasks.length,
    purchases: purchaseTasks.filter(t => !t.isCompleted).length,
    alerts: autoAlerts.length,
    completed: completedTasks.length,
  }), [todayAndTomorrowTasks, purchaseTasks, autoAlerts, completedTasks]);

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

  const selectedProjName = selectedProjectFilter !== 'all' ? projectsMap.get(selectedProjectFilter)?.name : undefined;

  const formattedWhatsAppText = useMemo(() => {
    return generateWhatsAppSchedule({
      tasks: whatsappTasks,
      targetDate: targetDateObj,
      isTomorrow: previewDateMode === 'tomorrow',
      specificProjectName: selectedProjName,
    });
  }, [whatsappTasks, targetDateObj, previewDateMode, selectedProjName]);

  // Progresso diário
  const dailyProgress = useMemo(() => {
    if (whatsappTasks.length === 0) return 0;
    const completedCount = whatsappTasks.filter(t => t.status === 'Concluída').length;
    return Math.round((completedCount / whatsappTasks.length) * 100);
  }, [whatsappTasks]);

  // -------------------------------------------------------------
  // MUTATIONS (CRIAR, TOGGLE, REAGENDAR, EXCLUIR)
  // -------------------------------------------------------------

  // 1. Criar Tarefa Ultrarrápida pela Barra
  const createQuickTaskMutation = useMutation({
    mutationFn: async (parsed: ParsedTaskResult) => {
      if (!profile?.company_id) throw new Error('Empresa não identificada');
      if (!parsed.title.trim()) throw new Error('Digite o título da pendência');

      const targetProjectId = parsed.project_id || projects[0]?.id;
      if (!targetProjectId) throw new Error('Cadastre pelo menos uma obra para vincular a tarefa');

      const insertPayload: any = {
        company_id: profile.company_id,
        project_id: targetProjectId,
        title: parsed.title.trim(),
        description: parsed.isPurchase ? '[COMPRA] Item para cotação e compra rápida' : '',
        status: 'Planejada',
        prioridade: parsed.isPurchase ? 'Alta' : 'Média',
        responsavel_execucao_id: parsed.responsavel_execucao_id || null,
        data_inicio_prevista: parsed.data_fim_prevista,
        data_fim_prevista: parsed.data_fim_prevista,
        observacoes: parsed.isPurchase ? '[COMPRA]' : null,
        created_by: user?.id,
      };

      const { data, error } = await (supabase as any)
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

  // 2. Toggle Status (Concluída <-> Planejada)
  const toggleTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus }: { taskId: string; newStatus: 'Concluída' | 'Planejada' }) => {
      if (!profile?.company_id) return;
      const { error } = await (supabase as any)
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

  // 3. Reagendar Data Rápida (Hoje / Amanhã)
  const rescheduleTaskMutation = useMutation({
    mutationFn: async ({ taskId, newDate }: { taskId: string; newDate: string }) => {
      if (!profile?.company_id) return;
      const { error } = await (supabase as any)
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

  // 4. Excluir Tarefa
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!profile?.company_id) return;
      const { error } = await (supabase as any)
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('company_id', profile.company_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setTaskToDelete(null);
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

  // 5. Transformar Alerta Automático em Tarefa Real
  const convertAlertToTask = (alert: any) => {
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

  // Submeter formulário rápido
  const handleQuickSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickInputText.trim()) return;
    createQuickTaskMutation.mutate(parsedPreview);
  };

  // Handlers de Envio para WhatsApp
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

  const handleOpenWhatsAppPrefilled = () => {
    openWhatsAppWebWithText(formattedWhatsAppText);
  };

  // -------------------------------------------------------------
  // RENDERIZAÇÃO DE CARDS AGRUPADOS POR OBRA
  // -------------------------------------------------------------
  const renderTasksGroupedByProject = (taskList: typeof enrichedTasks, isPurchasesView = false) => {
    if (taskList.length === 0) {
      return (
        <div className="py-16 text-center bg-white dark:bg-[#111827] border border-dashed border-slate-200 dark:border-gray-800 rounded-2xl p-6">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
            <CheckCircle2Icon className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">
            {isPurchasesView ? 'Nenhum material pendente de compra!' : 'Tudo em dia nesta visão!'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            {isPurchasesView
              ? 'Digite itens como "Comprar 20 sacos de cimento" na barra acima para alimentar a lista de compras.'
              : 'Use a barra rápida acima para programar o canteiro ou consulte as outras abas.'}
          </p>
        </div>
      );
    }

    // Agrupar por Obra
    const groups = new Map<string, typeof taskList>();
    taskList.forEach(t => {
      const pId = t.project_id || 'unassigned';
      const arr = groups.get(pId) || [];
      arr.push(t);
      groups.set(pId, arr);
    });

    return (
      <div className="space-y-4">
        {Array.from(groups.entries()).map(([pId, pTasks]) => {
          const pName = projectsMap.get(pId)?.name || 'Geral / Sem Obra Vinculada';
          const completedInGroup = pTasks.filter(t => t.isCompleted).length;

          return (
            <div
              key={pId}
              className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs"
            >
              {/* Cabeçalho da Obra */}
              <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-900/40 border-b border-slate-100 dark:border-gray-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <ConstructionIcon className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-white truncate">
                    {pName}
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-gray-300">
                    {completedInGroup}/{pTasks.length} concluídas
                  </span>
                </div>

                {/* Atalho para adicionar rápido nesta obra */}
                <button
                  type="button"
                  onClick={() => {
                    setQuickInputText(`${pName}: `);
                    if (inputRef.current) inputRef.current.focus();
                  }}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  + Adicionar nesta obra
                </button>
              </div>

              {/* Lista de Tarefas do Grupo */}
              <div className="divide-y divide-slate-100 dark:divide-gray-800/60">
                {pTasks.map(task => {
                  const isDone = task.isCompleted;

                  return (
                    <div
                      key={task.id}
                      className={`group p-3 sm:px-4 transition-all flex items-start sm:items-center justify-between gap-3 ${
                        isDone
                          ? 'bg-slate-50/40 dark:bg-slate-900/20 opacity-60'
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      {/* Checkbox e Título */}
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleTaskStatusMutation.mutate({
                            taskId: task.id,
                            newStatus: isDone ? 'Planejada' : 'Concluída',
                          })}
                          className={`mt-0.5 sm:mt-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                            isDone
                              ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                              : 'border-slate-300 dark:border-gray-600 bg-white dark:bg-slate-800 hover:border-indigo-500'
                          }`}
                          title={isDone ? 'Marcar como pendente' : 'Marcar como concluída'}
                        >
                          {isDone && <CheckIcon className="h-3.5 w-3.5 stroke-[3]" />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-semibold ${
                                isDone
                                  ? 'line-through text-slate-400 dark:text-gray-500'
                                  : 'text-slate-800 dark:text-white'
                              }`}
                            >
                              {task.title}
                            </span>

                            {/* Badge de Compra de Material */}
                            {task.isPurchase && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                                <ShoppingBagIcon className="h-2.5 w-2.5" /> Compra
                              </span>
                            )}

                            {/* Badge de Responsável */}
                            {task.collaboratorName && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
                                <UserIcon className="h-2.5 w-2.5" /> {task.collaboratorName}
                              </span>
                            )}

                            {/* Badge de Prazo */}
                            {task.isDelayed ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
                                Atrasada
                              </span>
                            ) : task.isTomorrowTask ? (
                              <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300">
                                Amanhã
                              </span>
                            ) : task.isTodayTask ? (
                              <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                                Hoje
                              </span>
                            ) : null}
                          </div>

                          {task.description && (
                            <p className="text-[11px] text-slate-400 dark:text-gray-400 truncate mt-0.5">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Ações Rápidas no Hover */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Botão Reagendar para Hoje */}
                        {!task.isTodayTask && !isDone && (
                          <button
                            type="button"
                            onClick={() => rescheduleTaskMutation.mutate({ taskId: task.id, newDate: todayStr })}
                            className="hidden sm:inline-flex px-1.5 py-1 text-[10px] font-semibold text-slate-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer transition-colors"
                            title="Mover prazo para Hoje"
                          >
                            P/ Hoje
                          </button>
                        )}

                        {/* Botão Reagendar para Amanhã */}
                        {!task.isTomorrowTask && !isDone && (
                          <button
                            type="button"
                            onClick={() => rescheduleTaskMutation.mutate({ taskId: task.id, newDate: tomorrowStr })}
                            className="hidden sm:inline-flex px-1.5 py-1 text-[10px] font-semibold text-slate-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer transition-colors"
                            title="Mover prazo para Amanhã"
                          >
                            P/ Amanhã
                          </button>
                        )}

                        {/* Editar */}
                        <button
                          type="button"
                          onClick={() => {
                            setTaskToEdit(task);
                            setIsCreateModalOpen(true);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Editar tarefa completa"
                        >
                          <EditIcon className="h-3.5 w-3.5" />
                        </button>

                        {/* Excluir */}
                        <button
                          type="button"
                          onClick={() => setTaskToDelete(task)}
                          className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="Excluir tarefa"
                        >
                          <Trash2Icon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
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
          {/* Seletor Rápido de Obra */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-lg px-2.5 py-1 text-xs shadow-2xs">
            <BuildingIcon className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-gray-200 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">Todas as Obras ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Botão Oficial do Grupo WhatsApp da Construtora */}
          <button
            type="button"
            onClick={openOfficialGroupLink}
            className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            title="Abrir Grupo Oficial do WhatsApp da JPL Construtora"
          >
            <SendIcon className="h-3.5 w-3.5" />
            <span>Grupo WhatsApp</span>
          </button>

          {/* Botão Nova Tarefa Completa */}
          <Button
            size="sm"
            onClick={() => {
              setTaskToEdit(null);
              setIsCreateModalOpen(true);
            }}
            className="h-8 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-700 cursor-pointer"
          >
            <PlusIcon className="h-3.5 w-3.5 mr-1" />
            <span>+ Detalhado</span>
          </Button>

          {/* Botão Ver Pauta no Mobile */}
          <div className="lg:hidden">
            <Button
              size="sm"
              onClick={() => setIsMobileWhatsappPreviewOpen(true)}
              className="h-8 text-xs bg-indigo-600 text-white"
            >
              <CopyIcon className="h-3.5 w-3.5 mr-1" />
              <span>Ver Pauta</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. BARRA DE ENTRADA ULTRARRÁPIDA (COM PARSER E VOZ)       */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-2xl p-3.5 shadow-sm space-y-2.5">
        {/* Banner de Gravação de Voz Ativa */}
        {isListeningVoice && (
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs animate-pulse">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
              </span>
              <span className="font-bold truncate">🎙️ Gravando áudio... Pode falar a pendência agora!</span>
            </div>
            <button
              type="button"
              onClick={toggleVoiceRecording}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-xs shrink-0 transition-colors"
            >
              Concluir Fala ⏹️
            </button>
          </div>
        )}

        <form onSubmit={handleQuickSubmit} className="relative flex items-center gap-2">
          {/* Ícone de Raio */}
          <div className="absolute left-3 text-emerald-600 dark:text-emerald-400">
            <SparklesIcon className="h-4 w-4" />
          </div>

          {/* Campo de Texto Principal */}
          <input
            ref={inputRef}
            type="text"
            value={quickInputText}
            onChange={(e) => setQuickInputText(e.target.value)}
            placeholder={
              isListeningVoice
                ? 'Escutando sua voz em tempo real...'
                : 'Digite ou fale a pendência (ex: "Lázaro: conferir nível do baldrame no Estrela Dalva amanhã" ou "Comprar 20 tábuas")...'
            }
            className={`w-full h-11 pl-9 pr-24 text-xs sm:text-sm bg-slate-50/70 dark:bg-slate-900/40 border rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none transition-all ${
              isListeningVoice
                ? 'border-rose-400 ring-2 ring-rose-400/30'
                : 'border-slate-200 dark:border-gray-800 focus:ring-2 focus:ring-emerald-500/40'
            }`}
          />

          {/* Botões Internos: Ditado por Voz e Salvar */}
          <div className="absolute right-2 flex items-center gap-1.5">
            {/* Botão Microfone de Ditado */}
            <button
              type="button"
              onClick={toggleVoiceRecording}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isListeningVoice
                  ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/40 ring-2 ring-rose-300'
                  : 'text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={isListeningVoice ? 'Parar gravação de voz' : 'Falar pendência ao microfone (Ditado por Voz)'}
            >
              {isListeningVoice ? <MicOffIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
            </button>

            {/* Botão Salvar (Enter) */}
            <Button
              type="submit"
              disabled={!quickInputText.trim() || createQuickTaskMutation.isPending}
              className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-30"
            >
              <span>Salvar ⚡</span>
            </Button>
          </div>
        </form>

        {/* Pílulas Inteligentes de Feedback em Tempo Real */}
        {quickInputText.trim().length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[11px] animate-in fade-in-50">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Identificado:
            </span>

            {/* Obra */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 font-semibold">
              <ConstructionIcon className="h-2.5 w-2.5" />
              {parsedPreview.projectName || 'Obra Padrão'}
            </span>

            {/* Responsável */}
            {parsedPreview.collaboratorName && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 font-semibold">
                <UserIcon className="h-2.5 w-2.5" />
                {parsedPreview.collaboratorName}
              </span>
            )}

            {/* Prazo */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold">
              <CalendarIcon className="h-2.5 w-2.5" />
              {parsedPreview.detectedDateLabel || 'Hoje'}
            </span>

            {/* Tipo Compra */}
            {parsedPreview.isPurchase && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 font-bold">
                <ShoppingBagIcon className="h-2.5 w-2.5" />
                🛒 Compra de Material
              </span>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 3. BARRA DE ABAS & BUSCA                                  */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Abas */}
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-[#111827] p-1 border border-slate-200/80 dark:border-gray-800 text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
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
            onClick={() => setActiveTab('purchases')}
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
            onClick={() => setActiveTab('alerts')}
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
            onClick={() => setActiveTab('completed')}
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

        {/* Campo de Busca Rápida */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar pendências..."
            className="w-full h-8 pl-8 pr-3 text-xs bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <FilterIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
              <XIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. ÁREA PRINCIPAL: SPLIT VIEW (DESKTOP)                   */}
      {/* ========================================================= */}
      <div className="flex flex-col lg:flex-row items-start gap-4">
        {/* ------------------------------------------------------- */}
        {/* LADO ESQUERDO: LISTAS DE PENDÊNCIAS E CARDS (58%)       */}
        {/* ------------------------------------------------------- */}
        <div className="w-full lg:w-[58%] xl:w-[60%] shrink-0 space-y-4">
          {isLoadingTasks ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              Carregando pendências e programação do canteiro...
            </div>
          ) : activeTab === 'today' ? (
            renderTasksGroupedByProject(todayAndTomorrowTasks, false)
          ) : activeTab === 'purchases' ? (
            renderTasksGroupedByProject(purchaseTasks, true)
          ) : activeTab === 'alerts' ? (
            /* ABA 3: ALERTAS AUTOMÁTICOS DERIVADOS DE OUTROS MÓDULOS */
            <div className="space-y-3">
              {autoAlerts.length === 0 ? (
                <div className="py-16 text-center bg-white dark:bg-[#111827] border border-dashed border-slate-200 dark:border-gray-800 rounded-2xl p-6">
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
                autoAlerts.map(alert => (
                  <div
                    key={alert.id}
                    className="p-3.5 rounded-xl border bg-white dark:bg-[#111827] border-slate-200/80 dark:border-gray-800 flex items-start justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        alert.severity === 'critical'
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                          : alert.severity === 'warning'
                          ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                          : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
                      }`}>
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

                    {/* Botão de Ação do Alerta */}
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
            /* ABA 4: CONCLUÍDAS */
            renderTasksGroupedByProject(completedTasks, false)
          )}
        </div>

        {/* ------------------------------------------------------- */}
        {/* LADO DIREITO: LIVE PREVIEW WHATSAPP (40% - 42%)         */}
        {/* ------------------------------------------------------- */}
        <div className="hidden lg:flex w-full lg:w-[42%] xl:w-[40%] flex-col space-y-3 sticky top-4">
          <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
            {/* Cabeçalho do Card WhatsApp */}
            <div className="p-3.5 bg-emerald-600 dark:bg-emerald-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SendIcon className="h-4 w-4" />
                <div>
                  <h3 className="text-xs font-bold">Pauta Diária para o WhatsApp</h3>
                  <p className="text-[10px] text-emerald-100">
                    Alimenta o grupo do canteiro com 1 clique
                  </p>
                </div>
              </div>

              {/* Alternador de Data: Hoje vs Amanhã */}
              <div className="inline-flex rounded-lg bg-emerald-700/80 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setPreviewDateMode('today')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    previewDateMode === 'today'
                      ? 'bg-white text-emerald-800 font-bold shadow-xs'
                      : 'text-emerald-100 hover:text-white'
                  }`}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDateMode('tomorrow')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    previewDateMode === 'tomorrow'
                      ? 'bg-white text-emerald-800 font-bold shadow-xs'
                      : 'text-emerald-100 hover:text-white'
                  }`}
                >
                  Amanhã
                </button>
              </div>
            </div>

            {/* Barra de Progresso Diário */}
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between text-xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-gray-400">
                Progresso ({previewDateMode === 'today' ? 'Hoje' : 'Amanhã'}):
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {dailyProgress}% concluído
              </span>
            </div>

            {/* Explicação de como funciona o envio direto */}
            <div className="px-3.5 py-2.5 bg-emerald-50/80 dark:bg-emerald-950/20 border-b border-slate-100 dark:border-gray-800 text-[11px] text-emerald-900 dark:text-emerald-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300">
                <span>💡 Como funciona o Envio em 1 Clique:</span>
              </div>
              <p className="text-[11px] leading-tight text-slate-600 dark:text-gray-300">
                1. O botão verde copia a pauta e já abre o grupo da JPL no WhatsApp.
              </p>
              <p className="text-[11px] leading-tight text-slate-600 dark:text-gray-300">
                2. No WhatsApp, você apenas pressiona <strong>Ctrl + V</strong> (ou segure o dedo e clique em <strong>Colar</strong> no celular) e aperta enviar!
              </p>
            </div>

            {/* Balão de Mensagem Estilo WhatsApp (Live Preview) */}
            <div className="p-3.5 bg-[#EFEAE2]/60 dark:bg-[#0D1418] max-h-[300px] overflow-y-auto custom-scrollbar">
              <div className="bg-white dark:bg-[#1F2C34] border border-slate-200/60 dark:border-gray-700/50 rounded-xl p-3 shadow-xs text-xs font-mono text-slate-800 dark:text-[#E9EDEF] whitespace-pre-wrap leading-relaxed select-all">
                {formattedWhatsAppText}
              </div>
            </div>

            {/* Botões de Ação da Pauta */}
            <div className="p-3 bg-white dark:bg-[#111827] border-t border-slate-100 dark:border-gray-800 space-y-2">
              {/* Botão de Destaque 1 Clique */}
              <button
                type="button"
                onClick={handleDirectGroupSend}
                className="w-full h-10 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                title="Copia o texto da pauta e abre direto o grupo do WhatsApp da JPL para você só colar e enviar"
              >
                <SendIcon className="h-4 w-4" />
                <span>{isCopiedSuccess ? '✅ Copiado! Abrindo Grupo...' : '🟢 Enviar no Grupo JPL (1 Clique)'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                {/* 1. Botão Apenas Copiar */}
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="h-8 rounded-lg font-semibold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-gray-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <CopyIcon className="h-3.5 w-3.5 text-slate-500" />
                  <span>Apenas Copiar</span>
                </button>

                {/* 2. Botão wa.me com texto pré-digitado */}
                <button
                  type="button"
                  onClick={handleOpenWhatsAppPrefilled}
                  className="h-8 rounded-lg font-semibold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-gray-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Abre o WhatsApp com o texto já na barra de digitação para você escolher o contato ou grupo"
                >
                  <SendIcon className="h-3.5 w-3.5 text-emerald-600" />
                  <span>wa.me (Pré-digitado)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. MODAL DE EDIÇÃO / CRIAÇÃO DETALHADA                    */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <CreateTaskModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setTaskToEdit(null);
          }}
          taskToEdit={taskToEdit}
          projects={projects}
          collaborators={collaborators}
          isLoadingPrerequisites={isLoadingProjects || isLoadingCollaborators}
        />
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

      {/* ========================================================= */}
      {/* 6. MODAL RESPONSIVO: PAUTA WHATSAPP NO CELULAR / MOBILE   */}
      {/* ========================================================= */}
      {isMobileWhatsappPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in-50">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Cabeçalho */}
            <div className="p-3.5 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SendIcon className="h-4 w-4" />
                <div>
                  <h3 className="text-xs font-bold">Pauta para WhatsApp</h3>
                  <p className="text-[10px] text-emerald-100">
                    Alimenta o grupo da JPL com 1 clique
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileWhatsappPreviewOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white cursor-pointer"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Alternador de Data e Progresso */}
            <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between text-xs">
              <div className="inline-flex rounded-lg bg-slate-200 dark:bg-slate-800 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPreviewDateMode('today')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    previewDateMode === 'today'
                      ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white font-bold shadow-xs'
                      : 'text-slate-600 dark:text-gray-400'
                  }`}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDateMode('tomorrow')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    previewDateMode === 'tomorrow'
                      ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white font-bold shadow-xs'
                      : 'text-slate-600 dark:text-gray-400'
                  }`}
                >
                  Amanhã
                </button>
              </div>

              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {dailyProgress}% concluído
              </span>
            </div>

            {/* Balão de Mensagem */}
            <div className="p-3.5 bg-[#EFEAE2]/60 dark:bg-[#0D1418] overflow-y-auto flex-1 text-xs font-mono text-slate-800 dark:text-[#E9EDEF] whitespace-pre-wrap select-all">
              <div className="bg-white dark:bg-[#1F2C34] border border-slate-200/60 dark:border-gray-700/50 rounded-xl p-3 shadow-xs leading-relaxed">
                {formattedWhatsAppText}
              </div>
            </div>

            {/* Explicação de como funciona */}
            <div className="px-3.5 py-2 bg-emerald-50/70 dark:bg-emerald-950/20 border-t border-emerald-100 dark:border-emerald-900/30 text-[11px] text-emerald-800 dark:text-emerald-300">
              💡 <strong>Como enviar:</strong> Clique no botão verde abaixo. O sistema copia a pauta e já abre o grupo do WhatsApp da JPL. Lá dentro, é só segurar o dedo na barra de texto, clicar em <strong>Colar</strong> e enviar!
            </div>

            {/* Botões de Ação */}
            <div className="p-3 bg-white dark:bg-[#111827] border-t border-slate-100 dark:border-gray-800 space-y-2">
              <button
                type="button"
                onClick={handleDirectGroupSend}
                className="w-full h-10 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <SendIcon className="h-4 w-4" />
                <span>{isCopiedSuccess ? '✅ Copiado! Abrindo Grupo...' : '🟢 Enviar no Grupo JPL (1 Clique)'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="h-8 rounded-lg font-semibold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-gray-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                  <span>Apenas Copiar</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenWhatsAppPrefilled}
                  className="h-8 rounded-lg font-semibold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-gray-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <SendIcon className="h-3.5 w-3.5 text-emerald-600" />
                  <span>wa.me (Pré-digitado)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tarefas;
