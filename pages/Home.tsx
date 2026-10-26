import React, { useMemo } from 'react';
import { useVisaoGeral } from '../hooks/useVisaoGeral';
import { PainelHoje } from '../components/home/PainelHoje';
import { CardObra } from '../components/home/CardObra';
import { EstourosPrevisto } from '../components/home/EstourosPrevisto';
import { DashboardCharts } from '../components/home/DashboardCharts';
import { AuditLogsPanel } from '../components/home/AuditLogsPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { HomeIcon, ConstructionIcon } from '../lib/icons';
import { Skeleton } from '../components/ui/Skeleton';

const Home: React.FC = () => {
  const { painelHoje, obrasResumo, obrasCategorias } = useVisaoGeral();

  // Filtrar apenas obras não concluídas para os cards em andamento
  const activeObras = useMemo(() => {
    return (obrasResumo.data || []).filter(
      (o) => o.status !== 'Concluido' && o.status !== 'Concluído'
    );
  }, [obrasResumo.data]);

  // Set de IDs das obras concluídas para o filtro do bloco Estouros
  const concludedProjectIds = useMemo(() => {
    return new Set(
      (obrasResumo.data || [])
        .filter((o) => o.status === 'Concluido' || o.status === 'Concluído')
        .map((o) => o.project_id)
    );
  }, [obrasResumo.data]);

  return (
    <div className="space-y-7 animate-in fade-in-50 pb-20 md:pb-6">
      {/* CABEÇALHO DA PÁGINA */}
      <PageHeader
        icon={HomeIcon}
        title="Visão Geral"
        description="Pendências do dia, situação de cada obra e custos acima do previsto."
      />

      {/* BLOCO 1: HOJE */}
      <PainelHoje
        data={painelHoje.data}
        isLoading={painelHoje.isLoading}
        isError={painelHoje.isError}
      />

      {/* BLOCO 2: OBRAS EM ANDAMENTO */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <ConstructionIcon className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-gray-200">
              Obras em andamento
            </h2>
          </div>
          {!obrasResumo.isLoading && (
            <span className="text-[11px] text-slate-500 dark:text-gray-400">
              {activeObras.length} {activeObras.length === 1 ? 'obra ativa' : 'obras ativas'}
            </span>
          )}
        </div>

        {obrasResumo.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : obrasResumo.isError ? (
          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300">
            Não foi possível carregar o resumo das obras no momento.
          </div>
        ) : activeObras.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-2xl space-y-1">
            <p className="text-xs font-semibold text-slate-700 dark:text-gray-300">
              Nenhuma obra em andamento no momento.
            </p>
            <p className="text-[11px] text-slate-400 dark:text-gray-500">
              Cadastre uma nova obra ou reabra uma obra em planejamento para acompanhar o consumo.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeObras.map((obra) => (
                <CardObra key={obra.project_id} obra={obra} />
              ))}
            </div>
            {/* LEGENDA CURTA ABAIXO DOS CARDS */}
            <p className="text-xs text-slate-500 dark:text-gray-400 text-center sm:text-left pt-1">
              Barra: dinheiro gasto. Traço: obra pronta.
            </p>
          </div>
        )}
      </section>

      {/* BLOCO 3: ESTOURANDO O PREVISTO */}
      <EstourosPrevisto
        categorias={obrasCategorias.data}
        concludedProjectIds={concludedProjectIds}
        isLoading={obrasCategorias.isLoading}
        isError={obrasCategorias.isError}
      />

      {/* DASHBOARD CHARTS (MANTIDO CONFORME ESPECIFICAÇÃO) */}
      <DashboardCharts />

      {/* AUDIT LOGS (MANTIDO CONFORME ESPECIFICAÇÃO) */}
      <div className="pt-2">
        <AuditLogsPanel />
      </div>
    </div>
  );
};

export default Home;
