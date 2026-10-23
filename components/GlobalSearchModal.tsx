import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalSearch, GlobalSearchInvoiceItem } from '../hooks/useGlobalSearch';
import { 
  SearchIcon, XIcon, FileTextIcon, ConstructionIcon, 
  ClipboardListIcon, BuildingIcon, UsersIcon, HistoryIcon, 
  TrendingDownIcon, TrendingUpIcon, DollarSignIcon, TagIcon,
  SparklesIcon, ArrowRightIcon, ShoppingBagIcon, CheckCircleIcon,
  ChevronRightIcon
} from '../lib/icons';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

type SearchTab = 'all' | 'items' | 'servicos' | 'tasks' | 'cadastros' | 'cartorio';

const SUGGESTIONS = [
  'Cimento',
  'Areia',
  'Brita',
  'Aço CA-50',
  'Bloco',
  'Tubo PVC',
  'Fio 2.5mm',
  'Pintura'
];

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<SearchTab>('all');

  const {
    searchTerm,
    debouncedTerm,
    setSearchTerm,
    clearSearch,
    results,
    priceStats,
    isLoading,
    isDebouncing,
    hasSearched,
  } = useGlobalSearch(initialQuery, { enabled: isOpen, debounceMs: 300, minChars: 2 });

  // Foco automático no input ao abrir
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 60);
      return () => clearTimeout(timer);
    } else {
      setActiveTab('all');
    }
  }, [isOpen]);

  // Fechar com Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Formatação de Moeda
  const formatCurrency = (val?: number | null) => {
    if (typeof val !== 'number' || isNaN(val)) return 'R$ 0,00';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Formatação de Data
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  // Contadores para as abas
  const tabCounts = useMemo(() => {
    return {
      all: results.totalCount,
      items: results.items.length + results.notas.length,
      servicos: results.servicos.length + results.adiantamentos.length,
      tasks: results.tasks.length,
      cadastros: results.suppliers.length + results.collaborators.length + results.projects.length,
      cartorio: results.cartorio.length,
    };
  }, [results]);

  // Navegações rápidas
  const handleNavigate = (path: string, state?: any) => {
    onClose();
    navigate(path, { state });
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-start justify-center p-3 sm:p-6 sm:pt-12 overflow-hidden animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl bg-white dark:bg-brand-dark-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl dark:shadow-black/80 overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================= */}
        {/* TOPBAR SEARCH INPUT                                       */}
        {/* ========================================================= */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-brand-dark-900/60">
          <SearchIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 shrink-0 ml-1" />
          
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar insumos, preços, notas, serviços, tarefas, fornecedores..."
            className="w-full bg-transparent border-0 px-3 py-1.5 text-sm sm:text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-0"
          />

          <div className="flex items-center gap-2 shrink-0">
            {(isLoading || isDebouncing) && (
              <span className="flex items-center gap-1.5 text-xs text-brand-blue-500 dark:text-brand-blue-400 font-medium">
                <span className="w-3.5 h-3.5 border-2 border-brand-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="hidden sm:inline">Buscando...</span>
              </span>
            )}

            {searchTerm && (
              <button
                type="button"
                onClick={clearSearch}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-800 transition-colors"
                title="Limpar busca"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-brand-dark-800 transition-colors text-xs font-mono border border-gray-200 dark:border-gray-800 hidden sm:flex items-center gap-1"
            >
              <span>ESC</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TABS DE FILTRO                                            */}
        {/* ========================================================= */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900/30 overflow-x-auto custom-scrollbar shrink-0 text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-brand-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-800'
            }`}
          >
            <span>Todos</span>
            {hasSearched && tabCounts.all > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                {tabCounts.all}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('items')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'items'
                ? 'bg-brand-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-800'
            }`}
          >
            <TagIcon className="h-3.5 w-3.5" />
            <span>Compras & Preços</span>
            {hasSearched && tabCounts.items > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'items' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                {tabCounts.items}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('servicos')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'servicos'
                ? 'bg-brand-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-800'
            }`}
          >
            <ConstructionIcon className="h-3.5 w-3.5" />
            <span>Serviços</span>
            {hasSearched && tabCounts.servicos > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'servicos' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                {tabCounts.servicos}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'tasks'
                ? 'bg-brand-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-800'
            }`}
          >
            <ClipboardListIcon className="h-3.5 w-3.5" />
            <span>Tarefas</span>
            {hasSearched && tabCounts.tasks > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'tasks' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                {tabCounts.tasks}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('cadastros')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'cadastros'
                ? 'bg-brand-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-800'
            }`}
          >
            <UsersIcon className="h-3.5 w-3.5" />
            <span>Cadastros</span>
            {hasSearched && tabCounts.cadastros > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'cadastros' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                {tabCounts.cadastros}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('cartorio')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'cartorio'
                ? 'bg-brand-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-800'
            }`}
          >
            <BuildingIcon className="h-3.5 w-3.5" />
            <span>Cartório</span>
            {hasSearched && tabCounts.cartorio > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'cartorio' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                {tabCounts.cartorio}
              </span>
            )}
          </button>
        </div>

        {/* ========================================================= */}
        {/* CORPO DE RESULTADOS E INTELIGÊNCIA DE PREÇOS              */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-6">
          
          {/* ESTADO INICIAL / SUGESTÕES */}
          {!searchTerm.trim() && (
            <div className="py-8 text-center space-y-5">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-brand-blue-500/10 border border-brand-blue-500/20 flex items-center justify-center text-brand-blue-500">
                <SparklesIcon className="h-6 w-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Busca Global & Inteligência de Preços
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Pesquise itens de compras para comparar preços históricos, ou encontre contratos de serviços, tarefas, fornecedores e documentos em instantes.
                </p>
              </div>

              {/* Chips de Sugestão Rápida */}
              <div className="pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Sugestões de Consulta</p>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                  {SUGGESTIONS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setSearchTerm(sug)}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-brand-dark-900 dark:hover:bg-brand-dark-800 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ESTADO DE NENHUM RESULTADO */}
          {hasSearched && results.totalCount === 0 && !isLoading && !isDebouncing && (
            <div className="py-12 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                <SearchIcon className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Nenhum registro encontrado para "{debouncedTerm}"
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                Tente buscar por termos mais genéricos como "cimento", "areia", pelo nome do fornecedor ou número de nota.
              </p>
            </div>
          )}

          {/* ======================================================= */}
          {/* PAINEL DE INTELIGÊNCIA DE PREÇOS (Cards de Resumo)      */}
          {/* ======================================================= */}
          {(activeTab === 'all' || activeTab === 'items') && priceStats && priceStats.hasData && (
            <div className="bg-gradient-to-br from-brand-blue-500/5 via-transparent to-emerald-500/5 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="h-4 w-4 text-brand-blue-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                    Inteligência de Preços para "{debouncedTerm}"
                  </span>
                </div>
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  {priceStats.totalOccurrences} cotações analisadas
                </span>
              </div>

              {/* 3 CARDS DE INTELIGÊNCIA DE PREÇOS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Último Preço Pago */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
                    <span className="font-medium">Último Preço Pago</span>
                    <HistoryIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                  </div>
                  <div className="my-1.5">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatCurrency(priceStats.lastPurchase?.unitPrice)}
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
                        /{priceStats.lastPurchase?.unitOfMeasure || 'un'}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    <span>{formatDate(priceStats.lastPurchase?.date)}</span>
                    {priceStats.lastPurchase?.supplierName && (
                      <span> • {priceStats.lastPurchase.supplierName}</span>
                    )}
                  </div>
                </div>

                {/* 2. Menor Preço Histórico (🟢 Verde em Destaque) */}
                <div className="p-3.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs">
                    <span className="font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Menor Preço Histórico
                    </span>
                    <TrendingDownIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="my-1.5">
                    <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(priceStats.lowestPrice?.unitPrice)}
                      <span className="text-xs font-normal opacity-80 ml-1">
                        /{priceStats.lowestPrice?.unitOfMeasure || 'un'}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 truncate">
                    <span>Melhor compra em {formatDate(priceStats.lowestPrice?.date)}</span>
                    {priceStats.lowestPrice?.supplierName && (
                      <span> • {priceStats.lowestPrice.supplierName}</span>
                    )}
                  </div>
                </div>

                {/* 3. Preço Médio Unitário */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
                    <span className="font-medium">Preço Médio Unitário</span>
                    <DollarSignIcon className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <div className="my-1.5">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatCurrency(priceStats.averagePrice)}
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
                        /médio
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
                    <span>Média ponderada: {formatCurrency(priceStats.weightedAveragePrice)}</span>
                    {priceStats.variancePercent > 0 && (
                      <span className="font-mono text-gray-400">±{priceStats.variancePercent}%</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* SEÇÃO: ITENS DE NOTAS FISCAIS & COMPRAS                */}
          {/* ======================================================= */}
          {(activeTab === 'all' || activeTab === 'items') && results.items.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <ShoppingBagIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                  Itens Comprados & Insumos ({results.items.length})
                </h4>
                <button
                  onClick={() => handleNavigate('/notas')}
                  className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  Ver em Notas <ChevronRightIcon className="h-3 w-3" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {results.items.map((item: GlobalSearchInvoiceItem) => {
                  const isLowest = priceStats && item.unit_price === priceStats.lowestPrice?.unitPrice;
                  const avg = priceStats?.averagePrice || 0;
                  const diffPercent = avg > 0 ? Math.round(((item.unit_price - avg) / avg) * 100) : 0;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleNavigate('/notas')}
                      className="p-3.5 rounded-xl bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 hover:border-brand-blue-500/50 hover:shadow-md transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-brand-blue-500 transition-colors">
                            {item.description}
                          </span>
                          
                          {/* Badge de Menor Preço ou Variação */}
                          {isLowest ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <span>🟢</span> Menor Preço
                            </span>
                          ) : diffPercent < 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              {diffPercent}% da média
                            </span>
                          ) : diffPercent > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              +{diffPercent}% da média
                            </span>
                          ) : null}

                          <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            {item.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                          <span>Fornecedor: <strong className="text-gray-700 dark:text-gray-300 font-medium">{item.supplier_name}</strong></span>
                          <span>•</span>
                          <span>Data: {formatDate(item.issue_date)}</span>
                          {item.invoice_number && (
                            <>
                              <span>•</span>
                              <span>NF: {item.invoice_number}</span>
                            </>
                          )}
                          {item.project_name && (
                            <>
                              <span>•</span>
                              <span>Obra: {item.project_name}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Valores Financeiros em Destaque */}
                      <div className="flex items-center sm:flex-col sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-gray-800 shrink-0">
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] uppercase font-semibold text-gray-400">Valor Unitário</p>
                          <p className="text-base font-bold text-brand-blue-600 dark:text-brand-blue-400">
                            {formatCurrency(item.unit_price)}
                            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
                              /{item.unit_of_measure || 'un'}
                            </span>
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Qtde: <strong className="text-gray-700 dark:text-gray-300">{item.quantity}</strong> • Total: <strong className="text-gray-900 dark:text-white">{formatCurrency(item.total_price)}</strong>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* SEÇÃO: SERVIÇOS & ADIANTAMENTOS                         */}
          {/* ======================================================= */}
          {(activeTab === 'all' || activeTab === 'servicos') && (results.servicos.length > 0 || results.adiantamentos.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <ConstructionIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                  Serviços & Adiantamentos ({results.servicos.length + results.adiantamentos.length})
                </h4>
                <button
                  onClick={() => handleNavigate('/servicos')}
                  className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  Ver em Serviços <ChevronRightIcon className="h-3 w-3" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {results.servicos.map((servico) => (
                  <div
                    key={servico.id}
                    onClick={() => handleNavigate('/servicos')}
                    className="p-3.5 rounded-xl bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 hover:border-brand-blue-500/50 hover:shadow-md transition-all cursor-pointer group space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-brand-blue-500 transition-colors line-clamp-1">
                        {servico.description}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                        servico.status === 'Concluído'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}>
                        {servico.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1">
                      <span>Prestador: <strong className="text-gray-700 dark:text-gray-300 font-medium">{servico.collaborator_name || 'N/A'}</strong></span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(servico.total_value)}</span>
                    </div>
                  </div>
                ))}

                {results.adiantamentos.map((adv) => (
                  <div
                    key={adv.id}
                    onClick={() => handleNavigate('/servicos')}
                    className="p-3.5 rounded-xl bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 hover:border-brand-blue-500/50 hover:shadow-md transition-all cursor-pointer group space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-brand-blue-500 transition-colors line-clamp-1">
                        Adiantamento: {adv.description || adv.service_description || 'Sem descrição'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
                        Adiantamento
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1">
                      <span>Data: {formatDate(adv.payment_date)}</span>
                      <span className="text-sm font-bold text-sky-600 dark:text-sky-400">{formatCurrency(adv.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* SEÇÃO: TAREFAS DE OBRA                                  */}
          {/* ======================================================= */}
          {(activeTab === 'all' || activeTab === 'tasks') && results.tasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <ClipboardListIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                  Tarefas de Obra ({results.tasks.length})
                </h4>
                <button
                  onClick={() => handleNavigate('/tarefas')}
                  className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  Ver em Tarefas <ChevronRightIcon className="h-3 w-3" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {results.tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleNavigate('/tarefas')}
                    className="p-3.5 rounded-xl bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 hover:border-brand-blue-500/50 hover:shadow-md transition-all cursor-pointer group space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-brand-blue-500 transition-colors line-clamp-1">
                        {task.title}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                        task.prioridade === 'Alta' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' :
                        task.prioridade === 'Média' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                        'bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20'
                      }`}>
                        {task.prioridade}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {task.description || 'Sem detalhes adicionais.'}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
                      <span>Status: <strong className="text-gray-700 dark:text-gray-300 font-medium">{task.status}</strong></span>
                      {task.project_name && <span>Obra: {task.project_name}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* SEÇÃO: CADASTROS (Fornecedores, Obras, Colaboradores)   */}
          {/* ======================================================= */}
          {(activeTab === 'all' || activeTab === 'cadastros') && (results.suppliers.length > 0 || results.projects.length > 0 || results.collaborators.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <UsersIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                  Cadastros Gerais ({results.suppliers.length + results.projects.length + results.collaborators.length})
                </h4>
                <button
                  onClick={() => handleNavigate('/registro')}
                  className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  Ver em Cadastros <ChevronRightIcon className="h-3 w-3" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {results.suppliers.map((sup) => (
                  <div
                    key={sup.id}
                    onClick={() => handleNavigate('/registro')}
                    className="p-3 rounded-xl bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 hover:border-brand-blue-500/50 transition-all cursor-pointer group space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-brand-blue-600 dark:text-brand-blue-400 uppercase">Fornecedor</span>
                      <BuildingIcon className="h-3 w-3 text-gray-400" />
                    </div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white truncate group-hover:text-brand-blue-500">{sup.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">CNPJ: {sup.cnpj || '-'}</p>
                  </div>
                ))}

                {results.projects.map((proj) => (
                  <div
                    key={proj.id}
                    onClick={() => handleNavigate('/registro')}
                    className="p-3 rounded-xl bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 hover:border-brand-blue-500/50 transition-all cursor-pointer group space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Obra</span>
                      <ConstructionIcon className="h-3 w-3 text-gray-400" />
                    </div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white truncate group-hover:text-brand-blue-500">{proj.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{proj.status} • {proj.address_city || 'Local não informado'}</p>
                  </div>
                ))}

                {results.collaborators.map((collab) => (
                  <div
                    key={collab.id}
                    onClick={() => handleNavigate('/registro')}
                    className="p-3 rounded-xl bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 hover:border-brand-blue-500/50 transition-all cursor-pointer group space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase">Colaborador</span>
                      <UsersIcon className="h-3 w-3 text-gray-400" />
                    </div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white truncate group-hover:text-brand-blue-500">{collab.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{collab.role || 'Sem função'} • {collab.phone || '-'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* SEÇÃO: CARTÓRIO                                         */}
          {/* ======================================================= */}
          {(activeTab === 'all' || activeTab === 'cartorio') && results.cartorio.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <BuildingIcon className="h-3.5 w-3.5 text-brand-blue-500" />
                  Cartório & Emolumentos ({results.cartorio.length})
                </h4>
                <button
                  onClick={() => handleNavigate('/cartorio')}
                  className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  Ver em Cartório <ChevronRightIcon className="h-3 w-3" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {results.cartorio.map((cart) => (
                  <div
                    key={cart.id}
                    onClick={() => handleNavigate('/cartorio')}
                    className="p-3.5 rounded-xl bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 hover:border-brand-blue-500/50 hover:shadow-md transition-all cursor-pointer group space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-brand-blue-500 transition-colors line-clamp-1">
                        {cart.description}
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white shrink-0">
                        {formatCurrency(cart.amount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>Data: {formatDate(cart.issue_date)}</span>
                      {cart.project_name && <span>Obra: {cart.project_name}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ========================================================= */}
        {/* FOOTER DO MODAL (Atalhos & Status)                        */}
        {/* ========================================================= */}
        <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-brand-dark-900/80 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">
              <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-800 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-800 font-mono text-[10px]">K</kbd> para abrir em qualquer tela
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-800 font-mono text-[10px]">ESC</kbd> para fechar
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-brand-blue-600 dark:text-brand-blue-400 font-medium">
            <SparklesIcon className="h-3.5 w-3.5" />
            <span>JPL Inteligência</span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default GlobalSearchModal;
