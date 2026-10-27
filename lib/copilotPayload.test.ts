import { montarContextoCopiloto } from './copilotPayload';
import { parseCompraItens } from './compraItens';
import { Project, Collaborator, Task } from '../types';

let passed = 0;
let failed = 0;

function check(description: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${description}${detail ? ` -> ${detail}` : ''}`);
    failed++;
  }
}

console.log('=== Testes de Payload do Copiloto (lib/copilotPayload.ts) ===\n');

const projects: Project[] = [
  {
    id: 'proj-1',
    company_id: 'comp-1',
    name: 'Residencial Mingone',
    status: 'Em Andamento',
    start_date: '2026-01-01',
    end_date: null,
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'proj-2',
    company_id: 'comp-1',
    name: 'Galpão Industrial',
    status: 'Em Andamento',
    start_date: '2026-02-01',
    end_date: null,
    created_by: 'user-1',
    created_at: '2026-02-01T00:00:00Z',
  },
];

const collaborators: Collaborator[] = [
  {
    id: 'colab-1',
    company_id: 'comp-1',
    name: 'João Pedreiro',
    role: 'Pedreiro',
    phone: '11999999999',
    rating: 5,
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'colab-2',
    company_id: 'comp-1',
    name: 'Carlos Eletricista',
    role: 'Eletricista',
    phone: '11888888888',
    rating: 5,
    created_by: 'user-1',
    created_at: '2026-01-02T00:00:00Z',
  },
];

const allTasks: Task[] = [
  // 1) Compra com itens não comprados (e 1 já comprado para testar filtro)
  {
    id: 'task-1',
    company_id: 'comp-1',
    project_id: 'proj-1',
    title: 'Compra de materiais básicos',
    description: '[COMPRA] Materiais alvenaria',
    status: 'Planejada',
    prioridade: 'Alta',
    data_inicio_prevista: '2026-10-26',
    data_fim_prevista: '2026-10-27',
    responsavel_execucao_id: 'colab-1',
    created_by: 'user-1',
    observacoes: '[COMPRA]',
    materiais_previstos: [
      { nome: 'Cimento', quantidade: 10, unidade: 'saco', comprado: false },
      { nome: 'Areia', quantidade: 2, unidade: 'm³', comprado: true },
      { nome: 'Cal', quantidade: 5, unidade: 'saco', comprado: false },
    ],
    equipamentos_utilizados: null,
    custo_real: 0,
    created_at: '2026-10-26T10:00:00Z',
  },
  // 2) Compra com todos os itens comprados (não deve incluir propriedade "itens")
  {
    id: 'task-2',
    company_id: 'comp-1',
    project_id: 'proj-2',
    title: 'Compra elétrica',
    description: 'Fios e disjuntores',
    status: 'Em Execução',
    prioridade: 'Média',
    data_inicio_prevista: '2026-10-25',
    data_fim_prevista: '2026-10-28',
    responsavel_execucao_id: null,
    created_by: 'user-1',
    observacoes: '[COMPRA]',
    materiais_previstos: [
      { nome: 'Cabo 2.5mm', quantidade: 100, unidade: 'm', comprado: true },
    ],
    equipamentos_utilizados: null,
    custo_real: 0,
    created_at: '2026-10-25T10:00:00Z',
  },
  // 3) Tarefa concluída (deve ser filtrada de pendingTasksList)
  {
    id: 'task-3',
    company_id: 'comp-1',
    project_id: 'proj-1',
    title: 'Concretagem da laje',
    description: 'Laje piso superior',
    status: 'Concluída',
    prioridade: 'Alta',
    data_inicio_prevista: '2026-10-20',
    data_fim_prevista: '2026-10-21',
    responsavel_execucao_id: 'colab-2',
    created_by: 'user-1',
    observacoes: null,
    materiais_previstos: null,
    equipamentos_utilizados: null,
    custo_real: 0,
    created_at: '2026-10-20T10:00:00Z',
  },
];

const projectsMap = new Map(projects.map((p) => [p.id, p]));
const collaboratorsMap = new Map(collaborators.map((c) => [c.id, c]));

// Lógica antiga copiada exatamente como referência de comparação
const legacyOutput = {
  projectsList: projects.map((p) => ({ id: p.id, name: p.name })),
  collaboratorsList: collaborators.map((c) => ({ id: c.id, name: c.name })),
  pendingTasksList: allTasks
    .filter((t) => t.status !== 'Concluída')
    .map((t) => {
      const isPurchase =
        (t.observacoes || '').includes('[COMPRA]') ||
        (t.description || '').toLowerCase().includes('[compra]');
      const itens = isPurchase
        ? parseCompraItens(t.materiais_previstos)
            .filter((i) => !i.comprado)
            .map((i) => ({ nome: i.nome, quantidade: i.quantidade, unidade: i.unidade }))
        : undefined;
      return {
        id: t.id,
        title: t.title,
        obra: projectsMap.get(t.project_id)?.name || 'Geral',
        responsavel: t.responsavel_execucao_id
          ? collaboratorsMap.get(t.responsavel_execucao_id)?.name
          : null,
        data_prevista: t.data_fim_prevista,
        isPurchase,
        ...(itens && itens.length > 0 ? { itens } : {}),
      };
    }),
};

const newOutput = montarContextoCopiloto({
  projects,
  collaborators,
  allTasks,
  projectsMap,
  collaboratorsMap,
});

check(
  'JSON.stringify de montarContextoCopiloto é idêntico à lógica antiga',
  JSON.stringify(newOutput) === JSON.stringify(legacyOutput),
  `Esperado: ${JSON.stringify(legacyOutput)}\nObtido: ${JSON.stringify(newOutput)}`
);

check(
  'Tarefa concluída não entra em pendingTasksList (2 pendentes de 3 totais)',
  newOutput.pendingTasksList.length === 2
);

check(
  'Compra com itens não comprados inclui apenas os itens pendentes (2 itens)',
  Array.isArray(newOutput.pendingTasksList[0].itens) &&
    newOutput.pendingTasksList[0].itens?.length === 2 &&
    newOutput.pendingTasksList[0].itens[0].nome === 'Cimento' &&
    newOutput.pendingTasksList[0].itens[1].nome === 'Cal'
);

check(
  'Compra com todos os itens comprados omite a chave "itens"',
  !('itens' in newOutput.pendingTasksList[1])
);

console.log(`\nResultado final: ${passed} passaram, ${failed} falharam.`);
if (failed > 0) {
  process.exit(1);
}
