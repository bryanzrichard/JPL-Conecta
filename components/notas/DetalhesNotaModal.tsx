import React, { useState, useEffect, useCallback } from 'react';
import { NotaFiscal, ItemNotaFiscal, PAYMENT_METHODS } from '../../types';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { FileTextIcon, BuildingIcon, ConstructionIcon, CreditCardIcon, TrendingUpIcon, PaperclipIcon, ExternalLinkIcon } from '../../lib/icons';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, openStorageFile } from '../../lib/utils';

interface DetalhesNotaModalProps {
    nota: NotaFiscal | null;
    isOpen: boolean;
    onClose: () => void;
}

const PAGE_SIZE = 15;

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
        case 'Estrutura':
            return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
        case 'Alvenaria':
            return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
        case 'Elétrica':
            return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
        case 'Hidráulica':
            return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
        case 'Pintura':
            return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
        case 'Acabamento':
            return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        case 'Ferramentas':
            return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
        default:
            return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
    }
};

const DetalhesNotaModal: React.FC<DetalhesNotaModalProps> = ({ nota, isOpen, onClose }) => {
    const { toast } = useToast();
    const [items, setItems] = useState<ItemNotaFiscal[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleViewFile = async (path: string) => {
        try {
            await openStorageFile(path);
        } catch (err) {
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
            console.error(err);
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
        <ResponsiveModal isOpen={isOpen} onOpenChange={onClose} displayMode="drawer">
            <ResponsiveModalContent className="max-w-4xl bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[92vh] sm:h-full">
                {/* Header */}
                <ResponsiveModalHeader className="px-6 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20 flex items-center justify-center text-brand-blue-400 shrink-0">
                                <FileTextIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <ResponsiveModalTitle className="text-lg font-bold text-white flex items-center gap-2">
                                    <span>NF-e #{nota.invoice_number || 'Sem Número'}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                                        Registrada
                                    </span>
                                </ResponsiveModalTitle>
                                <ResponsiveModalDescription className="text-xs text-gray-400 mt-0.5">
                                    Emitida em {formatDate(nota.issue_date)} • Cadastrada em {formatDate(nota.created_at)}
                                </ResponsiveModalDescription>
                            </div>
                        </div>

                        {nota.file_url && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewFile(nota.file_url!)}
                                className="hidden sm:flex border-brand-blue-500/30 text-brand-blue-400 hover:bg-brand-blue-500/10 text-xs h-8 gap-1.5"
                            >
                                <PaperclipIcon className="h-3.5 w-3.5" />
                                <span>Ver Anexo</span>
                            </Button>
                        )}
                    </div>
                </ResponsiveModalHeader>
                
                {/* Body Content */}
                <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-brand-dark-950/60 space-y-6">
                    {/* Metadata Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-brand-dark-900/80 border border-gray-800 p-3.5 rounded-xl">
                            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <BuildingIcon className="h-3.5 w-3.5 text-gray-500" /> Fornecedor
                            </span>
                            <p className="text-sm font-bold text-white mt-1.5 truncate">
                                {nota.suppliers?.name || 'Não informado'}
                            </p>
                        </div>

                        <div className="bg-brand-dark-900/80 border border-gray-800 p-3.5 rounded-xl">
                            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <ConstructionIcon className="h-3.5 w-3.5 text-gray-500" /> Obra / Projeto
                            </span>
                            <p className="text-sm font-bold text-white mt-1.5 truncate">
                                {nota.projects?.name || 'Não vinculada'}
                            </p>
                        </div>

                        <div className="bg-brand-dark-900/80 border border-gray-800 p-3.5 rounded-xl">
                            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <CreditCardIcon className="h-3.5 w-3.5 text-gray-500" /> Pagamento
                            </span>
                            <p className="text-sm font-bold text-white mt-1.5">
                                {paymentLabel}
                            </p>
                        </div>

                        <div className="bg-brand-dark-900/80 border border-emerald-900/30 p-3.5 rounded-xl bg-gradient-to-br from-brand-dark-900/90 to-emerald-950/20">
                            <span className="text-[11px] font-semibold text-emerald-400/90 uppercase tracking-wider flex items-center gap-1.5">
                                <TrendingUpIcon className="h-3.5 w-3.5 text-emerald-500" /> Valor Total
                            </span>
                            <p className="text-base font-extrabold text-emerald-400 mt-1.5">
                                {formatCurrency(nota.total_value)}
                            </p>
                            {Number(nota.shipping_value) > 0 && (
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                    (Frete incluso: {formatCurrency(nota.shipping_value)})
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Observations if available */}
                    {nota.observations && (
                        <div className="bg-brand-dark-900/40 border border-gray-800/80 p-3.5 rounded-xl">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Observações:</span>
                            <p className="text-xs text-gray-300 mt-1 leading-relaxed whitespace-pre-wrap">{nota.observations}</p>
                        </div>
                    )}

                    {/* Items Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                                <span>Itens da Nota Fiscal</span>
                                {items.length > 0 && (
                                    <span className="text-xs font-normal text-gray-400 bg-brand-dark-800 px-2 py-0.5 rounded-full border border-gray-700">
                                        {items.length} itens listados
                                    </span>
                                )}
                            </h3>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-brand-dark-900/30 border border-gray-800 rounded-xl">
                                <div className="w-8 h-8 border-2 border-brand-blue-500/30 border-t-brand-blue-500 rounded-full animate-spin" />
                                <p className="text-xs text-gray-400">Carregando itens da nota fiscal...</p>
                            </div>
                        ) : error ? (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        ) : items.length === 0 ? (
                            <div className="text-center py-14 bg-brand-dark-900/30 border border-dashed border-gray-800 rounded-xl">
                                <FileTextIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                                <p className="text-sm text-gray-400 font-medium">Nenhum item associado a esta nota.</p>
                            </div>
                        ) : (
                            <>
                                {/* Desktop High-Density Table */}
                                <div className="hidden sm:block overflow-hidden rounded-xl border border-gray-800 bg-brand-dark-900/40">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-gray-800 bg-brand-dark-900/90 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                                <th className="py-3 px-4">Item & Descrição</th>
                                                <th className="py-3 px-3">Categoria</th>
                                                <th className="py-3 px-3 text-right">Qtd</th>
                                                <th className="py-3 px-3 text-right">Preço Unit.</th>
                                                <th className="py-3 px-4 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800/60 text-xs text-gray-200">
                                            {items.map((item) => (
                                                <tr key={item.id} className="hover:bg-brand-dark-800/40 transition-colors">
                                                    <td className="py-3 px-4">
                                                        <p className="font-semibold text-white">{item.description}</p>
                                                        {item.manufacturer && (
                                                            <p className="text-[11px] text-gray-400 mt-0.5">Fabr: {item.manufacturer}</p>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-md border ${getCategoryBadgeClass(item.category)}`}>
                                                            {item.category}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-right whitespace-nowrap">
                                                        <span className="font-mono">{item.quantity}</span>
                                                        <span className="text-gray-500 ml-1">{item.unit_of_measure || 'un'}</span>
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-mono text-gray-300 whitespace-nowrap">
                                                        {formatCurrency(item.unit_price)}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                                                        {formatCurrency(item.total_price)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Stacked Cards */}
                                <div className="sm:hidden space-y-2.5">
                                    {items.map((item) => (
                                        <div key={item.id} className="p-3.5 bg-brand-dark-900/60 border border-gray-800 rounded-xl space-y-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="font-semibold text-white text-sm">{item.description}</p>
                                                <span className={`shrink-0 px-2 py-0.5 text-[10px] font-medium rounded border ${getCategoryBadgeClass(item.category)}`}>
                                                    {item.category}
                                                </span>
                                            </div>
                                            {item.manufacturer && (
                                                <p className="text-[11px] text-gray-400">Fabricante: {item.manufacturer}</p>
                                            )}
                                            <div className="flex items-center justify-between pt-2 border-t border-gray-800/80 text-xs">
                                                <span className="text-gray-400">
                                                    {item.quantity} {item.unit_of_measure || 'un'} × {formatCurrency(item.unit_price)}
                                                </span>
                                                <span className="font-bold text-white font-mono">{formatCurrency(item.total_price)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {hasMore && (
                                    <div className="pt-2">
                                        <Button
                                            variant="outline"
                                            className="w-full h-9 text-xs border-gray-800 hover:bg-gray-800 text-gray-300"
                                            onClick={handleLoadMore}
                                            isLoading={loadingMore}
                                            disabled={loadingMore}
                                        >
                                            Carregar mais itens
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <ResponsiveModalFooter className="px-6 py-4 border-t border-gray-800 bg-brand-dark-900 flex justify-between items-center gap-3">
                    {nota.file_url ? (
                        <Button 
                            variant="outline" 
                            size="sm"
                            className="border-brand-blue-500/30 text-brand-blue-400 hover:bg-brand-blue-500/10 text-xs h-9 px-3 gap-1.5"
                            onClick={() => handleViewFile(nota.file_url!)}
                        >
                            <PaperclipIcon className="h-4 w-4" />
                            <span>Abrir Comprovante</span>
                        </Button>
                    ) : <div />}
                    
                    <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={onClose} 
                        className="text-xs h-9 px-4 text-gray-300 hover:text-white hover:bg-brand-dark-800"
                    >
                        Fechar
                    </Button>
                </ResponsiveModalFooter>
            </ResponsiveModalContent>
        </ResponsiveModal>
    );
};

export default DetalhesNotaModal;
