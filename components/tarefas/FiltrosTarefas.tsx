import React, { useState, useEffect } from 'react';
import { 
  ResponsiveModal, 
  ResponsiveModalContent, 
  ResponsiveModalHeader, 
  ResponsiveModalTitle, 
  ResponsiveModalDescription, 
  ResponsiveModalFooter 
} from '../ui/ResponsiveModal';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import { FilterIcon, CalendarIcon, XIcon, BuildingIcon, UserIcon, AlertTriangleIcon } from '../../lib/icons';
import { Project, Collaborator, TaskPriority } from '../../types';
import { TarefasFilters } from './types';
import { formatDateYMD } from '../../lib/utils';

interface FiltrosTarefasProps {
  isOpen: boolean;
  onClose: () => void;
  filters: TarefasFilters;
  onApplyFilters: (filters: TarefasFilters) => void;
  projects: Project[];
  collaborators: Collaborator[];
}

const initialFilters: TarefasFilters = {
  project_id: null,
  responsavel_id: null,
  prioridade: 'all',
  start_date: null,
  end_date: null,
};

export const FiltrosTarefas: React.FC<FiltrosTarefasProps> = ({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  projects,
  collaborators,
}) => {
  const [tempFilters, setTempFilters] = useState<TarefasFilters>(filters);

  useEffect(() => {
    if (isOpen) {
      setTempFilters(filters);
    }
  }, [isOpen, filters]);

  const handleClear = () => {
    setTempFilters(initialFilters);
    onApplyFilters(initialFilters);
    onClose();
  };

  const handleApply = () => {
    onApplyFilters(tempFilters);
    onClose();
  };

  const applyQuickPeriod = (type: 'today' | 'next7' | 'thisMonth' | 'next30') => {
    const today = new Date();
    const todayStr = formatDateYMD(today);

    if (type === 'today') {
      setTempFilters((prev) => ({ ...prev, start_date: todayStr, end_date: todayStr }));
    } else if (type === 'next7') {
      const next7 = new Date();
      next7.setDate(next7.getDate() + 7);
      setTempFilters((prev) => ({ ...prev, start_date: todayStr, end_date: formatDateYMD(next7) }));
    } else if (type === 'thisMonth') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setTempFilters((prev) => ({
        ...prev,
        start_date: formatDateYMD(startOfMonth),
        end_date: formatDateYMD(endOfMonth),
      }));
    } else if (type === 'next30') {
      const next30 = new Date();
      next30.setDate(next30.getDate() + 30);
      setTempFilters((prev) => ({ ...prev, start_date: todayStr, end_date: formatDateYMD(next30) }));
    }
  };

  return (
    <ResponsiveModal open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} displayMode="drawer">
      <ResponsiveModalContent size="sm">
        {/* Header */}
        <ResponsiveModalHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400">
              <FilterIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle>Filtros de Tarefas</ResponsiveModalTitle>
              <ResponsiveModalDescription>
                Filtre por obra, responsável, prioridade e período.
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>

        {/* Corpo do formulário de filtros */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar text-xs">
          
          {/* Obra */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
              <BuildingIcon className="h-3.5 w-3.5 text-slate-400" />
              Obra / Canteiro
            </Label>
            <select
              value={tempFilters.project_id || ''}
              onChange={(e) => setTempFilters((prev) => ({ ...prev, project_id: e.target.value || null }))}
              className="w-full h-9 rounded-lg border border-slate-300 dark:border-gray-800 bg-white dark:bg-brand-dark-950 px-3 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Todas as Obras ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Responsável */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
              <UserIcon className="h-3.5 w-3.5 text-slate-400" />
              Responsável Técnico
            </Label>
            <select
              value={tempFilters.responsavel_id || ''}
              onChange={(e) => setTempFilters((prev) => ({ ...prev, responsavel_id: e.target.value || null }))}
              className="w-full h-9 rounded-lg border border-slate-300 dark:border-gray-800 bg-white dark:bg-brand-dark-950 px-3 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Todos os Responsáveis ({collaborators.length})</option>
              {collaborators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Prioridade */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
              <AlertTriangleIcon className="h-3.5 w-3.5 text-slate-400" />
              Prioridade
            </Label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['all', 'Baixa', 'Média', 'Alta'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTempFilters((prev) => ({ ...prev, prioridade: p }))}
                  className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    tempFilters.prioridade === p
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white dark:bg-brand-dark-950 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-800 hover:bg-slate-50'
                  }`}
                >
                  {p === 'all' ? 'Todas' : p}
                </button>
              ))}
            </div>
          </div>

          {/* Período do Prazo */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200/80 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                Período do Prazo Final
              </Label>
              {(tempFilters.start_date || tempFilters.end_date) && (
                <button
                  type="button"
                  onClick={() => setTempFilters((prev) => ({ ...prev, start_date: null, end_date: null }))}
                  className="text-[11px] text-rose-500 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <XIcon className="h-3 w-3" /> Limpar datas
                </button>
              )}
            </div>

            {/* Atalhos de Período */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => applyQuickPeriod('today')}
                className="h-7 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-gray-300 transition-colors cursor-pointer"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => applyQuickPeriod('next7')}
                className="h-7 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-gray-300 transition-colors cursor-pointer"
              >
                Próximos 7 dias
              </button>
              <button
                type="button"
                onClick={() => applyQuickPeriod('thisMonth')}
                className="h-7 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-gray-300 transition-colors cursor-pointer"
              >
                Este Mês
              </button>
              <button
                type="button"
                onClick={() => applyQuickPeriod('next30')}
                className="h-7 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-gray-300 transition-colors cursor-pointer"
              >
                Próximos 30 dias
              </button>
            </div>

            {/* Inputs de Data */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <Label className="text-[10px] text-slate-400 mb-1 block">A partir de</Label>
                <input
                  type="date"
                  value={tempFilters.start_date || ''}
                  onChange={(e) => setTempFilters((prev) => ({ ...prev, start_date: e.target.value || null }))}
                  className="w-full h-8 px-2 rounded-lg border border-slate-300 dark:border-gray-800 bg-white dark:bg-brand-dark-950 text-xs text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-400 mb-1 block">Até</Label>
                <input
                  type="date"
                  value={tempFilters.end_date || ''}
                  onChange={(e) => setTempFilters((prev) => ({ ...prev, end_date: e.target.value || null }))}
                  className="w-full h-8 px-2 rounded-lg border border-slate-300 dark:border-gray-800 bg-white dark:bg-brand-dark-950 text-xs text-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Rodapé Fixo */}
        <ResponsiveModalFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-xs text-slate-600 dark:text-gray-400 cursor-pointer"
          >
            Limpar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-xs"
          >
            Aplicar Filtros
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

export default FiltrosTarefas;
