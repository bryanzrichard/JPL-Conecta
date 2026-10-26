import React from 'react';
import { ChatMessage, ResolvedCopilotAction } from '../../lib/copilotExecutor';
import { CopilotReviewCard } from './CopilotReviewCard';
import { CopilotConsultaCard } from './CopilotConsultaCard';
import {
  SparklesIcon,
  UserIcon,
  ConstructionIcon,
  ShoppingBagIcon,
  ClipboardListIcon,
} from '../../lib/icons';

export interface CopilotMensagemProps {
  message: ChatMessage;
  onConfirmActions: (messageId: string, acoes: ResolvedCopilotAction[]) => void;
  onCancelActions: (messageId: string) => void;
  isProcessingAudioIA: boolean;
}

export const CopilotMensagem: React.FC<CopilotMensagemProps> = ({
  message,
  onConfirmActions,
  onCancelActions,
  isProcessingAudioIA,
}) => {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in-50`}>
      <div
        className={`max-w-[88%] sm:max-w-[78%] rounded-2xl p-3 shadow-xs text-xs leading-relaxed ${
          isUser
            ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-slate-800 dark:text-[#E9EDEF] rounded-tr-xs border border-emerald-300/40 dark:border-emerald-600/30'
            : 'bg-white dark:bg-[#1F2C34] text-slate-800 dark:text-[#E9EDEF] rounded-tl-xs border border-slate-200/80 dark:border-gray-700/60'
        }`}
      >
        <p className="whitespace-pre-wrap font-sans">{message.text}</p>

        {/* Indicador de consulta em andamento */}
        {message.consultando && (
          <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-pulse">
            <SparklesIcon className="h-3.5 w-3.5 animate-spin" />
            <span>Consultando...</span>
          </div>
        )}

        {/* Cards de Consulta de Gastos e Compras */}
        {message.consultas && message.consultas.length > 0 && (
          <div className="mt-2.5 space-y-2 pt-2 border-t border-slate-100 dark:border-gray-700/60">
            {message.consultas.map((consulta, idx) => (
              <CopilotConsultaCard key={idx} resultado={consulta} />
            ))}
          </div>
        )}

        {/* Card de Revisão de Ações (Ações que alteram dados) */}
        {message.review && (
          <CopilotReviewCard
            review={message.review}
            onConfirm={() => onConfirmActions(message.id, message.review!.acoes)}
            onCancel={() => onCancelActions(message.id)}
            isExecuting={isProcessingAudioIA}
          />
        )}

        {/* Cards de resultado pós-execução */}
        {message.cards && message.cards.length > 0 && (
          <div className="mt-2.5 space-y-2 pt-2 border-t border-slate-100 dark:border-gray-700/60">
            {message.cards.map((card, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border text-xs ${
                  card.tipo === 'colaborador'
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/40 text-blue-900 dark:text-blue-200'
                    : card.tipo === 'servico'
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200'
                    : card.tipo === 'compra'
                    ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200'
                    : card.tipo === 'erro'
                    ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/40 text-rose-900 dark:text-rose-200'
                    : 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/40 text-indigo-900 dark:text-indigo-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-[11px] mb-1">
                  {card.tipo === 'colaborador' && <UserIcon className="h-3.5 w-3.5 text-blue-600" />}
                  {card.tipo === 'servico' && <ConstructionIcon className="h-3.5 w-3.5 text-emerald-600" />}
                  {card.tipo === 'compra' && <ShoppingBagIcon className="h-3.5 w-3.5 text-amber-600" />}
                  {card.tipo === 'tarefa' && <ClipboardListIcon className="h-3.5 w-3.5 text-indigo-600" />}
                  <span>{card.badge}</span>
                </div>
                <p className="font-bold text-xs">{card.titulo}</p>
                <p className="text-[11px] opacity-90 mt-0.5">{card.subtitulo}</p>
                {card.detalhes && (
                  <p className="text-[11px] font-semibold opacity-95 mt-0.5">{card.detalhes}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <span className="block text-right text-[9px] text-slate-400 dark:text-gray-400 mt-1">
          {message.timestamp}
        </span>
      </div>
    </div>
  );
};

export default CopilotMensagem;
