import React from 'react';
import { NotaFiscal, PAYMENT_METHODS } from '../../types';
import { Building2, Calendar, FileText, CreditCard, ChevronRight } from 'lucide-react';

interface NotaCardProps {
    nota: NotaFiscal;
    onSelect: (nota: NotaFiscal) => void;
}

const NotaCard: React.FC<NotaCardProps> = ({ nota, onSelect }) => {
    
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDate = (dateString: string | Date | null | undefined) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('pt-BR');
    };

    return (
        <div 
            onClick={() => onSelect(nota)}
            className="group relative bg-brand-dark-900 rounded-2xl p-4 border border-gray-800/60 hover:border-brand-blue-500/30 transition-all duration-200 cursor-pointer shadow-sm touch-manipulation"
        >
            {/* Cabeçalho do Card: Fornecedor e Valor (Informações mais importantes) */}
            <div className="flex justify-between items-start mb-3">
                <div className="pr-4">
                    <h3 className="font-semibold text-white text-base leading-tight line-clamp-1">
                        {nota.suppliers?.name || 'Fornecedor não informado'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-medium text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded-md">
                            Nº {nota.invoice_number}
                        </span>
                    </div>
                </div>
                <div className="text-right flex-shrink-0">
                    <span className="font-bold text-emerald-400 text-lg tracking-tight">
                        {formatCurrency(nota.total_value)}
                    </span>
                </div>
            </div>

            {/* Linha divisória sutil */}
            <div className="h-px w-full bg-gradient-to-r from-gray-800/50 via-gray-800/20 to-transparent my-3" />

            {/* Metadados: Obra, Data, Pagamento */}
            <div className="flex items-end justify-between">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Building2 className="w-3.5 h-3.5 text-brand-blue-500/70" />
                        <span className="line-clamp-1">{nota.projects?.name || 'Obra não informada'}</span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formatDate(nota.issue_date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{PAYMENT_METHODS[nota.payment_method] || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                {/* Indicador de Ação (Thumb-friendly) */}
                <div className="w-8 h-8 rounded-full bg-gray-800/50 flex items-center justify-center text-gray-400 group-hover:bg-brand-blue-500/10 group-hover:text-brand-blue-400 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                </div>
            </div>
        </div>
    );
};

export default NotaCard;
