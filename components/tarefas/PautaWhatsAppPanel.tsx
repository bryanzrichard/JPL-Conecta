import React from 'react';
import { SendIcon, CopyIcon, XIcon, CheckCircle2Icon } from '../../lib/icons';

interface PautaWhatsAppPanelProps {
  previewDateMode: 'today' | 'tomorrow';
  setPreviewDateMode: (mode: 'today' | 'tomorrow') => void;
  dailyProgress: number;
  formattedWhatsAppText: string;
  handleDirectGroupSend: () => void;
  handleCopyWhatsApp: () => void;
  isCopiedSuccess: boolean;
  onClose?: () => void;
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
}) => {
  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
      {/* Cabeçalho do Card WhatsApp */}
      <div className="p-3.5 bg-emerald-600 dark:bg-emerald-700 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <SendIcon className="h-4 w-4" />
          <h3 className="text-xs font-bold">Pauta Diária para o WhatsApp</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Alternador de Data: Hoje vs Amanhã */}
          <div className="inline-flex rounded-lg bg-emerald-700/80 dark:bg-emerald-800/80 p-0.5 text-[11px] font-semibold">
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

      {/* Barra de Progresso Diário */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between text-xs shrink-0">
        <span className="text-[11px] font-medium text-slate-500 dark:text-gray-400">
          Progresso ({previewDateMode === 'today' ? 'Hoje' : 'Amanhã'}):
        </span>
        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
          {dailyProgress}% concluído
        </span>
      </div>

      {/* Balão de Mensagem Estilo WhatsApp (Live Preview) */}
      <div className="p-3.5 bg-[#EFEAE2]/60 dark:bg-[#0D1418] flex-1 overflow-y-auto custom-scrollbar">
        <div className="bg-white dark:bg-[#1F2C34] border border-slate-200/60 dark:border-gray-700/50 rounded-xl p-3 shadow-xs text-xs font-mono text-slate-800 dark:text-[#E9EDEF] whitespace-pre-wrap leading-relaxed select-all">
          {formattedWhatsAppText}
        </div>
      </div>

      {/* Botões de Ação da Pauta */}
      <div className="p-3 bg-white dark:bg-[#111827] border-t border-slate-100 dark:border-gray-800 space-y-2 shrink-0">
        <button
          type="button"
          onClick={handleDirectGroupSend}
          className="w-full h-10 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          title="Copia a pauta e abre o grupo do WhatsApp da JPL"
        >
          {isCopiedSuccess ? <CheckCircle2Icon className="h-4 w-4" /> : <SendIcon className="h-4 w-4" />}
          <span>{isCopiedSuccess ? 'Copiado! Abrindo Grupo...' : 'Enviar no Grupo JPL (1 Clique)'}</span>
        </button>

        <button
          type="button"
          onClick={handleCopyWhatsApp}
          className="w-full h-8 rounded-lg font-semibold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-gray-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <CopyIcon className="h-3.5 w-3.5 text-slate-500" />
          <span>Apenas Copiar</span>
        </button>
      </div>
    </div>
  );
};

export default PautaWhatsAppPanel;
