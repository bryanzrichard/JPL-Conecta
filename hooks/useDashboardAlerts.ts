import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface DashboardAlerts {
    monthlySpending: number;
    delayedTasks: number;
    pendingAi: number;
    isLoading: boolean;
}

export const useDashboardAlerts = (companyId?: string, userId?: string): DashboardAlerts => {
    const [monthlySpending, setMonthlySpending] = useState(0);
    const [delayedTasks, setDelayedTasks] = useState(0);
    const [pendingAi, setPendingAi] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!companyId || !userId) {
            setIsLoading(false);
            return;
        }

        let isMounted = true;

        const fetchStats = async () => {
            setIsLoading(true);
            try {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const today = `${year}-${month}-${day}`;
                const startOfMonthStr = `${year}-${month}-01`;

                // 1. Gasto Mês Atual
                const { data: notas } = await supabase
                    .from('notas_fiscais')
                    .select('total_value')
                    .eq('company_id', companyId)
                    .gte('issue_date', startOfMonthStr)
                    .range(0, 9999);
                
                const spending = notas?.reduce((sum, nota) => sum + Number(nota.total_value || 0), 0) || 0;

                // 2. Tarefas Atrasadas
                const { count: delayed } = await supabase
                    .from('tasks')
                    .select('*', { count: 'exact', head: true })
                    .eq('company_id', companyId)
                    .or(`status.eq.Atrasada,and(status.neq.Concluída,data_fim_prevista.lt.${today})`);

                // 3. Notas p/ Revisão (AI Jobs)
                const { count: pending } = await supabase
                    .from('ai_process_jobs')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .in('status', ['pending', 'processing', 'completed']);

                if (isMounted) {
                    setMonthlySpending(spending);
                    setDelayedTasks(delayed || 0);
                    setPendingAi(pending || 0);
                }
            } catch (error) {
                console.error("Error fetching dashboard alerts:", error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchStats();

        // Set up real-time subscriptions
        const notasSubscription = supabase
            .channel('notas_fiscais_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notas_fiscais', filter: `company_id=eq.${companyId}` }, fetchStats)
            .subscribe();

        const tasksSubscription = supabase
            .channel('tasks_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `company_id=eq.${companyId}` }, fetchStats)
            .subscribe();

        const aiJobsSubscription = supabase
            .channel('ai_jobs_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_process_jobs', filter: `user_id=eq.${userId}` }, fetchStats)
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(notasSubscription);
            supabase.removeChannel(tasksSubscription);
            supabase.removeChannel(aiJobsSubscription);
        };
    }, [companyId, userId]);

    return { monthlySpending, delayedTasks, pendingAi, isLoading };
};
