import React from 'react';
import { ServiceWithDetails } from '../../types';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/DropdownMenu';
import { Badge } from '../ui/Badge';
import { MoreVerticalIcon, EditIcon, Trash2Icon, UserIcon, ConstructionIcon, CalendarIcon, ChevronRightIcon, PaperclipIcon } from '../../lib/icons';

interface ServicoCardProps {
    service: ServiceWithDetails;
    onEdit: (service: ServiceWithDetails) => void;
    onDelete: (service: ServiceWithDetails) => void;
    onViewAttachment?: (path: string) => void;
}

const formatCurrency = (value: number | null | undefined) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('pt-BR');
};

const ServicoCard: React.FC<ServicoCardProps> = ({ service, onEdit, onDelete, onViewAttachment }) => {
    const isCompleted = service.status === 'Concluído';
    const statusClass = isCompleted 
        ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' 
        : 'bg-green-500/10 text-green-400 border-green-500/20';

    return (
        <div 
            onClick={() => onEdit(service)}
            className="group relative bg-brand-dark-900 rounded-2xl p-4 border border-gray-800/60 hover:border-brand-blue-500/30 transition-all duration-200 cursor-pointer shadow-sm touch-manipulation"
        >
            <div className="flex justify-between items-start mb-3">
                <div className="flex-grow min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Badge className={statusClass}>{service.status}</Badge>
                    </div>
                    <p className="font-semibold text-white text-base leading-tight line-clamp-2">{service.description}</p>
                </div>
                
                <div className="flex-shrink-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button 
                                className="p-1.5 -mr-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                                aria-label="Ações" 
                                onClick={(e) => e.stopPropagation()}
                            >
                                <MoreVerticalIcon className="h-4 w-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {service.receipt_path && onViewAttachment && (
                                <DropdownMenuItem onSelect={() => onViewAttachment(service.receipt_path!)}>
                                    <PaperclipIcon className="h-4 w-4 mr-2" /> Ver Anexo
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onSelect={() => onEdit(service)}><EditIcon className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onDelete(service)} className="text-red-500 hover:!text-red-400"><Trash2Icon className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            
            <div className="h-px w-full bg-gradient-to-r from-gray-800/50 via-gray-800/20 to-transparent my-3" />

            <div className="flex items-end justify-between">
                <div className="text-sm space-y-2 flex-1 pr-4">
                    <div className="flex items-center gap-2 text-gray-400">
                        <UserIcon className="h-3.5 w-3.5 flex-shrink-0 text-brand-blue-500/70" />
                        <span className="truncate">{service.collaborator_name || 'Sem colaborador'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                        <ConstructionIcon className="h-3.5 w-3.5 flex-shrink-0 text-brand-blue-500/70" />
                        <span className="truncate">{service.project_name || 'Sem obra'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                        <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{formatDate(service.start_date)} - {formatDate(service.end_date)}</span>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="text-right">
                        <span className="text-[10px] text-gray-500 uppercase block mb-0.5">Total</span>
                        <span className="font-semibold text-white">{formatCurrency(service.total_value)}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] text-gray-500 uppercase block mb-0.5">Restante</span>
                        <span className={`font-bold ${service.remaining_value > 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                            {formatCurrency(service.remaining_value)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServicoCard;