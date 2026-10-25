import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { BarChartIcon, ConstructionIcon } from '../../lib/icons';
import { Skeleton } from '../ui/Skeleton';
import { CATEGORIA_NOTA_ENUM, DashboardSpendingRow } from '../../types';

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const DashboardCharts: React.FC = () => {
    const { profile } = useAuth();
    const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

    const { data: spendingRows, isLoading } = useQuery<DashboardSpendingRow[]>({
        queryKey: ['dashboardItems', profile?.company_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .rpc('get_dashboard_spending', { p_company_id: profile!.company_id! })
                .returns<DashboardSpendingRow[]>();
            if (error) throw error;
            return data || [];
        },
        enabled: !!profile?.company_id,
        refetchInterval: 30000,
    });

    const { spendingByCategory, spendingByProject, totalFilteredSpending } = useMemo(() => {
        const categoryMap = new Map<string, number>();
        const projectMap = new Map<string, number>();
        let total = 0;

        if (spendingRows) {
            spendingRows.forEach(row => {
                const category = row.categoria || 'Sem Categoria';
                const projectName = row.obra || 'Sem Projeto';
                const price = Number(row.total) || 0;

                if (selectedCategory === 'Todas') {
                    categoryMap.set(category, (categoryMap.get(category) || 0) + price);
                    projectMap.set(projectName, (projectMap.get(projectName) || 0) + price);
                    total += price;
                } else if (category === selectedCategory) {
                    projectMap.set(projectName, (projectMap.get(projectName) || 0) + price);
                    total += price;
                }
            });
        }

        const sortedCategories = Array.from(categoryMap.entries())
            .map(([category, total]) => ({ category, total }))
            .sort((a, b) => b.total - a.total);

        const sortedProjects = Array.from(projectMap.entries())
            .map(([project, total]) => ({ project, total }))
            .sort((a, b) => b.total - a.total);

        return {
            spendingByCategory: sortedCategories,
            spendingByProject: sortedProjects,
            totalFilteredSpending: total,
        };
    }, [spendingRows, selectedCategory]);

    return (
        <div className="space-y-4">
            {/* Filter Section */}
            <div className="flex flex-col gap-4 bg-brand-dark-900 border border-gray-800/60 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label htmlFor="category-filter" className="text-sm font-medium text-gray-300">
                        Filtrar por Categoria:
                    </label>
                    <select
                        id="category-filter"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="bg-brand-dark-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-brand-blue-500 focus:border-brand-blue-500 block p-2.5 outline-none w-full sm:w-auto"
                    >
                        <option value="Todas">Todas as Categorias</option>
                        {CATEGORIA_NOTA_ENUM.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="Despesas Adicionais (Cartório)">Despesas Adicionais (Cartório)</option>
                        <option value="Serviços Concluídos">Serviços Concluídos</option>
                    </select>
                </div>
                <div className="pt-3 border-t border-gray-800/50 flex items-center gap-3">
                    <div className="p-2 bg-brand-blue-500/10 rounded-lg">
                        <BarChartIcon className="h-4 w-4 text-brand-blue-500" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total no Filtro</p>
                        <p className="text-xl font-bold text-white">{formatCurrency(totalFilteredSpending)}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart 1: Gastos por Categoria (Only show if 'Todas' is selected) */}
                {selectedCategory === 'Todas' && (
                    <div className="bg-brand-dark-900 border border-gray-800/60 rounded-2xl shadow-sm h-full flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-gray-800/50">
                            <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                                <BarChartIcon className="h-5 w-5 text-brand-blue-500" />
                                Raio-X de Gastos (Por Categoria)
                            </h3>
                        </div>
                        <div className="p-5 flex-grow">
                            {isLoading ? (
                                <div className="space-y-4">
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-3/4" />
                                    <Skeleton className="h-8 w-1/2" />
                                </div>
                            ) : spendingByCategory.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">
                                    <p>Sem gastos registrados.</p>
                                </div>
                            ) : (
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {spendingByCategory.map((cat, idx) => {
                                        const percentage = Math.min(100, Math.round((cat.total / (totalFilteredSpending || 1)) * 100));
                                        return (
                                            <div key={idx} className="space-y-1.5">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-300">{cat.category}</span>
                                                    <span className="font-semibold text-white">{formatCurrency(cat.total)}</span>
                                                </div>
                                                <div className="h-2 w-full bg-gray-800/50 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-brand-blue-500 rounded-full transition-all duration-1000 ease-out" 
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Chart 2: Gastos por Projeto */}
                <div className={`bg-brand-dark-900 border border-gray-800/60 rounded-2xl shadow-sm h-full flex flex-col overflow-hidden ${selectedCategory !== 'Todas' ? 'lg:col-span-2' : ''}`}>
                    <div className="p-5 border-b border-gray-800/50">
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                            <ConstructionIcon className="h-5 w-5 text-brand-blue-500" />
                            Gastos por Projeto {selectedCategory !== 'Todas' && <span className="text-brand-blue-400 text-sm ml-2">({selectedCategory})</span>}
                        </h3>
                    </div>
                    <div className="p-5 flex-grow">
                        {isLoading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-3/4" />
                            </div>
                        ) : spendingByProject.length === 0 ? (
                            <div className="text-center py-10 text-gray-500">
                                <p>Nenhum gasto encontrado para este filtro.</p>
                            </div>
                        ) : (
                            <div className={`space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar ${selectedCategory !== 'Todas' ? 'grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 space-y-0' : ''}`}>
                                {spendingByProject.map((proj, idx) => {
                                    const percentage = Math.min(100, Math.round((proj.total / (totalFilteredSpending || 1)) * 100));
                                    return (
                                        <div key={idx} className="space-y-1.5">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-300 truncate pr-2">{proj.project}</span>
                                                <span className="font-semibold text-white whitespace-nowrap">{formatCurrency(proj.total)}</span>
                                            </div>
                                            <div className="h-2 w-full bg-gray-800/50 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-brand-blue-500 rounded-full transition-all duration-1000 ease-out" 
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
