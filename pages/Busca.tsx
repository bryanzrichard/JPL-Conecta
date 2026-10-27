import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useBuscaGlobal } from '../hooks/useBuscaGlobal';
import {
  BuscaGlobalTipo,
  BuscaGlobalRow,
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
} from '../lib/buscaGlobal';
import { BuscaFiltros, ProjectOption } from '../components/busca/BuscaFiltros';
import { BuscaSugestoes } from '../components/busca/BuscaSugestoes';
import { BuscaGruposLista } from '../components/busca/BuscaGruposLista';
import { BuscaPrecosCards } from '../components/busca/BuscaPrecosCards';
import { BuscaTotaisFinanceiros } from '../components/busca/BuscaTotaisFinanceiros';
import { BuscaTabelaResultados } from '../components/busca/BuscaTabelaResultados';
import { SearchIcon, XIcon, FilterIcon, AlertTriangleIcon } from '../lib/icons';

export const Busca: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const companyId = profile?.company_id;

  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') || '';
  const tipoParam = (searchParams.get('tipo') as BuscaGlobalTipo) || null;
  const obraParam = searchParams.get('obra') || null;
  const inicioParam = searchParams.get('inicio') || null;
  const fimParam = searchParams.get('fim') || null;

  const [termoLocal, setTermoLocal] = useState<string>(qParam);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [recentes, setRecentes] = useState<string[]>([]);

  useEffect(() => {
    setTermoLocal(qParam);
  }, [qParam]);

  const carregarRecentes = useCallback(() => {
    if (user?.id) setRecentes(getRecentSearches(user.id));
  }, [user?.id]);

  useEffect(() => {
    carregarRecentes();
  }, [carregarRecentes]);

  const updateParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, val] of Object.entries(updates)) {
        if (val === null || val === undefined || val === '') {
          next.delete(key);
        } else {
          next.set(key, val);
        }
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      const clean = termoLocal.trim();
      if (clean !== qParam) {
        updateParams({ q: clean || null });
        if (clean.length >= 2 && user?.id) {
          addRecentSearch(user.id, clean);
          carregarRecentes();
        }
      }
    }, 250);
    return () => clearTimeout(handler);
  }, [termoLocal, qParam, updateParams, user?.id, carregarRecentes]);

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

  const limitePrincipal = tipoParam ? 200 : 20;
  const {
    grupos,
    rawRows,
    isLoading,
    isError,
    refetch,
    debouncedTerm,
  } = useBuscaGlobal(qParam, {
    limite: limitePrincipal,
    tipo: tipoParam,
    projectId: obraParam,
    inicio: inicioParam,
    fim: fimParam,
    enabled: qParam.trim().length >= 2,
  });

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (tipoParam) count++;
    if (obraParam) count++;
    if (inicioParam || fimParam) count++;
    return count;
  }, [tipoParam, obraParam, inicioParam, fimParam]);

  const handleLimparFiltros = useCallback(() => {
    updateParams({ tipo: null, obra: null, inicio: null, fim: null });
  }, [updateParams]);

  const handleSelectSugestao = (termo: string) => {
    setTermoLocal(termo);
    updateParams({ q: termo });
    if (user?.id) {
      addRecentSearch(user.id, termo);
      carregarRecentes();
    }
  };

  const handleSelectRow = (row: BuscaGlobalRow) => {
    if (user?.id && qParam.trim()) {
      addRecentSearch(user.id, qParam.trim());
    }
    navigate(row.rota);
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
    <div className="flex flex-col gap-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full">
      {/* 1. CAMPO DE BUSCA NO TOPO */}
      <div className="flex flex-col gap-3">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <SearchIcon className="h-5 w-5" />
          </div>
          <input
            type="text"
            value={termoLocal}
            onChange={(e) => setTermoLocal(e.target.value)}
            placeholder="Buscar em notas, itens, pagamentos, serviços, obras, tarefas..."
            className="w-full pl-11 pr-20 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs text-sm sm:text-base font-normal"
          />
          {termoLocal && (
            <button
              type="button"
              onClick={() => {
                setTermoLocal('');
                updateParams({ q: null });
              }}
              className="absolute inset-y-0 right-10 pr-2 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="lg:hidden absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-indigo-600 cursor-pointer"
          >
            <div className="relative">
              <FilterIcon className="h-5 w-5" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* 2. LAYOUT PRINCIPAL: FILTROS + CONTEÚDO */}
      <div className="flex items-start gap-8">
        {/* FILTROS DESKTOP */}
        <aside className="hidden lg:block w-64 shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs sticky top-20">
          <BuscaFiltros
            tipoSelecionado={tipoParam}
            onSelectTipo={(t) => updateParams({ tipo: t })}
            tipoCounts={tipoCountsMap}
            obraSelecionada={obraParam}
            onSelectObra={(o) => updateParams({ obra: o })}
            obras={obras}
            dataInicio={inicioParam}
            dataFim={fimParam}
            onSelectPeriodo={(ini, fim) => updateParams({ inicio: ini, fim })}
            onLimparFiltros={handleLimparFiltros}
            activeFiltersCount={activeFiltersCount}
          />
        </aside>

        {/* ÁREA DE RESULTADOS */}
        <main className="flex-1 min-w-0">
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
            <div>
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
              />
            </div>
          )}

          {!isLoading && !isError && !tipoParam && grupos.length > 0 && (
            <BuscaGruposLista
              grupos={grupos}
              termo={debouncedTerm}
              onSelectTipo={(tipo) => updateParams({ tipo })}
              onSelectRow={handleSelectRow}
            />
          )}
        </main>
      </div>

      {/* 3. DRAWER DE FILTROS MOBILE */}
      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative ml-auto w-full max-w-xs h-full bg-white dark:bg-slate-900 p-5 shadow-xl overflow-y-auto flex flex-col z-10">
            <BuscaFiltros
              tipoSelecionado={tipoParam}
              onSelectTipo={(t) => updateParams({ tipo: t })}
              tipoCounts={tipoCountsMap}
              obraSelecionada={obraParam}
              onSelectObra={(o) => updateParams({ obra: o })}
              obras={obras}
              dataInicio={inicioParam}
              dataFim={fimParam}
              onSelectPeriodo={(ini, fim) => updateParams({ inicio: ini, fim })}
              onLimparFiltros={handleLimparFiltros}
              activeFiltersCount={activeFiltersCount}
              isMobileDrawer={true}
              onCloseDrawer={() => setMobileDrawerOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Busca;
