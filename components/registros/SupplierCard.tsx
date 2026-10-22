import React from 'react';
import { Supplier } from '../../types';
import { Building2, FileText, User, Phone, ChevronRight, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/DropdownMenu';
import { StarRating } from '../ui/StarRating';
import { formatCnpj } from '../../lib/utils';

interface SupplierCardProps {
  supplier: Supplier;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
}

const SupplierCard: React.FC<SupplierCardProps> = ({ supplier, onEdit, onDelete }) => {
  return (
    <div 
      onClick={() => onEdit(supplier)}
      className="group relative bg-brand-dark-900 rounded-2xl p-4 border border-gray-800/60 hover:border-brand-blue-500/30 transition-all duration-200 cursor-pointer shadow-sm touch-manipulation"
    >
      {/* Cabeçalho do Card: Nome e CNPJ */}
      <div className="flex justify-between items-start mb-3">
          <div className="pr-4 flex-1">
              <div className="flex items-center gap-2 mb-1">
                  <Building2 className="w-4 h-4 text-brand-blue-500" />
                  <h3 className="font-semibold text-white text-base leading-tight line-clamp-2">
                      {supplier.name}
                  </h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{formatCnpj(supplier.cnpj) || 'CNPJ não informado'}</span>
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
                      <DropdownMenuItem onSelect={() => onEdit(supplier)}>
                          <Edit className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onDelete(supplier)} className="text-red-500 hover:!text-red-400">
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>
          </div>
      </div>

      {/* Linha divisória sutil */}
      <div className="h-px w-full bg-gradient-to-r from-gray-800/50 via-gray-800/20 to-transparent my-3" />

      {/* Metadados: Vendedor, Contato, Avaliações */}
      <div className="flex items-end justify-between">
          <div className="space-y-2 flex-1 pr-4">
              {(supplier.seller || supplier.seller_contact) && (
                  <>
                      <div className="flex items-center gap-2 text-xs text-gray-300">
                          <User className="w-3.5 h-3.5 text-brand-blue-500/70 flex-shrink-0" />
                          <span className="line-clamp-1">{supplier.seller || 'Vendedor não informado'}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="line-clamp-1">{supplier.seller_contact || 'Contato não informado'}</span>
                      </div>
                  </>
              )}

              <div className="flex flex-wrap items-center gap-4 pt-1">
                  <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-500 uppercase font-medium">Serviço</span>
                      <StarRating rating={supplier.service_rating} />
                  </div>
                  <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-500 uppercase font-medium">Entrega</span>
                      <StarRating rating={supplier.delivery_rating} />
                  </div>
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

export default SupplierCard;