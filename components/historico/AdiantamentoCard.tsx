import React from 'react';
import { AdvanceWithDetails } from '../../types';
import { Calendar, Briefcase, User, ChevronRight, MoreVertical, Edit, Trash2, Paperclip } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/DropdownMenu';

interface AdiantamentoCardProps {
    advance: AdvanceWithDetails;
    onEdit: (advance: AdvanceWithDetails) => void;
    onDelete: (advance: AdvanceWithDetails) => void;
    onViewAttachment?: (path: string) => void;
}

const formatCurrency = (value: number | null | undefined) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('pt-BR');
};

const AdiantamentoCard: React.FC<AdiantamentoCardProps> = ({ advance, onEdit, onDelete, onViewAttachment }) => {
    return (
        <div 
            onClick={() => onEdit(advance)}
            className="group relative bg-brand-dark-900 rounded-2xl p-4 border border-gray-800/60 hover:border-brand-blue-500/30 transition-all duration-200 cursor-pointer shadow-sm touch-manipulation"
        >
            {/* Cabeçalho do Card: Data e Valor */}
            <div className="flex justify-between items-start mb-3">
                <div className="pr-4 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-4 w-4 text-brand-blue-500/70" />
                        <span className="text-sm text-gray-400 font-medium">{formatDate(advance.payment_date)}</span>
                    </div>
                </div>
                
                <div className="flex flex-col items-end flex-shrink-0 gap-1">
                    <span className="font-bold text-emerald-400 text-xl tracking-tight">
                        {formatCurrency(advance.value)}
                    </span>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button 
                                className="p-1.5 -mr-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <MoreVertical className="w-4 h-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {advance.receipt_path && onViewAttachment && (
                                <DropdownMenuItem onSelect={() => onViewAttachment(advance.receipt_path!)}>
                                    <Paperclip className="h-4 w-4 mr-2" /> Ver Anexo
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onSelect={() => onEdit(advance)}>
                                <Edit className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onDelete(advance)} className="text-red-500 hover:!text-red-400">
                                <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Linha divisória sutil */}
            <div className="h-px w-full bg-gradient-to-r from-gray-800/50 via-gray-800/20 to-transparent my-3" />

            {/* Metadados: Serviço, Colaborador, Descrição */}
            <div className="flex items-end justify-between">
                <div className="space-y-2 flex-1 pr-4">
                    <div className="flex items-center gap-2 text-xs text-gray-300 font-medium">
                        <Briefcase className="w-3.5 h-3.5 text-brand-blue-500/70 flex-shrink-0" />
                        <span className="line-clamp-1">{advance.service_description}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <User className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="line-clamp-1">{advance.collaborator_name || 'Sem colaborador'}</span>
                    </div>

                    {advance.description && (
                        <p className="text-xs text-gray-500 italic line-clamp-1 mt-1">
                            "{advance.description}"
                        </p>
                    )}
                </div>

                {/* Indicador de Ação (Thumb-friendly) */}
                <div className="w-8 h-8 rounded-full bg-gray-800/50 flex items-center justify-center text-gray-400 group-hover:bg-brand-blue-500/10 group-hover:text-brand-blue-400 transition-colors flex-shrink-0">
                    <ChevronRight className="w-4 h-4" />
                </div>
            </div>
        </div>
    );
};

export default AdiantamentoCard;