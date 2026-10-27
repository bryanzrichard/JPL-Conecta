import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BuscaGlobalRow, BuscaGlobalTipo } from '../../types';
import {
  ROTULOS_BUSCA,
  TIPOS_COM_SOMA,
  extrairPrecoUnitarioItem,
  highlightMatches,
} from '../../lib/buscaGlobal';
import { formatCurrency, formatDateDMAA } from '../../lib/utils';
import { exportCsvBusca } from '../../lib/exportCsv';
import { extrairDadosItem } from '../../lib/precos';
import {
  DownloadIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  AlertTriangleIcon,
} from '../../lib/icons';

interface BuscaTabelaResultadosProps {
  linhas: BuscaGlobalRow[];
  tipo: BuscaGlobalTipo;
  totalTipo: number;
  somaTipo: number | null;
  termo: string;
}

type SortField = 'data' | 'valor';
type SortOrder = 'asc' | 'desc';

export const BuscaTabelaResultados: React.FC<BuscaTabelaResultadosProps> = ({
  linhas,
  tipo,
  totalTipo,
  somaTipo,
  termo,
}) => {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === 'desc') {
        setSortOrder('asc');
      } else {
        setSortField(null);
        setSortOrder('desc');
      }
    } else {
      setSortField(field);
      setSortOrder(field === 'data' ? 'desc' : 'desc');
    }
  };

  const linhasOrdenadas = useMemo(() => {
    if (!sortField) return linhas;
    const sorted = [...linhas];

    sorted.sort((a, b) => {
      if (sortField === 'data') {
        const dateA = a.data ? new Date(a.data).getTime() : 0;
        const dateB = b.data ? new Date(b.data).getTime() : 0;
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (sortField === 'valor') {
        const valA = typeof a.valor === 'number' ? a.valor : 0;
        const valB = typeof b.valor === 'number' ? b.valor : 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return 0;
    });

    return sorted;
  }, [linhas, sortField, sortOrder]);

  const somaVisivel = useMemo(() => {
    if (!TIPOS_COM_SOMA.has(tipo)) return null;
    return linhas.reduce((acc, l) => acc + (typeof l.valor === 'number' ? l.valor : 0), 0);
  }, [linhas, tipo]);

  const rotuloTipo = ROTULOS_BUSCA[tipo] || tipo;
  const isItem = tipo === 'item';

  const handleExportCsv = () => {
    exportCsvBusca(linhasOrdenadas, `busca_${tipo}`);
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDownIcon className="h-3.5 w-3.5 opacity-40 ml-1 inline" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUpIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 ml-1 inline" />
    ) : (
      <ChevronDownIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 ml-1 inline" />
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Barra de Ações da Tabela */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {linhas.length} {linhas.length === 1 ? 'registro exibido' : 'registros exibidos'} de{' '}
          {Math.max(totalTipo, linhas.length)} encontrados
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={linhas.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors shadow-2xs cursor-pointer"
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          <span>Exportar CSV</span>
        </button>
      </div>

      {/* Visualização Desktop: Tabela */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 select-none">
            <tr>
              <th
                onClick={() => handleToggleSort('data')}
                className="py-2.5 px-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-28"
              >
                <span>Data</span>
                {renderSortIndicator('data')}
              </th>
              <th className="py-2.5 px-3.5">Título</th>
              <th className="py-2.5 px-3.5">Obra</th>
              <th className="py-2.5 px-3.5">Fornecedor / Subtítulo</th>
              {isItem && (
                <>
                  <th className="py-2.5 px-3.5 text-right w-24">Qtd</th>
                  <th className="py-2.5 px-3.5 text-right w-28">Preço Unit.</th>
                </>
              )}
              <th
                onClick={() => handleToggleSort('valor')}
                className="py-2.5 px-3.5 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-32"
              >
                <span>Valor Total</span>
                {renderSortIndicator('valor')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-slate-700 dark:text-slate-300">
            {linhasOrdenadas.map((linha, idx) => {
              const highlighted = highlightMatches(linha.titulo, termo);
              const precoUnit = isItem ? extrairPrecoUnitarioItem(linha.detalhes) : null;
              const itemData = isItem ? extrairDadosItem(linha) : null;

              return (
                <tr
                  key={`${linha.id}-${idx}`}
                  onClick={() => navigate(linha.rota)}
                  className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors group"
                >
                  {/* Data */}
                  <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
                    {linha.data ? formatDateDMAA(linha.data) : '-'}
                  </td>

                  {/* Título */}
                  <td className="py-2.5 px-3.5 font-medium text-slate-900 dark:text-white">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate max-w-xs">
                        {highlighted.map((part, i) => (
                          <span
                            key={i}
                            className={
                              part.match
                                ? 'font-bold text-indigo-600 dark:text-indigo-400 underline decoration-indigo-400/80 decoration-2 underline-offset-2'
                                : ''
                            }
                          >
                            {part.text}
                          </span>
                        ))}
                      </span>
                      <ExternalLinkIcon className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0 text-indigo-600 dark:text-indigo-400" />
                    </div>
                  </td>

                  {/* Obra */}
                  <td className="py-2.5 px-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {linha.obra || '-'}
                  </td>

                  {/* Subtítulo / Fornecedor */}
                  <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                    {linha.subtitulo || '-'}
                  </td>

                  {/* Itens: Qtd e Preço Unitário */}
                  {isItem && (
                    <>
                      <td className="py-2.5 px-3.5 text-right font-mono whitespace-nowrap">
                        {itemData && itemData.quantity > 0
                          ? `${itemData.quantity.toLocaleString('pt-BR')} ${itemData.unidade}`
                          : '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {precoUnit || '-'}
                      </td>
                    </>
                  )}

                  {/* Valor Total */}
                  <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {linha.valor !== null && linha.valor !== undefined
                      ? formatCurrency(linha.valor)
                      : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Visualização Mobile: Cards */}
      <div className="md:hidden flex flex-col gap-2.5">
        {linhasOrdenadas.map((linha, idx) => {
          const highlighted = highlightMatches(linha.titulo, termo);
          const precoUnit = isItem ? extrairPrecoUnitarioItem(linha.detalhes) : null;
          const itemData = isItem ? extrairDadosItem(linha) : null;

          return (
            <div
              key={`m-${linha.id}-${idx}`}
              onClick={() => navigate(linha.rota)}
              className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 flex flex-col gap-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  {highlighted.map((part, i) => (
                    <span
                      key={i}
                      className={
                        part.match
                          ? 'font-bold text-indigo-600 dark:text-indigo-400 underline decoration-indigo-400/80 decoration-2 underline-offset-2'
                          : ''
                      }
                    >
                      {part.text}
                    </span>
                  ))}
                </span>
                {linha.valor !== null && linha.valor !== undefined && (
                  <span className="text-xs font-mono font-bold text-slate-900 dark:text-white shrink-0">
                    {formatCurrency(linha.valor)}
                  </span>
                )}
              </div>

              {linha.subtitulo && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {linha.subtitulo}
                </p>
              )}

              <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800 flex-wrap gap-1">
                <span>{linha.obra || 'Sem obra'}</span>
                <div className="flex items-center gap-2">
                  {isItem && (precoUnit || itemData) && (
                    <span className="font-mono text-sky-700 dark:text-sky-300">
                      {precoUnit || (itemData ? `${itemData.quantity} ${itemData.unidade}` : '')}
                    </span>
                  )}
                  <span>{linha.data ? formatDateDMAA(linha.data) : ''}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rodapé: N resultados · Total R$ X e Aviso de limite */}
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
          <span>{linhas.length} {linhas.length === 1 ? 'resultado' : 'resultados'}</span>
          {somaVisivel !== null && (
            <>
              <span>·</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                Total {formatCurrency(somaTipo !== null && totalTipo <= 200 ? somaTipo : somaVisivel)}
              </span>
            </>
          )}
        </div>

        {totalTipo > 200 && (
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium text-[11px]">
            <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
            <span>Mostrando 200 de {totalTipo}. Refine a busca para ver o restante.</span>
          </div>
        )}
      </div>
    </div>
  );
};
