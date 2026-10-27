import React, { useState } from 'react';
import {
  SendIcon,
  CopyIcon,
  XIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  ShoppingBagIcon,
  CalendarIcon,
  SparklesIcon,
} from '../../lib/icons';
import { formatDateDM } from '../../lib/utils';

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
  todayDateStr,
  tomorrowDateStr,
  tasksCount = 0,
  completedCount = 0,
  purchasesCount = 0,
}) => {
  const [activeView, setActiveView] = useState<'whatsapp' | 'info'>('whatsapp');

  const todayLabel = todayDateStr ? `Hoje · ${formatDateDM(todayDateStr)}` : 'Hoje';
  const tomorrowLabel = tomorrowDateStr ? `Amanhã · ${formatDateDM(tomorrowDateStr)}` : 'Amanhã';

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#111827] overflow-hidden select-text">
      {/* 1. CABEÇALHO SOFISTICADO */}
      <div className="p-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
            <SendIcon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight truncate">
                Pauta Diária da Obra
              </h3>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-emerald-400/25 text-[10px] font-bold text-emerald-100 border border-emerald-300/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                WhatsApp
              </span>
            </div>
            <p className="text-[11px] text-emerald-100/90 truncate mt-0.5">
              Programação e lista de compras formatadas para a equipe
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white cursor-pointer transition-colors ml-2 shrink-0"
            title="Fechar Pauta"
          >
            <XIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* 2. BARRA DE CONTROLE DINÂMICA: DATA + MÉTRICAS */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-gray-800 flex flex-col gap-3 shrink-0">
        {/* Switcher de Data com Pílulas Elegantes */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="inline-flex rounded-xl bg-slate-200/80 dark:bg-slate-800 p-1 text-xs font-semibold shadow-2xs">
            <button
              type="button"
              onClick={() => setPreviewDateMode('today')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                previewDateMode === 'today'
                  ? 'bg-white dark:bg-emerald-600 text-emerald-800 dark:text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarIcon className="h-3.5 w-3.5 opacity-70" />
              <span>{todayLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewDateMode('tomorrow')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                previewDateMode === 'tomorrow'
                  ? 'bg-white dark:bg-emerald-600 text-emerald-800 dark:text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarIcon className="h-3.5 w-3.5 opacity-70" />
              <span>{tomorrowLabel}</span>
            </button>
          </div>

          {/* Alternador de Visualização (Texto vs Info) */}
          <div className="inline-flex rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-gray-700 p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveView('whatsapp')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                activeView === 'whatsapp'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              Texto WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setActiveView('info')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                activeView === 'info'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              Destaques
            </button>
          </div>
        </div>

        {/* Barra de Progresso Dinâmica em Gradiente */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>Progresso</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                ({previewDateMode === 'today' ? 'Hoje' : 'Amanhã'})
              </span>
            </span>
            <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
              {dailyProgress}% concluído
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, dailyProgress))}%` }}
            />
          </div>
        </div>

        {/* Mini Cards de Estatísticas em Tempo Real */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="p-2 rounded-lg bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 shadow-2xs">
            <span className="block text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Total</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">{tasksCount}</span>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 shadow-2xs">
            <span className="block text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold">Concluídas</span>
            <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200 font-mono">{completedCount}</span>
          </div>
          <div className="p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 shadow-2xs">
            <span className="block text-[10px] text-amber-700 dark:text-amber-400 uppercase font-semibold">Compras</span>
            <span className="text-sm font-bold text-amber-800 dark:text-amber-200 font-mono">{purchasesCount}</span>
          </div>
        </div>
      </div>

      {/* 3. CONTEÚDO PRINCIPAL DINÂMICO */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 bg-[#EFEAE2]/60 dark:bg-[#0D1418]">
        {activeView === 'whatsapp' ? (
          /* Balão de Mensagem Estilo WhatsApp Oficial */
          <div className="bg-white dark:bg-[#1F2C34] border border-slate-200/70 dark:border-gray-700/60 rounded-2xl p-4 shadow-sm text-xs font-mono text-slate-800 dark:text-[#E9EDEF] whitespace-pre-wrap leading-relaxed select-all">
            {formattedWhatsAppText}
          </div>
        ) : (
          /* Aba de Destaques e Dicas de Envio */
          <div className="flex flex-col gap-3">
            <div className="p-4 rounded-xl bg-white dark:bg-[#1F2C34] border border-slate-200/70 dark:border-gray-700/60 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-2">
                <SparklesIcon className="h-4 w-4 text-emerald-600" />
                <span>Sobre a Pauta Automática</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                A pauta é gerada em tempo real com base nas tarefas e listas de compras marcadas para o dia selecionado.
                Ela já inclui emojis organizados, separação por obra, responsáveis e status de cada item.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#1F2C34] border border-slate-200/70 dark:border-gray-700/60 shadow-2xs flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                <ClipboardListIcon className="h-4 w-4 text-indigo-500" />
                <span>Instruções de Uso</span>
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc list-inside">
                <li>Clique em <strong>Enviar no Grupo JPL</strong> para copiar e abrir diretamente o WhatsApp Web/App.</li>
                <li>Use <strong>Apenas Copiar</strong> para colar em uma conversa privada ou e-mail.</li>
                <li>O progresso do dia atualiza automaticamente conforme a equipe avança no canteiro.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* 4. RODAPÉ DE AÇÕES MODERNIZADO */}
      <div className="p-3.5 bg-white dark:bg-[#111827] border-t border-slate-200/80 dark:border-gray-800 flex flex-col gap-2 shrink-0">
        <button
          type="button"
          onClick={handleDirectGroupSend}
          className="w-full h-10 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 active:scale-[0.98] text-white shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          title="Copia a pauta e abre o grupo do WhatsApp da JPL Construtora"
        >
          {isCopiedSuccess ? <CheckCircle2Icon className="h-4 w-4 text-emerald-200 animate-bounce" /> : <SendIcon className="h-4 w-4" />}
          <span>{isCopiedSuccess ? 'Copiado! Abrindo Grupo...' : 'Enviar no Grupo JPL (1 Clique)'}</span>
        </button>

        <button
          type="button"
          onClick={handleCopyWhatsApp}
          className="w-full h-8.5 rounded-xl font-semibold text-xs border border-slate-300 dark:border-gray-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-gray-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          title="Copiar texto da pauta para a área de transferência"
        >
          <CopyIcon className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          <span>{isCopiedSuccess ? 'Texto Copiado com Sucesso!' : 'Apenas Copiar Texto'}</span>
        </button>
      </div>
    </div>
  );
};

export default PautaWhatsAppPanel;
