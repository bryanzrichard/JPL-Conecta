import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';
import {
  BuscaGlobalTipo,
  BuscaGlobalRow,
  BuscaGrupo,
  agruparResultadosBusca,
} from '../lib/buscaGlobal';

export interface UseBuscaGlobalOptions {
  limite?: number;
  tipo?: BuscaGlobalTipo | string | null;
  projectId?: string | null;
  inicio?: string | null;
  fim?: string | null;
  enabled?: boolean;
}

export interface UseBuscaGlobalResult {
  grupos: BuscaGrupo[];
  rawRows: BuscaGlobalRow[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
  debouncedTerm: string;
}

/**
 * Hook de busca global inteligente:
 * - Espera 250ms após a última tecla digitada (debounce).
 * - Só executa consulta no banco com 2 ou mais caracteres úteis.
 * - Integra com React Query e mantém resultados anteriores na tela (placeholderData).
 * - Retorna grupos ordenados por relevância (score).
 */
export function useBuscaGlobal(
  termo: string,
  options: UseBuscaGlobalOptions = {}
): UseBuscaGlobalResult {
  const { user } = useAuth();
  const userId = user?.id || 'anon';

  const {
    limite = 8,
    tipo = null,
    projectId = null,
    inicio = null,
    fim = null,
    enabled = true,
  } = options;

  const [debouncedTerm, setDebouncedTerm] = useState(termo);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(termo);
    }, 250);
    return () => clearTimeout(handler);
  }, [termo]);

  const cleanTerm = debouncedTerm.trim();
  const shouldSearch = enabled && cleanTerm.length >= 2;

  const query = useQuery<BuscaGlobalRow[]>({
    queryKey: [
      'busca-global',
      userId,
      cleanTerm,
      limite,
      tipo,
      projectId,
      inicio,
      fim,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('busca_global', {
        p_termo: cleanTerm,
        p_limite: limite,
        p_tipo: tipo || null,
        p_project_id: projectId || null,
        p_inicio: inicio || null,
        p_fim: fim || null,
      });

      if (error) {
        throw error;
      }

      return (data as BuscaGlobalRow[]) || [];
    },
    enabled: shouldSearch,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const isDebouncing = termo.trim() !== debouncedTerm.trim();

  const grupos = useMemo(() => {
    if (!shouldSearch && termo.trim().length < 2) {
      return [];
    }
    return agruparResultadosBusca(query.data || []);
  }, [query.data, shouldSearch, termo]);

  const rawRows = query.data || [];

  return {
    grupos,
    rawRows,
    isLoading: (query.isLoading || isDebouncing) && shouldSearch,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    debouncedTerm,
  };
}
