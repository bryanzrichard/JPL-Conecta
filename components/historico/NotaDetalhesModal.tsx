import React, { useState, useEffect, useCallback } from 'react';
import { NotaFiscal, ItemNotaFiscal } from '../../types';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/Button';
import { FileTextIcon } from '../../lib/icons';

const formatCurrency = (value: number | null | undefined) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const InfoItem: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className }) => (
    <div className={className}>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="font-medium text-white break-words">{value || 'N/A'}</p>
    </div>
);

interface NotaDetalhesModalProps {
    nota: NotaFiscal | null;
    isOpen: boolean;
    onClose: () => void;
}

const PAGE_SIZE = 10;

const NotaDetalhesModal: React.FC<NotaDetalhesModalProps> = ({ nota, isOpen, onClose }) => {
    const [items, setItems] = useState<ItemNotaFiscal[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);

    const fetchItems = useCallback(async (pageNum: number) => {
        if (!nota) return;
        setLoading(pageNum === 0);
        
        const from = pageNum * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase.from('itens_nota_fiscal').select('*').eq('nota_fiscal_id', nota.id).order('description').range(from, to);
        if (error) { console.error(error); return; }

        setItems(prev => pageNum === 0 ? data : [...prev, ...data]);
        setHasMore(data.length === PAGE_SIZE);
        setLoading(false);
    }, [nota]);

    useEffect(() => {
        if (isOpen && nota) {
            setPage(0);
            fetchItems(0);
        }
    }, [isOpen, nota, fetchItems]);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchItems(nextPage);
    };

    if (!nota) return null;

    return (
        <ResponsiveModal isOpen={isOpen} onOpenChange={onClose}>
            <ResponsiveModalContent className="max-w-3xl bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
                <ResponsiveModalHeader className="px-5 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
                    <ResponsiveModalTitle className="flex items-center gap-2 text-base text-white">
                        <FileTextIcon className="h-4 w-4 text-brand-blue-500" />
                        Detalhes da Nota Fiscal
                    </ResponsiveModalTitle>
                    <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400">
                        Fornecedor: {nota.suppliers?.name || 'N/A'}
                    </ResponsiveModalDescription>
                </ResponsiveModalHeader>
                
                <div className="flex-grow overflow-y-auto custom-scrollbar p-5 bg-brand-dark-950/50 space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <p className="text-gray-400 animate-pulse">Carregando itens...</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <p className="text-gray-400">Nenhum item encontrado.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {items.map((item) => (
                                <div key={item.id} className="p-4 bg-brand-dark-900/50 border border-gray-800/50 rounded-xl space-y-3 transition-colors hover:bg-brand-dark-800/50">
                                    <p className="font-semibold text-white text-base">{item.description}</p>
                                    <div className="grid grid-cols-3 gap-4 text-xs">
                                        <InfoItem label="Fabricante" value={item.manufacturer} />
                                        <InfoItem label="Categoria" value={item.category} />
                                        <InfoItem label="Unidade" value={item.unit_of_measure} />
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 border-t border-gray-800 pt-3">
                                        <InfoItem label="Quantidade" value={`${item.quantity}`} />
                                        <InfoItem label="Preço Unit." value={formatCurrency(item.unit_price)} />
                                        <InfoItem label="Preço Total" value={<span className="font-bold text-brand-blue-400">{formatCurrency(item.total_price)}</span>} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {hasMore && (
                        <Button 
                            variant="outline" 
                            className="h-9 w-full border-gray-800 hover:bg-gray-800 text-gray-300" 
                            onClick={handleLoadMore} 
                            isLoading={loading}
                        >
                            Carregar Mais
                        </Button>
                    )}
                </div>

                <ResponsiveModalFooter className="p-4 border-t border-gray-800 bg-brand-dark-900 flex-shrink-0 flex justify-end items-center gap-3">
                    <Button variant="outline" onClick={onClose} className="h-9 px-4 border-gray-700 hover:bg-gray-800 text-gray-300">
                        Fechar
                    </Button>
                </ResponsiveModalFooter>
            </ResponsiveModalContent>
        </ResponsiveModal>
    );
};

export default NotaDetalhesModal;
