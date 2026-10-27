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
  executeGuardedConfirm,
} from './copilotHistorico';
import {
  extrairErroCopilot,
  formatarMensagemErroCopilot,
  MSG_IA_SOBRECARREGADA,
  MSG_IA_LIMITE,
  SUFIXO_AUDIO,
} from './copilotErros';
import type { ChatMessage, PendingReviewData } from './copilotExecutor';
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

export async function runCopilotHistoricoTests() {
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
    assert(
      sanitized.consultas![0].erro === 'Consulta interrompida. Clique em Atualizar.',
      'consulta com carregando=true deve receber erro de interrupção ao salvar'
    );
    assert(sanitized.review!.status === 'pending', 'card de revisão pendente deve continuar pendente após F5');
    console.log('✓ Teste 5: Sanitização remove estados voláteis e marca erro de interrupção');
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

  // Teste 11 (Defeito 1): Salvar consulta com carregando=true e ler
  {
    localStorage.clear();
    const msgWithLoadingConsulta: ChatMessage = {
      id: 'msg-consulta-interrompida',
      sender: 'ia',
      text: 'Gasto da obra',
      timestamp: '14:00',
      createdAt: new Date().toISOString(),
      consultas: [
        {
          pedido: { tipo: 'GASTOS', obra_nome: 'Edifício Horizonte' },
          obraNome: 'Edifício Horizonte',
          total: 0,
          linhas: [],
          carregando: true, // Interrompido durante consulta!
        },
      ],
    };

    saveCopilotHistory('empresa-1', 'user-test', [msgWithLoadingConsulta]);
    const loaded = loadCopilotHistory('empresa-1', 'user-test');

    assert(loaded.length === 1, 'Deve carregar 1 mensagem');
    const consulta = loaded[0].consultas?.[0];
    assert(!!consulta, 'Deve conter consulta');
    assert(consulta.carregando === false, 'carregando deve ser false após carregar histórico');
    assert(
      consulta.erro === 'Consulta interrompida. Clique em Atualizar.',
      `erro deve ser 'Consulta interrompida. Clique em Atualizar.', obteve: '${consulta.erro}'`
    );
    const resumo = formatResumoConsulta(consulta);
    assert(
      resumo === 'Consulta interrompida. Clique em Atualizar.',
      `resumo no painel de atividades deve ser igual ao erro, obteve: '${resumo}'`
    );

    // Teste 11b: dados salvos diretamente com carregando=true (versão antiga no localStorage)
    const key = getCopilotStorageKey('empresa-1', 'user-legacy');
    localStorage.setItem(
      key,
      JSON.stringify([
        {
          id: 'msg-legacy',
          sender: 'ia',
          text: 'Consulta legado',
          consultas: [{ pedido: { tipo: 'GASTOS' }, carregando: true, linhas: [], total: 0 }],
        },
      ])
    );
    const loadedLegacy = loadCopilotHistory('empresa-1', 'user-legacy');
    assert(loadedLegacy[0].consultas?.[0].carregando === false, 'carregando legado deve virar false');
    assert(
      loadedLegacy[0].consultas?.[0].erro === 'Consulta interrompida. Clique em Atualizar.',
      'deve injetar erro de interrupção em dados legados'
    );
    console.log('✓ Teste 11: Salvar consulta com carregando=true e ler vem com erro e resumo correto');
  }

  // Teste 12 (Defeito 1): formatResumoConsulta com carregando=true retorna "Consultando..."
  {
    const consultaEmAndamento: ConsultaResultado = {
      pedido: { tipo: 'GASTOS' },
      obraNome: 'Residencial Bela Vista',
      carregando: true,
      total: 0,
      linhas: [],
    };
    const resumo = formatResumoConsulta(consultaEmAndamento);
    assert(
      resumo === 'Consultando...',
      `formatResumoConsulta com carregando=true deve ser 'Consultando...', obteve: '${resumo}'`
    );
    console.log('✓ Teste 12: formatResumoConsulta com carregando=true retorna "Consultando..."');
  }

  // Teste 13 (Defeito 2): Salvar review com status 'executando' e ler: vem como 'interrompida'
  {
    localStorage.clear();
    const msgExecutando: ChatMessage = {
      id: 'msg-exec-1',
      sender: 'ia',
      text: 'Revisão em andamento',
      timestamp: '15:00',
      createdAt: new Date().toISOString(),
      review: {
        status: 'executando',
        acoes: [],
        items: [
          {
            id: 'item-1',
            tipo: 'CRIAR_TAREFA',
            badge: 'Tarefa',
            obraLabel: 'Obra 1',
            titulo: 'Comprar pregos',
            detalhes: '5 kg',
          },
        ],
      },
    };

    saveCopilotHistory('empresa-1', 'user-exec', [msgExecutando]);
    const loaded = loadCopilotHistory('empresa-1', 'user-exec');

    assert(loaded.length === 1, 'Deve carregar 1 mensagem');
    assert(!!loaded[0].review, 'Mensagem deve conter review');
    assert(
      loaded[0].review.status === 'interrompida',
      `review com status 'executando' deve virar 'interrompida' ao ser lida, obteve: '${loaded[0].review.status}'`
    );
    console.log('✓ Teste 13: Salvar review com status "executando" e ler vem como "interrompida"');
  }

  // Teste 14 (Defeito 2): Dois cliques seguidos em Confirmar: a execução é chamada uma única vez
  {
    let executeCalls = 0;
    const statusHolder: { current: PendingReviewData['status'] } = { current: 'pending' };
    const activeTestSet = new Set<string>();

    const onExecute = async () => {
      executeCalls++;
      await new Promise((resolve) => setTimeout(resolve, 50));
    };

    // Dispara dois cliques simultâneos para a mesma mensagem
    const p1 = executeGuardedConfirm({
      messageId: 'msg-confirm-double',
      getStatus: () => statusHolder.current,
      onSetStatus: (status) => {
        statusHolder.current = status;
      },
      onExecute,
      activeSet: activeTestSet,
    });

    const p2 = executeGuardedConfirm({
      messageId: 'msg-confirm-double',
      getStatus: () => statusHolder.current,
      onSetStatus: (status) => {
        statusHolder.current = status;
      },
      onExecute,
      activeSet: activeTestSet,
    });

    const [res1, res2] = await Promise.all([p1, p2]);

    assert(executeCalls === 1, `A execução deve ser chamada uma única vez, obteve ${executeCalls} chamadas`);
    assert((res1 && !res2) || (!res1 && res2), 'Uma chamada deve ter sido aceita e a outra ignorada');
    assert(statusHolder.current === 'confirmed', `Status final deve ser confirmed, obteve: '${statusHolder.current}'`);

    // Clique adicional quando já está confirmed também deve ser ignorado
    const p3 = await executeGuardedConfirm({
      messageId: 'msg-confirm-double',
      getStatus: () => statusHolder.current,
      onSetStatus: (status) => {
        statusHolder.current = status;
      },
      onExecute,
      activeSet: activeTestSet,
    });
    assert(p3 === false, 'Clique adicional após confirmação concluída deve ser ignorado');
    assert(executeCalls === 1, 'Chamadas continuam sendo 1');

    console.log('✓ Teste 14: Dois cliques seguidos em Confirmar executam uma única vez');
  }

  // Teste 15: Simular resposta 503 com código IA_SOBRECARREGADA
  {
    const mockHttpError = {
      context: {
        json: async () => ({ error: 'Service Unavailable', codigo: 'IA_SOBRECARREGADA' }),
      },
      message: 'FunctionsHttpError: 503',
    };

    const erroInfo = await extrairErroCopilot(mockHttpError);
    assert(erroInfo.codigo === 'IA_SOBRECARREGADA', 'deve extrair código IA_SOBRECARREGADA');

    const msgTexto = formatarMensagemErroCopilot({
      codigo: erroInfo.codigo,
      origem: 'texto',
      detalhe: erroInfo.detalhe,
    });
    assert(msgTexto === MSG_IA_SOBRECARREGADA, `mensagem de texto deve ser "${MSG_IA_SOBRECARREGADA}"`);

    // Mensagem de texto ganha o texto para o botão Reenviar
    const chatMsg: ChatMessage = {
      id: 'err-1',
      sender: 'ia',
      text: msgTexto,
      timestamp: '10:00',
      retryText: 'comprar 10 sacos de cimento',
    };
    assert(!!chatMsg.retryText, 'mensagem de erro de texto deve possuir retryText para o botão Reenviar');
    console.log('✓ Teste 15: Resposta 503 com IA_SOBRECARREGADA exibe mensagem correta e possui botão Reenviar');
  }

  // Teste 16: Simular resposta com código IA_LIMITE
  {
    const mockHttpError = {
      context: {
        json: async () => ({ error: 'Resource Exhausted', codigo: 'IA_LIMITE' }),
      },
      message: 'FunctionsHttpError: 429',
    };

    const erroInfo = await extrairErroCopilot(mockHttpError);
    assert(erroInfo.codigo === 'IA_LIMITE', 'deve extrair código IA_LIMITE');

    const msgTexto = formatarMensagemErroCopilot({
      codigo: erroInfo.codigo,
      origem: 'texto',
      detalhe: erroInfo.detalhe,
    });
    assert(msgTexto === MSG_IA_LIMITE, `mensagem de texto deve ser "${MSG_IA_LIMITE}"`);
    console.log('✓ Teste 16: Resposta com IA_LIMITE exibe mensagem de limite correta');
  }

  // Teste 17: Simular 500 com ERRO_INTERNO e falha de rede (mantém mensagem de deploy / API_KEY)
  {
    const mockHttp500 = {
      context: {
        json: async () => ({ error: 'Function crashed', codigo: 'ERRO_INTERNO' }),
      },
      message: 'FunctionsHttpError: 500',
    };
    const erro500 = await extrairErroCopilot(mockHttp500);
    assert(erro500.codigo === 'ERRO_INTERNO', 'deve extrair ERRO_INTERNO no 500');
    const msg500 = formatarMensagemErroCopilot({
      codigo: erro500.codigo,
      origem: 'texto',
      detalhe: erro500.detalhe,
    });
    assert(msg500.includes('Verifique o deploy de "processar-comando-voz" ou a API_KEY'), 'deve orientar verificar deploy/API_KEY');

    // Falha de rede (sem corpo HTTP)
    const mockNetworkError = new Error('Failed to fetch / NetworkError');
    const erroRede = await extrairErroCopilot(mockNetworkError);
    assert(erroRede.codigo === 'ERRO_INTERNO', 'falha de rede deve ser tratada como ERRO_INTERNO');
    const msgRede = formatarMensagemErroCopilot({
      codigo: erroRede.codigo,
      origem: 'texto',
      detalhe: erroRede.detalhe,
    });
    assert(msgRede.includes('Verifique o deploy de "processar-comando-voz" ou a API_KEY'), 'falha de rede orienta deploy/API_KEY');
    console.log('✓ Teste 17: ERRO_INTERNO e falha de rede mantêm mensagem de verificação de deploy / API_KEY');
  }

  // Teste 18: Erro em áudio: sem retryText, mensagem termina com "Grave o áudio de novo."
  {
    const mockAudioError = {
      context: {
        json: async () => ({ error: 'Overloaded', codigo: 'IA_SOBRECARREGADA' }),
      },
    };
    const erroAudio = await extrairErroCopilot(mockAudioError);
    const msgAudio = formatarMensagemErroCopilot({
      codigo: erroAudio.codigo,
      origem: 'audio',
      detalhe: erroAudio.detalhe,
    });
    assert(msgAudio.endsWith(SUFIXO_AUDIO), `mensagem de áudio deve terminar com '${SUFIXO_AUDIO}', obteve: '${msgAudio}'`);

    const chatAudioMsg: ChatMessage = {
      id: 'audio-err-1',
      sender: 'ia',
      text: msgAudio,
      timestamp: '10:00',
    };
    assert(chatAudioMsg.retryText === undefined, 'erro de áudio não deve ter retryText (sem botão Reenviar)');
    console.log('✓ Teste 18: Erro em áudio termina com "Grave o áudio de novo." e não possui botão Reenviar');
  }

  // Teste 19: Reenviar com sucesso substitui a mensagem de erro sem duplicar mensagem do usuário
  {
    let messages: ChatMessage[] = [
      { id: 'user-1', sender: 'user', text: 'pintar sala', timestamp: '10:00' },
      { id: 'ia-err-1', sender: 'ia', text: MSG_IA_SOBRECARREGADA, timestamp: '10:01', retryText: 'pintar sala' },
    ];

    // Simula clique em "Reenviar": estado entra em reenviando
    messages = messages.map((m) => (m.id === 'ia-err-1' ? { ...m, reenviando: true } : m));
    assert(messages[1].reenviando === true, 'botão deve entrar em estado Reenviando...');

    // Resposta bem sucedida recebida: substitui a mensagem 'ia-err-1' diretamente
    const respostaSucesso: ChatMessage = {
      id: 'ia-err-1',
      sender: 'ia',
      text: 'Serviço de pintura registrado com sucesso.',
      timestamp: '10:02',
    };
    messages = messages.map((m) => (m.id === 'ia-err-1' ? respostaSucesso : m));

    // Verificações
    const userMsgs = messages.filter((m) => m.sender === 'user');
    assert(userMsgs.length === 1, `não deve duplicar mensagem do usuário (esperado 1, obteve ${userMsgs.length})`);
    assert(messages.length === 2, 'conversa deve conter exatamente 2 mensagens');
    assert(messages[1].text === 'Serviço de pintura registrado com sucesso.', 'mensagem de erro foi substituída');
    assert(messages[1].retryText === undefined, 'botão Reenviar foi removido após sucesso');
    console.log('✓ Teste 19: Reenviar com sucesso substitui o erro e não duplica a mensagem do usuário');
  }

  // Teste 20: F5 com erro de texto na tela: retryText é preservado e reenviando é resetado
  {
    localStorage.clear();
    const msgComErroTexto: ChatMessage = {
      id: 'msg-erro-f5',
      sender: 'ia',
      text: MSG_IA_SOBRECARREGADA,
      timestamp: '11:00',
      createdAt: new Date().toISOString(),
      retryText: 'comprar 5 latas de tinta',
      reenviando: true, // Se usuário der F5 no meio do envio
    };

    saveCopilotHistory('empresa-1', 'user-retry', [msgComErroTexto]);
    const loaded = loadCopilotHistory('empresa-1', 'user-retry');

    assert(loaded.length === 1, 'deve carregar 1 mensagem');
    assert(loaded[0].retryText === 'comprar 5 latas de tinta', 'retryText deve ser preservado após F5');
    assert(loaded[0].reenviando === false, 'reenviando deve ser resetado para false após F5 para permitir novo clique');
    console.log('✓ Teste 20: F5 preserva retryText e reseta reenviando, mantendo o botão Reenviar funcional');
  }

  console.log('=== TODOS OS 20 TESTES PASSARAM COM SUCESSO! ===\n');
}

runCopilotHistoricoTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
