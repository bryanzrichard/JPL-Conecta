import { BuscaGlobalRow } from '../types';

export interface PriceRecord {
  unitPrice: number;
  date: string;
  totalPrice?: number;
  quantity?: number;
  unitOfMeasure?: string | null;
  supplierName?: string;
  projectName?: string;
  invoiceNumber?: string;
  description?: string;
  nota_id?: string;
  rota?: string;
}

export interface SupplierPriceStats {
  fornecedor: string;
  quantidadeComprada: number;
  totalGasto: number;
  precoMedio: number;
  ultimoPreco: number;
  ultimaData: string;
  ultimaRota: string;
}

export interface ProductPriceStats {
  chave: string;
  descricao: string;
  unidade: string;
  totalGasto: number;
  quantidadeTotal: number;
  numeroCompras: number;
  mediaPonderada: number;
  menorPreco: {
    unitPrice: number;
    supplierName: string;
    date: string;
    rota: string;
  };
  maiorPreco: {
    unitPrice: number;
    supplierName: string;
    date: string;
    rota: string;
  };
  ultimoPreco: {
    unitPrice: number;
    supplierName: string;
    date: string;
    rota: string;
  };
  porFornecedor: SupplierPriceStats[];
}

export interface GlobalPriceStats {
  hasData: boolean;
  totalOccurrences: number;
  lastPurchase: PriceRecord | null;
  lowestPrice: PriceRecord | null;
  highestPrice: PriceRecord | null;
  averagePrice: number;
  weightedAveragePrice: number;
  priceTrend: 'alta' | 'baixa' | 'estavel';
  variancePercent: number;
}

export function normalizarDescricao(desc: string): string {
  if (!desc) return '';
  return desc
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function extrairDadosItem(row: BuscaGlobalRow): {
  unitPrice: number;
  quantity: number;
  unidade: string;
  supplierName: string;
  date: string;
  totalPrice: number;
  rota: string;
  descricao: string;
} {
  const d = row.detalhes || {};

  const rawUnitPrice = d.preco_unitario ?? d.unit_price ?? d.valor_unitario ?? d.preco;
  const unitPrice =
    typeof rawUnitPrice === 'number'
      ? rawUnitPrice
      : parseFloat(String(rawUnitPrice || '0').replace(',', '.'));

  const rawQty = d.quantidade ?? d.quantity ?? d.qtd;
  const quantity =
    typeof rawQty === 'number'
      ? rawQty
      : parseFloat(String(rawQty || '1').replace(',', '.'));

  const rawUnidade = d.unidade ?? d.unidade_medida ?? d.unit_of_measure ?? 'un';
  const unidade = String(rawUnidade).trim().toLowerCase() || 'un';

  const supplierFromDetails = d.fornecedor ?? d.supplier_name ?? d.fornecedor_nome;
  const supplierFromSubtitle = row.subtitulo ? row.subtitulo.split('·')[0].trim() : '';
  const supplierName = String(supplierFromDetails || supplierFromSubtitle || 'Fornecedor não identificado');

  const date = String(row.data || d.data || d.issue_date || '');
  const notaId = d.nota_id ?? d.nota_fiscal_id ?? d.id_nota;
  const rota = notaId && typeof notaId === 'string'
    ? `/notas?editar=${notaId}&item=${row.id}`
    : row.rota;

  const validUnitPrice = !isNaN(unitPrice) && unitPrice > 0 ? unitPrice : 0;
  const validQty = !isNaN(quantity) && quantity > 0 ? quantity : 1;
  const totalPrice = typeof row.valor === 'number' && row.valor > 0
    ? row.valor
    : validUnitPrice * validQty;

  return {
    unitPrice: validUnitPrice,
    quantity: validQty,
    unidade,
    supplierName,
    date,
    totalPrice,
    rota,
    descricao: row.titulo || 'Item sem descrição',
  };
}

export function calculateProductPriceStats(rows: BuscaGlobalRow[]): ProductPriceStats[] {
  const itemRows = rows.filter((r) => r.tipo === 'item' && r.detalhes !== null);

  type ItemParsed = ReturnType<typeof extrairDadosItem> & { originalRow: BuscaGlobalRow };
  const parsedItems: ItemParsed[] = [];

  for (const r of itemRows) {
    const parsed = extrairDadosItem(r);
    if (parsed.unitPrice > 0) {
      parsedItems.push({ ...parsed, originalRow: r });
    }
  }

  if (parsedItems.length === 0) return [];

  // Agrupamento por produto (descrição normalizada) E unidade
  const mapGrupos = new Map<string, ItemParsed[]>();
  for (const item of parsedItems) {
    const key = `${normalizarDescricao(item.descricao)}:::${item.unidade}`;
    const lista = mapGrupos.get(key) || [];
    lista.push(item);
    mapGrupos.set(key, lista);
  }

  const result: ProductPriceStats[] = [];

  for (const [key, items] of mapGrupos.entries()) {
    const totalGasto = items.reduce((acc, curr) => acc + curr.totalPrice, 0);
    const quantidadeTotal = items.reduce((acc, curr) => acc + curr.quantity, 0);
    const numeroCompras = items.length;
    const mediaPonderada = quantidadeTotal > 0 ? totalGasto / quantidadeTotal : 0;

    const sortedByPrice = [...items].sort((a, b) => a.unitPrice - b.unitPrice);
    const lowest = sortedByPrice[0];
    const highest = sortedByPrice[sortedByPrice.length - 1];

    const sortedByDateDesc = [...items].sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return timeB - timeA;
    });
    const latest = sortedByDateDesc[0];

    const mapFornecedor = new Map<string, ItemParsed[]>();
    for (const it of items) {
      const fList = mapFornecedor.get(it.supplierName) || [];
      fList.push(it);
      mapFornecedor.set(it.supplierName, fList);
    }

    const porFornecedor: SupplierPriceStats[] = [];
    for (const [fornecedor, fItems] of mapFornecedor.entries()) {
      const fTotal = fItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
      const fQtd = fItems.reduce((acc, curr) => acc + curr.quantity, 0);
      const fMedia = fQtd > 0 ? fTotal / fQtd : 0;

      const fSortedDate = [...fItems].sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      });
      const fLatest = fSortedDate[0];

      porFornecedor.push({
        fornecedor,
        quantidadeComprada: fQtd,
        totalGasto: fTotal,
        precoMedio: fMedia,
        ultimoPreco: fLatest.unitPrice,
        ultimaData: fLatest.date,
        ultimaRota: fLatest.rota,
      });
    }

    porFornecedor.sort((a, b) => b.quantidadeComprada - a.quantidadeComprada);

    result.push({
      chave: key,
      descricao: latest.descricao,
      unidade: items[0].unidade,
      totalGasto,
      quantidadeTotal,
      numeroCompras,
      mediaPonderada,
      menorPreco: {
        unitPrice: lowest.unitPrice,
        supplierName: lowest.supplierName,
        date: lowest.date,
        rota: lowest.rota,
      },
      maiorPreco: {
        unitPrice: highest.unitPrice,
        supplierName: highest.supplierName,
        date: highest.date,
        rota: highest.rota,
      },
      ultimoPreco: {
        unitPrice: latest.unitPrice,
        supplierName: latest.supplierName,
        date: latest.date,
        rota: latest.rota,
      },
      porFornecedor,
    });
  }

  result.sort((a, b) => b.totalGasto - a.totalGasto);
  return result;
}

export function calculatePriceStats(rows: BuscaGlobalRow[]): GlobalPriceStats | null {
  const itemRows = rows.filter((r) => r.tipo === 'item' && r.detalhes !== null);
  const validItems = itemRows.map(extrairDadosItem).filter((it) => it.unitPrice > 0);

  if (validItems.length === 0) return null;

  const sortedByDateDesc = [...validItems].sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return timeB - timeA;
  });

  const latest = sortedByDateDesc[0];
  const lastPurchase: PriceRecord = {
    unitPrice: latest.unitPrice,
    date: latest.date,
    totalPrice: latest.totalPrice,
    quantity: latest.quantity,
    unitOfMeasure: latest.unidade,
    supplierName: latest.supplierName,
    description: latest.descricao,
    rota: latest.rota,
  };

  const sortedByPriceAsc = [...validItems].sort((a, b) => a.unitPrice - b.unitPrice);
  const lowest = sortedByPriceAsc[0];
  const highest = sortedByPriceAsc[sortedByPriceAsc.length - 1];

  const lowestPrice: PriceRecord = {
    unitPrice: lowest.unitPrice,
    date: lowest.date,
    totalPrice: lowest.totalPrice,
    quantity: lowest.quantity,
    unitOfMeasure: lowest.unidade,
    supplierName: lowest.supplierName,
    description: lowest.descricao,
    rota: lowest.rota,
  };

  const highestPrice: PriceRecord = {
    unitPrice: highest.unitPrice,
    date: highest.date,
    totalPrice: highest.totalPrice,
    quantity: highest.quantity,
    unitOfMeasure: highest.unidade,
    supplierName: highest.supplierName,
    description: highest.descricao,
    rota: highest.rota,
  };

  const sumUnitPrices = validItems.reduce((acc, curr) => acc + curr.unitPrice, 0);
  const averagePrice = Number((sumUnitPrices / validItems.length).toFixed(2));

  const totalSpend = validItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
  const totalQty = validItems.reduce((acc, curr) => acc + curr.quantity, 0);
  const weightedAveragePrice = totalQty > 0 ? Number((totalSpend / totalQty).toFixed(2)) : averagePrice;

  const variancePercent =
    lowestPrice.unitPrice > 0
      ? Number((((highestPrice.unitPrice - lowestPrice.unitPrice) / lowestPrice.unitPrice) * 100).toFixed(1))
      : 0;

  let priceTrend: 'alta' | 'baixa' | 'estavel' = 'estavel';
  if (lastPurchase.unitPrice > averagePrice * 1.03) {
    priceTrend = 'alta';
  } else if (lastPurchase.unitPrice < averagePrice * 0.97) {
    priceTrend = 'baixa';
  }

  return {
    hasData: true,
    totalOccurrences: validItems.length,
    lastPurchase,
    lowestPrice,
    highestPrice,
    averagePrice,
    weightedAveragePrice,
    priceTrend,
    variancePercent,
  };
}
