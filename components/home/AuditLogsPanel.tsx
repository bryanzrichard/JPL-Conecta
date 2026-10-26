import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { AuditLog } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const AuditLogsPanel: React.FC = () => {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    
    useEffect(() => {
        if (!profile?.company_id) return;
        
        const channel = supabase.channel('audit_logs_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'audit_logs',
                    filter: `company_id=eq.${profile.company_id}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
                }
            )
            .subscribe();
            
        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.company_id, queryClient]);
    
    const { data: logs, isLoading, error } = useQuery({
        queryKey: ['audit_logs', profile?.company_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('company_id', profile!.company_id)
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (error) {
                if (error.code === '42P01') {
                    throw new Error("A tabela 'audit_logs' ainda não foi criada no Supabase.");
                }
                throw error;
            }
            return data as AuditLog[];
        },
        enabled: !!profile?.company_id,
    });

    return (
        <div className="bg-white dark:bg-[#111827] flex flex-col h-[400px]">
            <div className="p-3.5 border-b border-[#E2E8F0] dark:border-[#1E293B] bg-slate-50 dark:bg-[#162235]/40 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#94A3B8] flex items-center">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse" />
                    Últimas ações no sistema
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                    Auditoria em tempo real
                </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full text-slate-400 dark:text-[#94A3B8] text-xs">
                        Carregando logs...
                    </div>
                ) : error ? (
                    <div className="flex flex-col justify-center items-center h-full text-rose-500 text-xs p-4 text-center">
                        <span className="font-semibold mb-2">Atenção</span>
                        {error instanceof Error ? error.message : "Não foi possível carregar os logs."}
                        <div className="mt-4 text-xs text-slate-500 max-w-sm text-left bg-slate-50 dark:bg-brand-dark-950 p-2 rounded border border-[#E2E8F0] dark:border-[#1E293B]">
                            Execute o script SQL localizado em <b>supabase/migrations/02-audit-logs.sql</b> no painel do Supabase.
                        </div>
                    </div>
                ) : logs && logs.length > 0 ? (
                    <div className="space-y-3">
                        {logs.map((log) => (
                            <div key={log.id} className="flex gap-3 p-3 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B] bg-slate-50/50 dark:bg-[#162235]/30 hover:bg-slate-100/60 dark:hover:bg-[#1E293B]/50 transition-colors">
                                <div className="flex-shrink-0 mt-0.5">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-brand-dark-800 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-[#1E293B]">
                                        {log.user_email ? log.user_email.charAt(0).toUpperCase() : '?'}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-semibold text-slate-800 dark:text-[#F8FAFC] truncate">
                                            {log.user_email || 'Usuário Desconhecido'}
                                        </p>
                                        <span className="text-[10px] text-slate-400 dark:text-[#94A3B8] font-mono whitespace-nowrap">
                                            {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                                        <span className="font-semibold text-brand-blue-600 dark:text-[#818CF8]">{log.action}</span> em <span className="font-medium text-slate-700 dark:text-[#F8FAFC]">{log.resource}</span>
                                    </p>
                                    {log.details && Object.keys(log.details).length > 0 && (
                                        <div className="mt-2 text-[11px] font-mono text-slate-500 dark:text-[#94A3B8] bg-slate-100 dark:bg-brand-dark-950 p-2 rounded border border-[#E2E8F0] dark:border-[#1E293B] overflow-x-auto">
                                            {JSON.stringify(log.details)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-[#94A3B8] space-y-2 p-8 text-center text-xs">
                        <p>Nenhum log de auditoria encontrado.</p>
                        <p className="text-[11px] max-w-xs text-slate-400 dark:text-[#94A3B8]">(Se você acabou de configurar, pode ser necessário criar a tabela <code>audit_logs</code> no Supabase).</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditLogsPanel;
