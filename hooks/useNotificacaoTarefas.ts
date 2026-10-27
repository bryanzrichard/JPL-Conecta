import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';
import { EnrichedTask } from '../components/tarefas/types';

export interface UseNotificacaoTarefasParams {
  todayAndTomorrowTasks: EnrichedTask[];
  todayStr: string;
}

export interface UseNotificacaoTarefasReturn {
  hasNotificationPermission: boolean;
  requestNotificationPermission: () => Promise<void>;
}

export function useNotificacaoTarefas({
  todayAndTomorrowTasks,
  todayStr,
}: UseNotificacaoTarefasParams): UseNotificacaoTarefasReturn {
  const { toast } = useToast();

  // -------------------------------------------------------------
  // NOTIFICAÇÕES NATIVAS DO SMARTPHONE / COMPUTADOR
  // -------------------------------------------------------------
  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean>(() => {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    );
  });

  // Notificação Automática de tarefas com prazo para hoje ou amanhã
  const sendTaskNotification = useCallback(
    (pendentesHoje: EnrichedTask[], pendentesAmanha: EnrichedTask[]) => {
      if (
        typeof window === 'undefined' ||
        !('Notification' in window) ||
        Notification.permission !== 'granted'
      ) {
        return;
      }
      if (pendentesHoje.length === 0 && pendentesAmanha.length === 0) {
        return;
      }

      let corpo = '';
      if (pendentesHoje.length > 0 && pendentesAmanha.length > 0) {
        corpo = `Você tem ${pendentesHoje.length} tarefa(s) para HOJE e ${pendentesAmanha.length} para AMANHÃ.`;
      } else if (pendentesHoje.length > 0) {
        corpo = `Atenção: ${pendentesHoje.length} tarefa(s) com prazo para HOJE.`;
      } else {
        corpo = `Atenção: ${pendentesAmanha.length} tarefa(s) com prazo para AMANHÃ.`;
      }

      try {
        const notif = new Notification('JPL Conecta 🏗️ — Lembrete de Tarefas', {
          body: corpo,
          icon: '/favicon.ico',
        });
        notif.onclick = () => {
          window.focus();
        };
      } catch (err) {
        console.warn('Erro ao disparar notificação automática:', err);
      }
    },
    []
  );

  // Disparo automático ao carregar ou atualizar tarefas
  useEffect(() => {
    if (todayAndTomorrowTasks.length === 0) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const pendentesHoje = todayAndTomorrowTasks.filter((t) => t.isTodayTask || t.isDelayed);
    const pendentesAmanha = todayAndTomorrowTasks.filter((t) => t.isTomorrowTask);

    if (pendentesHoje.length === 0 && pendentesAmanha.length === 0) return;

    const storageKey = `jpl_task_notif_${todayStr}`;
    const alreadyNotified = sessionStorage.getItem(storageKey);

    if (!alreadyNotified) {
      if (Notification.permission === 'granted') {
        sendTaskNotification(pendentesHoje, pendentesAmanha);
        sessionStorage.setItem(storageKey, 'true');
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            setHasNotificationPermission(true);
            sendTaskNotification(pendentesHoje, pendentesAmanha);
            sessionStorage.setItem(storageKey, 'true');
          }
        });
      }
    }
  }, [todayAndTomorrowTasks, todayStr, sendTaskNotification]);

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

        const pendentesHoje = todayAndTomorrowTasks.filter((t) => t.isTodayTask || t.isDelayed);
        const pendentesAmanha = todayAndTomorrowTasks.filter((t) => t.isTomorrowTask);

        if (pendentesHoje.length > 0 || pendentesAmanha.length > 0) {
          sendTaskNotification(pendentesHoje, pendentesAmanha);
        } else {
          new Notification('JPL Conecta 🏗️ — Lembrete de Tarefas', {
            body: 'Todas as tarefas de hoje e amanhã estão concluídas ou em dia!',
            icon: '/favicon.ico',
          });
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Notificações Bloqueadas',
          description:
            'Clique no ícone de cadeado na barra do navegador e permita as Notificações.',
        });
      }
    } catch (e) {
      console.warn('Erro ao solicitar permissão de notificações:', e);
    }
  };

  return {
    hasNotificationPermission,
    requestNotificationPermission,
  };
}
