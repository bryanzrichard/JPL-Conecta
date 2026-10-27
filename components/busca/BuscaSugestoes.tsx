import React from 'react';
import { ClockIcon, SparklesIcon } from '../../lib/icons';
import { EXEMPLOS_BUSCA } from '../../lib/buscaGlobal';

interface BuscaSugestoesProps {
  recentes: string[];
  onSelect: (termo: string) => void;
  onClearRecentes: () => void;
}

export const BuscaSugestoes: React.FC<BuscaSugestoesProps> = ({
  recentes,
  onSelect,
  onClearRecentes,
}) => {
  return (
    <div className="flex flex-col gap-6 py-6">
      {recentes.length > 0 && (
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              <ClockIcon className="h-4 w-4" />
              <span>Buscas Recentes</span>
            </div>
            <button
              type="button"
              onClick={onClearRecentes}
              className="text-xs text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
            >
              Limpar histórico
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentes.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelect(item)}
                className="px-3 py-1.5 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ClockIcon className="h-3 w-3 opacity-50" />
                <span>{item}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
          <SparklesIcon className="h-4 w-4 text-indigo-500" />
          <span>Exemplos de Busca</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXEMPLOS_BUSCA.map((ex, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelect(ex)}
              className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
