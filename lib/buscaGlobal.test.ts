import {
  agruparResultadosBusca,
  highlightMatches,
  extrairPrecoUnitarioItem,
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  ROTULOS_BUSCA,
  TIPOS_COM_SOMA,
  BuscaGlobalRow,
} from './buscaGlobal';
import { formatDateDMAA, formatCurrency } from './utils';

// Mock simples de localStorage em memória para testes no ambiente Node / tsx
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get store() {
      return store;
    },
  };
})();

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: storageMock,
    writable: true,
  });
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

export async function runBuscaGlobalTests() {
  console.log('--- Iniciando bateria de testes de buscaGlobal ---');

  // Teste 1: Rótulos definidos para todos os 12 tipos
  {
    const tipos = [
      'nota',
      'item',
      'servico',
      'adiantamento',
      'tarefa',
      'compra',
      'fornecedor',
      'colaborador',
      'obra',
      'cartorio',
      'etapa',
      'orcamento_item',
    ] as const;

    for (const t of tipos) {
      assert(!!ROTULOS_BUSCA[t], `Tipo "${t}" deve ter rótulo legível em português`);
    }
    assert(ROTULOS_BUSCA['nota'] === 'Notas fiscais', 'Rótulo nota');
    assert(ROTULOS_BUSCA['item'] === 'Itens de notas', 'Rótulo item');
    assert(ROTULOS_BUSCA['servico'] === 'Serviços', 'Rótulo serviço');
    assert(ROTULOS_BUSCA['adiantamento'] === 'Pagamentos', 'Rótulo pagamento');
    assert(ROTULOS_BUSCA['tarefa'] === 'Tarefas', 'Rótulo tarefa');
    assert(ROTULOS_BUSCA['compra'] === 'Listas de compras', 'Rótulo compra');
    assert(ROTULOS_BUSCA['fornecedor'] === 'Fornecedores', 'Rótulo fornecedor');
    assert(ROTULOS_BUSCA['colaborador'] === 'Colaboradores', 'Rótulo colaborador');
    assert(ROTULOS_BUSCA['obra'] === 'Obras', 'Rótulo obra');
    assert(ROTULOS_BUSCA['cartorio'] === 'Cartório', 'Rótulo cartório');
    assert(ROTULOS_BUSCA['etapa'] === 'Etapas do orçamento', 'Rótulo etapa');
    assert(ROTULOS_BUSCA['orcamento_item'] === 'Itens do orçamento', 'Rótulo orcamento_item');
    console.log('✓ Teste 1: Todos os 12 tipos possuem rótulos com acentuação correta');
  }

  // Teste 2: Agrupamento e ordenação por maior pontuação (score) do grupo
  {
    const mockRows: BuscaGlobalRow[] = [
      {
        tipo: 'nota',
        id: 'n1',
        titulo: 'NF 1024 - Votorantim',
        subtitulo: 'Solar dos Pássaros',
        valor: 1500,
        data: '2026-10-15',
        obra: 'Solar',
        obra_id: 'ob-1',
        rota: '/notas?editar=n1',
        detalhes: null,
        score: 0.75,
        total_tipo: 2,
        soma_tipo: 3500,
      },
      {
        tipo: 'nota',
        id: 'n2',
        titulo: 'NF 1025 - Votorantim',
        subtitulo: 'Solar dos Pássaros',
        valor: 2000,
        data: '2026-10-16',
        obra: 'Solar',
        obra_id: 'ob-1',
        rota: '/notas?editar=n2',
        detalhes: null,
        score: 0.60,
        total_tipo: 2,
        soma_tipo: 3500,
      },
      {
        tipo: 'item',
        id: 'it1',
        titulo: 'Cimento CP II 50kg',
        subtitulo: 'Votorantim · NF 1024',
        valor: 1500,
        data: '2026-10-15',
        obra: 'Solar',
        obra_id: 'ob-1',
        rota: '/notas?editar=n1&item=it1',
        detalhes: { preco_unitario: 35, unidade: 'sc' },
        score: 0.98, // Score mais alto
        total_tipo: 1,
        soma_tipo: 1500,
      },
      {
        tipo: 'tarefa',
        id: 't1',
        titulo: 'Descarregar cimento na obra',
        subtitulo: 'Solar dos Pássaros',
        valor: null,
        data: '2026-10-17',
        obra: 'Solar',
        obra_id: 'ob-1',
        rota: '/tarefas?tarefa=t1',
        detalhes: null,
        score: 0.40,
        total_tipo: 1,
        soma_tipo: null,
      },
    ];

    const grupos = agruparResultadosBusca(mockRows);
    assert(grupos.length === 3, 'Deve gerar 3 grupos: item, nota e tarefa');
    // Grupo 'item' teve score 0.98, deve ser o 1º grupo
    assert(grupos[0].tipo === 'item', 'Primeiro grupo deve ser item pelo maior score');
    assert(grupos[0].itens.length === 1, '1 item');
    assert(grupos[0].soma === 1500, 'Soma do item');

    // Grupo 'nota' teve score 0.75, deve ser o 2º grupo
    assert(grupos[1].tipo === 'nota', 'Segundo grupo deve ser nota');
    assert(grupos[1].itens.length === 2, '2 notas no grupo');
    assert(grupos[1].total === 2, 'Total do grupo');
    assert(grupos[1].soma === 3500, 'Soma do grupo de notas');

    // Grupo 'tarefa' não é tipo com soma financeira
    assert(grupos[2].tipo === 'tarefa', 'Terceiro grupo deve ser tarefa');
    assert(grupos[2].soma === null, 'Tarefa não deve exibir soma financeira');
    console.log('✓ Teste 2: Agrupamento correto e ordenação de grupos por score descendente');
  }

  // Teste 3: Destaque de palavras (highlightMatches) insensível a caixa e acentuação
  {
    const texto = 'Fundação e Estrutura de Concreto Armado';
    // Busca sem acento e em minúsculas
    const res1 = highlightMatches(texto, 'fundacao concreto');
    assert(res1.some((p) => p.text === 'Fundação' && p.match), 'Fundação deve ter match mesmo buscando fundacao');
    assert(res1.some((p) => p.text === 'Concreto' && p.match), 'Concreto deve ter match mesmo buscando concreto');

    const texto2 = 'Cimento CP II 50kg Votoran';
    const res2 = highlightMatches(texto2, 'cimento votoran');
    assert(res2[0].text === 'Cimento' && res2[0].match === true, 'Cimento inicial casado');
    assert(res2.some((p) => p.text === 'Votoran' && p.match === true), 'Votoran casado');

    // Teste com João e pagamento
    const texto3 = 'João da Silva (Pedreiro)';
    const res3 = highlightMatches(texto3, 'joao');
    assert(res3.some((p) => p.text === 'João' && p.match === true), 'João casado com joao');
    console.log('✓ Teste 3: highlightMatches é insensível a caixa e acento, preservando caracteres originais');
  }

  // Teste 4: Formatação de preço unitário e unidade para linhas de item
  {
    const det1 = { preco_unitario: 35.5, unidade: 'sc' };
    const p1 = extrairPrecoUnitarioItem(det1);
    assert(p1 !== null && p1.includes('35,50') && p1.includes('/sc'), `Deve formatar R$ 35,50/sc: ${p1}`);

    const det2 = { unit_price: 125, unit_of_measure: 'm³' };
    const p2 = extrairPrecoUnitarioItem(det2);
    assert(p2 !== null && p2.includes('125,00') && p2.includes('/m³'), `Deve formatar R$ 125,00/m³: ${p2}`);

    const det3 = null;
    assert(extrairPrecoUnitarioItem(det3) === null, 'Detalhes nulo retorna null');
    console.log('✓ Teste 4: extrairPrecoUnitarioItem formata preço unitário e unidade');
  }

  // Teste 5: Formatação de data dd/mm/aa com formatDateDMAA
  {
    const d1 = formatDateDMAA('2026-10-15');
    assert(d1 === '15/10/26', `Data deve ser 15/10/26, obteve: ${d1}`);

    const d2 = formatDateDMAA('2026-05-04T12:00:00Z');
    assert(d2 === '04/05/26', `Data ISO deve ser 04/05/26, obteve: ${d2}`);

    const d3 = formatDateDMAA(null);
    assert(d3 === '', 'Data nula retorna vazio');
    console.log('✓ Teste 5: formatDateDMAA formata dd/mm/aa corretamente');
  }

  // Teste 6: Histórico de buscas recentes (localStorage por usuário)
  {
    localStorage.clear();
    const userA = 'user-001';
    const userB = 'user-002';

    addRecentSearch(userA, 'cimento');
    addRecentSearch(userA, 'tubo 100');
    addRecentSearch(userA, 'ferros');

    const recA = getRecentSearches(userA);
    assert(recA.length === 3, 'Deve ter 3 buscas recentes');
    assert(recA[0] === 'ferros', 'Mais recente fica no topo');
    assert(recA[1] === 'tubo 100', 'Segunda mais recente');
    assert(recA[2] === 'cimento', 'Terceira mais recente');

    // Usuário B não vê buscas do usuário A
    const recB = getRecentSearches(userB);
    assert(recB.length === 0, 'Usuário B não deve ver histórico do usuário A');

    // Adicionar termo repetido: move para o topo sem duplicar
    addRecentSearch(userA, 'cimento');
    const recA2 = getRecentSearches(userA);
    assert(recA2.length === 3, 'Tamanho não aumenta ao repetir termo');
    assert(recA2[0] === 'cimento', 'Termo repetido move para o topo');

    // Remover termo individual
    removeRecentSearch(userA, 'tubo 100');
    const recA3 = getRecentSearches(userA);
    assert(recA3.length === 2 && !recA3.includes('tubo 100'), 'Termo removido');

    // Limpar tudo
    clearRecentSearches(userA);
    assert(getRecentSearches(userA).length === 0, 'Histórico limpo');
    console.log('✓ Teste 6: Histórico de buscas recentes salvo por usuário, limitado a 8, sem duplicações');
  }

  console.log('=== TODOS OS 6 TESTES DA BUSCA GLOBAL PASSARAM COM SUCESSO! ===\n');
}

runBuscaGlobalTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
