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
                    // Table does not exist yet
                    throw new Error("A tabela 'audit_logs' ainda não foi criada no Supabase.");
                }
                throw error;
            }
            return data as AuditLog[];
        },
        enabled: !!profile?.company_id,
    });

    return (
        <div className="bg-brand-dark-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col h-[400px]">
            <div className="p-4 border-b border-gray-800 bg-brand-dark-950/50">
                <h3 className="text-lg font-semibold text-white flex items-center">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse"></span>
                    Logs de Auditoria
                </h3>
                <p className="text-xs text-gray-400 mt-1">Acompanhe as últimas ações realizadas no sistema.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full text-gray-500 text-sm">
                        Carregando logs...
                    </div>
                ) : error ? (
                    <div className="flex flex-col justify-center items-center h-full text-red-400 text-sm p-4 text-center">
                        <span className="font-semibold mb-2">Atenção</span>
                        {error instanceof Error ? error.message : "Não foi possível carregar os logs."}
                        <div className="mt-4 text-xs text-gray-500 max-w-sm text-left bg-brand-dark-950 p-2 rounded border border-gray-800">
                            Execute o script SQL localizado em <b>supabase/migrations/02-audit-logs.sql</b> no painel do Supabase.
                        </div>
                    </div>
                ) : logs && logs.length > 0 ? (
                    <div className="space-y-4">
                        {logs.map((log) => (
                            <div key={log.id} className="flex gap-4 p-3 rounded-lg border border-gray-800/50 bg-gray-900/30 hover:bg-gray-800/50 transition-colors">
                                <div className="flex-shrink-0 mt-1">
                                    <div className="w-8 h-8 rounded-full bg-brand-dark-800 flex items-center justify-center text-xs font-medium text-gray-300 border border-gray-700">
                                        {log.user_email ? log.user_email.charAt(0).toUpperCase() : '?'}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-medium text-gray-200 truncate">
                                            {log.user_email || 'Usuário Desconhecido'}
                                        </p>
                                        <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                            {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        <span className="font-semibold text-blue-400">{log.action}</span> em <span className="font-medium text-gray-300">{log.resource}</span>
                                    </p>
                                    {log.details && Object.keys(log.details).length > 0 && (
                                        <div className="mt-2 text-xs font-mono text-gray-500 bg-brand-dark-950 p-2 rounded border border-gray-800 overflow-x-auto">
                                            {JSON.stringify(log.details)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2 p-8 text-center">
                        <p className="text-sm">Nenhum log de auditoria encontrado.</p>
                        <p className="text-xs max-w-xs">(Se você acabou de configurar, pode ser necessário criar a tabela <code>audit_logs</code> no Supabase).</p>
                    </div>
                )}
            </div>
        </div>
    );
};
