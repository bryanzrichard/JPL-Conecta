import React from 'react';
import { Button } from '../ui/Button';
import { ClipboardListIcon, BellIcon, SendIcon, CopyIcon } from '../../lib/icons';
import { openOfficialGroupLink } from '../../lib/whatsappGenerator';

export interface TarefasCabecalhoProps {
  hasNotificationPermission: boolean;
  onRequestNotificationPermission: () => void;
  onOpenMobileWhatsappPreview: () => void;
}

export const TarefasCabecalho: React.FC<TarefasCabecalhoProps> = ({
  hasNotificationPermission,
  onRequestNotificationPermission,
  onOpenMobileWhatsappPreview,
}) => {
  return (
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-gray-800">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 shrink-0">
          <ClipboardListIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-[#F8FAFC] tracking-tight flex items-center gap-2">
            Tarefas & Programação de Obra
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400">
              Central Rápida
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
            Pendências do canteiro, lista de compras e gerador automático de pauta para o WhatsApp da equipe.
          </p>
        </div>
      </div>

      {/* Botões do Topo */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Botão de Notificações / Lembretes */}
        <button
          type="button"
          onClick={onRequestNotificationPermission}
          className={`h-8 px-2.5 sm:px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
            hasNotificationPermission
              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 dark:bg-[#111827] dark:hover:bg-slate-800 dark:text-gray-200 dark:border-gray-800'
          }`}
          title={
            hasNotificationPermission
              ? 'Lembretes ativos no seu aparelho (clique para testar)'
              : 'Ativar lembretes no smartphone ou computador'
          }
        >
          <BellIcon
            className={`h-3.5 w-3.5 ${
              hasNotificationPermission
                ? 'text-amber-600 dark:text-amber-400 fill-amber-500/20'
                : 'text-slate-400'
            }`}
          />
          <span className="hidden sm:inline">
            {hasNotificationPermission ? 'Lembretes Ativos' : 'Ativar Lembretes'}
          </span>
          {hasNotificationPermission && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>

        {/* Botão Oficial do Grupo WhatsApp */}
        <button
          type="button"
          onClick={openOfficialGroupLink}
          className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          title="Abrir Grupo Oficial do WhatsApp da JPL Construtora"
        >
          <SendIcon className="h-3.5 w-3.5" />
          <span>Grupo WhatsApp</span>
        </button>

        {/* Botão Ver Pauta no Mobile */}
        <div className="lg:hidden">
          <Button
            size="sm"
            onClick={onOpenMobileWhatsappPreview}
            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
          >
            <CopyIcon className="h-3.5 w-3.5 mr-1" />
            <span>Ver Pauta</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
