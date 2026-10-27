import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { OrcamentoEtapa } from '../types';

export interface UseOrcamentoDeepLinkParams {
  etapas: OrcamentoEtapa[];
  isLoadingEtapas: boolean;
  setSelectedProjectFilter: (projectId: string) => void;
  setExpandedEtapaIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedEtapaId: (id: string | null) => void;
  setActiveTab: (tab: 'etapas' | 'categorias') => void;
}

export interface UseOrcamentoDeepLinkResult {
  highlightedEtapaId: string | null;
}

/**
 * Intercepta deep links no formato /orcamentos?obra=<id>&etapa=<id>:
 * - Seleciona a obra especificada
 * - Garante a aba de etapas ativa
 * - Expande a etapa pai (se for sub-etapa) e a própria etapa
 * - Seleciona a etapa no painel de detalhes (Inspector)
 * - Rola suavemente até ela
 * - Destaca visualmente a linha por 2 segundos
 * - Remove os parâmetros da URL com navigate replace
 */
export function useOrcamentoDeepLink({
  etapas,
  isLoadingEtapas,
  setSelectedProjectFilter,
  setExpandedEtapaIds,
  setSelectedEtapaId,
  setActiveTab,
}: UseOrcamentoDeepLinkParams): UseOrcamentoDeepLinkResult {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [highlightedEtapaId, setHighlightedEtapaId] = useState<string | null>(null);
  const handledKeyRef = useRef<string | null>(null);

  const obraParam = searchParams.get('obra');
  const etapaParam = searchParams.get('etapa');

  useEffect(() => {
    if (!obraParam && !etapaParam) {
      handledKeyRef.current = null;
      return;
    }

    const currentKey = `${obraParam || ''}:${etapaParam || ''}`;
    if (handledKeyRef.current === currentKey) {
      return;
    }

    // 1. Selecionar a obra se fornecida
    if (obraParam) {
      setSelectedProjectFilter(obraParam);
    }

    // Se veio parâmetro de etapa mas as etapas ainda estão carregando do banco, aguarda
    if (etapaParam && isLoadingEtapas) {
      return;
    }

    handledKeyRef.current = currentKey;

    if (etapaParam) {
      setActiveTab('etapas');
      const targetEtapa = etapas.find((e) => e.id === etapaParam);

      // Expande a etapa pai (se sub-etapa) e adiciona ao conjunto de expandidas
      setExpandedEtapaIds((prev) => {
        const next = new Set(prev);
        if (targetEtapa?.parent_id) {
          next.add(targetEtapa.parent_id);
        }
        next.add(etapaParam);
        return next;
      });

      setSelectedEtapaId(etapaParam);

      // Destaque temporário por 2 segundos
      setHighlightedEtapaId(etapaParam);
      const timer = setTimeout(() => {
        setHighlightedEtapaId(null);
      }, 2000);

      // Rolar até o elemento
      setTimeout(() => {
        const el = document.getElementById(`etapa-row-${etapaParam}`);
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 200);

      navigate('/orcamentos', { replace: true });
      return () => clearTimeout(timer);
    } else if (obraParam) {
      navigate('/orcamentos', { replace: true });
    }
  }, [
    obraParam,
    etapaParam,
    isLoadingEtapas,
    etapas,
    setSelectedProjectFilter,
    setExpandedEtapaIds,
    setSelectedEtapaId,
    setActiveTab,
    navigate,
  ]);

  return { highlightedEtapaId };
}
