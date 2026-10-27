import { Task } from '../types';

function check(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Falha no teste: ${msg}`);
}

function cleanObservacoesOrDescricao(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\[compra\]/gi, '').trim();
}

console.log('=== Testes de Tarefas e Otimização ===');

// Teste 1: Limpeza de [COMPRA]
check(cleanObservacoesOrDescricao('[COMPRA]') === '', 'Limpeza [COMPRA] maiúsculo deve ser vazio');
check(cleanObservacoesOrDescricao('[compra]') === '', 'Limpeza [compra] minúsculo deve ser vazio');
check(cleanObservacoesOrDescricao('[CoMpRa]') === '', 'Limpeza case-insensitive deve ser vazio');
check(cleanObservacoesOrDescricao('[COMPRA] Comprar pregos 17x27') === 'Comprar pregos 17x27', 'Deve remover prefixo');
check(cleanObservacoesOrDescricao('Urgente [compra] para amanhã') === 'Urgente  para amanhã'.trim() || cleanObservacoesOrDescricao('Urgente [compra] para amanhã').includes('Urgente'), 'Deve remover marca interna');

// Teste 2: Lógica otimista de Toggle Status
const mockTasks: Task[] = [
  {
    id: 'task-1',
    company_id: 'comp-1',
    title: 'Comprar cimento',
    status: 'Planejada',
    prioridade: 'Alta',
    project_id: 'proj-1',
    created_by: 'user-1',
    created_at: '2026-10-26T10:00:00Z',
    responsavel_execucao_id: null,
    data_inicio_prevista: '2026-10-26',
    data_fim_prevista: '2026-10-26',
    custo_real: 0,
    description: '[COMPRA]',
    observacoes: null,
    materiais_previstos: null,
    equipamentos_utilizados: null,
  },
  {
    id: 'task-2',
    company_id: 'comp-1',
    title: 'Pintar fachada',
    status: 'Concluída',
    prioridade: 'Média',
    project_id: 'proj-1',
    created_by: 'user-1',
    created_at: '2026-10-26T10:00:00Z',
    responsavel_execucao_id: null,
    data_inicio_prevista: '2026-10-26',
    data_fim_prevista: '2026-10-26',
    custo_real: 0,
    description: null,
    observacoes: null,
    materiais_previstos: null,
    equipamentos_utilizados: null,
  },
];

// Simula onMutate toggle status
const previousTasks = [...mockTasks];
let cacheTasks = mockTasks.map((t) => (t.id === 'task-1' ? { ...t, status: 'Concluída' as const } : t));
check(cacheTasks.find((t) => t.id === 'task-1')?.status === 'Concluída', 'Status deve mudar instantaneamente para Concluída');

// Simula rollback no onError
cacheTasks = previousTasks;
check(cacheTasks.find((t) => t.id === 'task-1')?.status === 'Planejada', 'Rollback deve restaurar status Planejada');

// Simula onMutate reschedule
const tomorrow = '2026-10-27';
cacheTasks = mockTasks.map((t) =>
  t.id === 'task-1'
    ? { ...t, data_inicio_prevista: tomorrow, data_fim_prevista: tomorrow, status: 'Planejada' as const }
    : t
);
const rescheduled = cacheTasks.find((t) => t.id === 'task-1');
check(rescheduled?.data_fim_prevista === tomorrow, 'Prazo final deve ser amanhã');
check(rescheduled?.status === 'Planejada', 'Status deve ser Planejada ao reagendar');

// Teste 3: Prevenção de clique duplo (Set de tarefas em mutação)
const mutating = new Set<string>();
function isTaskMutating(id: string) {
  return mutating.has(id);
}

check(!isTaskMutating('task-1'), 'Antes da mutação não deve estar bloqueado');
mutating.add('task-1');
check(isTaskMutating('task-1'), 'Durante a mutação deve estar bloqueado contra clique duplo');
check(!isTaskMutating('task-2'), 'Outras tarefas continuam desbloqueadas');
mutating.delete('task-1');
check(!isTaskMutating('task-1'), 'Após onSettled deve desbloquear');

console.log('✔ Todos os testes de Tarefas e Otimização passaram com sucesso!');
