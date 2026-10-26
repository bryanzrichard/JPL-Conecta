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
  saco: 'saco', sacos: 'saco', kg: 'kg', quilo: 'kg', quilos: 'kg', g: 'g', grama: 'g', gramas: 'g',
  m: 'm', metro: 'm', metros: 'm', m2: 'm²', 'm²': 'm²', m3: 'm³', 'm³': 'm³', barra: 'barra', barras: 'barra',
  lata: 'lata', latas: 'lata', galao: 'galão', galão: 'galão', galoes: 'galão', galões: 'galão',
  l: 'litro', litro: 'litro', litros: 'litro', caixa: 'caixa', caixas: 'caixa', cx: 'caixa', cxs: 'caixa',
  rolo: 'rolo', rolos: 'rolo', pc: 'peça', pç: 'peça', peca: 'peça', pecas: 'peça', peça: 'peça', peças: 'peça',
  un: 'unidade', und: 'unidade', unid: 'unidade', unidade: 'unidade', unidades: 'unidade',
  milheiro: 'milheiro', milheiros: 'milheiro', t: 'tonelada', ton: 'tonelada', tonelada: 'tonelada', toneladas: 'tonelada',
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

const NUMEROS_EXTENSO: Record<string, number> = {
  meio: 0.5, meia: 0.5, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14,
  quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, cem: 100, cento: 100,
};

const NUM_WORDS_PATTERN =
  'meio|meia|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|cem|cento';

const MATERIAIS_COM_BITOLA = new Set([
  'ferro', 'vergalhao', 'vergalhão', 'brita', 'pedra', 'cano', 'tubo', 'fio', 'cabo', 'disjuntor',
  'chave', 'prego', 'parafuso', 'eletroduto', 'conduite', 'conduíte', 'joelho', 'curva', 'luva',
  'te', 'tê', 'reducao', 'redução', 'tijolo', 'bloco', 'broca',
]);

const MATERIAIS_M3 = ['areia', 'brita', 'pedra', 'terra'];

function parseNumeroToken(val: string): number | null {
  const normKey = val.toLowerCase().trim();
  if (normKey in NUMEROS_EXTENSO) {
    return NUMEROS_EXTENSO[normKey];
  }
  const cleanStr = normKey.replace(',', '.');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? null : num;
}

/**
 * Transforma uma linha ou texto colado em itens estruturados de compra.
 * Suporta separadores: quebras de linha, vírgulas não-decimais, ponto e vírgula, barra '/', sinal '+' e ' e ' antes de números.
 */
export function parseListaColada(texto: string): CompraItem[] {
  if (!texto || !texto.trim()) return [];

  // 1.1 Separadores de itens:
  // - Preservar vírgula decimal entre dois dígitos (ex: 1,5) e barra de fração entre dígitos (ex: 1/2)
  let prepared = texto
    .replace(/(?<=\d),(?=\d)/g, '__DECIMAL_COMMA__')
    .replace(/(?<=\d)\/(?=\d)/g, '__SLASH__');

  // - " e " logo antes de um número (dígito ou por extenso)
  const eRegex = new RegExp(`(?:^|\\s+)e\\s+(?=\\d|\\b(?:${NUM_WORDS_PATTERN})\\b)`, 'gi');
  prepared = prepared.replace(eRegex, '\n');

  // - ponto e vírgula, sinal +, barra, vírgula
  prepared = prepared
    .replace(/;/g, '\n')
    .replace(/\+/g, '\n')
    .replace(/\//g, '\n')
    .replace(/,/g, '\n');

  // - Restaurar vírgula decimal e barra de fração
  prepared = prepared
    .replace(/__DECIMAL_COMMA__/g, ',')
    .replace(/__SLASH__/g, '/');

  const rawLines = prepared
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const results: CompraItem[] = [];

  for (const rawLine of rawLines) {
    let line = rawLine.replace(/^[-*•]\s*/, '').trim();
    if (!line) continue;

    let quantidade: number | null = null;
    let unidade: string | null = null;
    let restOfLine = line;

    // 1.2 Tentar quantidade no início (dígitos ou extenso)
    const numStartDigits = restOfLine.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(?:[xX]|-|:)?\s*(.*)$/);
    const numStartWords = restOfLine.match(new RegExp(`^(${NUM_WORDS_PATTERN})\\b\\s*(?:[xX]|-|:)?\\s*(.*)$`, 'i'));

    if (numStartDigits) {
      const q = parseNumeroToken(numStartDigits[1]);
      if (q !== null) {
        quantidade = q;
        restOfLine = numStartDigits[2].trim();
      }
    } else if (numStartWords) {
      const q = parseNumeroToken(numStartWords[1]);
      if (q !== null) {
        quantidade = q;
        restOfLine = numStartWords[2].trim();
      }
    }

    // Se achou quantidade no início, verificar se palavra seguinte é unidade conhecida
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

    // Se NÃO achou quantidade no início, tentar no fim
    if (quantidade === null) {
      // 2a. Número + Unidade no fim (ex: "cimento 10 sacos", "areia 2 m3")
      const endNumUnitMatch = restOfLine.match(
        new RegExp(
          `^(.*?)\\s+([0-9]+(?:[.,][0-9]+)?|${NUM_WORDS_PATTERN})\\s+([a-zA-ZÀ-ÿ0-9²³]+)$`,
          'i'
        )
      );
      if (endNumUnitMatch) {
        const potentialUnit = endNumUnitMatch[3].toLowerCase().replace(/[.,;]$/, '');
        if (potentialUnit in UNIDADES_MAP) {
          const q = parseNumeroToken(endNumUnitMatch[2]);
          if (q !== null) {
            quantidade = q;
            unidade = UNIDADES_MAP[potentialUnit];
            restOfLine = endNumUnitMatch[1].trim();
          }
        }
      }
    }

    if (quantidade === null) {
      // 2b. Número no fim sem unidade (ex: "cimento 10")
      // Exceto quando o item for material com bitola/medida (ex: "ferro 10", "brita 1")
      const endNumOnlyMatch = restOfLine.match(
        new RegExp(`^(.*?)\\s+([0-9]+(?:[.,][0-9]+)?|${NUM_WORDS_PATTERN})$`, 'i')
      );
      if (endNumOnlyMatch) {
        const prefix = endNumOnlyMatch[1].trim();
        const lastWord = prefix.split(/\s+/).pop()?.toLowerCase() || '';
        if (!MATERIAIS_COM_BITOLA.has(lastWord)) {
          const q = parseNumeroToken(endNumOnlyMatch[2]);
          if (q !== null) {
            quantidade = q;
            restOfLine = prefix;
          }
        }
      }
    }

    if (!restOfLine) {
      if (unidade) {
        restOfLine = unidade;
        unidade = null;
      } else {
        continue;
      }
    }

    // 1.3 Remover preposições no início do nome ("de", "do", "da", "dos", "das")
    while (/^(?:de|do|da|dos|das)\s+/i.test(restOfLine)) {
      restOfLine = restOfLine.replace(/^(?:de|do|da|dos|das)\s+/i, '').trim();
    }

    // 1.4 Nome: primeira letra maiúscula e o resto como digitado; se estiver tudo em MAIÚSCULAS, converter para minúsculas antes
    let nome = restOfLine;
    const hasLetters = /[a-zA-ZÀ-ÿ]/.test(nome);
    const hasLowerCase = /[a-zà-ÿ]/.test(nome);
    if (hasLetters && !hasLowerCase) {
      nome = nome.toLowerCase();
    }
    nome = nome.charAt(0).toUpperCase() + nome.slice(1);

    // 1.5 Areia, brita, pedra e terra com unidade "m"/"metro"/"metros" gravam "m³"
    const nomeLower = nome.toLowerCase();
    if (unidade === 'm' && MATERIAIS_M3.some((m) => nomeLower.includes(m))) {
      unidade = 'm³';
    }

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
