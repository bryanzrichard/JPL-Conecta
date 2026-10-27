import React, { useMemo } from 'react';
import { BuscaGlobalRow, BuscaGlobalTipo } from '../../types';
import { formatCurrency } from '../../lib/utils';
import {
  DollarSignIcon,
  UsersIcon,
  BuildingIcon,
  AlertTriangleIcon,
} from '../../lib/icons';

interface BuscaTotaisFinanceirosProps {
  linhas: BuscaGlobalRow[];
  tipo: BuscaGlobalTipo;
  totalTipo: number;
}

interface GrupoTotais {
  nome: string;
  total: number;
  quantidade: number;
  percentual: number;
}

function extrairColaborador(linha: BuscaGlobalRow): string {
  if (linha.detalhes) {
    const raw =
      linha.detalhes.colaborador ??
      linha.detalhes.colaborador_nome ??
      linha.detalhes.nome_colaborador ??
      linha.detalhes.responsavel;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
  }
  if (linha.subtitulo) {
    const parts = linha.subtitulo.split('·');
    if (parts.length > 0 && parts[0].trim().length > 0) {
      return parts[0].trim();
    }
  }
  return 'Não identificado';
}

export const BuscaTotaisFinanceiros: React.FC<BuscaTotaisFinanceirosProps> = ({
  linhas,
  tipo,
  totalTipo,
}) => {
  const { totalGeral, porColaborador, porObra } = useMemo(() => {
    let geral = 0;
    const mapaColab = new Map<string, { total: number; quantidade: number }>();
    const mapaObra = new Map<string, { total: number; quantidade: number }>();

    for (const l of linhas) {
      const valor = typeof l.valor === 'number' ? l.valor : 0;
      geral += valor;

      // Agrupa colaborador
      const colab = extrairColaborador(l);
      const atualColab = mapaColab.get(colab) || { total: 0, quantidade: 0 };
      atualColab.total += valor;
      atualColab.quantidade += 1;
      mapaColab.set(colab, atualColab);

      // Agrupa obra
      const obra = l.obra?.trim() || 'Sem obra associada';
      const atualObra = mapaObra.get(obra) || { total: 0, quantidade: 0 };
      atualObra.total += valor;
      atualObra.quantidade += 1;
      mapaObra.set(obra, atualObra);
    }

    const sortEPercentual = (
      mapa: Map<string, { total: number; quantidade: number }>
    ): GrupoTotais[] => {
      const lista: GrupoTotais[] = [];
      for (const [nome, d] of mapa.entries()) {
        const perc = geral > 0 ? (d.total / geral) * 100 : 0;
        lista.push({
          nome,
          total: d.total,
          quantidade: d.quantidade,
          percentual: perc,
        });
      }
      return lista.sort((a, b) => b.total - a.total);
    };

    return {
      totalGeral: geral,
      porColaborador: sortEPercentual(mapaColab),
      porObra: sortEPercentual(mapaObra),
    };
  }, [linhas]);

  if (linhas.length === 0) return null;

  const rotuloTipo = tipo === 'adiantamento' ? 'Pagamentos' : 'Serviços';

  return (
    <div className="mb-6 flex flex-col gap-4">
      {/* Alerta se houver mais de 200 registros no banco */}
      {totalTipo > 200 && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
          <AlertTriangleIcon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <span className="font-semibold">Totais calculados com base nos 200 registros mais relevantes</span>
            <span className="block mt-0.5 text-amber-700 dark:text-amber-300">
              Total no banco: {totalTipo} {rotuloTipo.toLowerCase()}. Filtre por obra ou período para ver totais completos de um recorte específico.
            </span>
          </div>
        </div>
      )}

      {/* Card de Resumo Geral */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
            <DollarSignIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
              Total Pago em {rotuloTipo}
            </h3>
            <span className="text-xl sm:text-2xl font-mono font-bold text-slate-900 dark:text-white">
              {formatCurrency(totalGeral)}
            </span>
          </div>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 sm:text-right">
          <span>{linhas.length} lançamentos considerados</span>
        </div>
      </div>

      {/* Grid de 2 Colunas: Por Colaborador e Por Obra */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Coluna: Por Colaborador */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <UsersIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Total por Colaborador ({porColaborador.length})
            </h4>
          </div>

          <div className="flex flex-col gap-2.5 max-h-[260px] overflow-y-auto pr-1">
            {porColaborador.map((c, i) => (
              <div key={i} className="flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate pr-2">
                    {c.nome}
                    <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500 ml-1">
                      ({c.quantidade})
                    </span>
                  </span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white shrink-0">
                    {formatCurrency(c.total)}
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 dark:bg-indigo-500 h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(2, c.percentual))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna: Por Obra */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <BuildingIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Total por Obra ({porObra.length})
            </h4>
          </div>

          <div className="flex flex-col gap-2.5 max-h-[260px] overflow-y-auto pr-1">
            {porObra.map((o, i) => (
              <div key={i} className="flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate pr-2">
                    {o.nome}
                    <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500 ml-1">
                      ({o.quantidade})
                    </span>
                  </span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white shrink-0">
                    {formatCurrency(o.total)}
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-600 dark:bg-emerald-500 h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(2, o.percentual))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
