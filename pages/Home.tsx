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
    <div className="w-full space-y-4 animate-in fade-in-50 pb-20 md:pb-6">
      {/* 1. CABEÇALHO OPERACIONAL NO PADRÃO NOTAS */}
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
          <HomeIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-[#F8FAFC] tracking-tight">
            Visão Geral
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
            Pendências do dia, situação de cada obra e custos acima do previsto.
          </p>
        </div>
      </header>

      {/* BLOCO 1: HOJE */}
      <PainelHoje
        data={painelHoje.data}
        isLoading={painelHoje.isLoading}
        isError={painelHoje.isError}
      />

      {/* BLOCO 2: OBRAS EM ANDAMENTO */}
      <section className="space-y-0">
        <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-t-xl px-4 py-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <ConstructionIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
              Obras em andamento
            </h2>
          </div>
          {!obrasResumo.isLoading && (
            <span className="text-[11px] font-semibold text-slate-500 dark:text-[#94A3B8]">
              {activeObras.length} {activeObras.length === 1 ? 'obra ativa' : 'obras ativas'}
            </span>
          )}
        </div>

        <div className="bg-slate-50/50 dark:bg-brand-dark-950/40 border-x border-b border-[#E2E8F0] dark:border-[#1E293B] rounded-b-xl p-4 space-y-3">
          {obrasResumo.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          ) : obrasResumo.isError ? (
            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300">
              Não foi possível carregar o resumo das obras no momento.
            </div>
          ) : activeObras.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl space-y-1">
              <p className="text-xs font-semibold text-slate-700 dark:text-[#F8FAFC]">
                Nenhuma obra em andamento no momento.
              </p>
              <p className="text-[11px] text-slate-400 dark:text-[#94A3B8]">
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
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] text-center sm:text-left pt-1">
                Barra: dinheiro gasto. Traço: obra pronta.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* BLOCO 3: ESTOURANDO O PREVISTO */}
      <EstourosPrevisto
        categorias={obrasCategorias.data}
        concludedProjectIds={concludedProjectIds}
        isLoading={obrasCategorias.isLoading}
        isError={obrasCategorias.isError}
      />

      {/* BLOCO 4: ANÁLISE E COMPARAÇÃO */}
      <section className="space-y-0">
        <div className={`bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] ${isAnaliseOpen ? 'rounded-t-xl' : 'rounded-xl'} px-4 py-3 flex items-center justify-between shadow-xs transition-colors`}>
          <div className="flex items-center gap-2">
            <BarChartIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
              Análise e comparação
            </h2>
          </div>

          {/* Botão de recolher/expandir */}
          <button
            type="button"
            onClick={() => setIsAnaliseOpen((prev) => !prev)}
            className="text-xs font-semibold text-brand-blue-600 dark:text-[#818CF8] flex items-center gap-1 cursor-pointer"
          >
            {isAnaliseOpen ? 'Recolher' : 'Expandir'}
            {isAnaliseOpen ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
          </button>
        </div>

        {isAnaliseOpen && (
          <div className="bg-slate-50/50 dark:bg-brand-dark-950/40 border-x border-b border-[#E2E8F0] dark:border-[#1E293B] rounded-b-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
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
      <section className="space-y-0">
        <button
          type="button"
          onClick={() => setIsAuditLogsOpen((prev) => !prev)}
          className={`w-full bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] ${isAuditLogsOpen ? 'rounded-t-xl' : 'rounded-xl'} px-4 py-3 flex items-center justify-between shadow-xs transition-colors cursor-pointer text-left`}
        >
          <div className="flex items-center gap-2">
            <ClipboardListIcon className="h-4 w-4 text-slate-600 dark:text-[#94A3B8]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
              Histórico de alterações
            </h2>
          </div>
          <span className="text-xs font-semibold text-brand-blue-600 dark:text-[#818CF8] flex items-center gap-1 shrink-0">
            {isAuditLogsOpen ? 'Recolher' : 'Expandir'}
            {isAuditLogsOpen ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </span>
        </button>

        {isAuditLogsOpen && (
          <div className="border-x border-b border-[#E2E8F0] dark:border-[#1E293B] rounded-b-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
            <AuditLogsPanel />
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
