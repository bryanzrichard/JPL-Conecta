import React from 'react';
import { BuscaGrupo, BuscaGlobalRow, BuscaGlobalTipo } from '../../lib/buscaGlobal';
import { formatCurrency } from '../../lib/utils';
import { BuscaLinha } from './BuscaLinha';
import { ChevronRightIcon } from '../../lib/icons';

interface BuscaGruposListaProps {
  grupos: BuscaGrupo[];
  termo: string;
  onSelectTipo: (tipo: BuscaGlobalTipo) => void;
  onSelectRow: (row: BuscaGlobalRow) => void;
  selectedKey?: string | null;
}

export const BuscaGruposLista: React.FC<BuscaGruposListaProps> = ({
  grupos,
  termo,
  onSelectTipo,
  onSelectRow,
  selectedKey,
}) => {
  return (
    <div className="flex flex-col gap-6">
      {grupos.map((grupo) => (
        <div
          key={grupo.tipo}
          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
        >
          {/* Cabeçalho do Grupo */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {grupo.rotulo}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                {grupo.total}
              </span>
              {grupo.soma !== null && (
                <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 ml-1">
                  · {formatCurrency(grupo.soma)}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => onSelectTipo(grupo.tipo)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer"
            >
              <span>Ver todos os {grupo.total}</span>
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Linhas do Grupo */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {grupo.itens.map((item, idx) => (
              <BuscaLinha
                key={`${item.id}-${idx}`}
                linha={item}
                termo={termo}
                isActive={selectedKey === `${item.tipo}:${item.id}`}
                onSelect={() => onSelectRow(item)}
                onSetActive={() => {}}
                index={idx}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
