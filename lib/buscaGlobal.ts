import { BuscaGlobalTipo, BuscaGlobalRow } from '../types';
import { formatCurrency } from './utils';

export type { BuscaGlobalTipo, BuscaGlobalRow };

export interface BuscaGrupo {
  tipo: BuscaGlobalTipo;
  rotulo: string;
  itens: BuscaGlobalRow[];
  total: number;
  soma: number | null;
  maxScore: number;
}

export const ROTULOS_BUSCA: Record<BuscaGlobalTipo, string> = {
  nota: 'Notas fiscais',
  item: 'Itens de notas',
  servico: 'Serviços',
  adiantamento: 'Pagamentos',
  tarefa: 'Tarefas',
  compra: 'Listas de compras',
  fornecedor: 'Fornecedores',
  colaborador: 'Colaboradores',
  obra: 'Obras',
  cartorio: 'Cartório',
  etapa: 'Etapas do orçamento',
  orcamento_item: 'Itens do orçamento',
};

export const TIPOS_COM_SOMA: ReadonlySet<BuscaGlobalTipo> = new Set<BuscaGlobalTipo>([
  'nota',
  'item',
  'servico',
  'adiantamento',
  'cartorio',
  'etapa',
  'orcamento_item',
]);

export const EXEMPLOS_BUSCA = [
  'cimento outubro',
  '1250',
  'joao pagamento',
  '15/10',
] as const;

/**
 * Agrupa os resultados da busca global por tipo, calcula total e soma
 * e ordena os grupos pela maior pontuação (score) do grupo descrescente.
 */
export function agruparResultadosBusca(rows: BuscaGlobalRow[]): BuscaGrupo[] {
  if (!rows || rows.length === 0) return [];

  const map = new Map<
    BuscaGlobalTipo,
    {
      itens: BuscaGlobalRow[];
      total: number;
      soma: number | null;
      maxScore: number;
    }
  >();

  for (const row of rows) {
    let grupo = map.get(row.tipo);
    if (!grupo) {
      grupo = {
        itens: [],
        total: row.total_tipo ?? 0,
        soma: TIPOS_COM_SOMA.has(row.tipo) ? (row.soma_tipo ?? null) : null,
        maxScore: row.score ?? 0,
      };
      map.set(row.tipo, grupo);
    }
    grupo.itens.push(row);
    if ((row.score ?? 0) > grupo.maxScore) {
      grupo.maxScore = row.score ?? 0;
    }
    if (!grupo.total && row.total_tipo) {
      grupo.total = row.total_tipo;
    }
    if (
      grupo.soma === null &&
      TIPOS_COM_SOMA.has(row.tipo) &&
      row.soma_tipo !== null &&
      row.soma_tipo !== undefined
    ) {
      grupo.soma = row.soma_tipo;
    }
  }

  const grupos: BuscaGrupo[] = [];
  for (const [tipo, data] of map.entries()) {
    grupos.push({
      tipo,
      rotulo: ROTULOS_BUSCA[tipo] || tipo,
      itens: data.itens,
      total: Math.max(data.total, data.itens.length),
      soma: data.soma,
      maxScore: data.maxScore,
    });
  }

  // Ordena grupos pela maior pontuação dentro do grupo (descendente)
  grupos.sort((a, b) => b.maxScore - a.maxScore);

  return grupos;
}

/**
 * Extrai e formata o preço unitário e unidade para linhas do tipo "item"
 * a partir do objeto jsonb detalhes.
 */
export function extrairPrecoUnitarioItem(
  detalhes: Record<string, unknown> | null
): string | null {
  if (!detalhes) return null;

  const rawPreco =
    detalhes.preco_unitario ??
    detalhes.unit_price ??
    detalhes.valor_unitario ??
    detalhes.preco;

  const numPreco =
    typeof rawPreco === 'number'
      ? rawPreco
      : typeof rawPreco === 'string'
      ? parseFloat(rawPreco.replace(',', '.'))
      : NaN;

  if (isNaN(numPreco) || numPreco <= 0) return null;

  const rawUnidade =
    detalhes.unidade ??
    detalhes.unidade_medida ??
    detalhes.unit_of_measure ??
    detalhes.medida;

  const unidadeStr =
    typeof rawUnidade === 'string' && rawUnidade.trim().length > 0
      ? rawUnidade.trim()
      : 'un';

  return `${formatCurrency(numPreco)}/${unidadeStr}`;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Mapeia cada caractere para uma expressão que casa variações com e sem acento.
 */
function makeAccentInsensitiveChar(ch: string): string {
  const map: Record<string, string> = {
    a: '[aáàãâä]',
    e: '[eéèêë]',
    i: '[iíìîï]',
    o: '[oóòõôö]',
    u: '[uúùûü]',
    c: '[cç]',
  };
  const lower = ch.toLowerCase();
  return map[lower] || escapeRegex(ch);
}

export interface HighlightSegment {
  text: string;
  match: boolean;
}

/**
 * Divide o texto do título em partes destacando as palavras da busca.
 * Comparação insensível a maiúsculas/minúsculas e acentos, preservando
 * a pontuação e os caracteres originais do título.
 */
export function highlightMatches(
  text: string,
  query: string
): HighlightSegment[] {
  if (!text) return [];
  if (!query || !query.trim()) {
    return [{ text, match: false }];
  }

  // Extrai palavras com ao menos 1 caractere alfanumérico
  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) {
    return [{ text, match: false }];
  }

  const patterns = words.map((w) =>
    w.split('').map(makeAccentInsensitiveChar).join('')
  );

  const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
  const result: HighlightSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;

    if (matchStart > lastIndex) {
      result.push({
        text: text.slice(lastIndex, matchStart),
        match: false,
      });
    }

    if (matchEnd > matchStart) {
      result.push({
        text: text.slice(matchStart, matchEnd),
        match: true,
      });
    }

    lastIndex = matchEnd;

    // Evita loop infinito se casar string vazia
    if (regex.lastIndex === match.index) {
      regex.lastIndex++;
    }
  }

  if (lastIndex < text.length) {
    result.push({
      text: text.slice(lastIndex),
      match: false,
    });
  }

  return result.length > 0 ? result : [{ text, match: false }];
}

// -------------------------------------------------------------
// HISTÓRICO DE BUSCAS RECENTES (localStorage por usuário)
// -------------------------------------------------------------

const RECENTES_KEY_PREFIX = 'jpl-busca-recentes:';
const MAX_RECENTES = 8;

export function getRecentSearches(userId?: string | null): string[] {
  if (!userId || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${RECENTES_KEY_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((t) => typeof t === 'string' && t.trim().length > 0)
        .slice(0, MAX_RECENTES);
    }
    return [];
  } catch {
    return [];
  }
}

export function addRecentSearch(
  userId: string | null | undefined,
  term: string
): void {
  if (!userId || typeof localStorage === 'undefined') return;
  const clean = term.trim();
  if (clean.length < 2) return;
  try {
    const current = getRecentSearches(userId);
    const filtered = current.filter(
      (t) => t.toLowerCase() !== clean.toLowerCase()
    );
    const updated = [clean, ...filtered].slice(0, MAX_RECENTES);
    localStorage.setItem(
      `${RECENTES_KEY_PREFIX}${userId}`,
      JSON.stringify(updated)
    );
  } catch {
    // Falhas de cota ou navegação privada silenciosas
  }
}

export function removeRecentSearch(
  userId: string | null | undefined,
  term: string
): void {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    const current = getRecentSearches(userId);
    const updated = current.filter(
      (t) => t.toLowerCase() !== term.toLowerCase()
    );
    localStorage.setItem(
      `${RECENTES_KEY_PREFIX}${userId}`,
      JSON.stringify(updated)
    );
  } catch {
    // Silencioso
  }
}

export function clearRecentSearches(userId: string | null | undefined): void {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(`${RECENTES_KEY_PREFIX}${userId}`);
  } catch {
    // Silencioso
  }
}
