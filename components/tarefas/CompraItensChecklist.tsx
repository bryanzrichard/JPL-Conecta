import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CompraItem, parseCompraItens, formatCompraItem, formatCompraItemTexto } from '../../lib/compraItens';
import { EnrichedTask } from './types';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { copyTextToClipboard } from '../../lib/whatsappGenerator';
import { TaskStatus } from '../../types';
import { CopyIcon, CheckIcon, ShoppingBagIcon } from '../../lib/icons';
import { Button } from '../ui/Button';

interface CompraItensChecklistProps {
  task: EnrichedTask;
}

export const CompraItensChecklist: React.FC<CompraItensChecklistProps> = ({ task }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [items, setItems] = useState<CompraItem[]>(() => parseCompraItens(task.materiais_previstos));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setItems(parseCompraItens(task.materiais_previstos));
  }, [task.materiais_previstos]);

  const total = items.length;
  const comprados = items.filter((i) => i.comprado).length;
  const pct = total > 0 ? Math.round((comprados / total) * 100) : 0;

  const mutation = useMutation({
    mutationFn: async ({
      updatedItens,
      newStatus,
    }: {
      updatedItens: CompraItem[];
      newStatus: TaskStatus;
    }) => {
      const { error } = await supabase
        .from('tasks')
        .update({
          materiais_previstos: updatedItens,
          status: newStatus,
        })
        .eq('id', task.id);
      if (error) throw error;
      return { newStatus };
    },
    onSuccess: ({ newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (newStatus === 'Concluída') {
        toast({
          title: 'Compra concluída!',
          description: 'Todos os materiais foram marcados como comprados.',
        });
      }
    },
    onError: (err) => {
      setItems(parseCompraItens(task.materiais_previstos));
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar item',
        description: formatApiError(err),
      });
    },
  });

  const handleToggleItem = (index: number) => {
    const updated = items.map((it, idx) =>
      idx === index ? { ...it, comprado: !it.comprado } : it
    );
    setItems(updated);

    const allPurchased = updated.length > 0 && updated.every((i) => i.comprado);
    const anyPending = updated.some((i) => !i.comprado);

    let nextStatus = task.status;
    if (allPurchased) {
      nextStatus = 'Concluída';
    } else if (task.status === 'Concluída' && anyPending) {
      nextStatus = 'Planejada';
    }

    mutation.mutate({ updatedItens: updated, newStatus: nextStatus });
  };

  const handleCopyPending = async () => {
    const pendentes = items.filter((i) => !i.comprado);
    if (pendentes.length === 0) {
      toast({ title: 'Aviso', description: 'Não há itens pendentes para copiar.' });
      return;
    }

    const lines = [
      `${task.title}${task.projectName ? ` - ${task.projectName}` : ''}`,
      ...pendentes.map((it) => `- ${formatCompraItemTexto(it)}`),
    ];

    const success = await copyTextToClipboard(lines.join('\n'));
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copiado!',
        description: `${pendentes.length} ${
          pendentes.length === 1 ? 'item pendente copiado' : 'itens pendentes copiados'
        }.`,
      });
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 p-3.5 rounded-xl shadow-xs space-y-3">
      {/* Cabeçalho do checklist */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <ShoppingBagIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-bold text-slate-800 dark:text-white">
            {comprados} de {total} comprados
          </span>
          <span className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
            {pct}%
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopyPending}
          disabled={comprados === total}
          className="h-7 px-2 text-[11px] font-semibold border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-brand-dark-800 gap-1.5 cursor-pointer disabled:opacity-40"
          title="Copiar itens não comprados"
        >
          {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-600" /> : <CopyIcon className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copiado!' : 'Copiar pendentes'}</span>
        </Button>
      </div>

      {/* Barra de progresso */}
      <div className="w-full bg-slate-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-amber-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Lista de itens interativos */}
      <ul className="space-y-1.5 divide-y divide-slate-100/80 dark:divide-gray-800/60">
        {items.map((item, index) => {
          const isDone = item.comprado;
          return (
            <li
              key={index}
              onClick={() => handleToggleItem(index)}
              className={`pt-1.5 first:pt-0 flex items-start gap-2.5 p-1 rounded-lg transition-colors cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-brand-dark-800/50 ${
                isDone ? 'opacity-60' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={isDone}
                onChange={() => {}} // tratado no li onClick
                className="mt-0.5 h-4 w-4 rounded-md border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <span
                className={`text-xs font-medium leading-tight flex-1 ${
                  isDone
                    ? 'line-through text-slate-400 dark:text-gray-500'
                    : 'text-slate-800 dark:text-gray-200'
                }`}
              >
                {formatCompraItem(item)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default CompraItensChecklist;
