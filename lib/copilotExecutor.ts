import { supabase } from './supabaseClient';
import { Project, Collaborator } from '../types';
import { toISODate } from './taskParser';

export interface CopilotActionDados {
  // Colaborador
  nome?: string;
  role?: string;
  phone?: string;
  document?: string;

  // Serviço
  descricao?: string;
  obra_id?: string | null;
  obra_nome?: string;
  colaborador_id?: string | null;
  colaborador_nome?: string;
  valor_total?: number;
  valor_adiantamento?: number;
  saldo_restante?: number;
  observacoes?: string;

  // Tarefa / Compras
  titulo?: string;
  tarefa_id?: string | null;
  tarefa_titulo?: string;
  responsavel_id?: string | null;
  responsavel_nome?: string;
  data_prevista?: string;
  is_compra?: boolean;

  // Quitação / Pagamento de Serviço
  servico_id?: string | null;
  servico_nome?: string;
  valor_pago?: number;
}

export interface CopilotAction {
  tipo: 'CADASTRAR_COLABORADOR' | 'CRIAR_SERVICO' | 'CRIAR_TAREFA' | 'CONCLUIR_TAREFA' | 'QUITAR_SERVICO' | 'CONVERSA_GERAL';
  dados: CopilotActionDados;
}

export interface CopilotResponse {
  transcricao?: string;
  resumo_ia: string;
  acoes?: CopilotAction[];
}

export interface ActionCardResult {
  tipo: string;
  badge: string;
  titulo: string;
  subtitulo: string;
  detalhes?: string;
  sucesso: boolean;
}

export interface ActionReviewItem {
  id: string;
  tipo: CopilotAction['tipo'];
  badge: string;
  titulo: string;
  obraLabel: string;
  responsavelLabel?: string;
  valoresLabel?: string;
  dataLabel?: string;
  detalhes?: string;
}

export interface PendingReviewData {
  acoes: CopilotAction[];
  items: ActionReviewItem[];
  status: 'pending' | 'confirmed' | 'cancelled';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ia';
  text: string;
  timestamp: string;
  cards?: ActionCardResult[];
  review?: PendingReviewData;
}

export function formatBRL(val?: number | null): string {
  if (val === undefined || val === null || isNaN(Number(val))) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val));
}

export function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * 2.2: Busca obra por nome:
 * 1º igualdade exata sem acento e sem maiúsculas
 * 2º só depois "contém". Se mais de um candidato casar no "contém", não escolher (retornar null).
 */
export function findProjectByName(nameQuery: string | undefined | null, projects: Project[]): Project | null {
  if (!nameQuery) return null;
  const qNorm = normalizeText(nameQuery);
  if (!qNorm) return null;

  const exactMatch = projects.find((p) => normalizeText(p.name) === qNorm);
  if (exactMatch) return exactMatch;

  const candidates = projects.filter((p) => {
    const pNorm = normalizeText(p.name);
    return pNorm.includes(qNorm) || qNorm.includes(pNorm);
  });

  if (candidates.length === 1) {
    return candidates[0];
  }

  return null;
}

/**
 * 2.2: Busca colaborador por nome:
 * 1º igualdade exata sem acento e sem maiúsculas
 * 2º só depois "contém". Se mais de um candidato casar no "contém", não escolher (retornar null).
 */
export function findCollaboratorByName(nameQuery: string | undefined | null, collaborators: Collaborator[]): Collaborator | null {
  if (!nameQuery) return null;
  const qNorm = normalizeText(nameQuery);
  if (!qNorm) return null;

  const exactMatch = collaborators.find((c) => normalizeText(c.name) === qNorm);
  if (exactMatch) return exactMatch;

  const candidates = collaborators.filter((c) => {
    const cNorm = normalizeText(c.name);
    return cNorm.includes(qNorm) || qNorm.includes(cNorm);
  });

  if (candidates.length === 1) {
    return candidates[0];
  }

  return null;
}

/**
 * Constrói a lista visual de itens para o card de revisão antes de gravar no banco
 */
export function buildActionReviewItems(
  acoes: CopilotAction[],
  projects: Project[],
  collaborators: Collaborator[]
): ActionReviewItem[] {
  const todayStr = toISODate(new Date());

  return acoes.map((acao, index) => {
    const id = `review-${index}-${Date.now()}`;

    if (acao.tipo === 'CADASTRAR_COLABORADOR') {
      const nome = acao.dados.nome?.trim() || 'Colaborador sem nome';
      return {
        id,
        tipo: acao.tipo,
        badge: '👷 Colaborador',
        titulo: nome,
        obraLabel: 'Geral / Empresa',
        responsavelLabel: `Função: ${acao.dados.role || 'Prestador de Serviço'}`,
        detalhes: `Tel: ${acao.dados.phone || 'Não informado'}${acao.dados.document ? ` • Doc: ${acao.dados.document}` : ''}`,
      };
    }

    if (acao.tipo === 'CRIAR_SERVICO') {
      const descricao = acao.dados.descricao?.trim() || 'Serviço de Empreitada';
      const valorTotal = Number(acao.dados.valor_total) || 0;
      const valorAdiantamento = Number(acao.dados.valor_adiantamento) || 0;
      const saldo = Math.max(0, valorTotal - valorAdiantamento);

      const p = acao.dados.obra_id
        ? projects.find((proj) => proj.id === acao.dados.obra_id)
        : findProjectByName(acao.dados.obra_nome, projects);
      const obraLabel = p?.name || 'Obra não identificada';

      const c = acao.dados.colaborador_id
        ? collaborators.find((col) => col.id === acao.dados.colaborador_id)
        : findCollaboratorByName(acao.dados.colaborador_nome, collaborators);
      const responsavelLabel = c?.name || acao.dados.colaborador_nome || 'Não informado';

      return {
        id,
        tipo: acao.tipo,
        badge: '🏗️ Criar Serviço',
        titulo: descricao,
        obraLabel,
        responsavelLabel: `Prestador: ${responsavelLabel}`,
        valoresLabel: `Total: ${formatBRL(valorTotal)} • Adiantamento: ${formatBRL(valorAdiantamento)} • Saldo: ${formatBRL(saldo)}`,
        dataLabel: `Início: ${todayStr}`,
      };
    }

    if (acao.tipo === 'CRIAR_TAREFA') {
      const titulo = acao.dados.titulo?.trim() || 'Nova Tarefa';
      const isPurchase = acao.dados.is_compra || (acao.dados.observacoes || '').includes('[COMPRA]');

      const p = acao.dados.obra_id
        ? projects.find((proj) => proj.id === acao.dados.obra_id)
        : findProjectByName(acao.dados.obra_nome, projects);
      const obraLabel = p?.name || 'Obra não identificada';

      const c = acao.dados.responsavel_id
        ? collaborators.find((col) => col.id === acao.dados.responsavel_id)
        : findCollaboratorByName(acao.dados.responsavel_nome, collaborators);
      const responsavelLabel = c?.name || acao.dados.responsavel_nome || 'Não informado';

      return {
        id,
        tipo: acao.tipo,
        badge: isPurchase ? '🛒 Lista de Compras' : '📋 Criar Tarefa',
        titulo,
        obraLabel,
        responsavelLabel: `Responsável: ${responsavelLabel}`,
        dataLabel: `Data: ${acao.dados.data_prevista || todayStr}`,
      };
    }

    if (acao.tipo === 'CONCLUIR_TAREFA') {
      const titulo = acao.dados.titulo?.trim() || acao.dados.tarefa_titulo?.trim() || 'Concluir Pendência';
      return {
        id,
        tipo: acao.tipo,
        badge: '✅ Concluir Tarefa',
        titulo,
        obraLabel: acao.dados.obra_nome || 'Obra vinculada',
        responsavelLabel: acao.dados.responsavel_nome ? `Responsável: ${acao.dados.responsavel_nome}` : undefined,
        detalhes: 'Marcar como Concluída no canteiro',
      };
    }

    if (acao.tipo === 'QUITAR_SERVICO') {
      const titulo = acao.dados.servico_nome?.trim() || acao.dados.descricao?.trim() || 'Serviço';
      const valorPago = Number(acao.dados.valor_pago) || 0;
      return {
        id,
        tipo: acao.tipo,
        badge: '💰 Quitar / Pagar Serviço',
        titulo,
        obraLabel: acao.dados.obra_nome || 'Obra vinculada',
        valoresLabel: `Valor a pagar: ${formatBRL(valorPago)}`,
        dataLabel: `Data: ${todayStr}`,
      };
    }

    return {
      id,
      tipo: acao.tipo,
      badge: '💬 Informação',
      titulo: 'Conversa Geral',
      obraLabel: 'Geral',
    };
  });
}

/**
 * Executa as ações retornadas pelo Gemini Flash no banco de dados do Supabase
 */
export async function executeCopilotActions({
  acoes,
  companyId,
  userId,
  projects,
  collaborators,
}: {
  acoes: CopilotAction[];
  companyId: string;
  userId: string;
  projects: Project[];
  collaborators: Collaborator[];
}): Promise<ActionCardResult[]> {
  const results: ActionCardResult[] = [];
  const todayStr = toISODate(new Date());

  for (const acao of acoes) {
    try {
      // 1. CADASTRAR COLABORADOR
      if (acao.tipo === 'CADASTRAR_COLABORADOR') {
        const nome = acao.dados.nome?.trim();
        if (!nome) continue;

        const { data: collab, error } = await supabase
          .from('collaborators')
          .insert({
            company_id: companyId,
            created_by: userId,
            name: nome,
            role: acao.dados.role || 'Prestador de Serviço',
            phone: acao.dados.phone || null,
            document: acao.dados.document || null,
            rating: 5,
            observations: 'Cadastrado via Copiloto IA (Chat/Voz)',
          })
          .select()
          .single();

        if (error) throw error;
        if (!collab) throw new Error('Não foi possível cadastrar o colaborador.');

        results.push({
          tipo: 'colaborador',
          badge: '👷 Colaborador Cadastrado',
          titulo: collab.name,
          subtitulo: `Função: ${collab.role || 'Geral'} • Tel: ${collab.phone || 'Não informado'}`,
          detalhes: collab.document ? `CPF/Doc: ${collab.document}` : undefined,
          sucesso: true,
        });
      }

      // 2. CRIAR SERVIÇO (COM OU SEM ADIANTAMENTO)
      else if (acao.tipo === 'CRIAR_SERVICO') {
        const descricao = acao.dados.descricao?.trim() || 'Serviço de Empreitada';
        const valorTotal = Number(acao.dados.valor_total) || 0;
        const valorAdiantamento = Number(acao.dados.valor_adiantamento) || 0;

        // 2.5: Recusar adiantamento maior que o valor total
        if (valorAdiantamento > valorTotal) {
          results.push({
            tipo: 'erro',
            badge: '⚠️ Adiantamento Inválido',
            titulo: 'Adiantamento excede o valor total',
            subtitulo: `Adiantamento (${formatBRL(valorAdiantamento)}) não pode superar o valor do serviço (${formatBRL(valorTotal)}).`,
            detalhes: 'Serviço não registrado. Ajuste os valores e tente novamente.',
            sucesso: false,
          });
          continue;
        }

        // 2.1 e 2.2: Mapear obra pelo nome (sem fallback para projects[0])
        let targetProjId: string | null = null;
        if (acao.dados.obra_id && projects.some((p) => p.id === acao.dados.obra_id)) {
          targetProjId = acao.dados.obra_id;
        } else if (acao.dados.obra_nome) {
          const found = findProjectByName(acao.dados.obra_nome, projects);
          if (found) targetProjId = found.id;
        }

        // 2.2: Mapear colaborador pelo nome
        let targetCollabId: string | null = null;
        if (acao.dados.colaborador_id && collaborators.some((c) => c.id === acao.dados.colaborador_id)) {
          targetCollabId = acao.dados.colaborador_id;
        } else if (acao.dados.colaborador_nome) {
          const foundC = findCollaboratorByName(acao.dados.colaborador_nome, collaborators);
          if (foundC) targetCollabId = foundC.id;
        }

        // Insere o Serviço na tabela 'servicos'
        const { data: servico, error: sErr } = await supabase
          .from('servicos')
          .insert({
            company_id: companyId,
            created_by: userId,
            project_id: targetProjId,
            collaborator_id: targetCollabId,
            description: descricao,
            status: 'Em Andamento',
            start_date: todayStr,
            end_date: todayStr,
            total_value: valorTotal,
            observations: acao.dados.observacoes || 'Criado via Copiloto IA (Chat/Voz)',
          })
          .select()
          .single();

        if (sErr) throw sErr;
        if (!servico) throw new Error('Falha ao cadastrar o serviço.');

        // 2.5: Se houver adiantamento, insere o registro e checa o erro (lançar se falhar)
        if (valorAdiantamento > 0) {
          const { error: advErr } = await supabase.from('adiantamentos').insert({
            company_id: companyId,
            created_by: userId,
            service_id: servico.id,
            value: valorAdiantamento,
            payment_date: todayStr,
            description: 'Adiantamento inicial via Copiloto IA',
          });

          if (advErr) throw advErr;
        }

        const pName = targetProjId
          ? projects.find((p) => p.id === targetProjId)?.name || 'Obra não identificada'
          : 'Obra não identificada';
        const saldo = Math.max(0, valorTotal - valorAdiantamento);

        results.push({
          tipo: 'servico',
          badge: '🏗️ Contrato de Serviço Criado',
          titulo: `${descricao} (${pName})`,
          subtitulo: `Valor Total: ${formatBRL(valorTotal)} • Adiantamento: ${formatBRL(valorAdiantamento)} (Pago ✅)`,
          detalhes: `Saldo Restante a Pagar: ${formatBRL(saldo)}`,
          sucesso: true,
        });
      }

      // 3. CRIAR TAREFA OU ITEM DE LISTA DE COMPRAS
      else if (acao.tipo === 'CRIAR_TAREFA') {
        const titulo = acao.dados.titulo?.trim();
        if (!titulo) continue;

        // 2.1 e 2.2: Mapear obra pelo nome (sem fallback para projects[0])
        let targetProjId: string | null = null;
        if (acao.dados.obra_id && projects.some((p) => p.id === acao.dados.obra_id)) {
          targetProjId = acao.dados.obra_id;
        } else if (acao.dados.obra_nome) {
          const found = findProjectByName(acao.dados.obra_nome, projects);
          if (found) targetProjId = found.id;
        }

        // 2.2: Mapear colaborador pelo nome
        let targetCollabId: string | null = null;
        if (acao.dados.responsavel_id && collaborators.some((c) => c.id === acao.dados.responsavel_id)) {
          targetCollabId = acao.dados.responsavel_id;
        } else if (acao.dados.responsavel_nome) {
          const foundC = findCollaboratorByName(acao.dados.responsavel_nome, collaborators);
          if (foundC) targetCollabId = foundC.id;
        }

        const isPurchase = acao.dados.is_compra || (acao.dados.observacoes || '').includes('[COMPRA]');
        const dataPrev = acao.dados.data_prevista || todayStr;

        const { error: tErr } = await supabase.from('tasks').insert({
          company_id: companyId,
          created_by: userId,
          project_id: targetProjId,
          responsavel_execucao_id: targetCollabId,
          title: titulo,
          description: isPurchase ? '[COMPRA] Material para compra/cotação' : '',
          data_inicio_prevista: dataPrev,
          data_fim_prevista: dataPrev,
          status: 'Planejada',
          prioridade: isPurchase ? 'Alta' : 'Média',
          observacoes: isPurchase ? '[COMPRA]' : null,
          materiais_previstos: null,
          equipamentos_utilizados: null,
          custo_real: null,
        });

        if (tErr) throw tErr;

        const pName = targetProjId
          ? projects.find((p) => p.id === targetProjId)?.name || 'Obra não identificada'
          : 'Obra não identificada';
        const respName = targetCollabId
          ? collaborators.find((c) => c.id === targetCollabId)?.name
          : undefined;

        results.push({
          tipo: isPurchase ? 'compra' : 'tarefa',
          badge: isPurchase ? '🛒 Lista de Compras' : '📋 Pendência de Canteiro',
          titulo: titulo,
          subtitulo: `Obra: ${pName}${respName ? ` • Resp: ${respName}` : ''}`,
          detalhes: `Data: ${dataPrev}`,
          sucesso: true,
        });
      }

      // 4. CONCLUIR TAREFA OU ITEM DA LISTA DE COMPRAS
      else if (acao.tipo === 'CONCLUIR_TAREFA') {
        const tarefaId = acao.dados.tarefa_id;
        const termoBusca = acao.dados.titulo?.trim() || acao.dados.tarefa_titulo?.trim() || '';

        let targetTaskId: string | null = null;
        let targetTaskTitle: string = termoBusca;

        // 2.3: Se vier tarefa_id, confirmar que ele existe entre as tarefas abertas da empresa
        if (tarefaId) {
          const { data: directTask } = await supabase
            .from('tasks')
            .select('id, title')
            .eq('id', tarefaId)
            .eq('company_id', companyId)
            .neq('status', 'Concluída')
            .maybeSingle();

          if (directTask) {
            targetTaskId = directTask.id;
            targetTaskTitle = directTask.title;
          }
        }

        // 2.3: Se não confirmou por tarefa_id e temos termoBusca, pesquisa nas tarefas abertas
        // REMOVIDO o critério de palavra de 4 letras
        if (!targetTaskId && termoBusca) {
          const { data: openTasks } = await supabase
            .from('tasks')
            .select('id, title')
            .eq('company_id', companyId)
            .neq('status', 'Concluída')
            .limit(100);

          if (openTasks && openTasks.length > 0) {
            const termoNorm = normalizeText(termoBusca);

            // 1. Igualdade exata sem acentos
            const exactMatch = openTasks.find((t) => normalizeText(t.title) === termoNorm);
            if (exactMatch) {
              targetTaskId = exactMatch.id;
              targetTaskTitle = exactMatch.title;
            } else {
              // 2. Match por substring direta (somente se único candidato)
              const partialMatches = openTasks.filter((t) => {
                const tNorm = normalizeText(t.title);
                return tNorm.includes(termoNorm) || termoNorm.includes(tNorm);
              });

              if (partialMatches.length === 1) {
                targetTaskId = partialMatches[0].id;
                targetTaskTitle = partialMatches[0].title;
              }
            }
          }
        }

        if (targetTaskId) {
          const { error: updErr } = await supabase
            .from('tasks')
            .update({ status: 'Concluída' })
            .eq('id', targetTaskId);

          if (updErr) throw updErr;

          results.push({
            tipo: 'tarefa',
            badge: '✅ Concluída com Sucesso',
            titulo: targetTaskTitle || 'Tarefa Baixada',
            subtitulo: 'Marcada como Concluída no canteiro',
            detalhes: 'Status atualizado pelo Copiloto IA',
            sucesso: true,
          });
        } else {
          results.push({
            tipo: 'tarefa',
            badge: 'ℹ️ Pendência não localizada',
            titulo: termoBusca ? `"${termoBusca}"` : 'Tarefa não identificada',
            subtitulo: 'Nenhuma pendência aberta correspondente encontrada para concluir.',
            detalhes: 'Dica: Verifique se a tarefa já foi concluída ou o nome cadastrado.',
            sucesso: false,
          });
        }
      }

      // 5. QUITAR SERVIÇO DE EMPREITADA
      else if (acao.tipo === 'QUITAR_SERVICO') {
        const termoBusca = acao.dados.servico_nome?.trim() || acao.dados.descricao?.trim() || '';
        const valorPago = Number(acao.dados.valor_pago) || 0;

        let targetServiceId: string | null = acao.dados.servico_id || null;

        if (targetServiceId) {
          const { data: directService } = await supabase
            .from('servicos')
            .select('id')
            .eq('id', targetServiceId)
            .eq('company_id', companyId)
            .maybeSingle();

          if (!directService) {
            targetServiceId = null;
          }
        }

        if (!targetServiceId && termoBusca) {
          const { data: openServices } = await supabase
            .from('servicos')
            .select('id, description')
            .eq('company_id', companyId)
            .neq('status', 'Concluído')
            .limit(50);

          if (openServices && openServices.length > 0) {
            const termoNorm = normalizeText(termoBusca);
            const exactMatch = openServices.find((s) => normalizeText(s.description) === termoNorm);
            if (exactMatch) {
              targetServiceId = exactMatch.id;
            } else {
              const partialMatches = openServices.filter((s) => {
                const sNorm = normalizeText(s.description);
                return sNorm.includes(termoNorm) || termoNorm.includes(sNorm);
              });
              if (partialMatches.length === 1) {
                targetServiceId = partialMatches[0].id;
              }
            }
          }
        }

        // 2.4: Se não encontrar o serviço, gerar card "Serviço não localizado"
        if (!targetServiceId) {
          results.push({
            tipo: 'servico',
            badge: 'ℹ️ Serviço não localizado',
            titulo: termoBusca ? `"${termoBusca}"` : 'Serviço não identificado',
            subtitulo: 'Nenhum contrato em andamento correspondente foi encontrado para quitação.',
            detalhes: 'Dica: Verifique se o serviço já foi concluído ou a descrição cadastrada.',
            sucesso: false,
          });
          continue;
        }

        // 2.4: Buscar serviço e a soma atual dos adiantamentos
        const { data: servico, error: sErr } = await supabase
          .from('servicos')
          .select('id, description, total_value, status')
          .eq('id', targetServiceId)
          .eq('company_id', companyId)
          .single();

        if (sErr || !servico) {
          throw sErr || new Error('Serviço não encontrado no banco de dados.');
        }

        const { data: adiantamentosList, error: aErr } = await supabase
          .from('adiantamentos')
          .select('value')
          .eq('service_id', targetServiceId)
          .eq('company_id', companyId);

        if (aErr) throw aErr;

        const totalAdiantamentos = (adiantamentosList || []).reduce(
          (sum, a) => sum + (Number(a.value) || 0),
          0
        );
        const totalValue = Number(servico.total_value) || 0;
        const saldoRestante = Math.max(0, totalValue - totalAdiantamentos);

        // 2.4: Recusar se valor_pago for maior que o saldo restante (card de erro com o saldo)
        if (valorPago > saldoRestante) {
          results.push({
            tipo: 'erro',
            badge: '⚠️ Pagamento Recusado',
            titulo: 'Valor pago excede o saldo restante',
            subtitulo: `Tentativa de pagar ${formatBRL(valorPago)}, mas o saldo restante é ${formatBRL(saldoRestante)}.`,
            detalhes: `Serviço: ${servico.description} • Total Contrato: ${formatBRL(totalValue)} • Já pago: ${formatBRL(totalAdiantamentos)}`,
            sucesso: false,
          });
          continue;
        }

        // 2.4: Gravar o adiantamento e checar o erro (lançar se falhar)
        if (valorPago > 0) {
          const { error: insAdvErr } = await supabase.from('adiantamentos').insert({
            company_id: companyId,
            created_by: userId,
            service_id: targetServiceId,
            value: valorPago,
            payment_date: todayStr,
            description: 'Pagamento via Copiloto IA',
          });

          if (insAdvErr) throw insAdvErr;
        }

        const somaFinalAdiantamentos = totalAdiantamentos + valorPago;
        const quitadoTotalmente = somaFinalAdiantamentos >= totalValue;

        // 2.4: Só mudar o status para Concluído se a soma final for >= total_value
        if (quitadoTotalmente) {
          const { error: updErr } = await supabase
            .from('servicos')
            .update({ status: 'Concluído' })
            .eq('id', targetServiceId);

          if (updErr) throw updErr;

          results.push({
            tipo: 'servico',
            badge: '✅ Serviço Quitado & Concluído',
            titulo: servico.description,
            subtitulo: `Pagamento registrado: ${formatBRL(valorPago)} • Contrato Quitado Integralmente ✅`,
            detalhes: `Total Contratado: ${formatBRL(totalValue)} • Total Pago: ${formatBRL(somaFinalAdiantamentos)} • Saldo: R$ 0,00`,
            sucesso: true,
          });
        } else {
          const novoSaldo = Math.max(0, totalValue - somaFinalAdiantamentos);
          results.push({
            tipo: 'servico',
            badge: '💵 Pagamento Parcial Registrado',
            titulo: servico.description,
            subtitulo: `Pagamento de ${formatBRL(valorPago)} registrado • Permanece Em Andamento`,
            detalhes: `Saldo restante atual: ${formatBRL(novoSaldo)} (Total Pago: ${formatBRL(somaFinalAdiantamentos)} de ${formatBRL(totalValue)})`,
            sucesso: true,
          });
        }
      }
    } catch (err: unknown) {
      console.error('Erro ao executar ação do Copiloto:', acao, err);
      const errorMessage = err instanceof Error ? err.message : 'Erro inesperado no banco de dados';
      results.push({
        tipo: 'erro',
        badge: '⚠️ Erro na Execução',
        titulo: `Falha ao processar ação: ${acao.tipo}`,
        subtitulo: errorMessage,
        sucesso: false,
      });
    }
  }

  return results;
}
