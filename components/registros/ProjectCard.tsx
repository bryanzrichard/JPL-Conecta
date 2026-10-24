import React from 'react';
import { Project } from '../../types';
import { Construction, Calendar, MapPin, User, ChevronRight, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/DropdownMenu';

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}

const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('pt-BR');
};

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onEdit, onDelete }) => {
    
  const fullAddress = [
    project.address_street,
    project.address_number,
    project.address_district,
    project.address_city,
    project.address_state,
  ].filter(Boolean).join(', ');
  
  const statusColors = {
    'Planejamento': 'bg-yellow-500/10 text-yellow-400',
    'Em Andamento': 'bg-green-500/10 text-green-400',
    'Concluído': 'bg-sky-500/10 text-sky-400',
  };

  return (
    <div 
      onClick={() => onEdit(project)}
      className="group relative bg-brand-dark-900 rounded-2xl p-4 border border-gray-800/60 hover:border-brand-blue-500/30 transition-all duration-200 cursor-pointer shadow-sm touch-manipulation"
    >
      {/* Cabeçalho do Card: Nome e Status */}
      <div className="flex justify-between items-start mb-3">
          <div className="pr-4 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                  <Construction className="w-4 h-4 text-brand-blue-500" />
                  <h3 className="font-semibold text-white text-base leading-tight line-clamp-2">
                      {project.name}
                  </h3>
              </div>
              {(() => {
                const todayStr = new Date().toLocaleDateString('en-CA');
                const cleanEnd = project.end_date ? (project.end_date.includes('T') ? project.end_date.split('T')[0] : project.end_date) : '';
                const isConcluded = project.status === 'Concluído' || (cleanEnd && cleanEnd <= todayStr);
                const effectiveStatus = isConcluded ? 'Concluído' : project.status;
                return (
                  <div className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusColors[effectiveStatus] || statusColors['Planejamento']}`}>
                      {effectiveStatus}
                  </div>
                );
              })()}
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
                      <DropdownMenuItem onSelect={() => onEdit(project)}>
                          <Edit className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onDelete(project)} className="text-red-500 hover:!text-red-400">
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>
          </div>
      </div>

      {/* Linha divisória sutil */}
      <div className="h-px w-full bg-gradient-to-r from-gray-800/50 via-gray-800/20 to-transparent my-3" />

      {/* Metadados: Gerente, Período, Endereço */}
      <div className="flex items-end justify-between">
          <div className="space-y-2 flex-1 pr-4">
              {project.manager && (
                  <div className="flex items-center gap-2 text-xs text-gray-300">
                      <User className="w-3.5 h-3.5 text-brand-blue-500/70 flex-shrink-0" />
                      <span className="line-clamp-1">Gerente: {project.manager}</span>
                  </div>
              )}
              
              {(project.start_date || project.end_date) && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="line-clamp-1">{formatDate(project.start_date)} - {formatDate(project.end_date)}</span>
                  </div>
              )}

              {!!fullAddress && (
                  <div className="flex items-start gap-2 text-xs text-gray-500 pt-1">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{fullAddress}</span>
                  </div>
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

export default ProjectCard;