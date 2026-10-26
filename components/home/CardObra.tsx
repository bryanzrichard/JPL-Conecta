import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ObraResumoRow } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { ConstructionIcon, ChevronRightIcon } from '../../lib/icons';

interface CardObraProps {
  obra: ObraResumoRow;
}

interface SituacaoSelo {
  texto: string;
  badgeClass: string;
  barColorClass: string;
}

function getSituacaoObra(
  pctComprometido: number | null,
  pctGasto: number | null,
  pctAvanco: number | null
): SituacaoSelo {
  const comp = pctComprometido ?? 0;
  const gasto = pctGasto ?? 0;
  const avanco = pctAvanco ?? 0;

  if (comp > 100) {
    return {
      texto: 'Acima do orçamento',
      badgeClass: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/[0.12] border-rose-200/80 dark:border-rose-500/20',
      barColorClass: 'bg-rose-500 dark:bg-rose-600',
    };
  }

  const diferenca = gasto - avanco;

  if (diferenca <= 5) {
    return {
      texto: 'No ritmo',
      badgeClass: 'text-[#047857] dark:text-[#34D399] bg-[#ECFDF5] dark:bg-emerald-500/[0.12] border-emerald-200/80 dark:border-emerald-500/20',
      barColorClass: 'bg-emerald-500 dark:bg-emerald-600',
    };
  }

  if (diferenca <= 15) {
    return {
      texto: 'Atenção',
      badgeClass: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/[0.12] border-amber-200/80 dark:border-amber-500/20',
      barColorClass: 'bg-amber-500 dark:bg-amber-600',
    };
  }

  return {
    texto: 'Gastando acima',
    badgeClass: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/[0.12] border-rose-200/80 dark:border-rose-500/20',
    barColorClass: 'bg-rose-500 dark:bg-rose-600',
  };
}

export const CardObra: React.FC<CardObraProps> = ({ obra }) => {
  const navigate = useNavigate();
  const hasOrcamento = obra.orcado_total > 0;
  const hasArea = obra.area_m2 !== null && obra.area_m2 !== undefined && Number(obra.area_m2) > 0;

  const pctGasto = obra.pct_gasto ?? 0;
  const pctAvanco = obra.pct_avanco ?? 0;
  const situacao = getSituacaoObra(obra.pct_comprometido, obra.pct_gasto, obra.pct_avanco);

  const handleCardClick = () => {
    navigate(`/orcamentos?obra=${obra.project_id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl p-4 transition-all cursor-pointer shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 flex flex-col justify-between gap-3.5"
    >
      {/* 1. CABEÇALHO: NOME E SELO */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
              <ConstructionIcon className="h-4 w-4" />
            </span>
            <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-[#F8FAFC] truncate" title={obra.nome}>
              {obra.nome}
            </h3>
          </div>
          {hasArea && (
            <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-1 pl-8">
              Área: <span className="font-semibold text-slate-700 dark:text-[#F8FAFC] font-mono">{Number(obra.area_m2).toLocaleString('pt-BR')} m²</span>
            </p>
          )}
        </div>

        {hasOrcamento && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${situacao.badgeClass}`}>
            {situacao.texto}
          </span>
        )}
      </div>

      {/* 2. BARRA DE PROGRESSO COM TRAÇO DE AVANÇO FÍSICO */}
      {hasOrcamento ? (
        <div className="space-y-1.5 pt-1">
          <div className="relative w-full h-3 bg-slate-100 dark:bg-[#1E293B] rounded-full overflow-hidden">
            {/* Preenchimento: pct_gasto limitado a 100% */}
            <div
              className={`h-full rounded-full transition-all ${situacao.barColorClass}`}
              style={{ width: `${Math.min(Math.max(pctGasto, 0), 100)}%` }}
            />
            {/* Traço vertical: pct_avanco */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-slate-900 dark:bg-white rounded-full z-10 shadow-xs"
              style={{ left: `calc(${Math.min(Math.max(pctAvanco, 0), 100)}% - 2px)` }}
              title={`Obra pronta: ${Math.round(pctAvanco)}%`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-[#94A3B8]">
            <span>{Math.round(pctGasto)}% do orçamento gasto</span>
            <span>{Math.round(pctAvanco)}% da obra pronta</span>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl border border-dashed border-amber-300 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 text-xs flex items-center justify-between gap-2">
          <span className="text-amber-800 dark:text-amber-300 font-medium">
            Cadastre o orçamento para acompanhar o consumo
          </span>
          <span className="text-amber-700 dark:text-amber-400 font-semibold inline-flex items-center gap-1 shrink-0">
            Ir p/ Orçamento <ChevronRightIcon className="h-3.5 w-3.5" />
          </span>
        </div>
      )}

      {/* 3. LINHAS DE VALORES */}
      <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#1E293B] space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-[#94A3B8]">Gasto:</span>
          <span className="font-mono font-bold text-slate-800 dark:text-[#F8FAFC]">
            {formatCurrency(obra.gasto_total)}
            {hasOrcamento && (
              <span className="text-slate-400 dark:text-[#94A3B8] font-normal"> de {formatCurrency(obra.orcado_total)}</span>
            )}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-[#94A3B8]">A pagar:</span>
          <span className="font-mono font-bold text-slate-800 dark:text-[#F8FAFC]">
            {formatCurrency(obra.a_pagar)}
          </span>
        </div>

        {hasOrcamento && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-[#94A3B8]">Comprometido:</span>
            <span className="font-mono font-bold text-slate-800 dark:text-[#F8FAFC]">
              {formatCurrency(obra.comprometido)}
            </span>
          </div>
        )}

        {/* Custo por m² quando houver área */}
        {hasArea ? (
          <div className="pt-1 border-t border-dashed border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between text-[11px] text-slate-500 dark:text-[#94A3B8] font-mono">
            <span>{formatCurrency(obra.custo_m2 || 0)}/m² gasto</span>
            {hasOrcamento && <span>{formatCurrency(obra.orcado_m2 || 0)}/m² orçado</span>}
          </div>
        ) : (
          <div className="pt-1 border-t border-dashed border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-end">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/registro');
              }}
              className="text-[11px] font-semibold text-brand-blue-600 dark:text-[#818CF8] hover:underline cursor-pointer"
            >
              Informar área →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardObra;
