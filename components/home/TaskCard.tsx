import React from 'react';
import { Task } from '../../types';
import { Construction, User, ChevronRight, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/DropdownMenu';

interface TaskCardProps {
    task: Task;
    onEdit: (task: Task) => void;
    onDelete: (task: Task) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onDelete }) => {
    
    const priorityClasses = {
        'Alta': 'bg-red-500/10 text-red-400',
        'Média': 'bg-yellow-500/10 text-yellow-400',
        'Baixa': 'bg-sky-500/10 text-sky-400',
    };
    
    const statusClasses = {
        'Planejada': 'bg-gray-500/10 text-gray-400',
        'Em Execução': 'bg-brand-blue-500/10 text-brand-blue-400',
        'Concluída': 'bg-green-500/10 text-green-400',
        'Atrasada': 'bg-red-500/10 text-red-400',
    };

    return (
        <div 
            onClick={() => onEdit(task)}
            className="group relative bg-brand-dark-900 rounded-2xl p-4 border border-gray-800/60 hover:border-brand-blue-500/30 transition-all duration-200 cursor-pointer shadow-sm touch-manipulation"
        >
            {/* Cabeçalho do Card: Título e Status/Prioridade */}
            <div className="flex justify-between items-start mb-3">
                <div className="pr-4 flex-1">
                    <h3 className="font-semibold text-white text-base leading-tight line-clamp-2 mb-2">
                        {task.title}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider ${statusClasses[task.status]}`}>
                            {task.status}
                        </span>
                        {task.prioridade && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider ${priorityClasses[task.prioridade]}`}>
                                {task.prioridade}
                            </span>
                        )}
                    </div>
                </div>
                
                <div className="flex flex-col items-end flex-shrink-0 gap-1">
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
                            <DropdownMenuItem onSelect={() => onEdit(task)}>
                                <Edit className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onDelete(task)} className="text-red-500 hover:!text-red-400">
                                <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Descrição (se houver) */}
            {task.description && (
                <p className="text-sm text-gray-400 mb-3 line-clamp-2 break-words">
                    {task.description}
                </p>
            )}

            {/* Linha divisória sutil */}
            <div className="h-px w-full bg-gradient-to-r from-gray-800/50 via-gray-800/20 to-transparent my-3" />

            {/* Metadados: Obra, Responsável */}
            <div className="flex items-end justify-between">
                <div className="space-y-2 flex-1 pr-4">
                    <div className="flex items-center gap-2 text-xs text-gray-300">
                        <Construction className="w-3.5 h-3.5 text-brand-blue-500/70 flex-shrink-0" />
                        <span className="line-clamp-1">Obra: {task.projects?.name || 'Não informada'}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <User className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="line-clamp-1">Resp: {task.collaborators?.name || 'Não atribuído'}</span>
                    </div>
                </div>

                {/* Indicador de Ação (Thumb-friendly) */}
                <div className="w-8 h-8 rounded-full bg-gray-800/50 flex items-center justify-center text-gray-400 group-hover:bg-brand-blue-500/10 group-hover:text-brand-blue-400 transition-colors flex-shrink-0">
                    <ChevronRight className="w-4 h-4" />
                </div>
            </div>
        </div>
    );
};

export default TaskCard;