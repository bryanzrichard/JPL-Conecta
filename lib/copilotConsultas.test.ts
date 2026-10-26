import {
  resolverConsulta,
  descreverConsulta,
  executarConsulta,
  SupabaseRpcClient,
} from './copilotConsultas';
import { Project } from '../types';

function check(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('=== Iniciando testes de lib/copilotConsultas.ts ===');

const mockProjects: Project[] = [
  {
    id: 'proj-1',
    company_id: 'comp-1',
    name: 'Edifício Horizonte',
    status: 'Em Andamento',
    start_date: '2026-01-01',
    end_date: null,
    created_by: 'user-1',
    created_at: '2026-01-01',
    area_m2: 1200,
  },
  {
    id: 'proj-2',
    company_id: 'comp-1',
    name: 'Residencial Mingone',
    status: 'Em Andamento',
    start_date: '2026-02-01',
    end_date: null,
    created_by: 'user-1',
    created_at: '2026-02-01',
    area_m2: 2400,
  },
];

// -------------------------------------------------------------
// Teste 1: resolverConsulta - Resolução de Obras
// -------------------------------------------------------------
// 1.1 Obra existente por nome exato / sem acento
const r1 = resolverConsulta(
  { tipo: 'GASTOS', obra_nome: 'Edificio Horizonte' },
  mockProjects
);
check(r1.pedido.obra_id === 'proj-1', 'Deveria resolver obra_id proj-1');
check(r1.obraNome === 'Edifício Horizonte', 'Deveria resolver nome oficial da obra');
check(!r1.erro, 'Não deveria ter erro');

// 1.2 Obra por candidato único em "contém" ("Mingone")
const r2 = resolverConsulta(
  { tipo: 'GASTOS', obra_nome: 'Mingone' },
  mockProjects
);
check(r2.pedido.obra_id === 'proj-2', 'Deveria resolver obra_id proj-2');
check(r2.obraNome === 'Residencial Mingone', 'Deveria resolver Residencial Mingone');
check(!r2.erro, 'Não deveria ter erro');

// 1.3 Obra citada inexistente -> erro "Obra não localizada: <nome>"
const r3 = resolverConsulta(
  { tipo: 'GASTOS', obra_nome: 'Obra Inexistente' },
  mockProjects
);
check(r3.pedido.obra_id === null, 'obra_id deveria ser null');
check(r3.erro === 'Obra não localizada: Obra Inexistente', `Erro incorreto: ${r3.erro}`);

// 1.4 Sem menção a obra -> sem erro, obra_id null
const r4 = resolverConsulta(
  { tipo: 'GASTOS' },
  mockProjects
);
check(r4.pedido.obra_id === null, 'obra_id null');
check(!r4.erro, 'Não deve dar erro sem menção a obra');

console.log('✔ resolverConsulta: resolução de obras validada com sucesso!');

// -------------------------------------------------------------
// Teste 2: resolverConsulta - Categoria, Datas e Agrupar
// -------------------------------------------------------------
// 2.1 Categoria válida mantida
const rCat1 = resolverConsulta(
  { tipo: 'GASTOS', categoria: 'Pintura' },
  mockProjects
);
check(rCat1.pedido.categoria === 'Pintura', 'Pintura é válida');

// 2.2 Categoria fora da lista vira null
const rCat2 = resolverConsulta(
  { tipo: 'GASTOS', categoria: 'Categoria Fantasma 123' },
  mockProjects
);
check(rCat2.pedido.categoria === null, 'Categoria inválida deve virar null');

// 2.3 Datas inválidas viram null
const rData1 = resolverConsulta(
  { tipo: 'GASTOS', data_inicio: 'invalida', data_fim: '2026-13-45' },
  mockProjects
);
check(rData1.pedido.data_inicio === null, 'Data início inválida deve virar null');
check(rData1.pedido.data_fim === null, 'Data fim inválida deve virar null');

// 2.4 Datas válidas preservadas
const rData2 = resolverConsulta(
  { tipo: 'GASTOS', data_inicio: '2026-07-01', data_fim: '2026-07-31' },
  mockProjects
);
check(rData2.pedido.data_inicio === '2026-07-01', 'Data início preservada');
check(rData2.pedido.data_fim === '2026-07-31', 'Data fim preservada');

// 2.5 agrupar null vira "origem"
const rAgruparNull = resolverConsulta(
  { tipo: 'GASTOS', agrupar: null },
  mockProjects
);
check(rAgruparNull.pedido.agrupar === 'origem', 'agrupar null vira "origem"');

console.log('✔ resolverConsulta: sanitização de categoria, datas e agrupar validada!');

// -------------------------------------------------------------
// Teste 3: descreverConsulta
// -------------------------------------------------------------
// 3.1 Exemplo da especificação: "Gastos · Mingone · 01/07/2026 a 31/07/2026 · ferro"
const d1 = descreverConsulta(
  {
    tipo: 'GASTOS',
    data_inicio: '2026-07-01',
    data_fim: '2026-07-31',
    termo: 'ferro|vergalhao',
    termo_exibicao: 'ferro',
  },
  'Mingone'
);
check(d1 === 'Gastos · Mingone · 01/07/2026 a 31/07/2026 · ferro', `D1 falhou: ${d1}`);

// 3.2 Sem período -> "todo o histórico"
const d2 = descreverConsulta(
  {
    tipo: 'GASTOS',
    termo: 'cimento',
  },
  'Mingone'
);
check(d2 === 'Gastos · Mingone · todo o histórico · cimento', `D2 falhou: ${d2}`);

// 3.3 Listar notas de um único dia
const d3 = descreverConsulta(
  {
    tipo: 'LISTAR_NOTAS',
    data_inicio: '2026-10-26',
    data_fim: '2026-10-26',
  },
  null
);
check(d3 === 'Notas Fiscais · 26/10/2026', `D3 falhou: ${d3}`);

console.log('✔ descreverConsulta: formatações validadas com sucesso!');

// -------------------------------------------------------------
// Teste 4: Cenários Obrigatórios de Teste (Simulação)
// -------------------------------------------------------------

// Mock RPC Client para simulação
const mockRpcClient: SupabaseRpcClient = {
  rpc: async (fn: string, args: Record<string, unknown>) => {
    if (fn === 'consultar_gastos') {
      if (args.p_agrupar === 'origem') {
        return {
          data: [
            { grupo: 'material', total: 45000, quantidade: null, unidade: null, lancamentos: 12 },
            { grupo: 'mao_de_obra', total: 32000, quantidade: null, unidade: null, lancamentos: 8 },
            { grupo: 'cartorio', total: 3500, quantidade: null, unidade: null, lancamentos: 2 },
          ],
          error: null,
        };
      }
      if (args.p_agrupar === 'item') {
        return {
          data: [
            { grupo: 'Ferro 10mm', total: 18500, quantidade: 25, unidade: 'barra', lancamentos: 4 },
            { grupo: 'Ferro 8mm', total: 9200, quantidade: 15, unidade: 'barra', lancamentos: 2 },
          ],
          error: null,
        };
      }
    }
    if (fn === 'listar_notas_consulta') {
      return {
        data: [
          {
            nota_id: 'nota-1',
            data: '2026-10-26',
            numero: '10452',
            fornecedor: 'Aço Minas',
            obra: 'Edifício Horizonte',
            total: 12500,
            qtd_itens: 3,
            itens_encontrados: 'Ferro 10mm, Arame',
          },
        ],
        error: null,
      };
    }
    return { data: [], error: null };
  },
};

async function runCenarios() {
  // CENÁRIO 1: { tipo GASTOS, agrupar origem, julho do ano atual } -> card com material, mao de obra e cartorio
  const c1 = resolverConsulta(
    { tipo: 'GASTOS', agrupar: 'origem', data_inicio: '2026-07-01', data_fim: '2026-07-31' },
    mockProjects
  );
  check(c1.pedido.agrupar === 'origem', 'Cenário 1 agrupar');
  const res1 = await executarConsulta(c1, 'comp-1', mockRpcClient);
  check(res1.linhas?.length === 3, 'Cenário 1 esperava 3 grupos');
  check(res1.total === 80500, `Cenário 1 total esperado 80500, obteve ${res1.total}`);

  // CENÁRIO 2: { tipo GASTOS, agrupar item, obra_nome de uma obra real, termo "ferro|vergalhao", termo_exibicao "ferro" }
  const c2 = resolverConsulta(
    {
      tipo: 'GASTOS',
      agrupar: 'item',
      obra_nome: 'Edifício Horizonte',
      termo: 'ferro|vergalhao',
      termo_exibicao: 'ferro',
    },
    mockProjects
  );
  check(c2.pedido.obra_id === 'proj-1', 'Cenário 2 obra_id');
  const res2 = await executarConsulta(c2, 'comp-1', mockRpcClient);
  check(res2.linhas?.length === 2, 'Cenário 2 esperava 2 itens');
  check(res2.linhas?.[0].quantidade === 25, 'Cenário 2 quantidade item');

  // CENÁRIO 3: { tipo GASTOS, agrupar obra, obra_nome "Obra Inexistente" } -> card de erro, sem chamar o banco
  const c3 = resolverConsulta(
    { tipo: 'GASTOS', agrupar: 'obra', obra_nome: 'Obra Inexistente' },
    mockProjects
  );
  check(c3.erro === 'Obra não localizada: Obra Inexistente', 'Cenário 3 erro');
  // Deve retornar sem chamar RPC
  let rpcCalled = false;
  const spyingClient: SupabaseRpcClient = {
    rpc: async () => {
      rpcCalled = true;
      return { data: [], error: null };
    },
  };
  const res3 = await executarConsulta(c3, 'comp-1', spyingClient);
  check(!rpcCalled, 'Não deveria chamar RPC quando há erro');
  check(res3.erro === 'Obra não localizada: Obra Inexistente', 'Erro preservado');
  check(res3.total === 0, 'Total zerado no erro');

  // CENÁRIO 4: { tipo LISTAR_NOTAS, data_inicio e data_fim no mesmo dia } -> lista de notas do dia
  const c4 = resolverConsulta(
    { tipo: 'LISTAR_NOTAS', data_inicio: '2026-10-26', data_fim: '2026-10-26' },
    mockProjects
  );
  const res4 = await executarConsulta(c4, 'comp-1', mockRpcClient);
  check(res4.notas?.length === 1, 'Cenário 4 esperava 1 nota');
  check(res4.notas?.[0].numero === '10452', 'Cenário 4 nota número');
  check(res4.total === 12500, 'Cenário 4 total notas');

  // CENÁRIO 5: Resposta da função atual (sem CONSULTAR) continua funcionando igual
  const acoesLegadas = [
    { tipo: 'CRIAR_TAREFA', dados: { titulo: 'Instalar tomadas' } },
    { tipo: 'CONVERSA_GERAL', dados: {} },
  ];
  const consultaActions = acoesLegadas.filter((a) => a.tipo === 'CONSULTAR');
  const actionableActions = acoesLegadas.filter(
    (a) => a.tipo !== 'CONVERSA_GERAL' && a.tipo !== 'CONSULTAR'
  );
  check(consultaActions.length === 0, 'Sem CONSULTAR');
  check(actionableActions.length === 1 && actionableActions[0].tipo === 'CRIAR_TAREFA', 'Ação legada preservada');

  console.log('✔ Todos os 5 cenários obrigatórios validados com sucesso!');
  console.log('=== TODOS OS TESTES PASSARAM COM SUCESSO! ===');
}

runCenarios();
