import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BuscaGlobalRow, BuscaGlobalTipo, addRecentSearch } from '../lib/buscaGlobal';
import { User } from '@supabase/supabase-js';

export interface UseBuscaParamsOptions {
  user: User | null;
  rawRows: BuscaGlobalRow[];
  grupos: Array<{ itens: BuscaGlobalRow[] }>;
  onAddRecent?: () => void;
}

export function useBuscaParams({
  user,
  rawRows,
  grupos,
  onAddRecent,
}: UseBuscaParamsOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') || '';
  const tipoParam = (searchParams.get('tipo') as BuscaGlobalTipo) || null;
  const obraParam = searchParams.get('obra') || null;
  const inicioParam = searchParams.get('inicio') || null;
  const fimParam = searchParams.get('fim') || null;
  const selParam = searchParams.get('sel') || null;

  const [termoLocal, setTermoLocal] = useState<string>(qParam);

  useEffect(() => {
    setTermoLocal(qParam);
  }, [qParam]);

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
          onAddRecent?.();
        }
      }
    }, 250);
    return () => clearTimeout(handler);
  }, [termoLocal, qParam, updateParams, user?.id, onAddRecent]);

  const visibleRows = useMemo<BuscaGlobalRow[]>(() => {
    if (tipoParam) return rawRows;
    return grupos.flatMap((g) => g.itens);
  }, [tipoParam, rawRows, grupos]);

  const selectedRow = useMemo<BuscaGlobalRow | null>(() => {
    if (!selParam) return null;
    const [tipo, ...idParts] = selParam.split(':');
    const id = idParts.join(':');
    if (!id || !tipo) return null;

    const found = visibleRows.find((r) => r.id === id && r.tipo === tipo);
    if (found) return found;

    return {
      id,
      tipo: tipo as BuscaGlobalTipo,
      titulo: 'Carregando registro...',
      subtitulo: null,
      valor: null,
      data: null,
      obra: null,
      obra_id: null,
      rota: `/${
        tipo === 'nota' || tipo === 'item'
          ? 'notas'
          : tipo === 'servico' || tipo === 'adiantamento'
          ? 'servicos'
          : tipo === 'tarefa' || tipo === 'compra'
          ? 'tarefas'
          : 'cadastros'
      }`,
      detalhes: null,
      score: 0,
      total_tipo: null,
      soma_tipo: null,
    };
  }, [selParam, visibleRows]);

  const currentIndex = useMemo(() => {
    if (!selectedRow) return -1;
    return visibleRows.findIndex(
      (r) => r.id === selectedRow.id && r.tipo === selectedRow.tipo
    );
  }, [selectedRow, visibleRows]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < visibleRows.length - 1;

  const handlePrevRow = useCallback(() => {
    if (hasPrev) {
      const prev = visibleRows[currentIndex - 1];
      if (prev) updateParams({ sel: `${prev.tipo}:${prev.id}` });
    }
  }, [hasPrev, visibleRows, currentIndex, updateParams]);

  const handleNextRow = useCallback(() => {
    if (hasNext) {
      const next = visibleRows[currentIndex + 1];
      if (next) updateParams({ sel: `${next.tipo}:${next.id}` });
    }
  }, [hasNext, visibleRows, currentIndex, updateParams]);

  const handleSelectRow = useCallback(
    (row: BuscaGlobalRow) => {
      if (user?.id && qParam.trim()) {
        addRecentSearch(user.id, qParam.trim());
        onAddRecent?.();
      }
      updateParams({ sel: `${row.tipo}:${row.id}` });
    },
    [user?.id, qParam, updateParams, onAddRecent]
  );

  const handleAuditFilter = useCallback(
    (filtros: { q?: string; tipo?: BuscaGlobalTipo; obra?: string }) => {
      updateParams({
        q: filtros.q !== undefined ? filtros.q : undefined,
        tipo: filtros.tipo !== undefined ? filtros.tipo : undefined,
        obra: filtros.obra !== undefined ? filtros.obra : undefined,
        sel: null,
      });
      if (filtros.q !== undefined) setTermoLocal(filtros.q);
    },
    [updateParams]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        if (selParam) {
          e.preventDefault();
          updateParams({ sel: null });
        }
        return;
      }
      if (isInput || visibleRows.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNextRow();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrevRow();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selParam, visibleRows, handleNextRow, handlePrevRow, updateParams]);

  return {
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
  };
}
