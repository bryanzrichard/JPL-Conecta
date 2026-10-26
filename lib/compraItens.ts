export type CompraItem = {
  nome: string;
  quantidade: number | null;
  unidade: string | null;
  comprado: boolean;
};

export const UNIDADES_CONHECIDAS: readonly string[] = [
  'saco',
  'kg',
  'g',
  'm',
  'm²',
  'm³',
  'barra',
  'lata',
  'galão',
  'litro',
  'caixa',
  'rolo',
  'peça',
  'unidade',
  'milheiro',
  'tonelada',
] as const;

const UNIDADES_MAP: Record<string, string> = {
  saco: 'saco',
  sacos: 'saco',
  kg: 'kg',
  quilo: 'kg',
  quilos: 'kg',
  g: 'g',
  grama: 'g',
  gramas: 'g',
  m: 'm',
  metro: 'm',
  metros: 'm',
  m2: 'm²',
  'm²': 'm²',
  m3: 'm³',
  'm³': 'm³',
  barra: 'barra',
  barras: 'barra',
  lata: 'lata',
  latas: 'lata',
  galao: 'galão',
  galão: 'galão',
  galoes: 'galão',
  galões: 'galão',
  l: 'litro',
  litro: 'litro',
  litros: 'litro',
  caixa: 'caixa',
  caixas: 'caixa',
  cx: 'caixa',
  cxs: 'caixa',
  rolo: 'rolo',
  rolos: 'rolo',
  pc: 'peça',
  pç: 'peça',
  peca: 'peça',
  pecas: 'peça',
  peça: 'peça',
  peças: 'peça',
  un: 'unidade',
  und: 'unidade',
  unid: 'unidade',
  unidade: 'unidade',
  unidades: 'unidade',
  milheiro: 'milheiro',
  milheiros: 'milheiro',
  t: 'tonelada',
  ton: 'tonelada',
  tonelada: 'tonelada',
  toneladas: 'tonelada',
};

/**
 * Formata número no padrão brasileiro sem zeros decimais desnecessários (1,5 ou 10)
 */
export function formatQuantidadeBR(qty: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(qty);
}

/**
 * Converte string brasileira (ex: "1,5") ou float em número válido ou null
 */
export function parseQuantidadeBR(val: unknown): number | null {
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  if (typeof val === 'string') {
    const cleaned = val.trim().replace(/\./g, '').replace(',', '.');
    if (!cleaned) return null;
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Parse seguro do campo materiais_previstos, aceitando formatos legados e o novo
 */
export function parseCompraItens(raw: unknown): CompraItem[] {
  if (!Array.isArray(raw)) return [];
  const list: CompraItem[] = [];

  for (const item of raw) {
    if (typeof item === 'string') {
      const nome = item.trim();
      if (nome) {
        list.push({
          nome,
          quantidade: null,
          unidade: null,
          comprado: false,
        });
      }
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const rawNome = typeof obj.nome === 'string' ? obj.nome.trim() : '';
      if (rawNome) {
        const quantidade = typeof obj.quantidade === 'number' && !isNaN(obj.quantidade)
          ? obj.quantidade
          : parseQuantidadeBR(obj.quantidade);

        const unidade = typeof obj.unidade === 'string' && obj.unidade.trim()
          ? obj.unidade.trim()
          : null;

        const comprado = typeof obj.comprado === 'boolean' ? obj.comprado : false;

        list.push({
          nome: rawNome,
          quantidade,
          unidade,
          comprado,
        });
      }
    }
  }

  return list;
}

/**
 * Formata um item para exibição visual.
 * Exemplos: "10 saco · Cimento", "1 kg · Prego 17x21", "Areia"
 */
export function formatCompraItem(item: CompraItem): string {
  if (item.quantidade !== null) {
    const qtyStr = formatQuantidadeBR(item.quantidade);
    if (item.unidade) {
      return `${qtyStr} ${item.unidade} · ${item.nome}`;
    }
    return `${qtyStr} · ${item.nome}`;
  }
  return item.nome;
}

/**
 * Formata item sem o caractere separador "·", ideal para pauta e listas de texto.
 * Exemplo: "10 saco Cimento"
 */
export function formatCompraItemTexto(item: CompraItem): string {
  if (item.quantidade !== null) {
    const qtyStr = formatQuantidadeBR(item.quantidade);
    if (item.unidade) {
      return `${qtyStr} ${item.unidade} ${item.nome}`;
    }
    return `${qtyStr} ${item.nome}`;
  }
  return item.nome;
}

/**
 * Transforma uma linha ou texto colado em itens estruturados de compra
 */
export function parseListaColada(texto: string): CompraItem[] {
  if (!texto || !texto.trim()) return [];

  let rawLines: string[];
  if (texto.includes('\n')) {
    rawLines = texto.split(/\r?\n/);
  } else {
    // Quando houver uma única linha, separa por vírgula (que não seja decimal) ou ponto e vírgula
    rawLines = texto.split(/(?<!\d),(?!\d)|;/);
  }

  const results: CompraItem[] = [];

  for (const rawLine of rawLines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Remover marcadores de lista comuns no início: "- ", "* ", "• "
    line = line.replace(/^[-*•]\s*/, '').trim();
    if (!line) continue;

    let quantidade: number | null = null;
    let unidade: string | null = null;
    let restOfLine = line;

    // Verificar se começa com número (ex: 10, 1.5, 1,5)
    const numMatch = restOfLine.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(.*)$/);
    if (numMatch) {
      const numStr = numMatch[1].replace(',', '.');
      const parsedNum = parseFloat(numStr);
      if (!isNaN(parsedNum)) {
        quantidade = parsedNum;
        restOfLine = numMatch[2].trim();
      }
    }

    // Se encontramos quantidade, verificar se a palavra seguinte é uma unidade conhecida
    if (quantidade !== null && restOfLine) {
      const unitMatch = restOfLine.match(/^([^\s]+)\s*(.*)$/);
      if (unitMatch) {
        const potentialUnit = unitMatch[1].toLowerCase().replace(/[.,;]$/, '');
        if (potentialUnit in UNIDADES_MAP) {
          unidade = UNIDADES_MAP[potentialUnit];
          restOfLine = unitMatch[2].trim();
        }
      }
    }

    // O restante vira o nome do item com a primeira letra maiúscula
    if (!restOfLine) {
      // Caso especial: usuário colou só "10 sacos", usar a unidade como nome se nada sobrou
      if (unidade) {
        restOfLine = unidade;
        unidade = null;
      } else {
        continue;
      }
    }

    const nome = restOfLine.charAt(0).toUpperCase() + restOfLine.slice(1);

    results.push({
      nome,
      quantidade,
      unidade,
      comprado: false,
    });
  }

  return results;
}

export interface LocalizarItensResult {
  itensAtualizados: CompraItem[];
  encontrados: CompraItem[];
  naoLocalizados: string[];
  pendentesApos: number;
  todosComprados: boolean;
}

/**
 * Localiza itens da compra para marcação por voz:
 * 1. Igualdade sem acento e sem maiúsculas primeiro
 * 2. "Contém" com candidato único depois
 * Itens não encontrados retornam em naoLocalizados.
 */
export function localizarItens(
  itensAtuais: CompraItem[],
  nomesComprados: string[]
): LocalizarItensResult {
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const atualizados: CompraItem[] = itensAtuais.map((item) => ({ ...item }));
  const encontrados: CompraItem[] = [];
  const naoLocalizados: string[] = [];
  const matchedIndices = new Set<number>();

  for (const rawNome of nomesComprados) {
    const nomeLimpo = rawNome.trim();
    if (!nomeLimpo) continue;
    const buscaNorm = norm(nomeLimpo);

    // 1. Igualdade exata sem acento e sem maiúsculas
    let targetIdx = atualizados.findIndex(
      (item, idx) => !matchedIndices.has(idx) && norm(item.nome) === buscaNorm
    );

    // 2. Se não achou por igualdade exata, busca "contém" com candidato único
    if (targetIdx === -1) {
      const candidates = atualizados
        .map((item, idx) => ({ item, idx }))
        .filter(
          ({ item, idx }) =>
            !matchedIndices.has(idx) &&
            (norm(item.nome).includes(buscaNorm) || buscaNorm.includes(norm(item.nome)))
        );

      if (candidates.length === 1) {
        targetIdx = candidates[0].idx;
      }
    }

    if (targetIdx !== -1) {
      matchedIndices.add(targetIdx);
      atualizados[targetIdx].comprado = true;
      encontrados.push(atualizados[targetIdx]);
    } else {
      naoLocalizados.push(nomeLimpo);
    }
  }

  const pendentesApos = atualizados.filter((i) => !i.comprado).length;
  const todosComprados = atualizados.length > 0 && pendentesApos === 0;

  return {
    itensAtualizados: atualizados,
    encontrados,
    naoLocalizados,
    pendentesApos,
    todosComprados,
  };
}
