import React from 'react';
import { PendingReviewData } from '../../lib/copilotExecutor';
import { Button } from '../ui/Button';
import {
  CheckIcon,
  XIcon,
  BuildingIcon,
  UserIcon,
  DollarSignIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ConstructionIcon,
  ShoppingBagIcon,
  ClipboardListIcon
} from '../../lib/icons';

interface CopilotReviewCardProps {
  review: PendingReviewData;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting: boolean;
}

export const CopilotReviewCard: React.FC<CopilotReviewCardProps> = ({
  review,
  onConfirm,
  onCancel,
  isExecuting,
}) => {
  const isPending = review.status === 'pending';
  const isConfirmed = review.status === 'confirmed';
  const isCancelled = review.status === 'cancelled';

  return (
    <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 dark:border-gray-700/60 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          📋 Revisão de Ações ({review.items.length})
        </span>
        {isConfirmed && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2Icon className="h-3.5 w-3.5" /> Confirmado
          </span>
        )}
        {isCancelled && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
            <XIcon className="h-3.5 w-3.5" /> Cancelado
          </span>
        )}
      </div>

      <div className="space-y-2">
        {review.items.map((item) => {
          const isObraUnknown = item.obraLabel === 'Obra não identificada';
          return (
            <div
              key={item.id}
              className="p-2.5 rounded-xl border border-slate-200/90 dark:border-gray-700/80 bg-slate-50/70 dark:bg-slate-900/40 text-xs space-y-1"
            >
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-emerald-700 dark:text-emerald-300">
                {item.tipo === 'CRIAR_SERVICO' && <ConstructionIcon className="h-3.5 w-3.5" />}
                {item.tipo === 'CRIAR_TAREFA' && (
                  item.badge.includes('Compras') ? <ShoppingBagIcon className="h-3.5 w-3.5" /> : <ClipboardListIcon className="h-3.5 w-3.5" />
                )}
                {item.tipo === 'CADASTRAR_COLABORADOR' && <UserIcon className="h-3.5 w-3.5" />}
                {item.tipo === 'CONCLUIR_TAREFA' && <CheckCircle2Icon className="h-3.5 w-3.5" />}
                {item.tipo === 'QUITAR_SERVICO' && <DollarSignIcon className="h-3.5 w-3.5" />}
                <span>{item.badge}</span>
              </div>

              <p className="font-bold text-slate-800 dark:text-white text-xs">{item.titulo}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-slate-600 dark:text-gray-300 pt-0.5">
                <div className="flex items-center gap-1">
                  <BuildingIcon className="h-3 w-3 shrink-0 opacity-70" />
                  <span className={isObraUnknown ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
                    {item.obraLabel}
                  </span>
                </div>

                {item.responsavelLabel && (
                  <div className="flex items-center gap-1">
                    <UserIcon className="h-3 w-3 shrink-0 opacity-70" />
                    <span>{item.responsavelLabel}</span>
                  </div>
                )}

                {item.valoresLabel && (
                  <div className="flex items-center gap-1 col-span-full font-medium text-emerald-700 dark:text-emerald-300">
                    <DollarSignIcon className="h-3 w-3 shrink-0" />
                    <span>{item.valoresLabel}</span>
                  </div>
                )}

                {item.dataLabel && (
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3 shrink-0 opacity-70" />
                    <span>{item.dataLabel}</span>
                  </div>
                )}

                {item.detalhes && (
                  <div className="col-span-full text-[10px] text-slate-500 dark:text-gray-400">
                    {item.detalhes}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isPending && (
        <div className="pt-1.5 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isExecuting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 gap-1.5 shadow-xs"
          >
            <CheckIcon className="h-3.5 w-3.5" />
            Confirmar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={isExecuting}
            className="flex-1 border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs h-8 gap-1.5"
          >
            <XIcon className="h-3.5 w-3.5" />
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
};

export default CopilotReviewCard;
