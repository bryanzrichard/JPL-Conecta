import { Task, TaskPriority, TaskStatus } from '../../types';

export type EnrichedTask = Task & {
  projectName: string;
  collaboratorName: string | null;
  isPurchase: boolean;
  isCompleted: boolean;
  isDelayed: boolean;
  isTodayTask: boolean;
  isTomorrowTask: boolean;
  isUpcomingTask: boolean;
  daysDiff: number | null;
};

export type TarefasFilters = {
  project_id: string | null;
  responsavel_id: string | null;
  prioridade: TaskPriority | 'all';
  start_date: string | null;
  end_date: string | null;
};

export type NamedItem = { nome: string };

export function parseNamedItems(raw: unknown): NamedItem[] {
  if (!Array.isArray(raw)) return [];
  const list: NamedItem[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      list.push({ nome: item.trim() });
    } else if (item && typeof item === 'object' && 'nome' in item) {
      const val = (item as { nome?: unknown }).nome;
      if (typeof val === 'string' && val.trim()) {
        list.push({ nome: val.trim() });
      }
    }
  }
  return list;
}
