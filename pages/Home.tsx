import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDashboardAlerts } from '../hooks/useDashboardAlerts';
import { SystemHealthPanel } from '../components/home/SystemHealthPanel';
import { DashboardCharts } from '../components/home/DashboardCharts';
import { AuditLogsPanel } from '../components/home/AuditLogsPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { HomeIcon, AlertTriangleIcon, ClockIcon, ChevronRightIcon, TrendingUpIcon } from '../lib/icons';
import { Skeleton } from '../components/ui/Skeleton';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const Home: React.FC = () => {
    const { profile, user } = useAuth();
    const navigate = useNavigate();
    const { monthlySpending, delayedTasks, pendingAi, isLoading } = useDashboardAlerts(
        profile?.company_id,
        user?.id
    );

    return (
        <div className="space-y-6 animate-in fade-in-50 pb-20 md:pb-0">
            <PageHeader
                icon={HomeIcon}
                title="Visão Geral & Indicadores"
                description="Acompanhe métricas executivas, alertas operacionais e integridade do sistema."
            />

            {/* KPI EXECUTIVE ALERTS ROW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. GASTOS NO MÊS */}
                <div 
                    onClick={() => navigate('/notas')}
                    className="bg-brand-dark-900 border border-gray-800 hover:border-gray-700 p-5 rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-sm hover:shadow-md group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                            <TrendingUpIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-400">Total Faturado no Mês</p>
                            {isLoading ? (
                                <Skeleton className="h-7 w-28 mt-1" />
                            ) : (
                                <p className="text-xl font-bold text-white tracking-tight">{formatCurrency(monthlySpending)}</p>
                            )}
                        </div>
                    </div>
                    <ChevronRightIcon className="h-5 w-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                </div>

                {/* 2. TAREFAS ATRASADAS */}
                <div 
                    onClick={() => navigate('/tarefas')}
                    className={`bg-brand-dark-900 border p-5 rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-sm hover:shadow-md group ${
                        delayedTasks > 0 ? 'border-red-900/40 hover:border-red-800/60 bg-red-950/10' : 'border-gray-800 hover:border-gray-700'
                    }`}
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-transform group-hover:scale-105 ${
                            delayedTasks > 0 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-brand-dark-800 border-gray-700 text-gray-400'
                        }`}>
                            <AlertTriangleIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-400">Tarefas em Atraso</p>
                            {isLoading ? (
                                <Skeleton className="h-7 w-16 mt-1" />
                            ) : (
                                <p className={`text-xl font-bold tracking-tight ${delayedTasks > 0 ? 'text-red-400' : 'text-white'}`}>
                                    {delayedTasks} {delayedTasks === 1 ? 'tarefa' : 'tarefas'}
                                </p>
                            )}
                        </div>
                    </div>
                    <ChevronRightIcon className="h-5 w-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                </div>

                {/* 3. PENDÊNCIAS / PROCESSAMENTOS IA */}
                <div 
                    onClick={() => navigate('/notas')}
                    className={`bg-brand-dark-900 border p-5 rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-sm hover:shadow-md group sm:col-span-2 lg:col-span-1 ${
                        pendingAi > 0 ? 'border-amber-900/40 hover:border-amber-800/60 bg-amber-950/10' : 'border-gray-800 hover:border-gray-700'
                    }`}
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-transform group-hover:scale-105 ${
                            pendingAi > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-brand-dark-800 border-gray-700 text-gray-400'
                        }`}>
                            <ClockIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-400">Processamento IA & Fila</p>
                            {isLoading ? (
                                <Skeleton className="h-7 w-20 mt-1" />
                            ) : (
                                <p className={`text-xl font-bold tracking-tight ${pendingAi > 0 ? 'text-amber-400' : 'text-white'}`}>
                                    {pendingAi} {pendingAi === 1 ? 'item pendente' : 'itens pendentes'}
                                </p>
                            )}
                        </div>
                    </div>
                    <ChevronRightIcon className="h-5 w-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                </div>
            </div>

            {/* DASHBOARD CHARTS */}
            <DashboardCharts />

            {/* AUDIT LOGS & HEALTH CHECK - SIDE BY SIDE IN WIDESCREEN DESKTOP */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
                <div className="min-h-[440px] flex flex-col">
                    <AuditLogsPanel />
                </div>
                <div className="min-h-[440px] flex flex-col">
                    <SystemHealthPanel />
                </div>
            </div>
        </div>
    );
};

export default Home;
