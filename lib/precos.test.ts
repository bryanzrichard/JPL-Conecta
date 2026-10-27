import {
  normalizarDescricao,
  calculateProductPriceStats,
  calculatePriceStats,
  extrairDadosItem,
} from './precos';
import { BuscaGlobalRow } from '../types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

export async function runPrecosTests() {
  console.log('--- Iniciando bateria de testes de precos.ts ---');

  // Teste 1: Normalização de descrição (sem acento, minúsculas, espaços simples)
  {
    assert(
      normalizarDescricao('Cimento CP-II  50kg ') === 'cimento cp-ii 50kg',
      'deve normalizar espaços e minúsculas'
    );
    assert(
      normalizarDescricao('Aço CA-50 10mm (Barra)') === 'aco ca-50 10mm (barra)',
      'deve remover acento de Aço'
    );
    assert(
      normalizarDescricao('Tubo Soldável 100mm   Tigre') === 'tubo soldavel 100mm tigre',
      'deve remover acentos e espaços extras'
    );
    console.log('✓ Teste 1: normalizarDescricao remove acentos, espaços e converte para minúsculas');
  }

  // Teste 2: Itens com mesma descrição mas UNIDADES DIFERENTES nunca se misturam
  {
    const mockRows: BuscaGlobalRow[] = [
      {
        tipo: 'item',
        id: 'it-1',
        titulo: 'Areia Média',
        subtitulo: 'Depósito X · NF 101',
        valor: 500,
        data: '2026-10-10',
        obra: 'Obra 1',
        obra_id: 'ob-1',
        rota: '/notas?editar=101&item=it-1',
        detalhes: {
          preco_unitario: 100,
          quantidade: 5,
          unidade: 'm³',
          fornecedor: 'Depósito X',
          nota_id: '101',
        },
        score: 0.9,
        total_tipo: 2,
        soma_tipo: 600,
      },
      {
        tipo: 'item',
        id: 'it-2',
        titulo: 'Areia Média',
        subtitulo: 'Depósito Y · NF 102',
        valor: 100,
        data: '2026-10-12',
        obra: 'Obra 1',
        obra_id: 'ob-1',
        rota: '/notas?editar=102&item=it-2',
        detalhes: {
          preco_unitario: 10,
          quantidade: 10,
          unidade: 'sc', // Unidade saco, diferente de m³
          fornecedor: 'Depósito Y',
          nota_id: '102',
        },
        score: 0.9,
        total_tipo: 2,
        soma_tipo: 600,
      },
    ];

    const stats = calculateProductPriceStats(mockRows);
    assert(stats.length === 2, 'Deve separar Areia em m³ e Areia em sc em dois cards distintos');
    assert(stats[0].unidade === 'm³' && stats[1].unidade === 'sc', 'Unidades preservadas separadamente');
    console.log('✓ Teste 2: Unidades diferentes nunca são comparadas entre si');
  }

  // Teste 3: Menor, Maior, Último Preço e Média Ponderada
  {
    const mockCimento: BuscaGlobalRow[] = [
      {
        tipo: 'item',
        id: 'c1',
        titulo: 'Cimento CP II 50kg',
        subtitulo: 'Votorantim',
        valor: 350,
        data: '2026-10-01',
        obra: 'Alpha',
        obra_id: 'ob-1',
        rota: '/notas?editar=nf-1&item=c1',
        detalhes: {
          preco_unitario: 35,
          quantidade: 10,
          unidade: 'sc',
          fornecedor: 'Depósito Silva',
          nota_id: 'nf-1',
        },
        score: 1.0,
        total_tipo: 3,
        soma_tipo: 1110,
      },
      {
        tipo: 'item',
        id: 'c2',
        titulo: 'Cimento CP II 50kg',
        subtitulo: 'Votorantim',
        valor: 400,
        data: '2026-10-15',
        obra: 'Alpha',
        obra_id: 'ob-1',
        rota: '/notas?editar=nf-2&item=c2',
        detalhes: {
          preco_unitario: 40,
          quantidade: 10,
          unidade: 'sc',
          fornecedor: 'Depósito Central',
          nota_id: 'nf-2',
        },
        score: 1.0,
        total_tipo: 3,
        soma_tipo: 1110,
      },
      {
        tipo: 'item',
        id: 'c3',
        titulo: 'Cimento CP II 50kg',
        subtitulo: 'Votorantim',
        valor: 360,
        data: '2026-10-20', // Data mais recente
        obra: 'Alpha',
        obra_id: 'ob-1',
        rota: '/notas?editar=nf-3&item=c3',
        detalhes: {
          preco_unitario: 36,
          quantidade: 10,
          unidade: 'sc',
          fornecedor: 'Depósito Silva',
          nota_id: 'nf-3',
        },
        score: 1.0,
        total_tipo: 3,
        soma_tipo: 1110,
      },
    ];

    const stats = calculateProductPriceStats(mockCimento);
    assert(stats.length === 1, 'Deve agrupar em 1 produto');
    const p = stats[0];

    assert(p.numeroCompras === 3, '3 compras registradas');
    assert(p.quantidadeTotal === 30, '30 sacos no total');
    assert(p.totalGasto === 1110, '350 + 400 + 360 = 1110');
    assert(p.mediaPonderada === 37, '1110 / 30 = 37.00');

    // Menor preço: R$ 35 (Depósito Silva em 2026-10-01)
    assert(p.menorPreco.unitPrice === 35, 'Menor preço R$ 35');
    assert(p.menorPreco.supplierName === 'Depósito Silva', 'Fornecedor menor preço');
    assert(p.menorPreco.rota === '/notas?editar=nf-1&item=c1', 'Rota do menor preço');

    // Maior preço: R$ 40 (Depósito Central em 2026-10-15)
    assert(p.maiorPreco.unitPrice === 40, 'Maior preço R$ 40');
    assert(p.maiorPreco.supplierName === 'Depósito Central', 'Fornecedor maior preço');

    // Último preço: R$ 36 (mais recente 2026-10-20)
    assert(p.ultimoPreco.unitPrice === 36, 'Último preço pago R$ 36');
    assert(p.ultimoPreco.supplierName === 'Depósito Silva', 'Fornecedor último preço');
    assert(p.ultimoPreco.date === '2026-10-20', 'Data do último preço');

    // Tabela por fornecedor
    assert(p.porFornecedor.length === 2, '2 fornecedores: Depósito Silva e Depósito Central');
    const fSilva = p.porFornecedor.find((f) => f.fornecedor === 'Depósito Silva');
    assert(fSilva !== undefined, 'Depósito Silva presente');
    assert(fSilva?.quantidadeComprada === 20, 'Silva vendeu 20 sacos');
    assert(fSilva?.precoMedio === 35.5, '(350 + 360) / 20 = 35.5');
    assert(fSilva?.ultimoPreco === 36, 'Último preço do Silva foi 36');

    console.log('✓ Teste 3: Menor, maior, último preço pago e tabela por fornecedor calculados com precisão');
  }

  // Teste 4: Ordenação dos cards de produtos pelo total gasto descrescente
  {
    const rowsMultiplos: BuscaGlobalRow[] = [
      {
        tipo: 'item',
        id: 'it-a',
        titulo: 'Tubo PVC 100mm',
        subtitulo: 'Tigre',
        valor: 200, // Menor gasto
        data: '2026-10-05',
        obra: 'Obra 1',
        obra_id: 'ob-1',
        rota: '/notas?editar=1&item=it-a',
        detalhes: { preco_unitario: 50, quantidade: 4, unidade: 'barra' },
        score: 0.9,
        total_tipo: 2,
        soma_tipo: 2200,
      },
      {
        tipo: 'item',
        id: 'it-b',
        titulo: 'Viga de Aço W200',
        subtitulo: 'Gerdau',
        valor: 2000, // Maior gasto
        data: '2026-10-06',
        obra: 'Obra 1',
        obra_id: 'ob-1',
        rota: '/notas?editar=2&item=it-b',
        detalhes: { preco_unitario: 1000, quantidade: 2, unidade: 'barra' },
        score: 0.9,
        total_tipo: 2,
        soma_tipo: 2200,
      },
    ];

    const stats = calculateProductPriceStats(rowsMultiplos);
    assert(stats.length === 2, '2 produtos');
    assert(stats[0].descricao === 'Viga de Aço W200', 'Viga de Aço com R$ 2.000 deve vir primeiro');
    assert(stats[1].descricao === 'Tubo PVC 100mm', 'Tubo PVC com R$ 200 deve vir em segundo');
    console.log('✓ Teste 4: Cards de produtos ordenados pelo total gasto descrescente');
  }

  // Teste 5: calculatePriceStats global
  {
    const rows: BuscaGlobalRow[] = [
      {
        tipo: 'item',
        id: '1',
        titulo: 'Cimento',
        subtitulo: '',
        valor: 100,
        data: '2026-10-01',
        obra: null,
        obra_id: null,
        rota: '',
        detalhes: { preco_unitario: 10, quantidade: 10, unidade: 'sc' },
        score: 1,
        total_tipo: 1,
        soma_tipo: 100,
      },
      {
        tipo: 'item',
        id: '2',
        titulo: 'Cimento',
        subtitulo: '',
        valor: 300,
        data: '2026-10-10',
        obra: null,
        obra_id: null,
        rota: '',
        detalhes: { preco_unitario: 15, quantidade: 20, unidade: 'sc' },
        score: 1,
        total_tipo: 1,
        soma_tipo: 400,
      },
    ];

    const globalStats = calculatePriceStats(rows);
    assert(globalStats !== null, 'Estatísticas globais calculadas');
    assert(globalStats?.lowestPrice?.unitPrice === 10, 'Menor preço global 10');
    assert(globalStats?.highestPrice?.unitPrice === 15, 'Maior preço global 15');
    assert(globalStats?.lastPurchase?.unitPrice === 15, 'Último preço global 15');
    assert(globalStats?.variancePercent === 50, 'Variação percentual 50%');
    console.log('✓ Teste 5: calculatePriceStats calcula variação e média global');
  }

  console.log('=== TODOS OS 5 TESTES DE PREÇOS PASSARAM COM SUCESSO! ===\n');
}

runPrecosTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
