import { supabase } from './supabaseClient';
import { Project, Collaborator } from '../types';

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

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ia';
  text: string;
  timestamp: string;
  cards?: ActionCardResult[];
}

function formatBRL(val?: number | null): string {
  if (val === undefined || val === null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
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
  const todayStr = new Date().toISOString().split('T')[0];

  for (const acao of acoes) {
    try {
      // 1. CADASTRAR COLABORADOR
      if (acao.tipo === 'CADASTRAR_COLABORADOR') {
        const nome = acao.dados.nome?.trim();
        if (!nome) continue;

        const { data: collab, error } = await (supabase as any)
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

        // Mapear obra pelo nome se o ID não veio direto
        let targetProjId = acao.dados.obra_id;
        if (!targetProjId && acao.dados.obra_nome) {
          const found = projects.find(
            (p) => p.name.toLowerCase().includes(acao.dados.obra_nome!.toLowerCase())
          );
          if (found) targetProjId = found.id;
        }
        if (!targetProjId && projects.length > 0) {
          targetProjId = projects[0].id;
        }

        // Mapear colaborador pelo nome se mencionado
        let targetCollabId = acao.dados.colaborador_id;
        if (!targetCollabId && acao.dados.colaborador_nome) {
          const foundC = collaborators.find(
            (c) => c.name.toLowerCase().includes(acao.dados.colaborador_nome!.toLowerCase())
          );
          if (foundC) targetCollabId = foundC.id;
        }

        // Insere o Serviço na tabela 'servicos'
        const { data: servico, error: sErr } = await (supabase as any)
          .from('servicos')
          .insert({
            company_id: companyId,
            created_by: userId,
            project_id: targetProjId || null,
            collaborator_id: targetCollabId || null,
            description: descricao,
            status: 'Em Andamento',
            start_date: todayStr,
            end_date: todayStr,
            total_value: valorTotal,
            observations: acao.dados.observacoes || `Criado via Copiloto IA (Chat/Voz)`,
          })
          .select()
          .single();

        if (sErr) throw sErr;

        // Se houver adiantamento, insere o registro na tabela 'adiantamentos'
        if (servico && valorAdiantamento > 0) {
          await (supabase as any).from('adiantamentos').insert({
            company_id: companyId,
            created_by: userId,
            service_id: servico.id,
            value: valorAdiantamento,
            payment_date: todayStr,
            description: 'Adiantamento inicial via Copiloto IA',
          });
        }

        const pName = projects.find((p) => p.id === targetProjId)?.name || 'Obra Geral';
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

        let targetProjId = acao.dados.obra_id;
        if (!targetProjId && acao.dados.obra_nome) {
          const found = projects.find(
            (p) => p.name.toLowerCase().includes(acao.dados.obra_nome!.toLowerCase())
          );
          if (found) targetProjId = found.id;
        }
        if (!targetProjId && projects.length > 0) {
          targetProjId = projects[0].id;
        }

        let targetCollabId = acao.dados.responsavel_id;
        if (!targetCollabId && acao.dados.responsavel_nome) {
          const foundC = collaborators.find(
            (c) => c.name.toLowerCase().includes(acao.dados.responsavel_nome!.toLowerCase())
          );
          if (foundC) targetCollabId = foundC.id;
        }

        const isPurchase = acao.dados.is_compra || (acao.dados.observacoes || '').includes('[COMPRA]');
        const dataPrev = acao.dados.data_prevista || todayStr;

        const { error: tErr } = await (supabase as any).from('tasks').insert({
          company_id: companyId,
          created_by: userId,
          project_id: targetProjId || null,
          responsavel_execucao_id: targetCollabId || null,
          title: titulo,
          description: isPurchase ? '[COMPRA] Material para compra/cotação' : '',
          data_inicio_prevista: dataPrev,
          data_fim_prevista: dataPrev,
          status: 'Planejada',
          prioridade: isPurchase ? 'Alta' : 'Média',
          observacoes: isPurchase ? '[COMPRA]' : null,
        });

        if (tErr) throw tErr;

        const pName = projects.find((p) => p.id === targetProjId)?.name || 'Obra Padrão';
        const respName = collaborators.find((c) => c.id === targetCollabId)?.name;

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

        let targetTaskId: string | null = tarefaId || null;
        let targetTaskTitle: string = termoBusca;

        // Se não veio tarefa_id direto, pesquisa nas tarefas abertas por aproximação
        if (!targetTaskId && termoBusca) {
          const { data: openTasks } = await (supabase as any)
            .from('tasks')
            .select('id, title')
            .eq('company_id', companyId)
            .neq('status', 'Concluída')
            .limit(100);

          if (openTasks && openTasks.length > 0) {
            const termoNorm = termoBusca.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            
            // 1. Match por substring direta
            const match = openTasks.find((t: any) => {
              const tNorm = (t.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              return tNorm.includes(termoNorm) || termoNorm.includes(tNorm);
            }) || openTasks.find((t: any) => {
              // 2. Match por qualquer palavra chave significativa (>= 4 letras)
              const words = termoNorm.split(/\s+/).filter((w: string) => w.length >= 4);
              const tNorm = (t.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              return words.some((w: string) => tNorm.includes(w));
            });

            if (match) {
              targetTaskId = match.id;
              targetTaskTitle = match.title;
            }
          }
        }

        if (targetTaskId) {
          const { error: updErr } = await (supabase as any)
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
        const termoBusca = (acao.dados as any).servico_nome?.trim() || '';
        const valorPago = Number((acao.dados as any).valor_pago) || 0;

        let targetServiceId: string | null = (acao.dados as any).servico_id || null;
        let targetServiceTitle: string = termoBusca;

        if (!targetServiceId && termoBusca) {
          const { data: openServices } = await (supabase as any)
            .from('servicos')
            .select('id, description')
            .eq('company_id', companyId)
            .eq('status', 'Em Andamento')
            .limit(50);

          if (openServices && openServices.length > 0) {
            const termoNorm = termoBusca.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const match = openServices.find((s: any) => {
              const sNorm = (s.description || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              return sNorm.includes(termoNorm) || termoNorm.includes(sNorm);
            });
            if (match) {
              targetServiceId = match.id;
              targetServiceTitle = match.description;
            }
          }
        }

        if (targetServiceId) {
          if (valorPago > 0) {
            await (supabase as any).from('adiantamentos').insert({
              company_id: companyId,
              created_by: userId,
              service_id: targetServiceId,
              value: valorPago,
              payment_date: todayStr,
              description: 'Quitação final via Copiloto IA',
            });
          }

          await (supabase as any)
            .from('servicos')
            .update({ status: 'Concluído' })
            .eq('id', targetServiceId);

          results.push({
            tipo: 'servico',
            badge: '✅ Serviço Quitado & Concluído',
            titulo: targetServiceTitle || 'Serviço Quitado',
            subtitulo: valorPago > 0 ? `Pagamento registrado: ${formatBRL(valorPago)}` : 'Status atualizado para Concluído',
            detalhes: 'Baixa efetuada pelo Copiloto IA',
            sucesso: true,
          });
        }
      }
    } catch (err: any) {
      console.error('Erro ao executar ação do Copiloto:', acao, err);
      results.push({
        tipo: 'erro',
        badge: '⚠️ Erro na Execução',
        titulo: `Falha ao processar ação: ${acao.tipo}`,
        subtitulo: err.message || 'Erro inesperado no banco de dados',
        sucesso: false,
      });
    }
  }

  return results;
}
