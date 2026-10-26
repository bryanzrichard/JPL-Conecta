import { supabase } from './supabaseClient';
import { Project, Collaborator } from '../types';
import { toISODate } from './taskParser';
import { parseCompraItens, formatCompraItem, localizarItens, CompraItem } from './compraItens';
import type { ConsultaPedido, ConsultaResultado } from './copilotConsultas';

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
  itens?: unknown;
  itens_comprados?: string[];

  // Quitação / Pagamento de Serviço
  servico_id?: string | null;
  servico_nome?: string;
  valor_pago?: number;

  // Consulta de gastos e notas
  consulta?: ConsultaPedido;
}

export type CopilotActionType = 
  | 'CADASTRAR_COLABORADOR' 
  | 'CRIAR_SERVICO' 
  | 'CRIAR_TAREFA' 
  | 'CONCLUIR_TAREFA' 
  | 'MARCAR_ITENS_COMPRADOS'
  | 'QUITAR_SERVICO' 
  | 'CONSULTAR'
  | 'CONVERSA_GERAL';

export interface CopilotAction {
  tipo: CopilotActionType;
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

export interface OpenTaskItem {
  id: string;
  title: string;
  project_id?: string | null;
  status?: string;
  materiais_previstos?: unknown;
  observacoes?: string | null;
  description?: string;
}

export interface OpenServiceItem {
  id: string;
  description: string;
  project_id: string | null;
  collaborator_id: string | null;
  total_value: number;
  total_pago: number;
  saldo: number;
  status: string;
}

export interface ServicoWithAdiantamentosRow {
  id: string;
  description: string;
  project_id: string | null;
  collaborator_id: string | null;
  total_value: number;
  status: string;
  adiantamentos: { value: number | null }[] | null;
}

export interface ResolvedCopilotActionDados extends CopilotActionDados {
  // IDs resolvidos
  obra_id: string | null;
  colaborador_id: string | null;
  responsavel_id: string | null;
  tarefa_id: string | null;
  servico_id: string | null;

  // Resoluções visuais para o card
  obra_nome_resolvido?: string | null;
  colaborador_nome_resolvido?: string | null;
  responsavel_nome_resolvido?: string | null;
  tarefa_titulo_resolvido?: string | null;
  servico_descricao_resolvida?: string | null;
  servico_total_value?: number;
  servico_total_pago?: number;
  servico_saldo_atual?: number;
  servico_status_resultante?: 'Concluído' | 'Em Andamento';

  // Comando combinado: colaborador a ser cadastrado no mesmo lote
  colaborador_pendente_cadastro?: string | null;
  responsavel_pendente_cadastro?: string | null;

  // Compras com itens
  itens_resolvidos?: CompraItem[];
  itens_comprados_resolvidos?: {
    encontrados: CompraItem[];
    naoLocalizados: string[];
    pendentesApos: number;
    todosComprados: boolean;
    itensAtualizados: CompraItem[];
  };

  // Validação prévia
  nao_executar?: boolean;
  motivo_recusa?: string;
}

export interface ResolvedCopilotAction {
  tipo: CopilotAction['tipo'];
  dados: ResolvedCopilotActionDados;
}

export interface ActionReviewItem {
  id: string;
  tipo: CopilotAction['tipo'];
  badge: string;
  titulo: string;
  subtitulo?: string;
  obraLabel: string;
  responsavelLabel?: string;
  valoresLabel?: string;
  dataLabel?: string;
  detalhes?: string;
  itensLista?: string[];
  itensExcedentes?: number;
  naoSeraExecutado?: boolean;
  motivoNaoExecutar?: string;
}

export interface PendingReviewData {
  acoes: ResolvedCopilotAction[];
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
  consultas?: ConsultaResultado[];
  consultando?: boolean;
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
 * Busca de obra por nome:
 * 1º igualdade exata sem acento e sem maiúsculas
 * 2º só depois "contém" (se mais de um candidato casar, retorna null).
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
 * Busca de colaborador por nome:
 * 1º igualdade exata sem acento e sem maiúsculas
 * 2º só depois "contém" (se mais de um candidato casar, retorna null).
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
 * 3. Comando combinado: Busca colaborador pendente de cadastro no mesmo lote
 */
export function findPendingCollabByName(
  nameQuery: string | undefined | null,
  pendingCollabs: { nome: string; role?: string }[]
): { nome: string; role?: string } | null {
  if (!nameQuery) return null;
  const qNorm = normalizeText(nameQuery);
  if (!qNorm) return null;

  const exactMatch = pendingCollabs.find((c) => normalizeText(c.nome) === qNorm);
  if (exactMatch) return exactMatch;

  const candidates = pendingCollabs.filter((c) => {
    const cNorm = normalizeText(c.nome);
    return cNorm.includes(qNorm) || qNorm.includes(cNorm);
  });

  if (candidates.length === 1) {
    return candidates[0];
  }

  return null;
}

/**
 * Consulta única dos serviços abertos com soma dos adiantamentos
 */
export async function fetchOpenServices(companyId: string): Promise<OpenServiceItem[]> {
  const { data, error } = await supabase
    .from('servicos')
    .select('id, description, project_id, collaborator_id, total_value, status, adiantamentos(value)')
    .eq('company_id', companyId)
    .neq('status', 'Concluído')
    .returns<ServicoWithAdiantamentosRow[]>();

  if (error || !data) {
    console.error('Erro ao buscar openServices para o Copiloto:', error);
    return [];
  }

  return data.map((s) => {
    const totalPago = (s.adiantamentos || []).reduce(
      (sum, a) => sum + (Number(a.value) || 0),
      0
    );
    const totalVal = Number(s.total_value) || 0;
    return {
      id: s.id,
      description: s.description,
      project_id: s.project_id,
      collaborator_id: s.collaborator_id,
      total_value: totalVal,
      total_pago: totalPago,
      saldo: Math.max(0, totalVal - totalPago),
      status: s.status,
    };
  });
}

/**
 * TAREFA 3: resolveCopilotActions
 * Pré-resolve todos os IDs (obra_id, colaborador_id/responsavel_id, tarefa_id, servico_id)
 * usando correspondência exata sem acento primeiro; includes só se for único candidato.
 * Marca 'nao_executar: true' com motivo se o item não for localizado ou tiver valores inválidos.
 */
export function resolveCopilotActions(
  acoes: CopilotAction[],
  projects: Project[],
  collaborators: Collaborator[],
  openTasks: OpenTaskItem[],
  openServices: OpenServiceItem[]
): ResolvedCopilotAction[] {
  // Coletar novos colaboradores que serão cadastrados no mesmo lote (comando combinado)
  const pendingCollabs = acoes
    .filter((a) => a.tipo === 'CADASTRAR_COLABORADOR' && !!a.dados.nome?.trim())
    .map((a) => ({
      nome: a.dados.nome!.trim(),
      role: a.dados.role,
    }));

  return acoes.map((acao) => {
    const dados = { ...acao.dados };

    if (acao.tipo === 'CADASTRAR_COLABORADOR') {
      const nome = dados.nome?.trim();
      const semNome = !nome;
      return {
        tipo: acao.tipo,
        dados: {
          ...dados,
          nome: nome || '',
          obra_id: null,
          colaborador_id: null,
          responsavel_id: null,
          tarefa_id: null,
          servico_id: null,
          nao_executar: semNome,
          motivo_recusa: semNome ? 'Nome do colaborador não informado.' : undefined,
        },
      };
    }

    if (acao.tipo === 'CRIAR_SERVICO') {
      let resolvedObraId: string | null = null;
      let resolvedObraNome: string | null = null;
      if (dados.obra_id && projects.some((p) => p.id === dados.obra_id)) {
        const found = projects.find((p) => p.id === dados.obra_id);
        resolvedObraId = dados.obra_id;
        resolvedObraNome = found?.name || null;
      } else if (dados.obra_nome) {
        const found = findProjectByName(dados.obra_nome, projects);
        if (found) {
          resolvedObraId = found.id;
          resolvedObraNome = found.name;
        }
      }

      let resolvedCollabId: string | null = null;
      let resolvedCollabNome: string | null = null;
      let collabPendenteCadastro: string | null = null;

      if (dados.colaborador_id && collaborators.some((c) => c.id === dados.colaborador_id)) {
        const found = collaborators.find((c) => c.id === dados.colaborador_id);
        resolvedCollabId = dados.colaborador_id;
        resolvedCollabNome = found?.name || null;
      } else if (dados.colaborador_nome) {
        const found = findCollaboratorByName(dados.colaborador_nome, collaborators);
        if (found) {
          resolvedCollabId = found.id;
          resolvedCollabNome = found.name;
        } else {
          // 3. Comando combinado: checa se está no mesmo lote para cadastrar
          const pendingMatch = findPendingCollabByName(dados.colaborador_nome, pendingCollabs);
          if (pendingMatch) {
            collabPendenteCadastro = pendingMatch.nome;
            resolvedCollabNome = pendingMatch.nome;
          }
        }
      }

      const valorTotal = Number(dados.valor_total) || 0;
      const valorAdiantamento = Number(dados.valor_adiantamento) || 0;

      let naoExecutar = false;
      let motivoRecusa: string | undefined = undefined;

      // 2. CRIAR_SERVICO:
      // - Colaborador não encontrado NÃO recusa: grava com collaborator_id null
      // - Obra não encontrada continua recusando ("Não será executado")
      // - Valor inválido e adiantamento maior que o total continuam recusando
      if (valorAdiantamento > valorTotal) {
        naoExecutar = true;
        motivoRecusa = `Adiantamento (${formatBRL(valorAdiantamento)}) excede o valor total (${formatBRL(valorTotal)}).`;
      } else if (valorTotal <= 0) {
        naoExecutar = true;
        motivoRecusa = 'Valor do serviço inválido ou não informado.';
      } else if (!resolvedObraId) {
        naoExecutar = true;
        motivoRecusa = dados.obra_nome
          ? `Obra não localizada (IA ouviu: "${dados.obra_nome}").`
          : 'Obra obrigatória não informada.';
      }

      return {
        tipo: acao.tipo,
        dados: {
          ...dados,
          obra_id: resolvedObraId,
          obra_nome_resolvido: resolvedObraNome,
          colaborador_id: resolvedCollabId,
          colaborador_nome_resolvido: resolvedCollabNome,
          colaborador_pendente_cadastro: collabPendenteCadastro,
          responsavel_id: null,
          tarefa_id: null,
          servico_id: null,
          valor_total: valorTotal,
          valor_adiantamento: valorAdiantamento,
          saldo_restante: Math.max(0, valorTotal - valorAdiantamento),
          nao_executar: naoExecutar,
          motivo_recusa: motivoRecusa,
        },
      };
    }

    if (acao.tipo === 'CRIAR_TAREFA') {
      let resolvedObraId: string | null = null;
      let resolvedObraNome: string | null = null;
      if (dados.obra_id && projects.some((p) => p.id === dados.obra_id)) {
        const found = projects.find((p) => p.id === dados.obra_id);
        resolvedObraId = dados.obra_id;
        resolvedObraNome = found?.name || null;
      } else if (dados.obra_nome) {
        const found = findProjectByName(dados.obra_nome, projects);
        if (found) {
          resolvedObraId = found.id;
          resolvedObraNome = found.name;
        }
      }

      let resolvedRespId: string | null = null;
      let resolvedRespNome: string | null = null;
      let respPendenteCadastro: string | null = null;

      if (dados.responsavel_id && collaborators.some((c) => c.id === dados.responsavel_id)) {
        const found = collaborators.find((c) => c.id === dados.responsavel_id);
        resolvedRespId = dados.responsavel_id;
        resolvedRespNome = found?.name || null;
      } else if (dados.responsavel_nome) {
        const found = findCollaboratorByName(dados.responsavel_nome, collaborators);
        if (found) {
          resolvedRespId = found.id;
          resolvedRespNome = found.name;
        } else {
          // 3. Comando combinado: checa se está no mesmo lote para cadastrar
          const pendingMatch = findPendingCollabByName(dados.responsavel_nome, pendingCollabs);
          if (pendingMatch) {
            respPendenteCadastro = pendingMatch.nome;
            resolvedRespNome = pendingMatch.nome;
          }
        }
      }

      const titulo = dados.titulo?.trim();
      let naoExecutar = false;
      let motivoRecusa: string | undefined = undefined;

      // 1. CRIAR_TAREFA:
      // Obra ou responsável não encontrados NÃO recusam o item. Grava com project_id ou responsavel_execucao_id null.
      // Recusar SOMENTE se faltar o título.
      if (!titulo) {
        naoExecutar = true;
        motivoRecusa = 'Título da tarefa não informado.';
      }

      let resolvedItens: CompraItem[] | undefined = undefined;
      const isPurchase = dados.is_compra || (dados.observacoes || '').includes('[COMPRA]');
      if (isPurchase && dados.itens) {
        const parsed = parseCompraItens(dados.itens);
        if (parsed.length > 0) {
          resolvedItens = parsed.map((i) => ({
            ...i,
            quantidade: typeof i.quantidade === 'number' && !isNaN(i.quantidade) ? i.quantidade : null,
            comprado: false,
          }));
        }
      }

      return {
        tipo: acao.tipo,
        dados: {
          ...dados,
          titulo,
          obra_id: resolvedObraId,
          obra_nome_resolvido: resolvedObraNome,
          responsavel_id: resolvedRespId,
          responsavel_nome_resolvido: resolvedRespNome,
          responsavel_pendente_cadastro: respPendenteCadastro,
          colaborador_id: null,
          tarefa_id: null,
          servico_id: null,
          itens_resolvidos: resolvedItens,
          nao_executar: naoExecutar,
          motivo_recusa: motivoRecusa,
        },
      };
    }

    if (acao.tipo === 'CONCLUIR_TAREFA') {
      const tarefaId = dados.tarefa_id;
      const termoBusca = dados.titulo?.trim() || dados.tarefa_titulo?.trim() || '';

      let targetTask: OpenTaskItem | null = null;

      if (tarefaId) {
        targetTask = openTasks.find((t) => t.id === tarefaId) || null;
      }

      if (!targetTask && termoBusca) {
        const termoNorm = normalizeText(termoBusca);
        const exactMatch = openTasks.find((t) => normalizeText(t.title) === termoNorm);
        if (exactMatch) {
          targetTask = exactMatch;
        } else {
          const candidates = openTasks.filter((t) => {
            const tNorm = normalizeText(t.title);
            return tNorm.includes(termoNorm) || termoNorm.includes(tNorm);
          });
          if (candidates.length === 1) {
            targetTask = candidates[0];
          }
        }
      }

      const naoExecutar = !targetTask;
      const motivoRecusa = naoExecutar ? 'Tarefa não localizada.' : undefined;

      const obraFound = targetTask?.project_id ? projects.find((p) => p.id === targetTask!.project_id) : null;

      return {
        tipo: acao.tipo,
        dados: {
          ...dados,
          tarefa_id: targetTask ? targetTask.id : null,
          tarefa_titulo_resolvido: targetTask ? targetTask.title : null,
          obra_id: targetTask?.project_id || null,
          obra_nome_resolvido: obraFound?.name || null,
          colaborador_id: null,
          responsavel_id: null,
          servico_id: null,
          nao_executar: naoExecutar,
          motivo_recusa: motivoRecusa,
        },
      };
    }

    if (acao.tipo === 'MARCAR_ITENS_COMPRADOS') {
      const tarefaId = dados.tarefa_id;
      const termoBusca = dados.titulo?.trim() || dados.tarefa_titulo?.trim() || '';

      let targetTask: OpenTaskItem | null = null;

      if (tarefaId) {
        targetTask = openTasks.find((t) => t.id === tarefaId) || null;
      }

      if (!targetTask && termoBusca) {
        let pool = openTasks;
        if (dados.obra_nome?.trim()) {
          const obraNorm = normalizeText(dados.obra_nome);
          const matchedProj = projects.find((p) => {
            const pNorm = normalizeText(p.name);
            return pNorm === obraNorm || pNorm.includes(obraNorm) || obraNorm.includes(pNorm);
          });
          if (matchedProj) {
            const obraTasks = openTasks.filter((t) => t.project_id === matchedProj.id);
            if (obraTasks.length > 0) {
              pool = obraTasks;
            }
          }
        }

        const termoNorm = normalizeText(termoBusca);
        const exactMatch = pool.find((t) => normalizeText(t.title) === termoNorm);
        if (exactMatch) {
          targetTask = exactMatch;
        } else {
          const candidates = pool.filter((t) => {
            const tNorm = normalizeText(t.title);
            return tNorm.includes(termoNorm) || termoNorm.includes(tNorm);
          });
          if (candidates.length === 1) {
            targetTask = candidates[0];
          } else if (candidates.length === 0 && pool !== openTasks) {
            const fallbackExact = openTasks.find((t) => normalizeText(t.title) === termoNorm);
            if (fallbackExact) {
              targetTask = fallbackExact;
            } else {
              const fallbackCandidates = openTasks.filter((t) => {
                const tNorm = normalizeText(t.title);
                return tNorm.includes(termoNorm) || termoNorm.includes(tNorm);
              });
              if (fallbackCandidates.length === 1) {
                targetTask = fallbackCandidates[0];
              }
            }
          }
        }
      }

      let naoExecutar = !targetTask;
      let motivoRecusa = naoExecutar ? 'Compra não localizada.' : undefined;

      let itensResolvidosObj: {
        encontrados: CompraItem[];
        naoLocalizados: string[];
        pendentesApos: number;
        todosComprados: boolean;
        itensAtualizados: CompraItem[];
      } | undefined = undefined;

      if (targetTask) {
        const itensAtuais = parseCompraItens(targetTask.materiais_previstos);
        if (itensAtuais.length === 0) {
          naoExecutar = true;
          motivoRecusa = 'A compra não possui itens estruturados (criada como texto livre). Conclua a tarefa inteira.';
        } else {
          const matchResult = localizarItens(itensAtuais, dados.itens_comprados || []);
          if (matchResult.encontrados.length === 0) {
            naoExecutar = true;
            motivoRecusa = 'Nenhum dos itens informados foi localizado na compra.';
          } else {
            itensResolvidosObj = matchResult;
          }
        }
      }

      const obraFound = targetTask?.project_id ? projects.find((p) => p.id === targetTask!.project_id) : null;

      return {
        tipo: acao.tipo,
        dados: {
          ...dados,
          tarefa_id: targetTask ? targetTask.id : null,
          tarefa_titulo_resolvido: targetTask ? targetTask.title : null,
          obra_id: targetTask?.project_id || null,
          obra_nome_resolvido: obraFound?.name || dados.obra_nome || null,
          colaborador_id: null,
          responsavel_id: null,
          servico_id: null,
          itens_comprados_resolvidos: itensResolvidosObj,
          nao_executar: naoExecutar,
          motivo_recusa: motivoRecusa,
        },
      };
    }

    if (acao.tipo === 'QUITAR_SERVICO') {
      const servicoId = dados.servico_id;
      const termoBusca = dados.servico_nome?.trim() || dados.descricao?.trim() || '';
      const valorPago = Number(dados.valor_pago) || 0;

      let targetService: OpenServiceItem | null = null;

      if (servicoId) {
        targetService = openServices.find((s) => s.id === servicoId) || null;
      }

      if (!targetService && termoBusca) {
        const termoNorm = normalizeText(termoBusca);
        const exactMatch = openServices.find((s) => normalizeText(s.description) === termoNorm);
        if (exactMatch) {
          targetService = exactMatch;
        } else {
          const candidates = openServices.filter((s) => {
            const sNorm = normalizeText(s.description);
            return sNorm.includes(termoNorm) || termoNorm.includes(sNorm);
          });
          if (candidates.length === 1) {
            targetService = candidates[0];
          }
        }
      }

      let naoExecutar = false;
      let motivoRecusa: string | undefined = undefined;
      let statusResultante: 'Concluído' | 'Em Andamento' = 'Em Andamento';

      if (!targetService) {
        naoExecutar = true;
        motivoRecusa = 'Serviço não localizado.';
      } else if (valorPago <= 0) {
        naoExecutar = true;
        motivoRecusa = 'Valor de pagamento não informado ou inválido.';
      } else if (valorPago > targetService.saldo) {
        naoExecutar = true;
        motivoRecusa = `Valor do pagamento (${formatBRL(valorPago)}) excede o saldo restante (${formatBRL(targetService.saldo)}).`;
      } else {
        const somaFinal = targetService.total_pago + valorPago;
        statusResultante = somaFinal >= targetService.total_value ? 'Concluído' : 'Em Andamento';
      }

      const obraFound = targetService?.project_id ? projects.find((p) => p.id === targetService!.project_id) : null;
      const collabFound = targetService?.collaborator_id ? collaborators.find((c) => c.id === targetService!.collaborator_id) : null;

      return {
        tipo: acao.tipo,
        dados: {
          ...dados,
          servico_id: targetService ? targetService.id : null,
          servico_descricao_resolvida: targetService ? targetService.description : null,
          servico_total_value: targetService ? targetService.total_value : undefined,
          servico_total_pago: targetService ? targetService.total_pago : undefined,
          servico_saldo_atual: targetService ? targetService.saldo : undefined,
          servico_status_resultante: statusResultante,
          obra_id: targetService?.project_id || null,
          obra_nome_resolvido: obraFound?.name || null,
          colaborador_id: targetService?.collaborator_id || null,
          colaborador_nome_resolvido: collabFound?.name || null,
          responsavel_id: null,
          tarefa_id: null,
          valor_pago: valorPago,
          nao_executar: naoExecutar,
          motivo_recusa: motivoRecusa,
        },
      };
    }

    return {
      tipo: acao.tipo,
      dados: {
        ...dados,
        obra_id: null,
        colaborador_id: null,
        responsavel_id: null,
        tarefa_id: null,
        servico_id: null,
      },
    };
  });
}

/**
 * Constrói a lista visual de itens para o card de revisão com DADOS REAIS já resolvidos
 */
export function buildActionReviewItems(
  acoes: ResolvedCopilotAction[]
): ActionReviewItem[] {
  const todayStr = toISODate(new Date());

  return acoes.map((acao, index) => {
    const id = `review-${index}-${Date.now()}`;
    const d = acao.dados;

    if (acao.tipo === 'CADASTRAR_COLABORADOR') {
      const nome = d.nome?.trim() || 'Colaborador sem nome';
      return {
        id,
        tipo: acao.tipo,
        badge: '👷 Cadastrar Colaborador',
        titulo: nome,
        obraLabel: 'Geral / Empresa',
        responsavelLabel: `Função: ${d.role || 'Prestador de Serviço'}`,
        detalhes: `Tel: ${d.phone || 'Não informado'}${d.document ? ` • Doc: ${d.document}` : ''}`,
        naoSeraExecutado: !!d.nao_executar,
        motivoNaoExecutar: d.motivo_recusa,
      };
    }

    if (acao.tipo === 'CRIAR_SERVICO') {
      const descricao = d.descricao?.trim() || 'Serviço de Empreitada';
      const valorTotal = Number(d.valor_total) || 0;
      const valorAdiantamento = Number(d.valor_adiantamento) || 0;
      const saldo = Math.max(0, valorTotal - valorAdiantamento);

      const obraLabel = d.obra_nome_resolvido
        || (d.obra_nome ? `Obra não localizada (IA ouviu: "${d.obra_nome}")` : 'Não informada');

      let responsavelLabel: string;
      if (d.colaborador_pendente_cadastro) {
        responsavelLabel = `Novo colaborador: ${d.colaborador_pendente_cadastro} (será cadastrado nesta confirmação)`;
      } else if (d.colaborador_nome_resolvido) {
        responsavelLabel = `Prestador: ${d.colaborador_nome_resolvido}`;
      } else if (d.colaborador_nome) {
        responsavelLabel = `Prestador não identificado (IA ouviu: "${d.colaborador_nome}")`;
      } else {
        responsavelLabel = 'Prestador: Não informado';
      }

      return {
        id,
        tipo: acao.tipo,
        badge: '🏗️ Criar Serviço',
        titulo: descricao,
        obraLabel,
        responsavelLabel,
        valoresLabel: `Total: ${formatBRL(valorTotal)} • Adiantamento: ${formatBRL(valorAdiantamento)} • Saldo: ${formatBRL(saldo)}`,
        dataLabel: `Início: ${todayStr}`,
        detalhes: d.observacoes || undefined,
        naoSeraExecutado: !!d.nao_executar,
        motivoNaoExecutar: d.motivo_recusa,
      };
    }

    if (acao.tipo === 'CRIAR_TAREFA') {
      const titulo = d.titulo?.trim() || 'Nova Tarefa';
      const isPurchase = d.is_compra || (d.observacoes || '').includes('[COMPRA]');

      const obraLabel = d.obra_nome_resolvido
        || (d.obra_nome ? `Obra não identificada (IA ouviu: "${d.obra_nome}")` : 'Não informada');

      let responsavelLabel: string;
      if (d.responsavel_pendente_cadastro) {
        responsavelLabel = `Novo colaborador: ${d.responsavel_pendente_cadastro} (será cadastrado nesta confirmação)`;
      } else if (d.responsavel_nome_resolvido) {
        responsavelLabel = `Responsável: ${d.responsavel_nome_resolvido}`;
      } else if (d.responsavel_nome) {
        responsavelLabel = `Responsável não identificado (IA ouviu: "${d.responsavel_nome}")`;
      } else {
        responsavelLabel = 'Responsável: Não informado';
      }

      let itensLista: string[] | undefined = undefined;
      let itensExcedentes: number | undefined = undefined;
      if (isPurchase && d.itens_resolvidos && d.itens_resolvidos.length > 0) {
        const total = d.itens_resolvidos.length;
        const limit = 8;
        itensLista = d.itens_resolvidos.slice(0, limit).map((i) => formatCompraItem(i));
        if (total > limit) {
          itensExcedentes = total - limit;
        }
      }

      const badge = isPurchase
        ? (d.itens_resolvidos && d.itens_resolvidos.length > 0 ? '🛒 Nova Lista de Compras' : '🛒 Lista de Compras')
        : '📋 Criar Tarefa';

      return {
        id,
        tipo: acao.tipo,
        badge,
        titulo,
        obraLabel,
        responsavelLabel,
        dataLabel: `Data: ${d.data_prevista || todayStr}`,
        itensLista,
        itensExcedentes,
        naoSeraExecutado: !!d.nao_executar,
        motivoNaoExecutar: d.motivo_recusa,
      };
    }

    if (acao.tipo === 'MARCAR_ITENS_COMPRADOS') {
      const achou = !!d.tarefa_id && !!d.tarefa_titulo_resolvido;
      const match = d.itens_comprados_resolvidos;
      const count = match ? match.encontrados.length : (d.itens_comprados?.length || 0);
      const obraText = d.obra_nome_resolvido ? ` na ${d.obra_nome_resolvido}` : '';
      const titulo = achou
        ? `Marcar ${count} ${count === 1 ? 'item como comprado' : 'itens como comprados'}${obraText}`
        : (d.titulo?.trim() || d.tarefa_titulo?.trim() || 'Marcar itens como comprados');
      const subtitulo = achou ? d.tarefa_titulo_resolvido! : undefined;

      let itensLista: string[] | undefined = undefined;
      let itensExcedentes: number | undefined = undefined;
      let detalhes = achou ? 'Itens serão marcados como comprados' : 'Nenhuma compra correspondente encontrada';

      if (match && match.encontrados.length > 0) {
        const total = match.encontrados.length;
        const limit = 8;
        itensLista = match.encontrados.slice(0, limit).map((i) => formatCompraItem(i));
        if (total > limit) {
          itensExcedentes = total - limit;
        }
        if (match.todosComprados) {
          detalhes = 'Esta compra será concluída';
        } else {
          detalhes = `Restarão ${match.pendentesApos} ${match.pendentesApos === 1 ? 'item pendente' : 'itens pendentes'}`;
        }
      } else if (achou && (!match || match.itensAtualizados.length === 0)) {
        detalhes = 'Esta compra não possui itens estruturados. Conclua a tarefa inteira.';
      }

      return {
        id,
        tipo: acao.tipo,
        badge: '✅ Marcar Itens Comprados',
        titulo,
        subtitulo,
        obraLabel: d.obra_nome_resolvido || 'Obra vinculada',
        detalhes,
        itensLista,
        itensExcedentes,
        naoSeraExecutado: !!d.nao_executar,
        motivoNaoExecutar: d.motivo_recusa,
      };
    }

    if (acao.tipo === 'CONCLUIR_TAREFA') {
      const achou = !!d.tarefa_id && !!d.tarefa_titulo_resolvido;
      const titulo = achou
        ? d.tarefa_titulo_resolvido!
        : (d.titulo?.trim() || d.tarefa_titulo?.trim() || 'Tarefa não identificada');

      return {
        id,
        tipo: acao.tipo,
        badge: achou ? '✅ Concluir Tarefa' : '⚠️ Tarefa não localizada',
        titulo,
        obraLabel: d.obra_nome_resolvido || 'Obra vinculada',
        detalhes: achou ? 'Será marcada como Concluída no canteiro' : 'Nenhuma pendência aberta correspondente encontrada',
        naoSeraExecutado: !!d.nao_executar,
        motivoNaoExecutar: d.motivo_recusa,
      };
    }

    if (acao.tipo === 'QUITAR_SERVICO') {
      const achou = !!d.servico_id && !!d.servico_descricao_resolvida;
      const titulo = achou
        ? d.servico_descricao_resolvida!
        : (d.servico_nome?.trim() || d.descricao?.trim() || 'Serviço não identificado');

      const badge = !achou
        ? '⚠️ Serviço não localizado'
        : (d.servico_status_resultante === 'Concluído' ? '💰 Quitar Serviço (Integral)' : '💵 Pagamento de Serviço (Parcial)');

      const valorPago = Number(d.valor_pago) || 0;
      const valoresLabel = achou
        ? `Total: ${formatBRL(d.servico_total_value)} • Já pago: ${formatBRL(d.servico_total_pago)} • Saldo atual: ${formatBRL(d.servico_saldo_atual)} • Pagamento: ${formatBRL(valorPago)}`
        : `Pagamento: ${formatBRL(valorPago)}`;

      const detalhes = achou
        ? `Status resultante: ${d.servico_status_resultante}`
        : 'Nenhum contrato em andamento correspondente encontrado';

      return {
        id,
        tipo: acao.tipo,
        badge,
        titulo,
        obraLabel: d.obra_nome_resolvido || 'Obra vinculada',
        responsavelLabel: d.colaborador_nome_resolvido ? `Prestador: ${d.colaborador_nome_resolvido}` : undefined,
        valoresLabel,
        dataLabel: `Data: ${todayStr}`,
        detalhes,
        naoSeraExecutado: !!d.nao_executar,
        motivoNaoExecutar: d.motivo_recusa,
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
 * TAREFA 3: executeCopilotActions
 * Grava usando os IDs JÁ RESOLVIDOS pelo resolveCopilotActions.
 * NÃO refaz busca por nome. Realiza apenas validações de segurança da empresa e saldo.
 * Ações com 'nao_executar === true' são ignoradas na gravação e retornam como não executadas.
 */
export async function executeCopilotActions({
  acoes,
  companyId,
  userId,
  projects,
  collaborators,
}: {
  acoes: ResolvedCopilotAction[];
  companyId: string;
  userId: string;
  projects: Project[];
  collaborators: Collaborator[];
}): Promise<ActionCardResult[]> {
  const results: ActionCardResult[] = [];
  const todayStr = toISODate(new Date());

  // 3. Comando combinado: executar primeiro todos os CADASTRAR_COLABORADOR do lote,
  // guardar os IDs criados e usá-los nas ações seguintes que citam esse nome.
  const sortedAcoes = [...acoes].sort((a, b) => {
    if (a.tipo === 'CADASTRAR_COLABORADOR' && b.tipo !== 'CADASTRAR_COLABORADOR') return -1;
    if (a.tipo !== 'CADASTRAR_COLABORADOR' && b.tipo === 'CADASTRAR_COLABORADOR') return 1;
    return 0;
  });

  const createdCollabsMap = new Map<string, { id: string; name: string }>();
  const failedCollabsNames = new Set<string>();

  for (const acao of sortedAcoes) {
    try {
      if (acao.dados.nao_executar) {
        results.push({
          tipo: 'erro',
          badge: '⚠️ Não Executado',
          titulo: acao.dados.tarefa_titulo_resolvido || acao.dados.servico_descricao_resolvida || acao.dados.titulo || acao.dados.descricao || acao.dados.nome || 'Ação cancelada',
          subtitulo: acao.dados.motivo_recusa || 'Item marcado para não execução.',
          detalhes: 'Nenhuma alteração foi realizada no banco de dados.',
          sucesso: false,
        });
        continue;
      }

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

        if (error || !collab) {
          failedCollabsNames.add(normalizeText(nome));
          throw (error || new Error('Não foi possível cadastrar o colaborador.'));
        }

        createdCollabsMap.set(normalizeText(collab.name), { id: collab.id, name: collab.name });

        results.push({
          tipo: 'colaborador',
          badge: '👷 Colaborador Cadastrado',
          titulo: collab.name,
          subtitulo: `Função: ${collab.role || 'Geral'} • Tel: ${collab.phone || 'Não informado'}`,
          detalhes: collab.document ? `CPF/Doc: ${collab.document}` : undefined,
          sucesso: true,
        });
      }

      // 2. CRIAR SERVIÇO
      else if (acao.tipo === 'CRIAR_SERVICO') {
        const descricao = acao.dados.descricao?.trim() || 'Serviço de Empreitada';
        const valorTotal = Number(acao.dados.valor_total) || 0;
        const valorAdiantamento = Number(acao.dados.valor_adiantamento) || 0;

        const targetProjId = acao.dados.obra_id && projects.some((p) => p.id === acao.dados.obra_id)
          ? acao.dados.obra_id
          : null;

        let targetCollabId: string | null = null;
        let targetCollabName: string | undefined = undefined;
        let collabFalhou = false;

        if (acao.dados.colaborador_id && collaborators.some((c) => c.id === acao.dados.colaborador_id)) {
          targetCollabId = acao.dados.colaborador_id;
          targetCollabName = acao.dados.colaborador_nome_resolvido || undefined;
        } else if (acao.dados.colaborador_pendente_cadastro || acao.dados.colaborador_nome) {
          const nomeBusca = acao.dados.colaborador_pendente_cadastro || acao.dados.colaborador_nome!;
          const norm = normalizeText(nomeBusca);
          let foundCreated = createdCollabsMap.get(norm);
          if (!foundCreated) {
            const matches = Array.from(createdCollabsMap.entries()).filter(([k]) => k.includes(norm) || norm.includes(k));
            if (matches.length === 1) foundCreated = matches[0][1];
          }
          if (foundCreated) {
            targetCollabId = foundCreated.id;
            targetCollabName = foundCreated.name;
          } else if (failedCollabsNames.has(norm)) {
            collabFalhou = true;
          }
        }

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

        let detalhesInfo = `Saldo Restante a Pagar: ${formatBRL(saldo)}`;
        if (collabFalhou) {
          detalhesInfo += ` • ⚠️ Cadastro de "${acao.dados.colaborador_nome}" falhou (serviço registrado sem colaborador)`;
        } else if (!targetCollabId && acao.dados.colaborador_nome) {
          detalhesInfo += ` • ⚠️ Prestador "${acao.dados.colaborador_nome}" não cadastrado (serviço registrado sem colaborador)`;
        }

        results.push({
          tipo: 'servico',
          badge: '🏗️ Contrato de Serviço Criado',
          titulo: `${descricao} (${pName})`,
          subtitulo: `Valor Total: ${formatBRL(valorTotal)} • Adiantamento: ${formatBRL(valorAdiantamento)} (Pago ✅)${targetCollabName ? ` • Prestador: ${targetCollabName}` : ''}`,
          detalhes: detalhesInfo,
          sucesso: true,
        });
      }

      // 3. CRIAR TAREFA OU ITEM DE LISTA DE COMPRAS
      else if (acao.tipo === 'CRIAR_TAREFA') {
        const titulo = acao.dados.titulo?.trim();
        if (!titulo) continue;

        const targetProjId = acao.dados.obra_id && projects.some((p) => p.id === acao.dados.obra_id)
          ? acao.dados.obra_id
          : null;

        let targetCollabId: string | null = null;
        let targetCollabName: string | undefined = undefined;
        let respFalhou = false;

        if (acao.dados.responsavel_id && collaborators.some((c) => c.id === acao.dados.responsavel_id)) {
          targetCollabId = acao.dados.responsavel_id;
          targetCollabName = acao.dados.responsavel_nome_resolvido || undefined;
        } else if (acao.dados.responsavel_pendente_cadastro || acao.dados.responsavel_nome) {
          const nomeBusca = acao.dados.responsavel_pendente_cadastro || acao.dados.responsavel_nome!;
          const norm = normalizeText(nomeBusca);
          let foundCreated = createdCollabsMap.get(norm);
          if (!foundCreated) {
            const matches = Array.from(createdCollabsMap.entries()).filter(([k]) => k.includes(norm) || norm.includes(k));
            if (matches.length === 1) foundCreated = matches[0][1];
          }
          if (foundCreated) {
            targetCollabId = foundCreated.id;
            targetCollabName = foundCreated.name;
          } else if (failedCollabsNames.has(norm)) {
            respFalhou = true;
          }
        }

        const isPurchase = acao.dados.is_compra || (acao.dados.observacoes || '').includes('[COMPRA]');
        const dataPrev = acao.dados.data_prevista || todayStr;

        const itensToSave = isPurchase
          ? (acao.dados.itens_resolvidos && acao.dados.itens_resolvidos.length > 0
              ? acao.dados.itens_resolvidos
              : (acao.dados.itens ? parseCompraItens(acao.dados.itens) : null))
          : null;

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
          materiais_previstos: (itensToSave && itensToSave.length > 0) ? itensToSave : null,
          equipamentos_utilizados: null,
          custo_real: null,
        });

        if (tErr) throw tErr;

        const pName = targetProjId
          ? projects.find((p) => p.id === targetProjId)?.name || 'Sem obra vinculada'
          : (acao.dados.obra_nome ? `Obra "${acao.dados.obra_nome}" não identificada (gravada sem obra)` : 'Sem obra vinculada');

        let avisosExtras = '';
        if (respFalhou) {
          avisosExtras = ` • ⚠️ Cadastro de "${acao.dados.responsavel_nome}" falhou (tarefa gravada sem responsável)`;
        } else if (!targetCollabId && acao.dados.responsavel_nome) {
          avisosExtras = ` • ⚠️ Responsável "${acao.dados.responsavel_nome}" não identificado (gravada sem responsável)`;
        }

        const numItens = itensToSave ? itensToSave.length : 0;
        let detalhesTexto = `Data: ${dataPrev}`;
        if (isPurchase && numItens > 0) {
          const itensMsg = `Compra registrada com ${numItens} ${numItens === 1 ? 'item' : 'itens'}`;
          detalhesTexto = `${itensMsg} • ${detalhesTexto}`;
        }

        results.push({
          tipo: isPurchase ? 'compra' : 'tarefa',
          badge: isPurchase ? '🛒 Lista de Compras' : '📋 Pendência de Canteiro',
          titulo: titulo,
          subtitulo: `Obra: ${pName}${targetCollabName ? ` • Resp: ${targetCollabName}` : ''}${avisosExtras}`,
          detalhes: detalhesTexto,
          sucesso: true,
        });
      }

      // 4. CONCLUIR TAREFA
      else if (acao.tipo === 'CONCLUIR_TAREFA') {
        const targetTaskId = acao.dados.tarefa_id;
        if (!targetTaskId) {
          results.push({
            tipo: 'tarefa',
            badge: '⚠️ Tarefa não localizada',
            titulo: acao.dados.titulo || 'Tarefa não identificada',
            subtitulo: 'Nenhuma pendência aberta correspondente encontrada para concluir.',
            sucesso: false,
          });
          continue;
        }

        const { data: directTask, error: fErr } = await supabase
          .from('tasks')
          .select('id, title, materiais_previstos')
          .eq('id', targetTaskId)
          .eq('company_id', companyId)
          .neq('status', 'Concluída')
          .maybeSingle();

        if (fErr || !directTask) {
          results.push({
            tipo: 'tarefa',
            badge: '⚠️ Tarefa não localizada',
            titulo: acao.dados.tarefa_titulo_resolvido || 'Tarefa',
            subtitulo: 'A tarefa já pode ter sido concluída ou não pertence à empresa.',
            sucesso: false,
          });
          continue;
        }

        const itensAtuais = parseCompraItens(directTask.materiais_previstos);
        const updatePayload: { status: 'Concluída'; materiais_previstos?: CompraItem[] } = {
          status: 'Concluída',
        };
        if (itensAtuais.length > 0) {
          updatePayload.materiais_previstos = itensAtuais.map((item) => ({ ...item, comprado: true }));
        }

        const { error: updErr } = await supabase
          .from('tasks')
          .update(updatePayload)
          .eq('id', directTask.id);

        if (updErr) throw updErr;

        results.push({
          tipo: 'tarefa',
          badge: '✅ Concluída com Sucesso',
          titulo: directTask.title,
          subtitulo: 'Marcada como Concluída no canteiro',
          detalhes: itensAtuais.length > 0
            ? `Status atualizado • Todos os ${itensAtuais.length} itens marcados como comprados`
            : 'Status atualizado pelo Copiloto JPL',
          sucesso: true,
        });
      }

      // 5. MARCAR ITENS COMPRADOS
      else if (acao.tipo === 'MARCAR_ITENS_COMPRADOS') {
        const targetTaskId = acao.dados.tarefa_id;
        if (!targetTaskId) {
          results.push({
            tipo: 'tarefa',
            badge: '⚠️ Compra não localizada',
            titulo: acao.dados.titulo || acao.dados.tarefa_titulo || 'Compra não identificada',
            subtitulo: 'Nenhuma compra em aberto correspondente encontrada para atualizar itens.',
            sucesso: false,
          });
          continue;
        }

        const { data: directTask, error: fErr } = await supabase
          .from('tasks')
          .select('id, title, status, materiais_previstos')
          .eq('id', targetTaskId)
          .eq('company_id', companyId)
          .neq('status', 'Concluída')
          .maybeSingle();

        if (fErr || !directTask) {
          results.push({
            tipo: 'tarefa',
            badge: '⚠️ Compra não localizada',
            titulo: acao.dados.tarefa_titulo_resolvido || 'Compra',
            subtitulo: 'A compra já pode ter sido concluída ou não pertence à empresa.',
            sucesso: false,
          });
          continue;
        }

        const itensAtuais = parseCompraItens(directTask.materiais_previstos);
        if (itensAtuais.length === 0) {
          results.push({
            tipo: 'tarefa',
            badge: '⚠️ Sem itens estruturados',
            titulo: directTask.title,
            subtitulo: 'Esta compra não possui itens cadastrados individualmente. Conclua a tarefa inteira.',
            sucesso: false,
          });
          continue;
        }

        const nomesComprados = acao.dados.itens_comprados || [];
        const matchResult = localizarItens(itensAtuais, nomesComprados);

        if (matchResult.encontrados.length === 0) {
          results.push({
            tipo: 'tarefa',
            badge: '⚠️ Nenhum item localizado',
            titulo: directTask.title,
            subtitulo: `Nenhum dos itens informados (${nomesComprados.join(', ')}) foi encontrado na compra.`,
            sucesso: false,
          });
          continue;
        }

        const novoStatus = matchResult.todosComprados ? 'Concluída' : (directTask.status || 'Planejada');

        const { error: updErr } = await supabase
          .from('tasks')
          .update({
            materiais_previstos: matchResult.itensAtualizados,
            status: novoStatus,
          })
          .eq('id', directTask.id);

        if (updErr) throw updErr;

        const qtdEncontrados = matchResult.encontrados.length;
        const msgItens = `${qtdEncontrados} ${qtdEncontrados === 1 ? 'item marcado como comprado' : 'itens marcados como comprados'}`;
        const concluidaSufixo = matchResult.todosComprados ? ' • Compra concluída' : ` • ${matchResult.pendentesApos} ${matchResult.pendentesApos === 1 ? 'pendente' : 'pendentes'}`;

        results.push({
          tipo: 'compra',
          badge: matchResult.todosComprados ? '✅ Compra Concluída' : '🛒 Itens Comprados',
          titulo: directTask.title,
          subtitulo: `${msgItens}${concluidaSufixo}`,
          detalhes: `Itens: ${matchResult.encontrados.map((i) => i.nome).join(', ')}`,
          sucesso: true,
        });
      }

      // 5. QUITAR SERVIÇO DE EMPREITADA
      else if (acao.tipo === 'QUITAR_SERVICO') {
        const targetServiceId = acao.dados.servico_id;
        const valorPago = Number(acao.dados.valor_pago) || 0;

        if (!targetServiceId) {
          results.push({
            tipo: 'servico',
            badge: '⚠️ Serviço não localizado',
            titulo: acao.dados.servico_nome || 'Serviço',
            subtitulo: 'Nenhum contrato em andamento correspondente foi encontrado para quitação.',
            sucesso: false,
          });
          continue;
        }

        const { data: servico, error: sErr } = await supabase
          .from('servicos')
          .select('id, description, total_value, status')
          .eq('id', targetServiceId)
          .eq('company_id', companyId)
          .single();

        if (sErr || !servico) {
          throw sErr || new Error('Serviço não encontrado na base de dados.');
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
