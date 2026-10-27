import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BuscaGlobalRow } from '../../types';
import {
  calculateProductPriceStats,
  ProductPriceStats,
} from '../../lib/precos';
import { formatCurrency, formatDateDMAA } from '../../lib/utils';
import {
  TagIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  ClockIcon,
  BuildingIcon,
  ExternalLinkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '../../lib/icons';

interface BuscaPrecosCardsProps {
  linhas: BuscaGlobalRow[];
}

export const BuscaPrecosCards: React.FC<BuscaPrecosCardsProps> = ({ linhas }) => {
  const navigate = useNavigate();
  const [expandido, setExpandido] = useState<boolean>(false);

  const stats = useMemo(() => calculateProductPriceStats(linhas), [linhas]);

  if (!stats || stats.length === 0) {
    return null;
  }

  const produtosVisiveis = expandido ? stats : stats.slice(0, 3);
  const temMais = stats.length > 3;

  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TagIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Comparação e Inteligência de Preços ({stats.length}{' '}
            {stats.length === 1 ? 'produto agrupado' : 'produtos agrupados'})
          </h2>
        </div>
        {temMais && (
          <button
            type="button"
            onClick={() => setExpandido((prev) => !prev)}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            {expandido ? (
              <>
                <span>Mostrar menos</span>
                <ChevronUpIcon className="h-4 w-4" />
              </>
            ) : (
              <>
                <span>Ver todos os {stats.length} produtos</span>
                <ChevronDownIcon className="h-4 w-4" />
              </>
            )}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {produtosVisiveis.map((prod) => (
          <ProductPriceCard key={prod.chave} prod={prod} onNavigate={navigate} />
        ))}
      </div>
    </div>
  );
};

interface ProductPriceCardProps {
  prod: ProductPriceStats;
  onNavigate: (rota: string) => void;
}

const ProductPriceCard: React.FC<ProductPriceCardProps> = ({ prod, onNavigate }) => {
  const [mostrarFornecedores, setMostrarFornecedores] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 sm:p-5 flex flex-col gap-4 transition-all">
      {/* Cabeçalho do Produto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-900 dark:text-white uppercase">
              {prod.descricao}
            </span>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Unidade: {prod.unidade}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {prod.numeroCompras} {prod.numeroCompras === 1 ? 'compra registrada' : 'compras registradas'} ·{' '}
            {prod.quantidadeTotal.toLocaleString('pt-BR')} {prod.unidade} no total
          </p>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-xs text-slate-500 dark:text-slate-400 block">Total Gasto</span>
          <span className="text-base font-mono font-bold text-slate-900 dark:text-white">
            {formatCurrency(prod.totalGasto)}
          </span>
        </div>
      </div>

      {/* Grid de 4 Indicadores de Preço */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Menor Preço */}
        <div
          onClick={() => prod.menorPreco.rota && onNavigate(prod.menorPreco.rota)}
          className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
            prod.menorPreco.rota
              ? 'cursor-pointer hover:border-emerald-400 hover:shadow-xs'
              : ''
          } bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/80`}
        >
          <div>
            <div className="flex items-center justify-between gap-1 text-emerald-700 dark:text-emerald-400 mb-1">
              <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider">
                <TrendingDownIcon className="h-3.5 w-3.5" />
                <span>Menor Preço</span>
              </div>
              {prod.menorPreco.rota && <ExternalLinkIcon className="h-3 w-3 shrink-0 opacity-70" />}
            </div>
            <div className="text-sm sm:text-base font-mono font-bold text-emerald-900 dark:text-emerald-200">
              {formatCurrency(prod.menorPreco.unitPrice)}
              <span className="text-xs font-normal text-emerald-700 dark:text-emerald-400">/{prod.unidade}</span>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-emerald-800 dark:text-emerald-300 truncate">
            <span className="font-semibold block truncate">{prod.menorPreco.supplierName}</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
              {formatDateDMAA(prod.menorPreco.date)}
            </span>
          </div>
        </div>

        {/* Maior Preço */}
        <div
          onClick={() => prod.maiorPreco.rota && onNavigate(prod.maiorPreco.rota)}
          className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
            prod.maiorPreco.rota
              ? 'cursor-pointer hover:border-rose-400 hover:shadow-xs'
              : ''
          } bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/80`}
        >
          <div>
            <div className="flex items-center justify-between gap-1 text-rose-700 dark:text-rose-400 mb-1">
              <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider">
                <TrendingUpIcon className="h-3.5 w-3.5" />
                <span>Maior Preço</span>
              </div>
              {prod.maiorPreco.rota && <ExternalLinkIcon className="h-3 w-3 shrink-0 opacity-70" />}
            </div>
            <div className="text-sm sm:text-base font-mono font-bold text-rose-900 dark:text-rose-200">
              {formatCurrency(prod.maiorPreco.unitPrice)}
              <span className="text-xs font-normal text-rose-700 dark:text-rose-400">/{prod.unidade}</span>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-rose-800 dark:text-rose-300 truncate">
            <span className="font-semibold block truncate">{prod.maiorPreco.supplierName}</span>
            <span className="text-[10px] text-rose-600 dark:text-rose-400">
              {formatDateDMAA(prod.maiorPreco.date)}
            </span>
          </div>
        </div>

        {/* Último Preço Pago */}
        <div
          onClick={() => prod.ultimoPreco.rota && onNavigate(prod.ultimoPreco.rota)}
          className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
            prod.ultimoPreco.rota
              ? 'cursor-pointer hover:border-sky-400 hover:shadow-xs'
              : ''
          } bg-sky-50/60 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/80`}
        >
          <div>
            <div className="flex items-center justify-between gap-1 text-sky-700 dark:text-sky-400 mb-1">
              <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider">
                <ClockIcon className="h-3.5 w-3.5" />
                <span>Último Pago</span>
              </div>
              {prod.ultimoPreco.rota && <ExternalLinkIcon className="h-3 w-3 shrink-0 opacity-70" />}
            </div>
            <div className="text-sm sm:text-base font-mono font-bold text-sky-900 dark:text-sky-200">
              {formatCurrency(prod.ultimoPreco.unitPrice)}
              <span className="text-xs font-normal text-sky-700 dark:text-sky-400">/{prod.unidade}</span>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-sky-800 dark:text-sky-300 truncate">
            <span className="font-semibold block truncate">{prod.ultimoPreco.supplierName}</span>
            <span className="text-[10px] text-sky-600 dark:text-sky-400">
              {formatDateDMAA(prod.ultimoPreco.date)}
            </span>
          </div>
        </div>

        {/* Média Ponderada */}
        <div className="p-3 rounded-lg border flex flex-col justify-between bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80">
          <div>
            <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              <span>Média Ponderada</span>
            </div>
            <div className="text-sm sm:text-base font-mono font-bold text-slate-900 dark:text-white">
              {formatCurrency(prod.mediaPonderada)}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/{prod.unidade}</span>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
            Total gasto ÷ Qtd total
          </div>
        </div>
      </div>

      {/* Tabela por Fornecedor (com botão de alternância) */}
      {prod.porFornecedor && prod.porFornecedor.length > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => setMostrarFornecedores((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
          >
            <BuildingIcon className="h-3.5 w-3.5" />
            <span>
              {mostrarFornecedores ? 'Ocultar' : 'Ver'} histórico por fornecedor ({prod.porFornecedor.length})
            </span>
            {mostrarFornecedores ? (
              <ChevronUpIcon className="h-3.5 w-3.5 ml-0.5" />
            ) : (
              <ChevronDownIcon className="h-3.5 w-3.5 ml-0.5" />
            )}
          </button>

          {mostrarFornecedores && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Fornecedor</th>
                    <th className="py-2 px-3 text-right">Preço Médio</th>
                    <th className="py-2 px-3 text-right">Último Preço</th>
                    <th className="py-2 px-3 text-right">Qtd Comprada</th>
                    <th className="py-2 px-3 text-right">Total Gasto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-slate-700 dark:text-slate-300">
                  {prod.porFornecedor.map((f, i) => (
                    <tr
                      key={i}
                      onClick={() => f.ultimaRota && onNavigate(f.ultimaRota)}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        f.ultimaRota ? 'cursor-pointer' : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-sans font-medium text-slate-900 dark:text-white flex items-center gap-1">
                        <span className="truncate">{f.fornecedor}</span>
                        {f.ultimaRota && <ExternalLinkIcon className="h-2.5 w-2.5 opacity-50 shrink-0" />}
                      </td>
                      <td className="py-2 px-3 text-right">{formatCurrency(f.precoMedio)}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(f.ultimoPreco)}
                      </td>
                      <td className="py-2 px-3 text-right font-sans">
                        {f.quantidadeComprada.toLocaleString('pt-BR')} {prod.unidade}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold">{formatCurrency(f.totalGasto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
