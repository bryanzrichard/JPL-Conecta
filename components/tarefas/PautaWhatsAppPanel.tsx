import React from 'react';
import { SendIcon, CopyIcon, XIcon, CheckCircle2Icon } from '../../lib/icons';

export interface PautaWhatsAppPanelProps {
  previewDateMode: 'today' | 'tomorrow';
  setPreviewDateMode: (mode: 'today' | 'tomorrow') => void;
  dailyProgress: number;
  formattedWhatsAppText: string;
  handleDirectGroupSend: () => void;
  handleCopyWhatsApp: () => void;
  isCopiedSuccess: boolean;
  onClose?: () => void;
  todayDateStr?: string;
  tomorrowDateStr?: string;
  tasksCount?: number;
  completedCount?: number;
  purchasesCount?: number;
}

export const PautaWhatsAppPanel: React.FC<PautaWhatsAppPanelProps> = ({
  previewDateMode,
  setPreviewDateMode,
  dailyProgress,
  formattedWhatsAppText,
  handleDirectGroupSend,
  handleCopyWhatsApp,
  isCopiedSuccess,
  onClose,
  tasksCount = 0,
  completedCount = 0,
  purchasesCount = 0,
}) => {
  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs select-text">
      {/* 1. CABEÇALHO COMPACTO & ELEGANTE */}
      <div className="px-3.5 py-2.5 bg-emerald-600 dark:bg-emerald-700 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <SendIcon className="h-4 w-4 shrink-0 text-white" />
          <h3 className="text-xs font-bold truncate">Pauta Diária para o WhatsApp</h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Alternador de Data Compacto: Hoje vs Amanhã */}
          <div className="inline-flex rounded-lg bg-emerald-700/90 dark:bg-emerald-800/90 p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setPreviewDateMode('today')}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                previewDateMode === 'today'
                  ? 'bg-white text-emerald-800 font-bold shadow-xs'
                  : 'text-emerald-100 hover:text-white'
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setPreviewDateMode('tomorrow')}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                previewDateMode === 'tomorrow'
                  ? 'bg-white text-emerald-800 font-bold shadow-xs'
                  : 'text-emerald-100 hover:text-white'
              }`}
            >
              Amanhã
            </button>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/20 text-white cursor-pointer transition-colors"
              title="Fechar"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. FAIXA DINÂMICA DE MÉTRICAS & PROGRESSO (COMPACTA) */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-gray-800 shrink-0">
        <div className="px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-gray-400">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              Total: <strong className="font-mono text-slate-800 dark:text-slate-200">{tasksCount}</strong>
            </span>
            <span>·</span>
            <span>
              Concluídas:{' '}
              <strong className="font-mono text-emerald-600 dark:text-emerald-400">{completedCount}</strong>
            </span>
            {purchasesCount > 0 && (
              <>
                <span>·</span>
                <span>
                  Compras:{' '}
                  <strong className="font-mono text-amber-600 dark:text-amber-400">{purchasesCount}</strong>
                </span>
              </>
            )}
          </div>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
            {dailyProgress}% concluído
          </span>
        </div>
        {/* Linha Fina de Progresso */}
        <div className="w-full h-1 bg-slate-200/80 dark:bg-gray-800">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, dailyProgress))}%` }}
          />
        </div>
      </div>

      {/* 3. BALÃO DE MENSAGEM WHATSAPP (MÁXIMO ESPAÇO ÚTIL DE ROLAGEM) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-[#EFEAE2]/60 dark:bg-[#0D1418] min-h-0">
        <div className="bg-white dark:bg-[#1F2C34] border border-slate-200/60 dark:border-gray-700/50 rounded-xl p-3 shadow-xs text-xs font-mono text-slate-800 dark:text-[#E9EDEF] whitespace-pre-wrap leading-relaxed select-all">
          {formattedWhatsAppText || 'Nenhuma pendência encontrada para esta data.'}
        </div>
      </div>

      {/* 4. AÇÕES LADO A LADO NO RODAPÉ (OTIMIZADO EM ALTURA) */}
      <div className="p-2.5 bg-white dark:bg-[#111827] border-t border-slate-100 dark:border-gray-800 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleDirectGroupSend}
          className="flex-1 h-9 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate px-2"
          title="Copia a pauta e abre o grupo do WhatsApp da JPL"
        >
          {isCopiedSuccess ? (
            <CheckCircle2Icon className="h-4 w-4 shrink-0 text-emerald-200" />
          ) : (
            <SendIcon className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">
            {isCopiedSuccess ? 'Copiado! Abrindo Grupo...' : 'Enviar no Grupo JPL (1 Clique)'}
          </span>
        </button>

        <button
          type="button"
          onClick={handleCopyWhatsApp}
          className="h-9 px-3 rounded-xl font-semibold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-gray-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-200/60 dark:border-gray-700 shrink-0"
          title="Apenas copiar o texto da pauta"
        >
          <CopyIcon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <span>{isCopiedSuccess ? 'Copiado!' : 'Copiar'}</span>
        </button>
      </div>
    </div>
  );
};

export default PautaWhatsAppPanel;
