import React, { useState, useEffect, useCallback } from 'react';
import { NotaFiscal, ItemNotaFiscal } from '../../types';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/Button';
import { FileTextIcon } from '../../lib/icons';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, openStorageFile } from '../../lib/utils';

// A small component for displaying item details in a structured way
const InfoItem: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className }) => (
    <div className={className}>
        <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-200 break-words mt-0.5">{value || 'N/A'}</p>
    </div>
);


interface DetalhesNotaModalProps {
    nota: NotaFiscal | null;
    isOpen: boolean;
    onClose: () => void;
}

const PAGE_SIZE = 10;

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
                description: 'Não foi possível gerar um link para este arquivo.', 
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
    
    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="w-8 h-8 border-2 border-brand-blue-500/30 border-t-brand-blue-500 rounded-full animate-spin" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Carregando itens da nota...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            );
        }

        if (items.length === 0) {
            return (
                <div className="text-center py-12">
                    <div className="w-12 h-12 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <FileTextIcon className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum item encontrado para esta nota.</p>
                </div>
            );
        }

        return (
            <div className="space-y-3">
                {items.map((item) => (
                    <div key={item.id} className="p-4 bg-brand-dark-900/50 border border-gray-800/50 rounded-xl transition-colors hover:bg-brand-dark-800/50 group">
                        <p className="text-sm font-medium text-gray-900 dark:text-white mb-3 group-hover:text-brand-blue-600 dark:group-hover:text-brand-blue-400 transition-colors">{item.description}</p>
                        
                        <div className="grid grid-cols-3 gap-4 mb-3">
                            <InfoItem label="Fabricante" value={item.manufacturer} />
                            <InfoItem label="Categoria" value={item.category} />
                            <InfoItem label="Unidade" value={item.unit_of_measure} />
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-200 dark:border-gray-800/50">
                            <InfoItem label="Quantidade" value={`${item.quantity}`} />
                            <InfoItem label="Preço Unit." value={formatCurrency(item.unit_price)} />
                            <InfoItem label="Preço Total" value={<span className="font-semibold text-brand-blue-600 dark:text-brand-blue-400">{formatCurrency(item.total_price)}</span>} />
                        </div>
                    </div>
                ))}
                {hasMore && (
                    <div className="pt-2">
                        <Button
                            variant="outline"
                            className="w-full h-9 text-sm border-gray-800 hover:bg-gray-800 text-gray-300"
                            onClick={handleLoadMore}
                            isLoading={loadingMore}
                            disabled={loadingMore}
                        >
                            Carregar mais itens
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    if (!nota) return null;
    
    return (
        <ResponsiveModal isOpen={isOpen} onOpenChange={onClose}>
            <ResponsiveModalContent className="max-w-2xl bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
                <ResponsiveModalHeader className="px-5 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-blue-500/10 flex items-center justify-center border border-brand-blue-500/20">
                            <FileTextIcon className="h-4 w-4 text-brand-blue-600 dark:text-brand-blue-400" />
                        </div>
                        <div>
                            <ResponsiveModalTitle className="text-base text-gray-900 dark:text-white">Detalhes da Nota Fiscal</ResponsiveModalTitle>
                            <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400">
                                Fornecedor: <span className="text-gray-700 dark:text-gray-300 font-medium">{nota.suppliers?.name || 'N/A'}</span>
                            </ResponsiveModalDescription>
                        </div>
                    </div>
                </ResponsiveModalHeader>
                
                <div className="flex-grow overflow-y-auto custom-scrollbar p-5 bg-brand-dark-950/50">
                   {renderContent()}
                </div>

                <ResponsiveModalFooter className="p-4 border-t border-gray-800 bg-brand-dark-900 flex-shrink-0 flex flex-col sm:flex-row justify-end gap-2">
                    <Button 
                        variant="ghost" 
                        onClick={onClose} 
                        className="text-sm h-10 w-full sm:w-auto order-1 sm:order-none"
                    >
                        Fechar
                    </Button>
                    {nota.file_url && (
                        <Button 
                            variant="outline" 
                            className="text-sm h-10 border-brand-blue-500/30 text-brand-blue-400 hover:bg-brand-blue-500/10 w-full sm:w-auto"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (nota.file_url) {
                                    handleViewFile(nota.file_url);
                                }
                            }}
                        >
                            Ver Anexo
                        </Button>
                    )}
                </ResponsiveModalFooter>
            </ResponsiveModalContent>
        </ResponsiveModal>
    );
};

export default DetalhesNotaModal;