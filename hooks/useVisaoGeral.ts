import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';
import { formatDateYMD } from '../lib/utils';
import { PainelHojeRow, ObraResumoRow, ObraCategoriaRow, GastoMensalRow } from '../types';

export const defaultPainelHoje: PainelHojeRow = {
  tarefas_atrasadas: 0,
  tarefas_hoje: 0,
  compras_pendentes: 0,
  empreitadas_vencendo: 0,
  empreitadas_vencidas: 0,
  notas_para_revisar: 0,
};

export function useVisaoGeral(meses: number = 6) {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const hoje = formatDateYMD(new Date());

  const painelHojeQuery = useQuery<PainelHojeRow>({
    queryKey: ['dashboardItems', 'painelHoje', companyId, hoje],
    queryFn: async () => {
      if (!companyId) return defaultPainelHoje;
      const { data, error } = await supabase
        .rpc('get_painel_hoje', { p_company_id: companyId, p_hoje: hoje });

      if (error) throw error;
      return data?.[0] || defaultPainelHoje;
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const obrasResumoQuery = useQuery<ObraResumoRow[]>({
    queryKey: ['dashboardItems', 'obrasResumo', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .rpc('get_obras_resumo', { p_company_id: companyId })
        .returns<ObraResumoRow[]>();

      if (error) throw error;
      return (data || []) as ObraResumoRow[];
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const obrasCategoriasQuery = useQuery<ObraCategoriaRow[]>({
    queryKey: ['dashboardItems', 'obrasCategorias', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .rpc('get_obras_categorias', { p_company_id: companyId })
        .returns<ObraCategoriaRow[]>();

      if (error) throw error;
      return (data || []) as ObraCategoriaRow[];
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const gastoMensalQuery = useQuery<GastoMensalRow[]>({
    queryKey: ['dashboardItems', 'gastoMensal', companyId, meses],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .rpc('get_gasto_mensal', { p_company_id: companyId, p_meses: meses })
        .returns<GastoMensalRow[]>();

      if (error) throw error;
      return (data || []) as GastoMensalRow[];
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    painelHoje: painelHojeQuery,
    obrasResumo: obrasResumoQuery,
    obrasCategorias: obrasCategoriasQuery,
    gastoMensal: gastoMensalQuery,
  };
}

export default useVisaoGeral;
