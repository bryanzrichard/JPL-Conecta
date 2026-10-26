import React from 'react';
import type { CopilotActivityItem } from '../../lib/copilotHistorico';
export type { CopilotActivityItem };
import {
  UserIcon,
  ConstructionIcon,
  ShoppingBagIcon,
  ClipboardListIcon,
  CheckCircle2Icon,
  SparklesIcon,
  ClockIcon,
  FileTextIcon,
} from '../../lib/icons';

interface CopilotActivityFeedProps {
  activities: CopilotActivityItem[];
}

export const CopilotActivityFeed: React.FC<CopilotActivityFeedProps> = ({ activities }) => {
  const handleScrollToMessage = (messageId?: string) => {
    if (!messageId) return;
    const el = document.getElementById(`copilot-msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      el.classList.add('ring-2', 'ring-emerald-500/50');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-emerald-500/50');
      }, 1500);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Cabeçalho do Painel Lateral */}
      <div className="p-3.5 border-b border-slate-200/80 dark:border-gray-800 bg-slate-100/70 dark:bg-[#111827] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <SparklesIcon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">
              Últimas Ações do Copiloto
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate">
              Ações gravadas e consultas feitas
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-gray-800 text-slate-700 dark:text-gray-300 text-[10px] font-bold shrink-0">
          {activities.length} {activities.length === 1 ? 'item' : 'itens'}
        </span>
      </div>

      {/* Lista de Atividades Recentes com Scroll */}
      <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-2.5 min-h-0">
        {activities.length === 0 ? (
          <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-200/60 dark:bg-gray-800 flex items-center justify-center text-slate-400 mb-3">
              <ClipboardListIcon className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-gray-300">
              Nenhuma ação executada ainda
            </p>
            <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-1 max-w-[220px] leading-relaxed">
              Fale ou digite comandos no chat ao lado. Cada ação gravada no banco ou consulta realizada aparecerá aqui para seu controle total.
            </p>
          </div>
        ) : (
          activities.map((act, index) => {
            const isCollab = act.tipo === 'colaborador';
            const isService = act.tipo === 'servico';
            const isPurchase = act.tipo === 'compra';
            const isTask = act.tipo === 'tarefa';
            const isError = act.tipo === 'erro';
            const isConsulta = act.tipo === 'consulta';

            return (
              <div
                key={`${act.messageId || ''}-${index}`}
                role="button"
                tabIndex={0}
                onClick={() => handleScrollToMessage(act.messageId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleScrollToMessage(act.messageId);
                  }
                }}
                className={`p-3 rounded-xl border transition-all text-xs shadow-xs cursor-pointer hover:shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 select-none ${
                  isConsulta
                    ? 'bg-teal-50/70 dark:bg-teal-950/30 border-teal-200/80 dark:border-teal-900/40 text-teal-950 dark:text-teal-200'
                    : isCollab
                    ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200/80 dark:border-blue-900/40 text-blue-950 dark:text-blue-200'
                    : isService
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-900/40 text-emerald-950 dark:text-emerald-200'
                    : isPurchase
                    ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-900/40 text-amber-950 dark:text-amber-200'
                    : isError
                    ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-900/40 text-rose-950 dark:text-rose-200'
                    : 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200/80 dark:border-indigo-900/40 text-indigo-950 dark:text-indigo-200'
                }`}
                title="Clique para ir até a mensagem no chat"
              >
                {/* Cabeçalho do Card */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-[11px]">
                    {isConsulta && <FileTextIcon className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />}
                    {isCollab && <UserIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                    {isService && <ConstructionIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                    {isPurchase && <ShoppingBagIcon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
                    {isTask && <ClipboardListIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                    <span className="truncate">{act.badge}</span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                      isConsulta
                        ? 'text-teal-700 dark:text-teal-400 bg-white/80 dark:bg-black/30 border-teal-300/40'
                        : 'text-emerald-700 dark:text-emerald-400 bg-white/80 dark:bg-black/30 border-emerald-300/40'
                    }`}
                  >
                    {isConsulta ? (
                      <>
                        <SparklesIcon className="h-3 w-3" />
                        <span>Consulta</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2Icon className="h-3 w-3" />
                        <span>Executado</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Título e Subtítulo */}
                <p className="font-bold text-xs leading-snug break-words">
                  {act.titulo}
                </p>
                <p className="text-[11px] opacity-90 mt-0.5 break-words">
                  {act.subtitulo}
                </p>

                {/* Detalhes de Valores ou Prazos e Horário */}
                {(act.detalhes || act.messageTimestamp) && (
                  <div className="mt-1.5 pt-1.5 border-t border-black/5 dark:border-white/10 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold opacity-95 truncate">
                      {act.detalhes || (isConsulta ? 'Consulta apurada' : '')}
                    </span>
                    {act.messageTimestamp && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] opacity-70 shrink-0">
                        <ClockIcon className="h-3 w-3" />
                        {act.messageTimestamp}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CopilotActivityFeed;
