import React, { useState, useMemo, useEffect } from 'react';
import { useVisaoGeral } from '../hooks/useVisaoGeral';
import { PainelHoje } from '../components/home/PainelHoje';
import { CardObra } from '../components/home/CardObra';
import { EstourosPrevisto } from '../components/home/EstourosPrevisto';
import { ComparativoObras } from '../components/home/ComparativoObras';
import { ComposicaoCategorias } from '../components/home/ComposicaoCategorias';
import { PrevistoRealizado } from '../components/home/PrevistoRealizado';
import { GastoMensal } from '../components/home/GastoMensal';
import { AuditLogsPanel } from '../components/home/AuditLogsPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { 
  HomeIcon, 
  ConstructionIcon, 
  BarChartIcon, 
  ClipboardListIcon, 
  ChevronUpIcon, 
  ChevronDownIcon 
} from '../lib/icons';
import { Skeleton } from '../components/ui/Skeleton';
import { useMediaQuery } from '../hooks/use-media-query';

const Home: React.FC = () => {
  const [mesesGasto, setMesesGasto] = useState<number>(6);
  const { painelHoje, obrasResumo, obrasCategorias, gastoMensal } = useVisaoGeral(mesesGasto);

  // No desktop (>= 1024px) começa aberta; no celular começa recolhida
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [isAnaliseOpen, setIsAnaliseOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  // Sincroniza se a tela mudar de largura
  useEffect(() => {
    setIsAnaliseOpen(isDesktop);
  }, [isDesktop]);

  // Histórico de alterações: fechado por padrão em todos os tamanhos
  const [isAuditLogsOpen, setIsAuditLogsOpen] = useState<boolean>(false);

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

      {/* BLOCO 4: ANÁLISE E COMPARAÇÃO */}
      <section className="space-y-4 pt-2 border-t border-slate-200/80 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <BarChartIcon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-gray-200">
                Análise e comparação
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-gray-400">
                Comparativo de custo/m², distribuição por categorias e evolução de desembolso
              </p>
            </div>
          </div>

          {/* Botão de recolher/expandir no mobile */}
          <button
            type="button"
            onClick={() => setIsAnaliseOpen((prev) => !prev)}
            className="lg:hidden text-xs font-semibold text-brand-blue-600 dark:text-brand-blue-400 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 cursor-pointer shadow-xs"
          >
            {isAnaliseOpen ? 'Recolher' : 'Expandir'}
            {isAnaliseOpen ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
          </button>
        </div>

        {isAnaliseOpen && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
            {/* 1. Comparativo entre obras por m² */}
            <ComparativoObras obras={obrasResumo.data} isLoading={obrasResumo.isLoading} />

            {/* 2. Composição do custo por categoria */}
            <ComposicaoCategorias
              categorias={obrasCategorias.data}
              isLoading={obrasCategorias.isLoading}
            />

            {/* 3. Previsto vs Realizado de material por obra */}
            <PrevistoRealizado
              categorias={obrasCategorias.data}
              obrasResumo={obrasResumo.data}
              isLoading={obrasCategorias.isLoading}
            />

            {/* 4. Gasto mensal */}
            <GastoMensal
              dados={gastoMensal.data}
              meses={mesesGasto}
              onMesesChange={setMesesGasto}
              isLoading={gastoMensal.isLoading}
            />
          </div>
        )}
      </section>

      {/* BLOCO 5: HISTÓRICO DE ALTERAÇÕES (RECOLHIDO POR PADRÃO) */}
      <section className="pt-2 border-t border-slate-200/80 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setIsAuditLogsOpen((prev) => !prev)}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-2xl hover:border-slate-300 dark:hover:border-gray-700 transition-colors cursor-pointer text-left shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300">
              <ClipboardListIcon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-gray-200">
                Histórico de alterações
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-gray-400">
                Registro de auditoria de criações, edições e exclusões no sistema
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-brand-blue-600 dark:text-brand-blue-400 flex items-center gap-1 shrink-0">
            {isAuditLogsOpen ? 'Recolher' : 'Expandir'}
            {isAuditLogsOpen ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </span>
        </button>

        {isAuditLogsOpen && (
          <div className="pt-4 animate-in fade-in slide-in-from-top-2">
            <AuditLogsPanel />
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
