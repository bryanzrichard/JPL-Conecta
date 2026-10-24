import React from 'react';
import { NotaFiscal, NotaWithItemCount, PAYMENT_METHODS } from '../../types';
import { BuildingIcon, CalendarIcon, CreditCardIcon, ChevronRightIcon, MoreVerticalIcon, EditIcon, Trash2Icon, EyeIcon, PackageIcon } from '../../lib/icons';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/DropdownMenu';
import { formatCurrency, formatDateBR as formatDate } from '../../lib/utils';

interface NotaCardProps {
    nota: NotaFiscal | NotaWithItemCount;
    onSelect?: (nota: any) => void;
    onEdit?: (nota: any) => void;
    onDelete?: (nota: any) => void;
}

const NotaCard: React.FC<NotaCardProps> = ({ nota, onSelect, onEdit, onDelete }) => {
    const paymentLabel = PAYMENT_METHODS[nota.payment_method] || nota.payment_method;
    const itemCount = (nota as NotaWithItemCount).item_count;

    return (
        <div 
            onClick={() => {
                if (onSelect) onSelect(nota);
                else if (onEdit) onEdit(nota);
            }}
            className="group relative bg-brand-dark-900 rounded-2xl p-4 border border-gray-800/60 hover:border-brand-blue-500/30 transition-all duration-200 cursor-pointer shadow-sm touch-manipulation"
        >
            {/* Cabeçalho do Card: Fornecedor e Valor */}
            <div className="flex justify-between items-start mb-3">
                <div className="pr-4 flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-base leading-tight truncate" title={nota.suppliers?.name || 'Fornecedor não informado'}>
                        {nota.suppliers?.name || 'Fornecedor não informado'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs font-medium text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded-md">
                            Nº {nota.invoice_number}
                        </span>
                        {typeof itemCount === 'number' && itemCount > 0 && (
                            <span className="text-[11px] font-medium text-brand-blue-400 bg-brand-blue-500/10 border border-brand-blue-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <PackageIcon className="w-3 h-3" />
                                {itemCount} {itemCount === 1 ? 'item' : 'itens'}
                            </span>
                        )}
                    </div>
                </div>
                
                <div className="flex flex-col items-end flex-shrink-0 gap-1">
                    <span className="font-bold text-emerald-400 text-lg tracking-tight">
                        {formatCurrency(nota.total_value)}
                    </span>
                    {(onSelect || onEdit || onDelete) && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button 
                                    className="p-1.5 -mr-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <MoreVerticalIcon className="w-4 h-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {onSelect && (
                                    <DropdownMenuItem onSelect={() => onSelect(nota)}>
                                        <EyeIcon className="h-4 w-4 mr-2" /> Visualizar
                                    </DropdownMenuItem>
                                )}
                                {onEdit && (
                                    <DropdownMenuItem onSelect={() => onEdit(nota)}>
                                        <EditIcon className="h-4 w-4 mr-2" /> Editar
                                    </DropdownMenuItem>
                                )}
                                {onDelete && (
                                    <DropdownMenuItem onSelect={() => onDelete(nota)} className="text-red-500 hover:!text-red-400 focus:text-red-500">
                                        <Trash2Icon className="h-4 w-4 mr-2" /> Excluir
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>

            {/* Linha divisória sutil */}
            <div className="h-px w-full bg-gradient-to-r from-gray-800/50 via-gray-800/20 to-transparent my-3" />

            {/* Metadados: Obra, Data, Pagamento */}
            <div className="flex items-end justify-between gap-2">
                <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <BuildingIcon className="w-3.5 h-3.5 text-brand-blue-500/70 shrink-0" />
                        <span className="truncate">{nota.projects?.name || 'Obra não informada'}</span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{formatDate(nota.issue_date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CreditCardIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{paymentLabel}</span>
                        </div>
                    </div>
                </div>

                {/* Indicador de Ação (Thumb-friendly) */}
                <div className="w-8 h-8 rounded-full bg-gray-800/50 flex items-center justify-center text-gray-400 group-hover:bg-brand-blue-500/10 group-hover:text-brand-blue-400 transition-colors shrink-0">
                    <ChevronRightIcon className="w-4 h-4" />
                </div>
            </div>
        </div>
    );
};

export default NotaCard;
