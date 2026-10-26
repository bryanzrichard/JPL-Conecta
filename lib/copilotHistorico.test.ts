import {
  getCopilotStorageKey,
  formatMessageTimestamp,
  formatHoraConsulta,
  formatResumoConsulta,
  saveCopilotHistory,
  loadCopilotHistory,
  clearCopilotHistory,
  sanitizeMessageForStorage,
  buildRecentActivities,
  resetStorageWarningFlagForTest,
  STORAGE_WARNING_MESSAGE,
} from './copilotHistorico';
import type { ChatMessage } from './copilotExecutor';
import { ConsultaResultado } from './copilotConsultas';

// Mock simples de localStorage em memória para os testes em Node/Vitest
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

// Atribui ao global se não existir
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

export function runCopilotHistoricoTests() {
  console.log('--- Iniciando testes de copilotHistorico.ts ---');

  // Teste 1: Chave de armazenamento por empresa e usuário
  {
    const k1 = getCopilotStorageKey('comp-1', 'user-A');
    const k2 = getCopilotStorageKey('comp-1', 'user-B');
    assert(k1 === 'jpl-copiloto:v1:comp-1:user-A', 'Chave deve seguir o formato especificado');
    assert(k1 !== k2, 'Usuários diferentes devem ter chaves distintas');
    console.log('✓ Teste 1: Isolamento de chave multi-usuário');
  }

  // Teste 2: Formatação de horário da mensagem (hoje vs outro dia)
  {
    const now = new Date();
    const todayIso = now.toISOString();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const expectedToday = `${hh}:${mm}`;
    const resultToday = formatMessageTimestamp(todayIso);
    assert(resultToday === expectedToday, `Hoje deve mostrar apenas hora: ${resultToday} === ${expectedToday}`);

    const pastDate = new Date(2026, 9, 24, 14, 32); // 24/10/2026 14:32
    const pastIso = pastDate.toISOString();
    const resultPast = formatMessageTimestamp(pastIso);
    assert(resultPast === '24/10, 14:32', `Outro dia deve mostrar data e hora: ${resultPast}`);
    console.log('✓ Teste 2: Formatação de horário de mensagens');
  }

  // Teste 3: Formatação do rodapé de consulta ("Valores de 20h15" vs "Valores de 26/10, 20h15")
  {
    const now = new Date();
    const todayIso = now.toISOString();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const expectedToday = `Valores de ${hh}h${mm}`;
    const resultToday = formatHoraConsulta(todayIso);
    assert(resultToday === expectedToday, `Hoje deve ser "${expectedToday}", obteve: "${resultToday}"`);

    const pastDate = new Date(2026, 9, 24, 20, 15); // 24/10/2026 20:15
    const pastIso = pastDate.toISOString();
    const resultPast = formatHoraConsulta(pastIso);
    assert(resultPast === 'Valores de 24/10, 20h15', `Outro dia deve ser "Valores de 24/10, 20h15", obteve: "${resultPast}"`);
    console.log('✓ Teste 3: Formatação do rodapé da consulta com data e hora');
  }

  // Teste 4: Formatação de resumo de consulta para o painel de atividades
  {
    const consultaGastos: ConsultaResultado = {
      pedido: { tipo: 'GASTOS' },
      obraNome: 'Solar dos Pássaros',
      total: 4900,
      linhas: [{ grupo: 'Pintura', total: 4900, quantidade: null, unidade: null, lancamentos: 1 }],
    };
    const resumoG = formatResumoConsulta(consultaGastos);
    assert(resumoG.includes('4.900,00'), `Resumo gastos deve ter R$ 4.900,00: ${resumoG}`);

    const consultaNotas: ConsultaResultado = {
      pedido: { tipo: 'LISTAR_NOTAS' },
      obraNome: 'Residencial Alpha',
      total: 1950,
      notas: [
        { nota_id: '1', data: '2026-10-20', numero: '101', fornecedor: 'Depósito X', obra: 'Alpha', total: 1000, itens_encontrados: 'cimento', qtd_itens: 1 },
        { nota_id: '2', data: '2026-10-21', numero: '102', fornecedor: 'Depósito Y', obra: 'Alpha', total: 500, itens_encontrados: 'cimento', qtd_itens: 1 },
        { nota_id: '3', data: '2026-10-22', numero: '103', fornecedor: 'Depósito Z', obra: 'Alpha', total: 450, itens_encontrados: 'cimento', qtd_itens: 1 },
      ],
    };
    const resumoN = formatResumoConsulta(consultaNotas);
    assert(resumoN.includes('3 notas') && resumoN.includes('1.950,00'), `Resumo notas: ${resumoN}`);

    const consultaVazia: ConsultaResultado = {
      pedido: { tipo: 'GASTOS' },
      obraNome: null,
      total: 0,
      linhas: [],
    };
    const resumoVazio = formatResumoConsulta(consultaVazia);
    assert(resumoVazio === 'Nenhum lançamento', `Resumo vazio deve ser 'Nenhum lançamento': ${resumoVazio}`);

    const consultaErro: ConsultaResultado = {
      pedido: { tipo: 'GASTOS' },
      obraNome: 'Inexistente',
      total: 0,
      erro: 'Obra não localizada: Inexistente',
    };
    const resumoErro = formatResumoConsulta(consultaErro);
    assert(resumoErro === 'Obra não localizada: Inexistente', `Resumo erro: ${resumoErro}`);
    console.log('✓ Teste 4: Resumos formatados para o painel de atividades');
  }

  // Teste 5: Sanitização de mensagem e persistência com F5
  {
    const msg: ChatMessage = {
      id: 'msg-1',
      sender: 'ia',
      text: 'Resposta da consulta',
      timestamp: '14:30',
      createdAt: new Date().toISOString(),
      consultando: true, // temporário!
      consultas: [
        {
          pedido: { tipo: 'GASTOS' },
          obraNome: 'Mingone',
          total: 5000,
          carregando: true, // temporário!
          executadoEm: new Date().toISOString(),
        },
      ],
      review: {
        status: 'pending',
        acoes: [],
        items: [],
      },
    };

    const sanitized = sanitizeMessageForStorage(msg);
    assert(sanitized.consultando === false, 'consultando deve ser false ao salvar');
    assert(sanitized.consultas![0].carregando === false, 'carregando deve ser false ao salvar');
    assert(sanitized.review!.status === 'pending', 'card de revisão pendente deve continuar pendente após F5');
    console.log('✓ Teste 5: Sanitização remove estados voláteis e preserva dados vitais');
  }

  // Teste 6: Salvar e carregar histórico com isolamento por usuário
  {
    localStorage.clear();
    const userAMsgs: ChatMessage[] = [
      { id: '1', sender: 'user', text: 'Quanto gastei?', timestamp: '10:00', createdAt: new Date().toISOString() },
      { id: '2', sender: 'ia', text: 'Gasto total:', timestamp: '10:01', createdAt: new Date().toISOString() },
    ];

    saveCopilotHistory('empresa-1', 'user-A', userAMsgs);

    const loadedA = loadCopilotHistory('empresa-1', 'user-A');
    assert(loadedA.length === 2, 'Usuário A deve recuperar suas 2 mensagens');
    assert(loadedA[0].text === 'Quanto gastei?', 'Texto correto de A');

    const loadedB = loadCopilotHistory('empresa-1', 'user-B');
    assert(loadedB.length === 0, 'Usuário B não deve ver as mensagens do usuário A no mesmo aparelho');
    console.log('✓ Teste 6: Persistência no localStorage e isolamento estrito entre usuários');
  }

  // Teste 7: Limpar conversa e recarregar
  {
    clearCopilotHistory('empresa-1', 'user-A');
    const loadedAfterClear = loadCopilotHistory('empresa-1', 'user-A');
    assert(loadedAfterClear.length === 0, 'Após limpar conversa, carregamento deve retornar vazio');
    console.log('✓ Teste 7: Limpar conversa apaga do localStorage e tela');
  }

  // Teste 8: Limite de 100 mensagens mais recentes
  {
    localStorage.clear();
    const manyMsgs: ChatMessage[] = [];
    for (let i = 1; i <= 150; i++) {
      manyMsgs.push({
        id: `msg-${i}`,
        sender: i % 2 === 0 ? 'ia' : 'user',
        text: `Mensagem ${i}`,
        timestamp: '12:00',
        createdAt: new Date().toISOString(),
      });
    }

    saveCopilotHistory('empresa-1', 'user-A', manyMsgs);
    const loaded100 = loadCopilotHistory('empresa-1', 'user-A');
    assert(loaded100.length === 100, `Deve guardar no máximo 100 mensagens (obteve ${loaded100.length})`);
    assert(loaded100[0].text === 'Mensagem 51', 'Deve manter as 100 mais recentes, descartando as primeiras 50');
    assert(loaded100[99].text === 'Mensagem 150', 'Última mensagem deve ser a 150');
    console.log('✓ Teste 8: Limite estrito de 100 mensagens mais recentes');
  }

  // Teste 9: Tratar dado corrompido com aviso uma única vez
  {
    resetStorageWarningFlagForTest();
    const key = getCopilotStorageKey('empresa-1', 'user-corrupt');
    localStorage.setItem(key, '{ invalid json');

    let warningCount = 0;
    let warningMsg = '';
    const onWarning = (msg: string) => {
      warningCount++;
      warningMsg = msg;
    };

    const loadedCorrupt = loadCopilotHistory('empresa-1', 'user-corrupt', onWarning);
    assert(loadedCorrupt.length === 0, 'Dado corrompido deve retornar conversa vazia');
    assert(warningCount === 1, 'Deve emitir aviso discreto exatamente uma vez');
    assert(warningMsg === STORAGE_WARNING_MESSAGE, 'Mensagem de aviso correta');

    // Segunda chamada não deve repetir o aviso
    loadCopilotHistory('empresa-1', 'user-corrupt', onWarning);
    assert(warningCount === 1, 'Não deve repetir o aviso no segundo carregamento');
    console.log('✓ Teste 9: Tratamento de dado corrompido e aviso emitido uma única vez');
  }

  // Teste 10: buildRecentActivities unifica ações gravadas e consultas da mais recente para a mais antiga
  {
    const msgs: ChatMessage[] = [
      {
        id: 'msg-1',
        sender: 'ia',
        text: 'Consulta 1',
        timestamp: '10:00',
        consultas: [
          {
            pedido: { tipo: 'GASTOS', obra_nome: 'Obra 1' },
            obraNome: 'Obra 1',
            total: 1000,
            executadoEm: new Date(2026, 9, 26, 10, 0).toISOString(),
          },
        ],
      },
      {
        id: 'msg-2',
        sender: 'ia',
        text: 'Ação 2',
        timestamp: '10:05',
        cards: [
          {
            tipo: 'servico',
            badge: 'Serviço',
            titulo: 'Pintura executada',
            subtitulo: 'R$ 2.000,00',
            sucesso: true,
          },
        ],
      },
      {
        id: 'msg-3',
        sender: 'ia',
        text: 'Consulta 3',
        timestamp: '10:10',
        consultas: [
          {
            pedido: { tipo: 'LISTAR_NOTAS', obra_nome: 'Obra 2' },
            obraNome: 'Obra 2',
            total: 500,
            executadoEm: new Date(2026, 9, 26, 10, 10).toISOString(),
          },
        ],
      },
    ];

    const activities = buildRecentActivities(msgs);
    assert(activities.length === 3, `Deve ter 3 atividades, obteve ${activities.length}`);
    assert(activities[0].tipo === 'consulta' && activities[0].titulo.includes('Obra 2'), 'Mais recente deve ser a Consulta 3');
    assert(activities[1].tipo === 'servico' && activities[1].titulo === 'Pintura executada', 'Segunda mais recente deve ser a Ação 2');
    assert(activities[2].tipo === 'consulta' && activities[2].titulo.includes('Obra 1'), 'Terceira mais recente deve ser a Consulta 1');
    console.log('✓ Teste 10: buildRecentActivities unificado e ordenado do mais recente para o mais antigo');
  }

  console.log('=== TODOS OS 10 TESTES PASSARAM COM SUCESSO! ===\n');
}

runCopilotHistoricoTests();
