import React, { useRef, useEffect } from 'react';
import {
  ChatMessage,
  ResolvedCopilotAction,
} from '../../lib/copilotExecutor';
import { CopilotReviewCard } from './CopilotReviewCard';
import { useMediaQuery } from '../../hooks/use-media-query';
import {
  BotIcon,
  MicIcon,
  MicOffIcon,
  SendIcon,
  SparklesIcon,
  UserIcon,
  ConstructionIcon,
  ShoppingBagIcon,
  ClipboardListIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '../../lib/icons';

interface CopilotPanelProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  chatMessages: ChatMessage[];
  chatInputText: string;
  onChatInputChange: (val: string) => void;
  onSendTextMessage: (text?: string) => void;
  isProcessingAudioIA: boolean;
  isRecordingAudio: boolean;
  recordingSeconds: number;
  onStartAudioRecording: () => void;
  onStopAudioRecording: () => void;
  onCancelAudioRecording: () => void;
  onConfirmActions: (messageId: string, acoes: ResolvedCopilotAction[]) => void;
  onCancelActions: (messageId: string) => void;
}

export const CopilotPanel: React.FC<CopilotPanelProps> = ({
  isExpanded,
  onToggleExpanded,
  chatMessages,
  chatInputText,
  onChatInputChange,
  onSendTextMessage,
  isProcessingAudioIA,
  isRecordingAudio,
  recordingSeconds,
  onStartAudioRecording,
  onStopAudioRecording,
  onCancelAudioRecording,
  onConfirmActions,
  onCancelActions,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Contagem de ações aguardando revisão
  const pendingCount = chatMessages.reduce((sum, msg) => {
    if (msg.review && msg.review.status === 'pending') {
      return sum + (msg.review.items?.length || msg.review.acoes?.length || 1);
    }
    return sum;
  }, 0);

  const pendingLabel = pendingCount === 1
    ? '1 ação aguardando confirmação'
    : `${pendingCount} ações aguardando confirmação`;

  // Altura automática de 3 linhas até 10 linhas
  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minHeight = 72; // ~3 linhas
    const maxHeight = 220; // ~10 linhas
    const target = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${target}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [chatInputText]);

  // Ao abrir, foco automático no campo de texto
  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
        adjustTextareaHeight();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  // Scroll suave ao receber novas mensagens
  useEffect(() => {
    if (isExpanded && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isProcessingAudioIA, isExpanded]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (isDesktop && !e.shiftKey) {
        e.preventDefault();
        if (chatInputText.trim() && !isProcessingAudioIA && !isRecordingAudio) {
          onSendTextMessage();
        }
      }
      // No mobile ou Shift+Enter no desktop, permite a quebra de linha nativa
    }
  };

  // -------------------------------------------------------------
  // TAREFA 1: Minimizado vira barra compacta de 1 linha
  // -------------------------------------------------------------
  if (!isExpanded) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpanded();
          }
        }}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white rounded-2xl shadow-xs cursor-pointer select-none hover:opacity-95 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        aria-label="Abrir Copiloto JPL"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
            <BotIcon className="h-4 w-4" />
          </div>
          <span className="font-bold text-xs sm:text-sm tracking-tight shrink-0">Copiloto JPL</span>
          <span className="text-white/60 text-xs hidden sm:inline">•</span>
          <span className="text-xs text-white/85 truncate">Toque para conversar</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[11px] font-bold shadow-xs animate-pulse">
              <span>⚠️</span>
              <span>{pendingLabel}</span>
            </span>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors flex items-center gap-1">
            <span>Abrir Chat</span>
            <ChevronDownIcon className="h-3 w-3" />
          </span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Aberto: Chat Completo com Botão Minimizar e Textarea
  // -------------------------------------------------------------
  return (
    <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
      {/* Topo do Chat */}
      <div className="p-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0">
            <BotIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold tracking-tight truncate">
                Copiloto JPL — Assistente de Canteiro
              </h3>
              <span className="hidden xs:flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400/30 text-emerald-100 text-[10px] font-semibold border border-emerald-300/30 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                Gemini Flash Ativo
              </span>
            </div>
            <p className="text-[11px] text-emerald-100/90 hidden sm:block truncate">
              Fale ou digite como no WhatsApp: crie serviços com adiantamento, baixe tarefas ou cadastre pessoas
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleExpanded}
          className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 shrink-0 ml-2"
          aria-label="Minimizar Copiloto"
        >
          <span>Minimizar</span>
          <ChevronUpIcon className="h-3 w-3" />
        </button>
      </div>

      <div className="flex flex-col">
        {/* Histórico de Mensagens */}
        <div className="p-3.5 bg-[#EFEAE2]/60 dark:bg-[#0D1418] max-h-[320px] min-h-[120px] overflow-y-auto custom-scrollbar space-y-3">
          {chatMessages.length === 0 && !isProcessingAudioIA && !isRecordingAudio && (
            <div className="py-6 text-center text-xs text-slate-400 dark:text-gray-500">
              Envie uma mensagem ou áudio para o Copiloto...
            </div>
          )}

          {chatMessages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in-50`}
              >
                <div
                  className={`max-w-[88%] sm:max-w-[78%] rounded-2xl p-3 shadow-xs text-xs leading-relaxed ${
                    isUser
                      ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-slate-800 dark:text-[#E9EDEF] rounded-tr-xs border border-emerald-300/40 dark:border-emerald-600/30'
                      : 'bg-white dark:bg-[#1F2C34] text-slate-800 dark:text-[#E9EDEF] rounded-tl-xs border border-slate-200/80 dark:border-gray-700/60'
                  }`}
                >
                  <p className="whitespace-pre-wrap font-sans">{msg.text}</p>

                  {msg.review && (
                    <CopilotReviewCard
                      review={msg.review}
                      onConfirm={() => onConfirmActions(msg.id, msg.review!.acoes)}
                      onCancel={() => onCancelActions(msg.id)}
                      isExecuting={isProcessingAudioIA}
                    />
                  )}

                  {msg.cards && msg.cards.length > 0 && (
                    <div className="mt-2.5 space-y-2 pt-2 border-t border-slate-100 dark:border-gray-700/60">
                      {msg.cards.map((card, idx) => (
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
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {isProcessingAudioIA && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-[#1F2C34] border border-slate-200/80 dark:border-gray-700/60 max-w-[240px] text-xs text-slate-600 dark:text-gray-300 animate-pulse shadow-2xs">
              <SparklesIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 animate-spin" />
              <span className="font-semibold text-[11px]">Gemini Flash processando...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Barra de Gravação de Áudio */}
        {isRecordingAudio && (
          <div className="px-3.5 py-2.5 bg-rose-500/10 border-t border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
              </span>
              <div>
                <span className="font-bold text-xs">
                  Gravando Áudio ({String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')})
                </span>
                <p className="text-[10px] text-slate-500 dark:text-gray-400">
                  Fale o comando completo com calma e clique em Enviar
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancelAudioRecording}
                className="px-2 py-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white text-xs cursor-pointer"
              >
                Cancelar ❌
              </button>
              <button
                type="button"
                onClick={onStopAudioRecording}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs flex items-center gap-1.5 transition-all"
              >
                <span>Concluir e Enviar ✨</span>
              </button>
            </div>
          </div>
        )}

        {/* TAREFA 2: Textarea com auto-resize (3 a 10 linhas) e quebra de linha */}
        <div className="p-2.5 bg-slate-50 dark:bg-[#111827] border-t border-slate-200/80 dark:border-gray-800 flex items-end gap-2">
          <button
            type="button"
            onClick={isRecordingAudio ? onStopAudioRecording : onStartAudioRecording}
            className={`p-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 mb-0.5 ${
              isRecordingAudio
                ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/40 ring-2 ring-rose-300'
                : 'text-slate-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-gray-700 hover:border-emerald-500'
            }`}
            title={isRecordingAudio ? 'Clique para concluir gravação' : 'Gravar áudio com IA Gemini Flash'}
          >
            {isRecordingAudio ? <MicOffIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
          </button>

          <textarea
            ref={textareaRef}
            rows={3}
            value={chatInputText}
            onChange={(e) => onChatInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessingAudioIA || isRecordingAudio}
            placeholder={
              isDesktop
                ? 'Digite seu comando... (Enter envia, Shift+Enter pula linha)'
                : 'Digite seu comando... (Enter pula linha)'
            }
            className="flex-1 py-2 px-3 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all disabled:opacity-50 resize-none font-sans leading-relaxed"
          />

          <button
            type="button"
            onClick={() => onSendTextMessage()}
            disabled={!chatInputText.trim() || isProcessingAudioIA || isRecordingAudio}
            className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-xs mb-0.5"
            title="Enviar comando para o Copiloto IA"
          >
            <SendIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CopilotPanel;
