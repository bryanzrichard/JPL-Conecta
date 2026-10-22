import React from 'react';
import { Collaborator } from '../../types';
import { User, Briefcase, Phone, FileText, ClipboardList, ChevronRight, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/DropdownMenu';
import { StarRating } from '../ui/StarRating';

interface CollaboratorCardProps {
  collaborator: Collaborator;
  onEdit: (collaborator: Collaborator) => void;
  onDelete: (collaborator: Collaborator) => void;
}

const CollaboratorCard: React.FC<CollaboratorCardProps> = ({ collaborator, onEdit, onDelete }) => {
  return (
    <div 
      onClick={() => onEdit(collaborator)}
      className="group relative bg-brand-dark-900 rounded-2xl p-4 border border-gray-800/60 hover:border-brand-blue-500/30 transition-all duration-200 cursor-pointer shadow-sm touch-manipulation"
    >
      {/* Cabeçalho do Card: Nome e Cargo */}
      <div className="flex justify-between items-start mb-3">
          <div className="pr-4 flex-1">
              <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-brand-blue-500" />
                  <h3 className="font-semibold text-white text-base leading-tight line-clamp-2">
                      {collaborator.name}
                  </h3>
              </div>
              {collaborator.role && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Briefcase className="w-3.5 h-3.5" />
                      <span>{collaborator.role}</span>
                  </div>
              )}
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
                      <DropdownMenuItem onSelect={() => onEdit(collaborator)}>
                          <Edit className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onDelete(collaborator)} className="text-red-500 hover:!text-red-400">
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>
          </div>
      </div>

      {/* Linha divisória sutil */}
      <div className="h-px w-full bg-gradient-to-r from-gray-800/50 via-gray-800/20 to-transparent my-3" />

      {/* Metadados: Telefone, Documento, Observações e Avaliação */}
      <div className="flex items-end justify-between">
          <div className="space-y-2 flex-1 pr-4">
              {collaborator.phone && (
                  <div className="flex items-center gap-2 text-xs text-gray-300">
                      <Phone className="w-3.5 h-3.5 text-brand-blue-500/70 flex-shrink-0" />
                      <span className="line-clamp-1">{collaborator.phone}</span>
                  </div>
              )}
              
              {collaborator.document && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                      <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="line-clamp-1">{collaborator.document}</span>
                  </div>
              )}

              {collaborator.observations && (
                  <div className="flex items-start gap-2 text-xs text-gray-500 pt-1">
                      <ClipboardList className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2 italic">{collaborator.observations}</span>
                  </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-gray-500 uppercase font-medium">Avaliação</span>
                  <StarRating rating={collaborator.rating} />
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

export default CollaboratorCard;