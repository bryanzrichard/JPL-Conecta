import type { ChatMessage } from './copilotExecutor';
import { ConsultaResultado, descreverConsulta } from './copilotConsultas';
import { formatCurrency } from './utils';

export const STORAGE_WARNING_MESSAGE = 'Não foi possível salvar o histórico neste navegador.';

let hasShownStorageWarning = false;

export interface CopilotActivityItem {
  tipo: string;
  badge: string;
  titulo: string;
  subtitulo: string;
  detalhes?: string;
  sucesso: boolean;
  messageTimestamp?: string;
  messageId?: string;
}

/**
 * Constrói a lista unificada de atividades recentes (ações gravadas + consultas)
 * ordenadas da mais recente para a mais antiga.
 */
export function buildRecentActivities(chatMessages: ChatMessage[]): CopilotActivityItem[] {
  const list: CopilotActivityItem[] = [];
  chatMessages.forEach((msg) => {
    // 1. Ações gravadas (cards pós-execução)
    if (msg.cards && msg.cards.length > 0) {
      msg.cards.forEach((card) => {
        list.push({
          ...card,
          messageTimestamp: formatMessageTimestamp(msg.createdAt, msg.timestamp),
          messageId: msg.id,
        });
      });
    }

    // 2. Consultas apuradas
    if (msg.consultas && msg.consultas.length > 0) {
      msg.consultas.forEach((c) => {
        const resumo = formatResumoConsulta(c);
        const hora = c.executadoEm
          ? formatMessageTimestamp(c.executadoEm)
          : formatMessageTimestamp(msg.createdAt, msg.timestamp);

        list.push({
          tipo: 'consulta',
          badge: 'Consulta',
          titulo: descreverConsulta(c.pedido, c.obraNome),
          subtitulo: resumo,
          sucesso: !c.erro,
          messageTimestamp: hora,
          messageId: msg.id,
        });
      });
    }
  });
  return list.reverse();
}

export function resetStorageWarningFlagForTest(): void {
  hasShownStorageWarning = false;
}

export function notifyStorageWarning(onWarning?: (msg: string) => void): void {
  if (hasShownStorageWarning) return;
  hasShownStorageWarning = true;
  if (onWarning) {
    onWarning(STORAGE_WARNING_MESSAGE);
  }
}

/**
 * Gera a chave única por empresa e usuário para isolamento no mesmo navegador.
 * Formato: jpl-copiloto:v1:<company_id>:<user_id>
 */
export function getCopilotStorageKey(companyId: string, userId: string): string {
  return `jpl-copiloto:v1:${companyId}:${userId}`;
}

/**
 * Formata o horário da mensagem:
 * - Se for de hoje: apenas a hora ("14:32")
 * - Se for de outro dia: data e hora ("24/10, 14:32")
 */
export function formatMessageTimestamp(createdAt?: string, fallback?: string): string {
  if (!createdAt) return fallback || '';
  const date = new Date(createdAt);
  if (isNaN(date.getTime())) return fallback || '';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const timeStr = `${hh}:${mm}`;

  if (isToday) {
    return timeStr;
  }

  const dd = String(date.getDate()).padStart(2, '0');
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mo}, ${timeStr}`;
}

/**
 * Formata o rodapé da consulta:
 * - Se hoje: "Valores de 20h15"
 * - Se outro dia: "Valores de 26/10, 20h15"
 */
export function formatHoraConsulta(isoString?: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const timeStr = `${hh}h${mm}`;

  if (isToday) {
    return `Valores de ${timeStr}`;
  }

  const dd = String(date.getDate()).padStart(2, '0');
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  return `Valores de ${dd}/${mo}, ${timeStr}`;
}

/**
 * Resumo do resultado da consulta para o painel de atividades:
 * Ex: "Total R$ 4.900,00", "3 notas, R$ 1.950,00", "Nenhum lançamento" ou mensagem de erro.
 */
export function formatResumoConsulta(resultado: ConsultaResultado): string {
  if (resultado.erro) {
    return resultado.erro;
  }

  if (resultado.pedido.tipo === 'LISTAR_NOTAS') {
    const totalNotas = resultado.notas ? resultado.notas.length : 0;
    if (totalNotas === 0) {
      return 'Nenhum lançamento';
    }
    return `${totalNotas} ${totalNotas === 1 ? 'nota' : 'notas'}, ${formatCurrency(resultado.total)}`;
  }

  // Tipo GASTOS
  const hasLinhas = Boolean(resultado.linhas && resultado.linhas.length > 0);
  if (!hasLinhas && (!resultado.total || resultado.total === 0)) {
    return 'Nenhum lançamento';
  }
  return `Total ${formatCurrency(resultado.total)}`;
}

/**
 * Remove estados temporários antes de persistir no localStorage:
 * - consultando: false
 * - remove carregando de cada consulta
 * - garante createdAt em ISO
 */
export function sanitizeMessageForStorage(msg: ChatMessage): ChatMessage {
  const { consultando: _unusedConsultando, ...rest } = msg;

  const sanitizedConsultas = rest.consultas?.map((c) => {
    const { carregando: _unusedCarregando, ...cRest } = c;
    return {
      ...cRest,
      carregando: false,
    };
  });

  return {
    ...rest,
    createdAt: msg.createdAt || new Date().toISOString(),
    consultando: false,
    ...(sanitizedConsultas ? { consultas: sanitizedConsultas } : {}),
  };
}

function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name || '';
  const code = (err as { code?: number }).code;
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  );
}

/**
 * Carrega o histórico de mensagens do localStorage para a empresa e usuário informados.
 * Se corrompido ou bloqueado, retorna array vazio e dispara notificação uma única vez.
 */
export function loadCopilotHistory(
  companyId: string,
  userId: string,
  onWarning?: (msg: string) => void
): ChatMessage[] {
  if (!companyId || !userId) return [];

  try {
    const key = getCopilotStorageKey(companyId, userId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('Conteúdo inválido');
    }

    return (parsed as ChatMessage[]).map((msg) => ({
      ...msg,
      consultando: false,
      timestamp: formatMessageTimestamp(msg.createdAt, msg.timestamp),
    }));
  } catch (err: unknown) {
    console.warn('Falha ao carregar histórico do Copiloto:', err);
    notifyStorageWarning(onWarning);
    return [];
  }
}

/**
 * Salva até 100 mensagens no localStorage. Se a cota estourar,
 * descarta mensagens antigas até conseguir salvar.
 */
export function saveCopilotHistory(
  companyId: string,
  userId: string,
  messages: ChatMessage[],
  onWarning?: (msg: string) => void
): boolean {
  if (!companyId || !userId) return false;

  const key = getCopilotStorageKey(companyId, userId);
  let msgsToSave = messages.slice(-100).map(sanitizeMessageForStorage);

  while (msgsToSave.length > 0) {
    try {
      localStorage.setItem(key, JSON.stringify(msgsToSave));
      return true;
    } catch (err: unknown) {
      if (isQuotaExceededError(err) && msgsToSave.length > 1) {
        // Remove 10% das mensagens mais antigas (mínimo 1) e tenta novamente
        const toRemove = Math.max(1, Math.ceil(msgsToSave.length * 0.1));
        msgsToSave = msgsToSave.slice(toRemove);
      } else {
        console.warn('Erro ao salvar histórico do Copiloto no localStorage:', err);
        notifyStorageWarning(onWarning);
        return false;
      }
    }
  }

  // Se esvaziou a lista e ainda não conseguiu salvar
  try {
    localStorage.removeItem(key);
  } catch (_) {}
  return false;
}

/**
 * Limpa a conversa do usuário do localStorage.
 */
export function clearCopilotHistory(companyId: string, userId: string): void {
  if (!companyId || !userId) return;
  try {
    const key = getCopilotStorageKey(companyId, userId);
    localStorage.removeItem(key);
  } catch (err: unknown) {
    console.warn('Falha ao remover histórico do Copiloto:', err);
  }
}
