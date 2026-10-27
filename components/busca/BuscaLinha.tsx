import React, { useMemo } from 'react';
import {
  BuscaGlobalRow,
  BuscaGlobalTipo,
  highlightMatches,
  extrairPrecoUnitarioItem,
} from '../../lib/buscaGlobal';
import { formatCurrency, formatDateDMAA } from '../../lib/utils';
import {
  FileTextIcon,
  TagIcon,
  ConstructionIcon,
  DollarSignIcon,
  ClipboardListIcon,
  ShoppingBagIcon,
  BuildingIcon,
  UsersIcon,
  CalculatorIcon,
} from '../../lib/icons';

interface BuscaLinhaProps {
  linha: BuscaGlobalRow;
  termo: string;
  isActive: boolean;
  onSelect: () => void;
  onSetActive: () => void;
  index: number;
}

function getTipoIcon(tipo: BuscaGlobalTipo): {
  icon: React.ReactNode;
  containerClass: string;
} {
  switch (tipo) {
    case 'nota':
      return {
        icon: <FileTextIcon className="h-4 w-4" />,
        containerClass:
          'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800',
      };
    case 'item':
      return {
        icon: <TagIcon className="h-4 w-4" />,
        containerClass:
          'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800',
      };
    case 'servico':
      return {
        icon: <ConstructionIcon className="h-4 w-4" />,
        containerClass:
          'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
      };
    case 'adiantamento':
      return {
        icon: <DollarSignIcon className="h-4 w-4" />,
        containerClass:
          'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
      };
    case 'tarefa':
      return {
        icon: <ClipboardListIcon className="h-4 w-4" />,
        containerClass:
          'bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800',
      };
    case 'compra':
      return {
        icon: <ShoppingBagIcon className="h-4 w-4" />,
        containerClass:
          'bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800',
      };
    case 'fornecedor':
      return {
        icon: <BuildingIcon className="h-4 w-4" />,
        containerClass:
          'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
      };
    case 'colaborador':
      return {
        icon: <UsersIcon className="h-4 w-4" />,
        containerClass:
          'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800',
      };
    case 'obra':
      return {
        icon: <BuildingIcon className="h-4 w-4" />,
        containerClass:
          'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
      };
    case 'cartorio':
      return {
        icon: <FileTextIcon className="h-4 w-4" />,
        containerClass:
          'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800',
      };
    case 'etapa':
      return {
        icon: <ClipboardListIcon className="h-4 w-4" />,
        containerClass:
          'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800',
      };
    case 'orcamento_item':
      return {
        icon: <CalculatorIcon className="h-4 w-4" />,
        containerClass:
          'bg-fuchsia-50 dark:bg-fuchsia-950/60 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-200 dark:border-fuchsia-800',
      };
    default:
      return {
        icon: <FileTextIcon className="h-4 w-4" />,
        containerClass:
          'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
      };
  }
}

export const BuscaLinha: React.FC<BuscaLinhaProps> = ({
  linha,
  termo,
  isActive,
  onSelect,
  onSetActive,
  index,
}) => {
  const { icon, containerClass } = useMemo(
    () => getTipoIcon(linha.tipo),
    [linha.tipo]
  );
  const highlightedTitle = useMemo(
    () => highlightMatches(linha.titulo, termo),
    [linha.titulo, termo]
  );
  const precoUnitario = useMemo(() => {
    if (linha.tipo === 'item') {
      return extrairPrecoUnitarioItem(linha.detalhes);
    }
    return null;
  }, [linha.tipo, linha.detalhes]);

  const temValor = linha.valor !== null && linha.valor !== undefined;
  const dataFormatada = linha.data ? formatDateDMAA(linha.data) : null;

  return (
    <div
      id={`busca-linha-${index}`}
      role="option"
      aria-selected={isActive}
      onClick={onSelect}
      onMouseEnter={onSetActive}
      className={`group flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer transition-colors select-none ${
        isActive
          ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-l-4 border-indigo-600 dark:border-indigo-400'
          : 'border-l-4 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
      }`}
    >
      {/* Lado Esquerdo: Ícone + Título + Subtítulo + Preço Unitário */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${containerClass}`}
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-800 dark:text-slate-200 truncate leading-tight">
              {highlightedTitle.map((part, i) => (
                <span
                  key={i}
                  className={
                    part.match
                      ? 'font-bold text-slate-950 dark:text-white underline decoration-indigo-400/80 decoration-2 underline-offset-2'
                      : 'font-normal'
                  }
                >
                  {part.text}
                </span>
              ))}
            </span>

            {/* Badge de Preço Unitário para Itens de Notas */}
            {precoUnitario && (
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/80 whitespace-nowrap">
                {precoUnitario}
              </span>
            )}
          </div>

          {linha.subtitulo && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5 leading-tight">
              {linha.subtitulo}
            </p>
          )}
        </div>
      </div>

      {/* Lado Direito: Valor e/ou Data */}
      {(temValor || dataFormatada) && (
        <div className="flex flex-col items-end shrink-0 pl-2 text-right">
          {temValor && (
            <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
              {formatCurrency(linha.valor)}
            </span>
          )}
          {dataFormatada && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
              {dataFormatada}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
