import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useMediaQuery } from '../hooks/use-media-query';
import { useBuscaParams } from '../hooks/useBuscaParams';
import { useBuscaGlobal } from '../hooks/useBuscaGlobal';
import {
  BuscaGlobalTipo,
  BuscaGlobalRow,
  getRecentSearches,
  clearRecentSearches,
} from '../lib/buscaGlobal';
import { BuscaFiltros, ProjectOption } from '../components/busca/BuscaFiltros';
import { BuscaSugestoes } from '../components/busca/BuscaSugestoes';
import { BuscaGruposLista } from '../components/busca/BuscaGruposLista';
import { BuscaPrecosCards } from '../components/busca/BuscaPrecosCards';
import { BuscaTotaisFinanceiros } from '../components/busca/BuscaTotaisFinanceiros';
import { BuscaTabelaResultados } from '../components/busca/BuscaTabelaResultados';
import { BuscaDetalhe } from '../components/busca/BuscaDetalhe';
import { BuscaHeader } from '../components/busca/BuscaHeader';
import { AlertTriangleIcon } from '../lib/icons';

export const Busca: React.FC = () => {
  const { user, profile } = useAuth();
  const companyId = profile?.company_id;
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [searchParams] = useSearchParams();
  const tipoParamInitial = (searchParams.get('tipo') as BuscaGlobalTipo) || null;
  const qParamInitial = searchParams.get('q') || '';
  const obraParamInitial = searchParams.get('obra') || null;
  const inicioParamInitial = searchParams.get('inicio') || null;
  const fimParamInitial = searchParams.get('fim') || null;

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('jpl_busca_filtros_abertos');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [recentes, setRecentes] = useState<string[]>([]);

  const carregarRecentes = useCallback(() => {
    if (user?.id) setRecentes(getRecentSearches(user.id));
  }, [user?.id]);

  useEffect(() => {
    carregarRecentes();
  }, [carregarRecentes]);

  const toggleFiltros = useCallback(() => {
    setFiltrosAbertos((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('jpl_busca_filtros_abertos', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const limitePrincipal = tipoParamInitial ? 200 : 20;
  const {
    grupos,
    rawRows,
    isLoading,
    isError,
    refetch,
    debouncedTerm,
  } = useBuscaGlobal(qParamInitial, {
    limite: limitePrincipal,
    tipo: tipoParamInitial,
    projectId: obraParamInitial,
    inicio: inicioParamInitial,
    fim: fimParamInitial,
    enabled: qParamInitial.trim().length >= 2,
  });

  const {
    qParam,
    tipoParam,
    obraParam,
    inicioParam,
    fimParam,
    selParam,
    termoLocal,
    setTermoLocal,
    updateParams,
    visibleRows,
    selectedRow,
    currentIndex,
    hasPrev,
    hasNext,
    handlePrevRow,
    handleNextRow,
    handleSelectRow,
    handleAuditFilter,
  } = useBuscaParams({
    user,
    rawRows,
    grupos,
    onAddRecent: carregarRecentes,
  });

  const { data: obras = [] } = useQuery<ProjectOption[]>({
    queryKey: ['projects-busca-filtro', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name');
      if (error) throw error;
      return (data as ProjectOption[]) || [];
    },
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  });

  const { data: countsRows = [] } = useQuery<BuscaGlobalRow[]>({
    queryKey: ['busca-counts', user?.id, qParam, obraParam, inicioParam, fimParam],
    queryFn: async () => {
      if (!qParam || qParam.trim().length < 2) return [];
      const { data, error } = await supabase.rpc('busca_global', {
        p_termo: qParam.trim(),
        p_limite: 1,
        p_tipo: null,
        p_project_id: obraParam || null,
        p_inicio: inicioParam || null,
        p_fim: fimParam || null,
      });
      if (error) throw error;
      return (data as BuscaGlobalRow[]) || [];
    },
    enabled: !!qParam && qParam.trim().length >= 2,
    staleTime: 30_000,
  });

  const tipoCountsMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of countsRows) {
      map[r.tipo] = r.total_tipo ?? 0;
    }
    return map;
  }, [countsRows]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (tipoParam) count++;
    if (obraParam) count++;
    if (inicioParam || fimParam) count++;
    return count;
  }, [tipoParam, obraParam, inicioParam, fimParam]);

  const handleLimparFiltros = useCallback(() => {
    updateParams({ tipo: null, obra: null, inicio: null, fim: null, sel: null });
  }, [updateParams]);

  const handleSelectSugestao = (termo: string) => {
    setTermoLocal(termo);
    updateParams({ q: termo, sel: null });
    carregarRecentes();
  };

  const totalTipoAtual = useMemo(() => {
    if (!tipoParam) return 0;
    if (tipoCountsMap[tipoParam] !== undefined) return tipoCountsMap[tipoParam];
    if (rawRows.length > 0 && rawRows[0].total_tipo !== null && rawRows[0].total_tipo !== undefined) {
      return rawRows[0].total_tipo;
    }
    return rawRows.length;
  }, [tipoParam, tipoCountsMap, rawRows]);

  const somaTipoAtual = useMemo(() => {
    if (!tipoParam) return null;
    if (rawRows.length > 0 && rawRows[0].soma_tipo !== null && rawRows[0].soma_tipo !== undefined) {
      return rawRows[0].soma_tipo;
    }
    return null;
  }, [tipoParam, rawRows]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-50 dark:bg-brand-dark-950 select-text">
      {/* 1. CABEÇALHO OPERACIONAL NO ESTILO NOTAS */}
      <BuscaHeader
        termoLocal={termoLocal}
        onChangeTermo={(val) => setTermoLocal(val)}
        onClearTermo={() => {
          setTermoLocal('');
          updateParams({ q: null, sel: null });
        }}
        onToggleFiltros={isDesktop ? toggleFiltros : () => setMobileDrawerOpen(true)}
        filtrosAbertos={filtrosAbertos}
        activeFiltersCount={activeFiltersCount}
        isDesktop={isDesktop}
        tipoParam={tipoParam}
        rawRowsCount={rawRows.length}
        totalTipo={totalTipoAtual}
        somaTipo={somaTipoAtual}
        gruposCount={grupos.length}
        visibleRowsCount={visibleRows.length}
      />

      {/* 2. CORPO DIVIDIDO EM TRÊS ÁREAS */}
      <div className="flex-1 flex overflow-hidden">
        {/* COLUNA 1: FILTROS DESKTOP (RECOLHÍVEL, ~240px) */}
        {isDesktop && filtrosAbertos && (
          <aside className="w-[240px] shrink-0 border-r border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111827] p-3 overflow-y-auto custom-scrollbar animate-in slide-in-from-left-2 duration-150">
            <BuscaFiltros
              tipoSelecionado={tipoParam}
              onSelectTipo={(t) => updateParams({ tipo: t, sel: null })}
              tipoCounts={tipoCountsMap}
              obraSelecionada={obraParam}
              onSelectObra={(o) => updateParams({ obra: o, sel: null })}
              obras={obras}
              dataInicio={inicioParam}
              dataFim={fimParam}
              onSelectPeriodo={(ini, fim) => updateParams({ inicio: ini, fim, sel: null })}
              onLimparFiltros={handleLimparFiltros}
              activeFiltersCount={activeFiltersCount}
            />
          </aside>
        )}

        {/* COLUNA 2: RESULTADOS (46% com painel aberto, 100% sem painel) */}
        <main
          className={`overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4 ${
            selectedRow && isDesktop
              ? 'w-full lg:w-[46%] shrink-0 border-r border-[#E2E8F0] dark:border-[#1E293B]'
              : 'flex-1 min-w-0'
          }`}
        >
          {(!qParam || qParam.trim().length < 2) && (
            <BuscaSugestoes
              recentes={recentes}
              onSelect={handleSelectSugestao}
              onClearRecentes={() => {
                clearRecentSearches(user?.id);
                setRecentes([]);
              }}
            />
          )}

          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Buscando em todo o JPL Conecta...</span>
            </div>
          )}

          {isError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between">
              <span>Erro ao realizar a busca. Tente novamente.</span>
              <button
                type="button"
                onClick={() => refetch()}
                className="px-3 py-1 rounded bg-rose-600 text-white font-medium hover:bg-rose-700 cursor-pointer"
              >
                Tentar de novo
              </button>
            </div>
          )}

          {!isLoading && !isError && qParam.trim().length >= 2 && rawRows.length === 0 && (
            <div className="py-12 text-center flex flex-col items-center gap-2">
              <AlertTriangleIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Nenhum resultado encontrado para &quot;{qParam}&quot;
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                Tente palavras mais genéricas ou confira se não há filtros restritivos ativos.
              </p>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleLimparFiltros}
                  className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Limpar todos os filtros
                </button>
              )}
            </div>
          )}

          {!isLoading && !isError && tipoParam && rawRows.length > 0 && (
            <div className="space-y-4">
              {tipoParam === 'item' && <BuscaPrecosCards linhas={rawRows} />}

              {(tipoParam === 'adiantamento' || tipoParam === 'servico') && (
                <BuscaTotaisFinanceiros
                  linhas={rawRows}
                  tipo={tipoParam}
                  totalTipo={totalTipoAtual}
                />
              )}

              <BuscaTabelaResultados
                linhas={rawRows}
                tipo={tipoParam}
                totalTipo={totalTipoAtual}
                somaTipo={somaTipoAtual}
                termo={debouncedTerm}
                onSelectRow={handleSelectRow}
                selectedKey={selParam}
                isDetailOpen={!!selectedRow && isDesktop}
              />
            </div>
          )}

          {!isLoading && !isError && !tipoParam && grupos.length > 0 && (
            <BuscaGruposLista
              grupos={grupos}
              termo={debouncedTerm}
              onSelectTipo={(tipo) => updateParams({ tipo, sel: null })}
              onSelectRow={handleSelectRow}
              selectedKey={selParam}
            />
          )}
        </main>

        {/* COLUNA 3: PAINEL DE DETALHE DESKTOP (54%) */}
        {selectedRow && isDesktop && (
          <aside className="w-full lg:w-[54%] shrink-0 h-full overflow-hidden bg-white dark:bg-[#111827] animate-in fade-in-50 duration-200">
            <BuscaDetalhe
              item={selectedRow}
              onClose={() => updateParams({ sel: null })}
              onPrev={handlePrevRow}
              onNext={handleNextRow}
              hasPrev={hasPrev}
              hasNext={hasNext}
              currentIndex={currentIndex}
              totalCount={visibleRows.length}
              onAuditFilter={handleAuditFilter}
            />
          </aside>
        )}
      </div>

      {/* 3. GAVETA DE FILTROS MOBILE */}
      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative ml-auto w-full max-w-xs h-full bg-white dark:bg-slate-900 p-5 shadow-xl overflow-y-auto flex flex-col z-10">
            <BuscaFiltros
              tipoSelecionado={tipoParam}
              onSelectTipo={(t) => updateParams({ tipo: t, sel: null })}
              tipoCounts={tipoCountsMap}
              obraSelecionada={obraParam}
              onSelectObra={(o) => updateParams({ obra: o, sel: null })}
              obras={obras}
              dataInicio={inicioParam}
              dataFim={fimParam}
              onSelectPeriodo={(ini, fim) => updateParams({ inicio: ini, fim, sel: null })}
              onLimparFiltros={handleLimparFiltros}
              activeFiltersCount={activeFiltersCount}
              isMobileDrawer={true}
              onCloseDrawer={() => setMobileDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* 4. GAVETA DE DETALHE MOBILE (BOTTOM-SHEET) */}
      {!isDesktop && selectedRow && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
            onClick={() => updateParams({ sel: null })}
          />
          <div className="relative w-full h-[88vh] max-h-[92vh] bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in slide-in-from-bottom duration-300">
            <BuscaDetalhe
              item={selectedRow}
              onClose={() => updateParams({ sel: null })}
              onPrev={handlePrevRow}
              onNext={handleNextRow}
              hasPrev={hasPrev}
              hasNext={hasNext}
              currentIndex={currentIndex}
              totalCount={visibleRows.length}
              onAuditFilter={handleAuditFilter}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Busca;
