import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBuscaGlobal } from '../../hooks/useBuscaGlobal';
import {
  BuscaGlobalRow,
  BuscaGrupo,
  EXEMPLOS_BUSCA,
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from '../../lib/buscaGlobal';
import { formatCurrency } from '../../lib/utils';
import { BuscaLinha } from './BuscaLinha';
import {
  SearchIcon,
  XIcon,
  ClockIcon,
  ChevronRightIcon,
  SparklesIcon,
  AlertTriangleIcon,
} from '../../lib/icons';

interface BuscaPaletaProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export const BuscaPaleta: React.FC<BuscaPaletaProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [termo, setTermo] = useState<string>(initialQuery);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [recentes, setRecentes] = useState<string[]>([]);

  const carregarRecentes = useCallback(() => {
    if (user?.id) setRecentes(getRecentSearches(user.id));
  }, [user?.id]);

  useEffect(() => {
    if (isOpen) {
      carregarRecentes();
      setTermo(initialQuery);
      setActiveIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialQuery, carregarRecentes]);

  const { grupos, isLoading, isError, refetch } = useBuscaGlobal(termo, {
    limite: 8,
    enabled: isOpen,
  });

  const flatItems = useMemo<BuscaGlobalRow[]>(
    () => grupos.flatMap((g) => g.itens),
    [grupos]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [flatItems.length, termo]);

  useEffect(() => {
    if (flatItems.length > 0) {
      document
        .getElementById(`busca-linha-${activeIndex}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [activeIndex, flatItems.length]);

  const handleSelectRow = useCallback(
    (row: BuscaGlobalRow) => {
      if (user?.id && termo.trim()) addRecentSearch(user.id, termo.trim());
      onClose();
      navigate(row.rota);
    },
    [user?.id, termo, onClose, navigate]
  );

  const handleOpenVerTodos = useCallback(
    (tipo?: string) => {
      const clean = termo.trim();
      if (!clean) return;
      if (user?.id) addRecentSearch(user.id, clean);
      onClose();
      const params = new URLSearchParams({ q: clean });
      if (tipo) params.set('tipo', tipo);
      navigate(`/busca?${params.toString()}`);
    },
    [termo, user?.id, onClose, navigate]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if ((e.ctrlKey || e.shiftKey) && e.key === 'Enter') {
      e.preventDefault();
      handleOpenVerTodos();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatItems.length > 0) {
        setActiveIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatItems.length > 0) {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[activeIndex]) handleSelectRow(flatItems[activeIndex]);
    }
  };

  const handleRemoverRecente = (e: React.MouseEvent, rec: string) => {
    e.stopPropagation();
    if (user?.id) {
      removeRecentSearch(user.id, rec);
      carregarRecentes();
    }
  };

  const handleLimparRecentes = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (user?.id) {
      clearRecentSearches(user.id);
      setRecentes([]);
    }
  };

  if (!isOpen) return null;

  const temTermoValido = termo.trim().length >= 2;
  const semResultados = temTermoValido && !isLoading && grupos.length === 0;
  let currentFlatCounter = 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center p-0 sm:pt-16 sm:px-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full sm:h-auto sm:max-h-[70vh] sm:max-w-[720px] bg-white dark:bg-brand-dark-900 sm:rounded-xl shadow-2xl border border-slate-200 dark:border-gray-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* CABEÇALHO DO MODAL */}
        <div className="p-3.5 border-b border-slate-100 dark:border-gray-800/80 shrink-0">
          <div className="relative flex items-center">
            <SearchIcon className="absolute left-3.5 h-4 w-4 text-slate-400 dark:text-gray-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Busque nota, item, valor, data, pagamento, obra..."
              className="w-full h-11 pl-10 pr-20 bg-slate-50 dark:bg-brand-dark-800/80 border border-slate-200 dark:border-gray-700/80 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
            />
            <div className="absolute right-3 flex items-center gap-1.5">
              {termo && (
                <button
                  type="button"
                  onClick={() => {
                    setTermo('');
                    inputRef.current?.focus();
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/50 cursor-pointer"
                  title="Limpar texto"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white dark:bg-brand-dark-700 border border-slate-200 dark:border-gray-700 rounded shadow-xs">
                Esc
              </kbd>
            </div>
          </div>
        </div>

        {/* BARRA FINA DE CARREGAMENTO */}
        <div className="h-0.5 w-full bg-transparent overflow-hidden shrink-0">
          {isLoading && (
            <div className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-indigo-500 animate-pulse w-full" />
          )}
        </div>

        {/* CORPO DO MODAL */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100 dark:divide-gray-800/60"
        >
          {!temTermoValido && (
            <div className="p-4 space-y-5">
              {recentes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500 flex items-center gap-1.5">
                      <ClockIcon className="h-3 w-3" /> Buscas recentes
                    </span>
                    <button
                      type="button"
                      onClick={handleLimparRecentes}
                      className="text-[11px] text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="space-y-1">
                    {recentes.map((rec) => (
                      <div
                        key={rec}
                        onClick={() => {
                          setTermo(rec);
                          inputRef.current?.focus();
                        }}
                        className="group flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-brand-dark-800/70 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <ClockIcon className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-500 shrink-0" />
                          <span className="truncate">{rec}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleRemoverRecente(e, rec)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                          title="Remover do histórico"
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500 flex items-center gap-1.5 mb-2.5">
                  <SparklesIcon className="h-3 w-3 text-amber-500" /> Exemplos
                </span>
                <div className="flex flex-wrap gap-2">
                  {EXEMPLOS_BUSCA.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => {
                        setTermo(ex);
                        inputRef.current?.focus();
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-100 hover:bg-slate-200/80 dark:bg-brand-dark-800 dark:hover:bg-brand-dark-700 text-slate-700 dark:text-gray-300 border border-slate-200/80 dark:border-gray-700/80 cursor-pointer"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isError && (
            <div className="p-8 text-center space-y-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 mb-1">
                <AlertTriangleIcon className="h-5 w-5" />
              </div>
              <p className="text-xs text-slate-600 dark:text-gray-400">
                Não foi possível buscar agora.
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
              >
                Tentar de novo
              </button>
            </div>
          )}

          {semResultados && !isError && (
            <div className="p-8 text-center space-y-2">
              <p className="text-xs font-medium text-slate-800 dark:text-gray-200">
                Nada encontrado para &quot;{termo}&quot;.
              </p>
              <p className="text-xs text-slate-400 dark:text-gray-500">
                Tente menos palavras, um valor (1250) ou uma data (15/10).
              </p>
            </div>
          )}

          {grupos.map((grupo: BuscaGrupo) => {
            const resumoBadge =
              grupo.soma !== null && grupo.soma !== undefined
                ? `${grupo.total} · ${formatCurrency(grupo.soma)}`
                : `${grupo.total}`;

            return (
              <div key={grupo.tipo} className="py-2">
                <div className="flex items-center justify-between px-3.5 py-1 text-xs select-none">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-600 dark:text-gray-300">
                      {grupo.rotulo}
                    </span>
                    <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-400">
                      {resumoBadge}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenVerTodos(grupo.tipo)}
                    className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    Ver todos <ChevronRightIcon className="h-3 w-3" />
                  </button>
                </div>

                <div className="mt-1">
                  {grupo.itens.map((linha) => {
                    const rowIdx = currentFlatCounter++;
                    return (
                      <BuscaLinha
                        key={linha.id}
                        linha={linha}
                        termo={termo}
                        isActive={rowIdx === activeIndex}
                        index={rowIdx}
                        onSelect={() => handleSelectRow(linha)}
                        onSetActive={() => setActiveIndex(rowIdx)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* RODAPÉ (SOMENTE COMPUTADOR) */}
        <div className="hidden sm:flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-brand-dark-800/80 border-t border-slate-200 dark:border-gray-800 text-[11px] text-slate-500 dark:text-gray-400 shrink-0">
          <span>Enter abrir · ↑↓ navegar · Ctrl+Enter ver todos · Esc fechar</span>
          {flatItems.length > 0 && (
            <span className="font-mono text-[10px] text-slate-400">
              {activeIndex + 1} de {flatItems.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
