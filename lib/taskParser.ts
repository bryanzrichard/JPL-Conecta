import { Project, Collaborator } from '../types';

export interface ParsedTaskResult {
  raw: string;
  title: string;
  project_id: string | null;
  projectName?: string;
  responsavel_execucao_id: string | null;
  collaboratorName?: string;
  data_fim_prevista: string; // YYYY-MM-DD
  isTomorrow: boolean;
  isToday: boolean;
  isPurchase: boolean;
  detectedObraLabel?: string;
  detectedCollabLabel?: string;
  detectedDateLabel?: string;
}

// Remove acentos para comparação insensível
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Palavras-chave associadas a Compras / Almoxarifado
const PURCHASE_KEYWORDS = [
  'comprar', 'compra', 'cotar', 'cotacao', 'pedir', 'material', 'materiais',
  'cimento', 'tabua', 'tabuas', 'areia', 'ferro', 'prego', 'pregos',
  'disco', 'tijolo', 'tijolos', 'fio', 'argamassa', 'tinta', 'cano',
  'tubo', 'tubos', 'arame', 'brita', 'concreto', 'bloco', 'blocos',
  'fechadura', 'torneira', 'registro', 'caixa', 'caixaria', 'compensado'
];

/**
 * Converte data para string YYYY-MM-DD
 */
export function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retorna a próxima data correspondente ao dia da semana (0=Dom, 1=Seg, ..., 6=Sáb)
 */
function getNextDayOfWeek(targetDay: number): Date {
  const today = new Date();
  const currentDay = today.getDay();
  let diff = targetDay - currentDay;
  if (diff <= 0) {
    diff += 7; // Próxima semana
  }
  const next = new Date(today);
  next.setDate(today.getDate() + diff);
  return next;
}

/**
 * Analisador inteligente de linguagem natural para canteiro de obras
 */
export function parseQuickTask(
  text: string,
  projects: Project[],
  collaborators: Collaborator[],
  fallbackProjectId?: string | null
): ParsedTaskResult {
  const trimmed = text.trim();
  const normalizedText = normalize(trimmed);

  // 1. Detectar Intenção de Compra
  const isPurchase = PURCHASE_KEYWORDS.some((kw) => {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return regex.test(normalizedText);
  });

  // 2. Detectar Data / Prazo
  let targetDate = new Date();
  let isToday = false;
  let isTomorrow = false;
  let detectedDateLabel: string | undefined = undefined;

  // 2.1 Verifica padrões explícitos como "dia 30", "dia 30/10" ou "30/10"
  const explicitDayMonthMatch = normalizedText.match(/\b(?:no\s+dia|dia|para\s+o\s+dia)\s+(\d{1,2})(?:\/(\d{1,2}))?\b/i) ||
                                normalizedText.match(/\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/);

  if (explicitDayMonthMatch) {
    const day = parseInt(explicitDayMonthMatch[1], 10);
    const month = explicitDayMonthMatch[2] ? parseInt(explicitDayMonthMatch[2], 10) - 1 : targetDate.getMonth();
    
    if (day >= 1 && day <= 31) {
      const year = targetDate.getFullYear();
      const candidateDate = new Date(year, month, day);
      
      // Se não passou mês e o dia já passou no mês corrente, joga para o próximo mês
      if (!explicitDayMonthMatch[2] && candidateDate < new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())) {
        candidateDate.setMonth(candidateDate.getMonth() + 1);
      }

      targetDate = candidateDate;
      const todayOnly = new Date();
      todayOnly.setHours(0, 0, 0, 0);
      const targetOnly = new Date(targetDate);
      targetOnly.setHours(0, 0, 0, 0);
      const diffDays = Math.round((targetOnly.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        isToday = true;
        detectedDateLabel = 'Hoje';
      } else if (diffDays === 1) {
        isTomorrow = true;
        detectedDateLabel = 'Amanhã';
      } else {
        const dayStr = String(targetDate.getDate()).padStart(2, '0');
        const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
        detectedDateLabel = `${dayStr}/${monthStr}`;
      }
    }
  } else if (/\b(amanha|amanhã)\b/i.test(normalizedText)) {
    targetDate.setDate(targetDate.getDate() + 1);
    isTomorrow = true;
    detectedDateLabel = 'Amanhã';
  } else if (/\b(depois de amanha|depois de amanhã)\b/i.test(normalizedText)) {
    targetDate.setDate(targetDate.getDate() + 2);
    detectedDateLabel = '+2 dias';
  } else if (/\b(hoje)\b/i.test(normalizedText)) {
    isToday = true;
    detectedDateLabel = 'Hoje';
  } else if (/\b(segunda|segunda-feira)\b/i.test(normalizedText)) {
    targetDate = getNextDayOfWeek(1);
    detectedDateLabel = 'Segunda-feira';
  } else if (/\b(terca|terça|terca-feira|terça-feira)\b/i.test(normalizedText)) {
    targetDate = getNextDayOfWeek(2);
    detectedDateLabel = 'Terça-feira';
  } else if (/\b(quarta|quarta-feira)\b/i.test(normalizedText)) {
    targetDate = getNextDayOfWeek(3);
    detectedDateLabel = 'Quarta-feira';
  } else if (/\b(quinta|quinta-feira)\b/i.test(normalizedText)) {
    targetDate = getNextDayOfWeek(4);
    detectedDateLabel = 'Quinta-feira';
  } else if (/\b(sexta|sexta-feira)\b/i.test(normalizedText)) {
    targetDate = getNextDayOfWeek(5);
    detectedDateLabel = 'Sexta-feira';
  } else if (/\b(sabado|sábado)\b/i.test(normalizedText)) {
    targetDate = getNextDayOfWeek(6);
    detectedDateLabel = 'Sábado';
  } else if (/\b(domingo)\b/i.test(normalizedText)) {
    targetDate = getNextDayOfWeek(0);
    detectedDateLabel = 'Domingo';
  } else {
    // Padrão: Hoje
    isToday = true;
    detectedDateLabel = 'Hoje';
  }

  const data_fim_prevista = toISODate(targetDate);

  // 3. Detectar Obra
  let matchedProjectId: string | null = fallbackProjectId || (projects[0]?.id ?? null);
  let matchedProjectName: string | undefined = projects.find(p => p.id === matchedProjectId)?.name;
  let detectedObraLabel: string | undefined = undefined;

  for (const proj of projects) {
    const projNorm = normalize(proj.name);
    // Extrai palavras significativas da obra (ignora palavras pequenas como de, da, do, ix, lote)
    const words = projNorm.split(/\s+/).filter(w => w.length > 2);
    const matchesAllWords = words.length > 0 && words.every(w => normalizedText.includes(w));
    const matchesFullName = normalizedText.includes(projNorm);

    if (matchesFullName || matchesAllWords) {
      matchedProjectId = proj.id;
      matchedProjectName = proj.name;
      detectedObraLabel = proj.name;
      break;
    }
  }

  // 4. Detectar Colaborador / Responsável
  let matchedCollabId: string | null = null;
  let matchedCollabName: string | undefined = undefined;
  let detectedCollabLabel: string | undefined = undefined;

  for (const collab of collaborators) {
    const collabNorm = normalize(collab.name);
    const firstName = collabNorm.split(/\s+/)[0];

    // Se o texto contiver o primeiro nome (com pelo menos 3 letras) ou o nome completo
    if (firstName.length >= 3) {
      const regex = new RegExp(`\\b${firstName}\\b`, 'i');
      if (regex.test(normalizedText)) {
        matchedCollabId = collab.id;
        matchedCollabName = collab.name;
        detectedCollabLabel = collab.name;
        break;
      }
    }
  }

  // 5. Limpeza de Título
  // Remove preposições comuns no início se houver
  let cleanedTitle = trimmed;
  // Se começou com "Lázaro: " ou "Alvaro - ", etc.
  cleanedTitle = cleanedTitle.replace(/^[^:]+:\s*/, '');
  // Capitaliza primeira letra
  if (cleanedTitle.length > 0) {
    cleanedTitle = cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1);
  } else {
    cleanedTitle = trimmed;
  }

  return {
    raw: trimmed,
    title: cleanedTitle || trimmed,
    project_id: matchedProjectId,
    projectName: matchedProjectName,
    responsavel_execucao_id: matchedCollabId,
    collaboratorName: matchedCollabName,
    data_fim_prevista,
    isTomorrow,
    isToday,
    isPurchase,
    detectedObraLabel,
    detectedCollabLabel,
    detectedDateLabel,
  };
}

/**
 * Hook ou Helper para Web Speech API nativa
 */
export function checkSpeechRecognitionSupport(): boolean {
  return typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
}
