import React, { useState, useEffect, useCallback } from 'react';
import { NotaFiscal, ItemNotaFiscal, PAYMENT_METHODS } from '../../types';
import { 
  ResponsiveModal, 
  ResponsiveModalContent, 
  ResponsiveModalHeader, 
  ResponsiveModalTitle, 
  ResponsiveModalDescription, 
  ResponsiveModalFooter 
} from '../ui/ResponsiveModal';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/Button';
import { 
  FileTextIcon, 
  BuildingIcon, 
  ConstructionIcon, 
  CreditCardIcon, 
  DollarSignIcon, 
  PaperclipIcon, 
  ExternalLinkIcon,
  PackageIcon,
  CalendarIcon,
  CheckCircle2Icon,
  EditIcon,
  Trash2Icon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '../../lib/icons';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, openStorageFile } from '../../lib/utils';

interface DetalhesNotaModalProps {
  nota: NotaFiscal | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (nota: NotaFiscal) => void;
  onDelete?: (nota: NotaFiscal) => void;
  onPrevNota?: () => void;
  onNextNota?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  highlightItemId?: string | null;
}

const PAGE_SIZE = 25;

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'N/A';
  try {
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

const getCategoryBadgeClass = (category: string) => {
  switch (category) {
    case 'Serviços Preliminares e Terraplenagem':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
    case 'Estrutura':
    case 'Estrutura e Fundação':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    case 'Carpintaria e Marcenaria':
      return 'bg-amber-600/15 text-amber-800 dark:text-amber-300 border-amber-600/30';
    case 'Alvenaria':
    case 'Alvenaria e Vedação':
    case 'Alvenaria e Vedações':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    case 'Cobertura e Impermeabilização':
      return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
    case 'Hidráulica':
    case 'Instalação Hidráulica':
    case 'Instalações Hidrossanitárias':
      return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
    case 'Elétrica':
    case 'Instalação Elétrica':
    case 'Instalações Elétricas':
      return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20';
    case 'Acabamento':
    case 'Acabamento e Revestimento':
    case 'Acabamentos e Revestimentos':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    case 'Esquadrias e Vidros':
      return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';
    case 'Pintura':
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    case 'Gastos Gerais':
    case 'Ferramentas':
    case 'Ferramentas e Equipamentos':
    default:
      return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
  }
};

const DetalhesNotaModal: React.FC<DetalhesNotaModalProps> = ({ 
  nota, 
  isOpen, 
  onClose, 
  onEdit, 
  onDelete,
  onPrevNota,
  onNextNota,
  hasPrev,
  hasNext,
  highlightItemId,
}) => {
  const { toast } = useToast();
  const [items, setItems] = useState<ItemNotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'resumo' | 'anexo'>('resumo');

  // Scroll e destaque automático quando item é passado por deep link
  useEffect(() => {
    if (highlightItemId && items.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`nota-item-row-${highlightItemId}`);
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 150);
    }
  }, [highlightItemId, items]);

  // Navegação sequencial por teclado (← / →)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(activeTag)) return;

      if (e.key === 'ArrowLeft' && hasPrev && onPrevNota) {
        e.preventDefault();
        onPrevNota();
      } else if (e.key === 'ArrowRight' && hasNext && onNextNota) {
        e.preventDefault();
        onNextNota();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasPrev, hasNext, onPrevNota, onNextNota]);

  const handleViewFile = async (path: string) => {
    try {
      await openStorageFile(path);
    } catch {
      toast({ 
        title: 'Erro ao acessar arquivo', 
        description: 'Não foi possível gerar um link para este anexo.', 
        variant: 'destructive' 
      });
    }
  };

  const fetchItems = useCallback(async (pageNum: number) => {
    if (!nota) return;

    if (pageNum === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      const { data, error: queryError } = await supabase
        .from('itens_nota_fiscal')
        .select('*')
        .eq('nota_fiscal_id', nota.id)
        .order('description', { ascending: true })
        .range(from, to);

      if (queryError) throw queryError;
      
      const fetchedItems = data || [];

      if (pageNum === 0) {
        setItems(fetchedItems);
      } else {
        setItems(prev => [...prev, ...fetchedItems]);
      }
      
      setHasMore(fetchedItems.length === PAGE_SIZE);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Falha ao carregar os itens da nota.";
      setError(errorMessage);
    } finally {
      if (pageNum === 0) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [nota]);

  useEffect(() => {
    if (isOpen && nota) {
      setPage(0);
      setItems([]);
      setActiveTab('resumo');
      fetchItems(0);
    }
  }, [isOpen, nota, fetchItems]);

  const handleLoadMore = () => {
    if (!loadingMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchItems(nextPage);
    }
  };

  if (!nota) return null;

  const paymentLabel = (PAYMENT_METHODS as any)[nota.payment_method] || nota.payment_method || 'Não especificado';

  return (
    <ResponsiveModal open={isOpen} onOpenChange={onClose} displayMode="drawer">
      <ResponsiveModalContent size="xl" className="max-w-4xl flex flex-col p-0">
        
        {/* Header do Dossier */}
        <ResponsiveModalHeader className="px-6 py-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20 flex items-center justify-center text-brand-blue-600 dark:text-brand-blue-400 shrink-0">
                <FileTextIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <ResponsiveModalTitle className="text-base font-bold text-gray-900 dark:text-white">
                    NF-e #{nota.invoice_number || 'Sem Número'}
                  </ResponsiveModalTitle>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2Icon className="h-3 w-3" /> Registrada
                  </span>
                </div>
                <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Emissão: {formatDate(nota.issue_date)} • Cadastrada em: {formatDate(nota.created_at)}
                </ResponsiveModalDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Botões de Navegação Sequencial */}
              {(hasPrev !== undefined || hasNext !== undefined) && (
                <div className="inline-flex items-center bg-slate-100 dark:bg-brand-dark-800 rounded-lg p-0.5 border border-slate-200 dark:border-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onPrevNota}
                    disabled={!hasPrev}
                    className="h-7 px-2 text-xs text-slate-700 dark:text-gray-300 disabled:opacity-30 hover:bg-white dark:hover:bg-brand-dark-700 gap-1"
                    title="Nota Anterior (Seta Esquerda)"
                  >
                    <ChevronLeftIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Anterior</span>
                  </Button>
                  <div className="h-3 w-px bg-slate-300 dark:bg-gray-700 mx-0.5" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onNextNota}
                    disabled={!hasNext}
                    className="h-7 px-2 text-xs text-slate-700 dark:text-gray-300 disabled:opacity-30 hover:bg-white dark:hover:bg-brand-dark-700 gap-1"
                    title="Próxima Nota (Seta Direita)"
                  >
                    <span className="hidden sm:inline">Próxima</span>
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {nota.file_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewFile(nota.file_url!)}
                  className="h-8 text-xs font-semibold gap-1.5 border-brand-blue-500/30 text-brand-blue-600 dark:text-brand-blue-400 hover:bg-brand-blue-500/10"
                >
                  <PaperclipIcon className="h-3.5 w-3.5" />
                  <span>Abrir Anexo</span>
                  <ExternalLinkIcon className="h-3 w-3 ml-0.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Abas Superiores de Navegação */}
          <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('resumo')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'resumo'
                  ? 'bg-brand-blue-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-800'
              }`}
            >
              Resumo & Insumos ({items.length})
            </button>
            {nota.file_url && (
              <button
                type="button"
                onClick={() => setActiveTab('anexo')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === 'anexo'
                    ? 'bg-brand-blue-500 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-800'
                }`}
              >
                <PaperclipIcon className="h-3.5 w-3.5" /> Comprovante Vinculado
              </button>
            )}
          </div>
        </ResponsiveModalHeader>
        
        {/* Corpo do Inspector Drawer */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/60 dark:bg-brand-dark-950/50 space-y-5 custom-scrollbar">
          
          {activeTab === 'resumo' ? (
            <>
              {/* Banner de Destaque Financeiro */}
              <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* KPI 1: Fornecedor */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <BuildingIcon className="h-3 w-3" /> Fornecedor
                    </span>
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {nota.suppliers?.name || 'Não informado'}
                    </p>
                    {nota.suppliers?.cnpj && (
                      <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                        CNPJ: {nota.suppliers.cnpj}
                      </p>
                    )}
                  </div>

                  {/* KPI 2: Obra */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <ConstructionIcon className="h-3 w-3" /> Obra Vinculada
                    </span>
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {nota.projects?.name || 'Não vinculada'}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Centro de Custo
                    </p>
                  </div>

                  {/* KPI 3: Forma Pagamento */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <CreditCardIcon className="h-3 w-3" /> Pagamento
                    </span>
                    <p className="text-sm font-bold text-gray-900 dark:text-white capitalize">
                      {paymentLabel}
                    </p>
                    {Number(nota.shipping_value) > 0 && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Frete: {formatCurrency(nota.shipping_value)}
                      </p>
                    )}
                  </div>

                  {/* KPI 4: Valor Total */}
                  <div className="space-y-1 bg-emerald-50/60 dark:bg-brand-dark-950 p-3 rounded-xl border border-emerald-500/20">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                      <DollarSignIcon className="h-3 w-3" /> Valor Total
                    </span>
                    <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(nota.total_value)}
                    </p>
                  </div>

                </div>
              </div>

              {/* Observações */}
              {nota.observations && (
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 p-4 rounded-xl shadow-sm space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Observações e Notas
                  </span>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {nota.observations}
                  </p>
                </div>
              )}

              {/* Seção de Insumos */}
              <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <PackageIcon className="h-4 w-4 text-brand-blue-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                      Itens Discriminados
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {items.length} {items.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <div className="w-8 h-8 border-2 border-brand-blue-500/30 border-t-brand-blue-500 rounded-full animate-spin" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">Carregando itens da nota fiscal...</p>
                  </div>
                ) : error ? (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                    <p className="text-xs text-red-500">{error}</p>
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                    <PackageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-gray-500 font-medium">Nenhum item discriminado para esta nota fiscal.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[550px]">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            <th className="py-2.5 px-3">Item / Discriminação</th>
                            <th className="py-2.5 px-3">Categoria</th>
                            <th className="py-2.5 px-3 text-right">Qtd</th>
                            <th className="py-2.5 px-3 text-right">Preço Unit.</th>
                            <th className="py-2.5 px-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs">
                          {items.map((item) => {
                            const isHighlighted = highlightItemId === item.id;
                            return (
                              <tr
                                key={item.id}
                                id={`nota-item-row-${item.id}`}
                                className={
                                  isHighlighted
                                    ? 'bg-amber-100/80 dark:bg-amber-950/60 ring-2 ring-amber-400 dark:ring-amber-500 font-medium transition-all'
                                    : 'hover:bg-gray-50/50 dark:hover:bg-brand-dark-800/30 transition-colors'
                                }
                              >
                                <td className="py-3 px-3">
                                  <p className="font-semibold text-gray-900 dark:text-white">{item.description}</p>
                                  {item.manufacturer && (
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Fabr: {item.manufacturer}</p>
                                  )}
                                </td>
                                <td className="py-3 px-3">
                                  <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-md border ${getCategoryBadgeClass(item.category)}`}>
                                    {item.category}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right font-mono">
                                  <span>{item.quantity}</span>
                                  <span className="text-gray-400 ml-1 text-[11px]">{item.unit_of_measure || 'un'}</span>
                                </td>
                                <td className="py-3 px-3 text-right font-mono text-gray-600 dark:text-gray-300">
                                  {formatCurrency(item.unit_price)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                                  {formatCurrency(item.total_price)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {hasMore && (
                      <div className="pt-2 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleLoadMore}
                          isLoading={loadingMore}
                          className="h-8 text-xs font-semibold px-4"
                        >
                          Carregar mais itens
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            /* Tab Anexo */
            <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center min-h-[350px] text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-blue-500/10 border border-brand-blue-500/20 flex items-center justify-center text-brand-blue-600 dark:text-brand-blue-400">
                <PaperclipIcon className="h-7 w-7" />
              </div>
              <div className="max-w-md">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Documento Fiscal Digitalizado
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Este registro possui um anexo original armazenado com segurança no storage do projeto.
                </p>
              </div>
              <Button
                onClick={() => handleViewFile(nota.file_url!)}
                className="gap-2 bg-brand-blue-600 hover:bg-brand-blue-500 text-white font-semibold text-xs h-9 px-5"
              >
                <ExternalLinkIcon className="h-4 w-4" /> Visualizar Documento Completo
              </Button>
            </div>
          )}

        </div>

        {/* Footer */}
        <ResponsiveModalFooter className="px-6 py-4 flex-shrink-0 flex items-center justify-between border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900">
          <div className="flex items-center gap-2">
            {onDelete && nota && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onDelete(nota)}
                className="text-xs font-semibold h-9 px-3 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1.5"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
                Excluir
              </Button>
            )}
            {onEdit && nota && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(nota)}
                className="text-xs font-semibold h-9 px-3 text-brand-blue-600 dark:text-brand-blue-400 border-brand-blue-200 dark:border-brand-blue-900/40 hover:bg-brand-blue-50 dark:hover:bg-brand-blue-950/30 gap-1.5"
              >
                <EditIcon className="h-3.5 w-3.5" />
                Editar Nota
              </Button>
            )}
          </div>
          <Button 
            variant="ghost" 
            onClick={onClose} 
            className="text-xs font-semibold h-9 px-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            Fechar
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

export default DetalhesNotaModal;
