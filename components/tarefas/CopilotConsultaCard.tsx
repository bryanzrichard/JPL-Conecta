import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ConsultaResultado, descreverConsulta } from '../../lib/copilotConsultas';
import { formatCurrency, formatDateDM, formatMonthYear } from '../../lib/utils';
import { formatQuantidadeBR } from '../../lib/compraItens';
import { DollarSignIcon, FileTextIcon, BuildingIcon } from '../../lib/icons';

export interface CopilotConsultaCardProps {
  resultado: ConsultaResultado;
}

export const CopilotConsultaCard: React.FC<CopilotConsultaCardProps> = ({ resultado }) => {
  const navigate = useNavigate();
  const { pedido, obraNome, linhas, notas, total, erro } = resultado;

  const descricaoHeader = descreverConsulta(pedido, obraNome);
  const isGastos = pedido.tipo === 'GASTOS';
  const isNotas = pedido.tipo === 'LISTAR_NOTAS';

  const hasLinhas = Boolean(linhas && linhas.length > 0);
  const hasNotas = Boolean(notas && notas.length > 0);
  const hasData = isGastos ? hasLinhas : hasNotas;

  return (
    <div className="p-3 rounded-xl border border-slate-200/90 dark:border-gray-700/80 bg-slate-50/70 dark:bg-slate-900/40 text-xs space-y-2.5 transition-all shadow-2xs">
      {/* 1. CABEÇALHO */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-bold text-[11px] text-emerald-700 dark:text-emerald-400">
          {isGastos ? <DollarSignIcon className="h-3.5 w-3.5" /> : <FileTextIcon className="h-3.5 w-3.5" />}
          <span>{isGastos ? 'Consulta de Gastos' : 'Notas Fiscais'}</span>
        </div>

        {obraNome && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-gray-400 bg-white/80 dark:bg-brand-dark-900/60 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-gray-800 shrink-0">
            <BuildingIcon className="h-3 w-3 text-slate-400" />
            <span className="truncate max-w-[120px]">{obraNome}</span>
          </span>
        )}
      </div>

      {/* Descrição curta do que foi compreendido */}
      <p className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 leading-tight">
        {descricaoHeader}
      </p>

      {/* 2. ERRO (Ex: Obra não localizada) */}
      {erro && (
        <div className="p-2.5 rounded-lg bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
          <span>⚠️</span>
          <span>{erro}</span>
        </div>
      )}

      {/* 3. SEM RESULTADOS (Quando não houve erro, mas linhas ou notas vazias) */}
      {!erro && !hasData && (
        <div className="py-3 px-2 text-center rounded-lg bg-white/60 dark:bg-brand-dark-900/40 border border-dashed border-slate-200 dark:border-gray-800 text-[11px] text-slate-500 dark:text-gray-400">
          Nenhum lançamento encontrado para <span className="font-semibold text-slate-700 dark:text-gray-300">{descricaoHeader}</span>.
        </div>
      )}

      {/* 4. RESULTADO TIPO GASTOS */}
      {!erro && isGastos && hasLinhas && linhas && (
        <div className="space-y-2">
          {/* Total em destaque */}
          <div className="flex items-baseline justify-between p-2 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
              Total Apurado:
            </span>
            <span className="text-base font-bold font-mono text-emerald-900 dark:text-emerald-200">
              {formatCurrency(total)}
            </span>
          </div>

          {/* Até 10 linhas */}
          <div className="space-y-1">
            {linhas.slice(0, 10).map((l, idx) => {
              const labelGrupo =
                pedido.agrupar === 'mes'
                  ? formatMonthYear(l.grupo)
                  : l.grupo || 'Geral';

              const pct = total > 0 ? ((l.total / total) * 100).toFixed(1) : '0';
              const pctNum = Math.min(100, Math.max(0, parseFloat(pct)));

              const hasQtd = pedido.agrupar === 'item' && l.quantidade !== null && l.quantidade !== undefined;
              const qtdTexto = hasQtd
                ? `${formatQuantidadeBR(l.quantidade!)}${l.unidade ? ' ' + l.unidade : ''}`
                : null;

              return (
                <div
                  key={idx}
                  className="relative p-1.5 rounded-lg bg-white/80 dark:bg-brand-dark-900/60 border border-slate-200/60 dark:border-gray-800 flex items-center justify-between text-xs overflow-hidden gap-2"
                >
                  {/* Barra suave de preenchimento proporcional */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-emerald-500/10 dark:bg-emerald-500/15 pointer-events-none"
                    style={{ width: `${pctNum}%` }}
                  />

                  <div className="relative flex items-center gap-1.5 min-w-0 pr-1">
                    <span className="font-semibold text-slate-800 dark:text-gray-100 truncate">
                      {labelGrupo}
                    </span>
                    {qtdTexto && (
                      <span className="text-[10px] font-mono text-slate-500 dark:text-gray-400 shrink-0">
                        ({qtdTexto})
                      </span>
                    )}
                  </div>

                  <div className="relative flex items-center gap-2 text-right shrink-0 font-mono">
                    <span className="font-bold text-slate-800 dark:text-white">
                      {formatCurrency(l.total)}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-gray-500 w-11 text-right">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}

            {linhas.length > 10 && (
              <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 block text-right pt-0.5">
                +{linhas.length - 10} grupos
              </span>
            )}
          </div>
        </div>
      )}

      {/* 5. RESULTADO TIPO LISTAR_NOTAS */}
      {!erro && isNotas && hasNotas && notas && (
        <div className="space-y-2">
          {/* Total e contagem no topo */}
          <div className="flex items-baseline justify-between p-2 rounded-lg bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20">
            <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300">
              {notas.length} {notas.length === 1 ? 'nota encontrada' : 'notas encontradas'}:
            </span>
            <span className="text-base font-bold font-mono text-blue-900 dark:text-blue-200">
              {formatCurrency(total)}
            </span>
          </div>

          {/* Até 15 notas */}
          <div className="space-y-1.5">
            {notas.slice(0, 15).map((n) => (
              <button
                key={n.nota_id}
                type="button"
                onClick={() => navigate(`/notas?editar=${n.nota_id}`)}
                className="w-full text-left p-2 rounded-lg bg-white/80 dark:bg-brand-dark-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/70 dark:border-gray-800 transition-colors cursor-pointer group"
                title="Clique para abrir detalhes da nota"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-gray-400 shrink-0">
                      {formatDateDM(n.data)}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      {n.fornecedor || 'Fornecedor não inf.'}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-800 dark:text-white shrink-0">
                    {formatCurrency(n.total)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                  <span className="truncate">
                    {n.obra || 'Obra Geral'} {n.numero ? `· NF ${n.numero}` : ''}
                  </span>
                </div>

                {pedido.termo && n.itens_encontrados && (
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400 italic mt-0.5 truncate">
                    Itens: {n.itens_encontrados}
                  </p>
                )}
              </button>
            ))}

            {notas.length > 15 && (
              <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 block text-right pt-0.5">
                +{notas.length - 15} notas
              </span>
            )}
          </div>
        </div>
      )}

      {/* 6. RODAPÉ FIXO (Somente se houver filtro de termo ou categoria) */}
      {(pedido.termo || pedido.categoria) && (
        <p className="text-[10px] text-slate-400 dark:text-gray-500 pt-1.5 border-t border-slate-200/60 dark:border-gray-800 text-center">
          Material com filtro de item ou categoria não inclui frete.
        </p>
      )}
    </div>
  );
};

export default CopilotConsultaCard;
