import { Project, CATEGORIA_NOTA_ENUM, ConsultarGastosRow, ListarNotasConsultaRow } from '../types';

export type ConsultaTipo = 'GASTOS' | 'LISTAR_NOTAS';

export type ConsultaAgrupar =
  | 'nenhum'
  | 'origem'
  | 'obra'
  | 'categoria'
  | 'mes'
  | 'fornecedor'
  | 'item'
  | null;

export interface ConsultaPedido {
  tipo: ConsultaTipo;
  agrupar?: ConsultaAgrupar;
  data_inicio?: string | null;
  data_fim?: string | null;
  periodo_texto?: string | null;
  obra_id?: string | null;
  obra_nome?: string | null;
  categoria?: string | null;
  termo?: string | null;
  termo_exibicao?: string | null;
}

export interface ConsultaResolvida {
  pedido: ConsultaPedido;
  obraNome: string | null;
  erro?: string;
}

export interface ConsultaResultado {
  pedido: ConsultaPedido;
  obraNome: string | null;
  linhas?: ConsultarGastosRow[];
  notas?: ListarNotasConsultaRow[];
  total: number;
  erro?: string;
}

export interface SupabaseRpcClient {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: unknown }>;
}

let defaultSupabaseClient: SupabaseRpcClient | null = null;

async function getClient(): Promise<SupabaseRpcClient> {
  if (defaultSupabaseClient) return defaultSupabaseClient;
  const mod = await import('./supabaseClient');
  defaultSupabaseClient = mod.supabase as unknown as SupabaseRpcClient;
  return defaultSupabaseClient;
}

export function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Busca de obra por nome com a regra do Copiloto:
 * 1º igualdade exata sem acento e sem maiúsculas
 * 2º só depois "contém" (se mais de um candidato casar, retorna null).
 */
export function findProjectByName(
  nameQuery: string | undefined | null,
  projects: Project[]
): Project | null {
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

function isValidDateString(dateStr: string | null | undefined): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const clean = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return false;
  const d = new Date(`${clean}T00:00:00`);
  return !isNaN(d.getTime());
}

function formatDateBR(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const clean = dateString.includes('T') ? dateString.split('T')[0] : dateString;
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
}

/**
 * Resolve a obra e sanitiza os parâmetros da consulta.
 * Regras:
 * - obra_id válido; senão nome igual sem acento; senão "contém" com candidato único.
 * - Obra citada e não encontrada vira erro "Obra não localizada: <nome>".
 * - Categoria fora da lista CATEGORIA_NOTA_ENUM vira null.
 * - Datas inválidas viram null.
 * - agrupar null vira "origem".
 */
export function resolverConsulta(
  pedido: ConsultaPedido,
  projects: Project[]
): ConsultaResolvida {
  let resolvedProject: Project | null = null;
  const hasObraCitation = Boolean(pedido.obra_id || pedido.obra_nome);

  if (pedido.obra_id) {
    resolvedProject = projects.find((p) => p.id === pedido.obra_id) || null;
  }
  if (!resolvedProject && pedido.obra_nome) {
    resolvedProject = findProjectByName(pedido.obra_nome, projects);
  }

  const obraId: string | null = resolvedProject ? resolvedProject.id : null;
  const obraNome: string | null = resolvedProject ? resolvedProject.name : (pedido.obra_nome || null);
  let erro: string | undefined = undefined;

  if (hasObraCitation && !resolvedProject) {
    const nomeCitado = pedido.obra_nome || pedido.obra_id || 'não identificada';
    erro = `Obra não localizada: ${nomeCitado}`;
  }

  // Categoria fora da lista CATEGORIA_NOTA_ENUM vira null
  let resolvedCategoria: string | null = null;
  if (pedido.categoria) {
    const catMatch = CATEGORIA_NOTA_ENUM.find(
      (c) =>
        c.toLowerCase() === pedido.categoria?.toLowerCase() ||
        normalizeText(c) === normalizeText(pedido.categoria || '')
    );
    resolvedCategoria = catMatch || null;
  }

  // Datas inválidas viram null
  const dataInicio = isValidDateString(pedido.data_inicio) ? pedido.data_inicio!.trim() : null;
  const dataFim = isValidDateString(pedido.data_fim) ? pedido.data_fim!.trim() : null;

  // agrupar null vira "origem"
  const agrupar: ConsultaAgrupar = pedido.agrupar ?? 'origem';

  return {
    pedido: {
      ...pedido,
      obra_id: obraId,
      obra_nome: obraNome,
      categoria: resolvedCategoria,
      data_inicio: dataInicio,
      data_fim: dataFim,
      agrupar,
    },
    obraNome,
    erro,
  };
}

/**
 * Gera texto curto resumindo o que foi compreendido na consulta.
 * Exemplo: "Gastos · Mingone · 01/07/2026 a 31/07/2026 · ferro"
 * Sem período: "todo o histórico".
 */
export function descreverConsulta(
  pedido: ConsultaPedido,
  obraNome: string | null
): string {
  const tipoStr = pedido.tipo === 'LISTAR_NOTAS' ? 'Notas Fiscais' : 'Gastos';
  const obraPart = obraNome || pedido.obra_nome || null;

  let periodoPart = 'todo o histórico';
  if (pedido.data_inicio && pedido.data_fim) {
    if (pedido.data_inicio === pedido.data_fim) {
      periodoPart = formatDateBR(pedido.data_inicio);
    } else {
      periodoPart = `${formatDateBR(pedido.data_inicio)} a ${formatDateBR(pedido.data_fim)}`;
    }
  } else if (pedido.data_inicio) {
    periodoPart = `a partir de ${formatDateBR(pedido.data_inicio)}`;
  } else if (pedido.data_fim) {
    periodoPart = `até ${formatDateBR(pedido.data_fim)}`;
  } else if (pedido.periodo_texto) {
    periodoPart = pedido.periodo_texto;
  }

  const catPart = pedido.categoria || null;
  const termoPart = pedido.termo_exibicao || pedido.termo || null;

  return [tipoStr, obraPart, periodoPart, catPart, termoPart]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Executa a chamada RPC correspondente no Supabase sem pedir confirmação.
 * Se a consulta tiver erro de resolução (ex: obra não localizada), retorna sem chamar o banco.
 */
export async function executarConsulta(
  resolvida: ConsultaResolvida,
  companyId: string,
  customClient?: SupabaseRpcClient
): Promise<ConsultaResultado> {
  const { pedido, obraNome, erro } = resolvida;

  if (erro) {
    return {
      pedido,
      obraNome,
      linhas: [],
      notas: [],
      total: 0,
      erro,
    };
  }

  try {
    const client = customClient || (await getClient());

    if (pedido.tipo === 'LISTAR_NOTAS') {
      const { data, error } = await client.rpc('listar_notas_consulta', {
        p_company_id: companyId,
        p_inicio: pedido.data_inicio || null,
        p_fim: pedido.data_fim || null,
        p_project_id: pedido.obra_id || null,
        p_termo: pedido.termo || null,
        p_limite: 30,
      });

      if (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(msg);
      }
      const notas = (data || []) as ListarNotasConsultaRow[];
      const total = notas.reduce((acc, n) => acc + (Number(n.total) || 0), 0);

      return {
        pedido,
        obraNome,
        notas,
        total,
      };
    } else {
      // Tipo GASTOS
      const { data, error } = await client.rpc('consultar_gastos', {
        p_company_id: companyId,
        p_inicio: pedido.data_inicio || null,
        p_fim: pedido.data_fim || null,
        p_project_id: pedido.obra_id || null,
        p_categoria: pedido.categoria || null,
        p_termo: pedido.termo || null,
        p_agrupar: pedido.agrupar || 'origem',
      });

      if (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(msg);
      }
      const linhas = (data || []) as ConsultarGastosRow[];
      const total = linhas.reduce((acc, l) => acc + (Number(l.total) || 0), 0);

      return {
        pedido,
        obraNome,
        linhas,
        total,
      };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erro ao executar consulta no banco.';
    return {
      pedido,
      obraNome,
      linhas: [],
      notas: [],
      total: 0,
      erro: errorMsg,
    };
  }
}
