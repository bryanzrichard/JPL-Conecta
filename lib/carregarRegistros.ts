import { supabase } from './supabaseClient';
import { CartorioRecord, NotaFiscal, NotaWithItemCount, Service, ServiceWithDetails, Task } from '../types';
import { EnrichedTask } from '../components/tarefas/types';
import { toISODate } from './taskParser';

interface NotaDbRow extends NotaFiscal {
  itens_nota_fiscal?: Array<{ count?: number | null }> | null;
}

interface ServiceDbRow extends Service {
  collaborators?: { name?: string | null } | null;
  projects?: { name?: string | null } | null;
  adiantamentos?: Array<{ id: string; value: number }> | null;
}

type TaskDbRow = Task;

/**
 * Enriquece uma tarefa isolada com flags visuais, de compras e de prazos
 */
export function enriquecerTarefa(
  t: Task,
  projectName?: string | null,
  collaboratorName?: string | null,
  todayStr = toISODate(new Date()),
  tomorrowStr?: string
): EnrichedTask {
  if (!tomorrowStr) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    tomorrowStr = toISODate(d);
  }
  const isPurchase =
    (t.observacoes || '').includes('[COMPRA]') ||
    (t.description || '').toLowerCase().includes('[compra]');
  const isCompleted = t.status === 'Concluída';
  const isDelayed = !isCompleted && !!t.data_fim_prevista && t.data_fim_prevista < todayStr;
  const isTodayTask = t.data_fim_prevista === todayStr;
  const isTomorrowTask = t.data_fim_prevista === tomorrowStr;
  const isUpcomingTask =
    !isCompleted && !!t.data_fim_prevista && t.data_fim_prevista > tomorrowStr;

  let daysDiff: number | null = null;
  if (t.data_fim_prevista) {
    const targetD = new Date(t.data_fim_prevista + 'T00:00:00');
    const nowD = new Date(todayStr + 'T00:00:00');
    daysDiff = Math.round((targetD.getTime() - nowD.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    ...t,
    projectName: projectName || 'Obra sem nome',
    collaboratorName: collaboratorName || null,
    isPurchase,
    isCompleted,
    isDelayed,
    isTodayTask,
    isTomorrowTask,
    isUpcomingTask,
    daysDiff,
  };
}

/**
 * Carrega os dados completos de uma nota fiscal com contagem de itens
 */
export async function carregarNota(
  id: string,
  companyId?: string
): Promise<NotaWithItemCount | null> {
  let query = supabase
    .from('notas_fiscais')
    .select('*, projects(name), suppliers(name), itens_nota_fiscal(count)')
    .eq('id', id);

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data, error } = await query.returns<NotaDbRow[]>().maybeSingle();
  if (error || !data) {
    if (error) console.error('Erro ao carregar nota fiscal:', error);
    return null;
  }

  const itemCount = data.itens_nota_fiscal?.[0]?.count || 0;
  const { itens_nota_fiscal: _discarded, ...rest } = data;

  return {
    ...rest,
    item_count: itemCount,
  };
}

/**
 * Carrega a nota fiscal proprietária de um item de nota
 */
export async function carregarNotaPorItem(
  itemId: string,
  companyId?: string
): Promise<{ nota: NotaWithItemCount | null; notaId: string | null }> {
  const { data: itemData, error: itemError } = await supabase
    .from('itens_nota_fiscal')
    .select('nota_fiscal_id')
    .eq('id', itemId)
    .maybeSingle();

  if (itemError || !itemData?.nota_fiscal_id) {
    if (itemError) console.error('Erro ao buscar nota do item:', itemError);
    return { nota: null, notaId: null };
  }

  const nota = await carregarNota(itemData.nota_fiscal_id, companyId);
  return { nota, notaId: itemData.nota_fiscal_id };
}

/**
 * Carrega os detalhes completos de um serviço com total de adiantamentos
 */
export async function carregarServico(
  id: string,
  companyId?: string
): Promise<ServiceWithDetails | null> {
  let query = supabase
    .from('servicos')
    .select('*, collaborators(name), projects(name), adiantamentos(id, value)')
    .eq('id', id);

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data, error } = await query.returns<ServiceDbRow[]>().maybeSingle();
  if (error || !data) {
    if (error) console.error('Erro ao carregar serviço:', error);
    return null;
  }

  const isCompleted = data.status === 'Concluído';
  const total_advances = (data.adiantamentos || []).reduce(
    (acc, curr) => acc + (Number(curr.value) || 0),
    0
  );

  return {
    ...data,
    collaborator_name: data.collaborators?.name || null,
    project_name: data.projects?.name || null,
    total_advances,
    remaining_value: isCompleted ? 0 : Math.max(0, (Number(data.total_value) || 0) - total_advances),
  };
}

/**
 * Carrega o serviço proprietário de um adiantamento
 */
export async function carregarServicoPorAdiantamento(
  advanceId: string,
  companyId?: string
): Promise<{ servico: ServiceWithDetails | null; servicoId: string | null }> {
  const { data: advData, error: advError } = await supabase
    .from('adiantamentos')
    .select('id, service_id')
    .eq('id', advanceId)
    .maybeSingle();

  if (advError || !advData?.service_id) {
    if (advError) console.error('Erro ao buscar serviço do adiantamento:', advError);
    return { servico: null, servicoId: null };
  }

  const servico = await carregarServico(advData.service_id, companyId);
  return { servico, servicoId: advData.service_id };
}

/**
 * Carrega uma tarefa pelo ID e aplica o enriquecimento visual
 */
export async function carregarTarefa(
  id: string,
  companyId?: string
): Promise<EnrichedTask | null> {
  let query = supabase
    .from('tasks')
    .select('*, projects(name), collaborators:responsavel_execucao_id(name)')
    .eq('id', id);

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data, error } = await query.returns<TaskDbRow[]>().maybeSingle();
  if (error || !data) {
    if (error) console.error('Erro ao carregar tarefa:', error);
    return null;
  }

  return enriquecerTarefa(
    data,
    data.projects?.name || null,
    data.collaborators?.name || null
  );
}

/**
 * Carrega um registro de cartório por ID e descobre o índice da página (base 0)
 * em que ele aparece na ordenação padrão da empresa (issue_date desc, created_at desc)
 */
export async function carregarRegistroCartorioEPagina(
  id: string,
  companyId: string,
  pageSize = 10
): Promise<{ record: CartorioRecord; page: number } | null> {
  const { data: record, error } = await supabase
    .from('cartorio_records')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle();

  if (error || !record) {
    if (error) console.error('Erro ao carregar registro de cartório:', error);
    return null;
  }

  // Contar registros que aparecem antes na ordenação (issue_date maior, ou mesma data e criado depois)
  const [resMaior, resMesmaData] = await Promise.all([
    supabase
      .from('cartorio_records')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gt('issue_date', record.issue_date),
    supabase
      .from('cartorio_records')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('issue_date', record.issue_date)
      .gt('created_at', record.created_at),
  ]);

  if (resMaior.error) console.error('Erro ao contar registros com issue_date maior:', resMaior.error);
  if (resMesmaData.error) console.error('Erro ao contar registros com mesma data:', resMesmaData.error);

  const countAntes = (resMaior.count || 0) + (resMesmaData.count || 0);
  const page = Math.floor(countAntes / pageSize);

  return {
    record: record as CartorioRecord,
    page,
  };
}
