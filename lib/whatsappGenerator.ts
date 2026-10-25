export const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/L6enTk86iVxJgYUm7iiefX';

export interface TaskForWhatsApp {
  id: string;
  title: string;
  status: string;
  project_id?: string;
  projectName?: string;
  collaboratorName?: string;
  data_fim_prevista?: string | null;
  isPurchase?: boolean;
}

export function formatDayOfWeek(date: Date): string {
  const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return days[date.getDay()];
}

export function formatDateBRShort(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

/**
 * Gera a mensagem formatada para WhatsApp agrupada por Obra
 */
export function generateWhatsAppSchedule({
  tasks,
  targetDate,
  isTomorrow = false,
  specificProjectName,
}: {
  tasks: TaskForWhatsApp[];
  targetDate: Date;
  isTomorrow?: boolean;
  specificProjectName?: string;
}): string {
  const dateStr = formatDateBRShort(targetDate);
  const dayOfWeek = formatDayOfWeek(targetDate);
  const prefix = isTomorrow ? 'PROGRAMAÇÃO DE AMANHÃ' : 'PROGRAMAÇÃO DO DIA';

  const lines: string[] = [];
  lines.push(`📋 *${prefix} — ${dateStr} (${dayOfWeek})*`);
  lines.push(`*JPL Construtora*`);
  lines.push(``);

  if (tasks.length === 0) {
    if (specificProjectName) {
      lines.push(`🏗️ *${specificProjectName}*`);
    }
    lines.push(`_Nenhuma pendência prioritária registrada para esta data._`);
    lines.push(``);
    lines.push(`_Enviado via JPL Conecta ⚡_`);
    return lines.join('\n');
  }

  // Agrupar tarefas por obra
  const grouped = new Map<string, TaskForWhatsApp[]>();
  tasks.forEach((t) => {
    const pName = t.projectName || 'Geral / Escritório';
    const list = grouped.get(pName) || [];
    list.push(t);
    grouped.set(pName, list);
  });

  grouped.forEach((projectTasks, pName) => {
    lines.push(`🏗️ *${pName}*`);
    projectTasks.forEach((t) => {
      const isDone = t.status === 'Concluída';
      const checkMark = isDone ? '✅' : '⬜';
      const purchaseTag = t.isPurchase ? '🛒 ' : '';
      const resp = t.collaboratorName ? ` (Resp: ${t.collaboratorName})` : '';
      lines.push(`• ${checkMark} ${purchaseTag}${t.title}${resp}`);
    });
    lines.push(``);
  });

  lines.push(`_Enviado via JPL Conecta ⚡_`);
  return lines.join('\n');
}

/**
 * Copiar texto para o clipboard com fallback
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch (err) {
    console.error('Falha ao copiar:', err);
    return false;
  }
}

/**
 * Abrir WhatsApp Web com texto pré-carregado
 */
export function openWhatsAppWebWithText(text: string) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Abrir link direto do Grupo do WhatsApp
 */
export function openOfficialGroupLink() {
  window.open(WHATSAPP_GROUP_URL, '_blank', 'noopener,noreferrer');
}
